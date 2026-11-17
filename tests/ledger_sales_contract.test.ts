import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import { Hono } from "hono";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { campaignsRouter, processDispatch } from "../src/routes/campaigns";

class Statement {
  constructor(
    private db: Database,
    readonly sql: string,
    private params: SqlValue[] = [],
  ) {}

  bind(...params: SqlValue[]) {
    return new Statement(this.db, this.sql, params);
  }

  async all() {
    const statement = this.db.prepare(this.sql, this.params);
    try {
      const results: Record<string, SqlValue>[] = [];
      while (statement.step()) results.push(statement.getAsObject());
      return { results, success: true };
    } finally {
      statement.free();
    }
  }

  async first() {
    return (await this.all()).results[0] ?? null;
  }

  async run() {
    this.db.run(this.sql, this.params);
    return { success: true, meta: { changes: this.db.getRowsModified() } };
  }
}

class TestD1 {
  constructor(readonly db: Database) {}

  prepare(sql: string) {
    return new Statement(this.db, sql);
  }

  async batch(statements: Statement[]) {
    this.db.run("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.run("COMMIT");
      return results;
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }
}

const ledgerRoot = process.env.LEDGER_COMMS_PATH;
const testKey = "synthetic-internal-key";
let salesDb: TestD1;
let ledgerDb: TestD1;
let salesEnv: Record<string, unknown>;
let app: Hono;
let sqlite: Awaited<ReturnType<typeof initSqlJs>>;

beforeAll(async () => {
  sqlite = await initSqlJs();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T16:30:00Z"));
  salesDb = new TestD1(new sqlite.Database());
  salesDb.db.run(`
    CREATE TABLE sales_accounts (id TEXT PRIMARY KEY, tenant_id TEXT);
    CREATE TABLE sales_contacts (id TEXT PRIMARY KEY, account_id TEXT, phone TEXT, whatsapp TEXT, email TEXT,
      consent_status TEXT, contact_preferences_json TEXT, name TEXT);
    CREATE TABLE crm_dnc_list (id TEXT PRIMARY KEY, tenant_id TEXT, email TEXT UNIQUE, phone TEXT, reason TEXT, created_at TEXT);
  `);
  salesDb.db.run(readFileSync(resolve("migrations", "0027_comms_job_contract.sql"), "utf8"));
  salesDb.db.run("INSERT INTO sales_accounts VALUES ('account-1', 'tenant-1')");
  salesDb.db.run("INSERT INTO sales_contacts VALUES ('sales-1', 'account-1', '+525512345677', '+525512345678', 'test@example.test', 'opt_in', NULL, 'Ana')");
  salesDb.db.run(
    "INSERT INTO repep_list_version (id, list_version, cut_off_date, expires_at, status) VALUES ('current', 1, '2026-11-01', '2026-12-01', 'active')",
  );
  salesDb.db.run(
    `INSERT INTO whatsapp_hsm_templates (id, tenant_id, template_name, template_version, language_code, components_json, variables_json, status)
     VALUES ('template-1', 'tenant-1', 'bienvenida', '1', 'es-MX', '[{"type":"BODY","text":"Hola {{nombre}}"}]', '["nombre"]', 'approved')`,
  );
  ledgerDb = new TestD1(new sqlite.Database());
  ledgerDb.db.run(
    "CREATE TABLE leads_ark_tools (id TEXT PRIMARY KEY, tenant_id TEXT, is_demo INTEGER, arkangel_share_consent INTEGER, consent_accepted_at TEXT)",
  );
  if (ledgerRoot) ledgerDb.db.run(readFileSync(resolve(ledgerRoot, "migrations", "0017_canaco_comms_jobs.sql"), "utf8"));
  salesEnv = {
    DB: salesDb,
    ENVIRONMENT: "production",
    STAYPUFT_API_KEY: testKey,
    TELNYX_API_KEY: "synthetic",
    TELNYX_PHONE_NUMBER: "+525500000000",
    RESEND_API_KEY: "synthetic",
    RESEND_FROM_EMAIL: "test@example.test",
  };
  app = new Hono();
  app.route("/api/internal/campaigns", campaignsRouter);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  salesDb.db.close();
  ledgerDb.db.close();
});

async function salesRequest(path: string, method: string, body?: unknown) {
  return app.fetch(
    new Request(`https://synthetic-sales.test/api/internal/campaigns${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-StayPuft-Key": testKey },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    salesEnv,
  );
}

async function previewAndApprove(channel: "whatsapp" | "email") {
  const response = await salesRequest("/dispatch", "POST", {
    job_id: "job-1",
    idempotency_key: "key-1",
    tenant_id: "tenant-1",
    sender_brand: "CANACO",
    channel,
    audience: { mode: "explicit", contact_ids: ["sales-1"] },
    message: channel === "email" ? { subject: "Aviso", body: "Saludos" } : { template_id: "template-1", variables: { nombre: "Ana" } },
    dry_run: true,
  });
  expect(response.status).toBe(200);
  const preview = (await response.json()) as { deferred: number };
  const approval = await salesRequest("/job-1/approve", "POST", {});
  expect(approval.status).toBe(200);
  return preview;
}

describe("Sales dispatch with SQLite", () => {
  it("rejects unapproved templates and missing or invalid variables before preview", async () => {
    const body = {
      job_id: "job-1",
      idempotency_key: "key-1",
      tenant_id: "tenant-1",
      sender_brand: "CANACO",
      channel: "whatsapp",
      audience: { mode: "explicit", contact_ids: ["sales-1"] },
      message: { template_id: "template-1", variables: { nombre: "" } },
      dry_run: true,
    };
    expect((await salesRequest("/dispatch", "POST", body)).status).toBe(400);
    body.message.variables.nombre = "Ana";
    salesDb.db.run("UPDATE whatsapp_hsm_templates SET status = 'draft' WHERE id = 'template-1'");
    expect((await salesRequest("/dispatch", "POST", body)).status).toBe(400);
    salesDb.db.run("UPDATE whatsapp_hsm_templates SET status = 'approved', variables_json = 'invalid' WHERE id = 'template-1'");
    expect((await salesRequest("/dispatch", "POST", body)).status).toBe(400);
    expect((await salesDb.prepare("SELECT * FROM campaign_jobs").all()).results).toEqual([]);
  });

  it("uses email destinations and fails closed without Resend credentials", async () => {
    delete salesEnv.RESEND_API_KEY;
    const fetchMock = vi.fn(() => {
      throw new Error("Unexpected provider call");
    });
    vi.stubGlobal("fetch", fetchMock);
    await previewAndApprove("email");
    expect(await salesDb.prepare("SELECT destination FROM campaign_job_targets").first()).toEqual({ destination: "test@example.test" });
    expect(await processDispatch(salesEnv as never, "job-1")).toMatchObject({ processed: 1, succeeded: 0, failed: 1 });
    expect(await salesDb.prepare("SELECT status, reason FROM campaign_job_targets").first()).toEqual({
      status: "failed",
      reason: "RESEND_API_KEY_NOT_CONFIGURED",
    });
    expect(await salesDb.prepare("SELECT status, total_cost_usd FROM usage_events").first()).toEqual({ status: "audit_zero", total_cost_usd: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defers during quiet hours and retries only in the sending window", async () => {
    vi.setSystemTime(new Date("2026-11-18T04:00:00Z"));
    const provider = vi.fn(async () => Response.json({ id: "synthetic-email-id" }));
    vi.stubGlobal("fetch", provider);
    const preview = await previewAndApprove("email");
    expect(preview.deferred).toBe(1);
    await processDispatch(salesEnv as never, "job-1");
    expect(await salesDb.prepare("SELECT status FROM campaign_job_targets").first()).toEqual({ status: "deferred" });
    expect(provider).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-11-18T14:00:00Z"));
    expect(await processDispatch(salesEnv as never, "job-1")).toMatchObject({ succeeded: 1 });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("does not send to a changed destination", async () => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    await previewAndApprove("email");
    salesDb.db.run("UPDATE sales_contacts SET email = 'changed@example.test' WHERE id = 'sales-1'");
    await processDispatch(salesEnv as never, "job-1");
    expect(await salesDb.prepare("SELECT status, reason FROM campaign_job_targets").first()).toEqual({
      status: "excluded",
      reason: "destination_changed",
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("rechecks phone DNC at send time even for email", async () => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    await previewAndApprove("email");
    salesDb.db.run("INSERT INTO crm_dnc_list (id, email, phone, reason) VALUES ('dnc-1', 'tel:+525512345677', '+525512345677', 'opt_out')");
    await processDispatch(salesEnv as never, "job-1");
    expect(await salesDb.prepare("SELECT status, reason FROM campaign_job_targets").first()).toEqual({ status: "excluded", reason: "dnc" });
    expect(provider).not.toHaveBeenCalled();
  });

  it("does not bill a provider response without a message ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    );
    await previewAndApprove("email");
    await processDispatch(salesEnv as never, "job-1");
    expect(await salesDb.prepare("SELECT status, reason FROM campaign_job_targets").first()).toEqual({
      status: "failed",
      reason: "RESEND_INVALID_RESPONSE",
    });
    expect(await salesDb.prepare("SELECT status, total_cost_usd FROM usage_events").first()).toEqual({ status: "audit_zero", total_cost_usd: 0 });
  });

  it("rejects Voice and SMS instead of recording simulated sends", async () => {
    for (const channel of ["voice", "sms"]) {
      const response = await salesRequest("/dispatch", "POST", {
        job_id: "job-1",
        idempotency_key: "key-1",
        tenant_id: "tenant-1",
        sender_brand: "CANACO",
        channel,
        audience: { mode: "explicit", contact_ids: ["sales-1"] },
        message: { script: "Hola" },
        dry_run: true,
      });
      expect(response.status).toBe(400);
    }
    expect((await salesDb.prepare("SELECT * FROM usage_events").all()).results).toEqual([]);
    expect((await salesDb.prepare("SELECT * FROM campaign_job_targets").all()).results).toEqual([]);
  });
});

describe.skipIf(!ledgerRoot)("Ledger to Sales contract (set LEDGER_COMMS_PATH)", () => {
  it("lists templates and creates, previews, approves, dispatches and records the canonical receipt", async () => {
    const ledgerModulePath = resolve(ledgerRoot!, "src", "server", "canacoCommsApi.ts");
    vi.doMock(resolve(ledgerRoot!, "src", "server", "auth.ts"), () => ({ requireTenantMembership: vi.fn() }));
    const { handleCanacoCommsApiRequest } = await import(/* @vite-ignore */ ledgerModulePath);
    ledgerDb.db.run("INSERT INTO leads_ark_tools VALUES ('ledger-1', 'tenant-1', 0, 1, '2026-01-01')");
    ledgerDb.db.run("INSERT INTO canaco_comms_contact_mappings VALUES ('tenant-1', 'ledger-1', 'sales-1')");
    const ledgerEnv = {
      ARK_TOOLS_DB: ledgerDb,
      SALES_WORKER_URL: "https://synthetic-sales.test",
      SALES_WORKER_INTERNAL_KEY: testKey,
      CANACO_SALES_TENANT_ID: "tenant-1",
    };
    const principal = { id: "admin", email: "pavel@arksystems.site", fullName: "Admin", platformRole: "user" };
    const provider = vi.fn(async () => Response.json({ data: { id: "synthetic-provider-id" } }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const target = new URL(url);
        if (target.hostname === "synthetic-sales.test") return app.fetch(new Request(target, init), salesEnv);
        if (target.hostname === "api.telnyx.com") return provider();
        throw new Error(`Unexpected external request: ${target.hostname}`);
      }),
    );
    const ledger = (path: string, method = "GET", body?: unknown) =>
      handleCanacoCommsApiRequest(
        new Request(`https://synthetic-ledger.test${path}`, {
          method,
          ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
        }),
        ledgerEnv,
        {},
        principal,
      );
    const templates = await ledger("/api/comms/templates");
    expect(await templates.json()).toMatchObject({
      templates: [{ id: "template-1", template_name: "bienvenida", language_code: "es-MX", variables_json: '["nombre"]' }],
    });
    const previewResponse = await ledger("/api/comms/jobs", "POST", {
      channel: "whatsapp",
      contact_ids: ["ledger-1"],
      idempotency_key: "synthetic-idempotency-key",
      template_id: "template-1",
      variables: { nombre: "Ana" },
      dry_run: true,
    });
    const preview = await previewResponse.json();
    expect(previewResponse.status).toBe(200);
    expect(preview).toMatchObject({ status: "pending_approval", audience_total: 1, would_send: 1 });
    expect(await salesDb.prepare("SELECT contact_id, destination FROM campaign_job_targets WHERE job_id = ?").bind(preview.job_id).first()).toEqual({
      contact_id: "sales-1",
      destination: "+525512345678",
    });
    const approval = await ledger(`/api/comms/jobs/${preview.job_id}/approve`, "POST");
    expect(approval.status).toBe(200);
    expect(await processDispatch(salesEnv as never, preview.job_id)).toMatchObject({ processed: 1, succeeded: 1 });
    expect(provider).toHaveBeenCalledTimes(1);
    salesDb.db.run("UPDATE campaign_job_targets SET cost_usd = 99 WHERE job_id = ?", [preview.job_id]);
    const receipt = await ledger(`/api/comms/jobs/${preview.job_id}/receipt`, "POST", {
      results: [{ outcome: "forged" }],
      summary: { total_cost_usd: 9999 },
    });
    const actual = await receipt.json();
    expect(actual).toMatchObject({
      results: [{ contact_id: "sales-1", outcome: "sent" }],
      summary: { sent: 1, total_cost_usd: 0.2 },
      usage: { billable_events: 1, total_cost_usd: 0.2 },
    });
    const stored = await ledgerDb.prepare("SELECT receipt_json FROM canaco_comms_jobs WHERE job_id = ?").bind(preview.job_id).first();
    expect(JSON.parse(String(stored?.receipt_json))).toEqual(actual);
  });
});
