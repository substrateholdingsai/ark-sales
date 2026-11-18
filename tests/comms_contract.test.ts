// Contract-layer tests for the Ark Sales comms job contract (Step 4: G8).
// Covers campaigns.ts routes (dispatch / approve / receipt / pause / resume),
// processDispatch integration (guardrails -> send -> outcomes + usage_events +
// cap increments), approval fail-closed rules, receipt shape, no usage event
// for excluded sends, HSM template fail-closed (G6), and telnyxWebhook
// /messages inbound opt-out -> auto-DNC (G5).

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { campaignsRouter, processDispatch } from "../src/routes/campaigns";
import { telnyxRouter } from "../src/routes/telnyxWebhook";

// ------------------------------------------------------------------
// Mock D1 with basic WHERE filtering
// ------------------------------------------------------------------
type Row = Record<string, any>;

function parseValue(token: string): any {
  const t = token.trim();
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1);
  }
  if (t === "NULL") return null;
  if (t === "TRUE") return true;
  if (t === "FALSE") return false;
  const n = Number(t);
  return !isNaN(n) ? n : t;
}

function matchCondition(row: Row, col: string, op: string, val: any): boolean {
  const realCol = col.split(".").pop() ?? col;
  const cell = row[realCol];
  if (op.toUpperCase() === "IS NULL") return cell == null;
  if (op.toUpperCase() === "IS NOT NULL") return cell != null;
  if (op === "=") return cell == val;
  if (op === "!=") return cell != val;
  if (op === ">=") return cell >= val;
  if (op === "<=") return cell <= val;
  if (op === ">") return cell > val;
  if (op === "<") return cell < val;
  if (op.toUpperCase() === "LIKE") {
    const pattern = String(val).replace(/%/g, ".*").replace(/_/g, ".");
    return new RegExp(`^${pattern}$`, "i").test(String(cell ?? ""));
  }
  return true;
}

function whereFilter(rows: Row[], where: string, params: unknown[] = [], startIndex = 0): Row[] {
  if (!where) return rows;
  const conds = where
    .split(/\s+AND\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
  const result = rows.filter((row) => {
    let pIdx = startIndex;
    return conds.every((cond) => {
      const inM = cond.match(/^(\w+)\s+IN\s*\((.*)\)$/i);
      if (inM) {
        const vals = inM[2].split(",").map(parseValue);
        return vals.includes(row[inM[1]]);
      }
      const nullM = cond.match(/^(\w+)\s+(IS NOT NULL|IS NULL)$/i);
      if (nullM) {
        const [, col, op] = nullM;
        return op.toUpperCase() === "IS NULL" ? row[col] == null : row[col] != null;
      }
      const m = cond.match(/^([\w.]+)\s*(>=|<=|!=|=|>|<|LIKE)\s*(.+)$/i);
      if (!m) return true;
      const [, col, op, raw] = m;
      const val = raw.trim() === "?" ? params[pIdx++] : parseValue(raw);
      return matchCondition(row, col, op, val);
    });
  });
  return result;
}

function makeMockDb(tables: Record<string, Row[]> = {}) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const insertCalls: Array<{ sql: string; params: unknown[] }> = [];
  const data: Record<string, Row[]> = { ...tables };

  const prepare = vi.fn((sql: string) => {
    const sqlTrim = sql.trim().replace(/\s+/g, " ");
    const sqlLower = sqlTrim.toLowerCase();
    const isSelect = /^\s*select/i.test(sqlTrim);
    const isInsert = /^\s*insert/i.test(sqlTrim);
    const isUpdate = /^\s*update/i.test(sqlTrim);

    let targetTable: string | null = null;
    const tMatch = sqlTrim.match(/(?:from|into|update)\s+([a-z_][a-z0-9_]*)/i);
    if (tMatch) targetTable = tMatch[1].toLowerCase();

    const whereMatch = sqlTrim.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s*$)/i);
    const whereClauseRaw = whereMatch ? whereMatch[1].trim() : "";

    return {
      bind: vi.fn((...params: unknown[]) => {
        statements.push({ sql: sqlTrim, params });
        const whereClause = whereClauseRaw.replace(/\s+AND\s+EXISTS\s*\(SELECT[\s\S]*\)$/i, "");
        if (isInsert) {
          insertCalls.push({ sql: sqlTrim, params });
          if (targetTable) {
            if (!data[targetTable]) data[targetTable] = [];
            if (targetTable === "campaign_jobs") {
              data[targetTable].push({
                id: params[0],
                idempotency_key: params[1],
                tenant_id: params[2],
                sender_brand: params[3],
                channel: params[4],
                message_payload_json: params[5],
                audience_payload_json: params[6],
                schedule_json: params[7],
                status: "pending_approval",
              });
            } else if (targetTable === "campaign_job_targets") {
              data[targetTable].push({
                id: params[0],
                job_id: params[1],
                tenant_id: params[2],
                contact_id: params[3],
                channel: params[4],
                destination: params[5],
                status: "pending",
              });
            } else {
              data[targetTable].push({});
            }
          }
          return {
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          };
        }
        if (isUpdate) {
          const setMatch = sqlTrim.match(/SET\s+(.+?)(?:\s+WHERE|\s*$)/i);
          const setClauseRaw = setMatch ? setMatch[1] : "";
          const assignments: Array<[string, any]> = [];
          let pIdx = 0;
          for (const part of setClauseRaw.split(",")) {
            const m = part.trim().match(/^(\w+)\s*=\s*(.+)$/);
            if (m) {
              const col = m[1];
              const raw = m[2].trim();
              const val = raw === "?" ? params[pIdx++] : parseValue(raw);
              assignments.push([col, val]);
            }
          }
          const setParamCount = pIdx;
          const targetRows = targetTable ? whereFilter(data[targetTable] || [], whereClause, params, setParamCount) : [];
          for (const row of targetRows) {
            for (const [k, v] of assignments) row[k] = v;
          }
          return {
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: targetRows.length } }),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          };
        }
        if (isSelect && targetTable) {
          const rows = whereFilter(data[targetTable] || [], whereClause, params, 0);
          const countM = sqlLower.match(/count\(*\*\)*/i);
          if (targetTable === "usage_events" && sqlLower.includes("sum(total_cost_usd)")) {
            return {
              first: vi.fn().mockResolvedValue({
                total_cost_usd: rows.reduce((total, row) => total + Number(row.total_cost_usd || 0), 0),
                event_count: rows.length,
              }),
            };
          }
          return {
            run: vi.fn().mockResolvedValue({ success: true }),
            first: vi.fn().mockResolvedValue(countM ? { cnt: rows.length } : (rows[0] ?? null)),
            all: vi.fn().mockResolvedValue({ results: rows }),
          };
        }
        return { run: vi.fn().mockResolvedValue({ success: true }), first: vi.fn().mockResolvedValue(null) };
      }),
    };
  });

  const batch = async (items: Array<{ run: () => Promise<unknown> }>) => Promise.all(items.map((item) => item.run()));
  return { prepare, batch, statements, insertCalls, data };
}

const baseEnv: any = {
  DB: {} as any,
  STAYPUFT_API_KEY: "test-staypuft-key",
  CAMPAIGN_ALLOWED_TENANTS: "acc_1",
  ENVIRONMENT: "test",
  TELNYX_API_KEY: "test-telnyx-key",
  TELNYX_PHONE_NUMBER: "+525500000000",
  RESEND_API_KEY: "test-resend-key",
  RESEND_FROM_EMAIL: "ARK Systems <test@ark.com>",
};

function mountCampaignsApp(db: any) {
  const app = new Hono();
  app.route("/api/internal/campaigns", campaignsRouter as any);
  return app;
}

const nowPlus2h = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const nowMinus1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const contactRow: Row = {
  id: "ct_1",
  account_id: "acc_1",
  phone: "+525512345677",
  whatsapp: "+525512345678",
  email: "cliente@despacho.com",
  consent_status: "opt_in",
  contact_preferences_json: null,
  name: "Ana Cliente",
  tenant_id: "acc_1",
};
const accountRow: Row = { id: "acc_1", tenant_id: "acc_1" };
const repepVersionRow: Row = {
  id: "current",
  list_version: 1,
  cut_off_date: new Date(Date.now() - 86400000).toISOString(),
  expires_at: nowPlus2h,
  status: "active",
};

describe("Campaigns contract routes", () => {
  it("dispatch dry_run returns a pending job with counts + cost", async () => {
    const db = makeMockDb({
      sales_contacts: [contactRow],
      sales_accounts: [accountRow],
      crm_dnc_list: [],
      repep_list_version: [repepVersionRow],
      repep_list: [],
      contact_frequency_caps: [],
      whatsapp_hsm_templates: [
        { id: "tpl_1", tenant_id: "acc_1", template_name: "tpl_1", template_version: "1", language_code: "es-MX", variables_json: "[]", status: "approved" },
      ],
    });
    const app = mountCampaignsApp(db);
    const env = { ...baseEnv, DB: db };

    const res: any = await app.fetch(
      new Request("http://localhost/api/internal/campaigns/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-StayPuft-Key": "test-staypuft-key" },
        body: JSON.stringify({
          job_id: "job_prev_1",
          idempotency_key: "idem_prev_1",
          tenant_id: "acc_1",
          sender_brand: "ARK Test",
          channel: "whatsapp",
          audience: { mode: "explicit", contact_ids: ["ct_1"] },
          message: { template_id: "tpl_1", template_version: "1", language: "es-MX", variables: {} },
          schedule: { start_at: "2026-11-17T16:00:00Z" },
          dry_run: true,
        }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.status).toBe("pending_approval");
    expect(body.audience_total).toBe(1);
    expect(body.would_send).toBe(1);
    expect(body.excluded_by_rule).toEqual([]);
    expect(body.deferred).toBe(0);
    expect(body.cost_estimate.channel).toBe("whatsapp");
    expect(body.cost_estimate.unit_cost_usd).toBe(0.2);
    expect(body.cost_estimate.total_usd).toBe(0.2);
    expect(body.preview_ttl).toBeTruthy();
    const inserts = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO campaign_jobs"));
    expect(inserts.length).toBe(1);
  });

  it("dispatch creates job in pending_approval (no send)", async () => {
    const db = makeMockDb({
      sales_contacts: [contactRow],
      sales_accounts: [accountRow],
      crm_dnc_list: [],
      repep_list_version: [repepVersionRow],
      repep_list: [],
      contact_frequency_caps: [],
      whatsapp_hsm_templates: [
        { id: "tpl_1", tenant_id: "acc_1", template_name: "tpl_1", template_version: "1", language_code: "es-MX", variables_json: "[]", status: "approved" },
      ],
    });
    const app = mountCampaignsApp(db);
    const env = { ...baseEnv, DB: db };

    const res: any = await app.fetch(
      new Request("http://localhost/api/internal/campaigns/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-StayPuft-Key": "test-staypuft-key" },
        body: JSON.stringify({
          job_id: "job_create_1",
          idempotency_key: "idem_create_1",
          tenant_id: "acc_1",
          sender_brand: "ARK Test",
          channel: "whatsapp",
          audience: { mode: "explicit", contact_ids: ["ct_1"] },
          message: { template_id: "tpl_1", template_version: "1", language: "es-MX", variables: {} },
          schedule: { start_at: "2026-11-17T16:00:00Z" },
          dry_run: false,
        }),
      }),
      env,
    );
    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.status).toBe("pending_approval");
    const jobInserts = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO campaign_jobs"));
    const targetInserts = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO campaign_job_targets"));
    expect(jobInserts.length).toBe(1);
    expect(targetInserts.length).toBe(1);

    const res2: any = await app.fetch(
      new Request("http://localhost/api/internal/campaigns/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-StayPuft-Key": "test-staypuft-key" },
        body: JSON.stringify({
          job_id: "job_create_1",
          idempotency_key: "idem_create_1",
          tenant_id: "acc_1",
          sender_brand: "ARK Test",
          channel: "whatsapp",
          audience: { mode: "explicit", contact_ids: ["ct_1"] },
          message: { template_id: "tpl_1", template_version: "1", language: "es-MX", variables: {} },
          schedule: { start_at: "2026-11-17T16:00:00Z" },
          dry_run: false,
        }),
      }),
      env,
    );
    expect(res2.status).toBe(200);
    const body2: any = await res2.json();
    expect(body2.job_id).toBe("job_create_1");
    expect(body2.message).toContain("already exists");
    // Idempotency: no duplicate job row was inserted
    const jobInsertsAfter = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO campaign_jobs"));
    expect(jobInsertsAfter.length).toBe(1);
  });

  it("approve flips pending_approval -> approved and checks preview TTL", async () => {
    const db = makeMockDb({
      campaign_jobs: [
        {
          id: "job_1",
          status: "pending_approval",
          preview_ttl: nowPlus2h,
          preview_json: '{"preview_revision":"rev-1"}',
          tenant_id: "acc_1",
          channel: "whatsapp",
          sender_brand: "ARK",
        },
      ],
    });
    const app = mountCampaignsApp(db);
    const env = { ...baseEnv, DB: db };

    const res: any = await app.fetch(
      new Request("http://localhost/api/internal/campaigns/job_1/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-StayPuft-Key": "test-staypuft-key" },
        body: JSON.stringify({ approved_by: "pavel", preview_revision: "rev-1" }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.status).toBe("approved");
    const updates = db.statements.filter((s: any) => s.sql.includes("UPDATE campaign_jobs") && s.sql.includes("status = 'approved'"));
    expect(updates.length).toBeGreaterThan(0);
  });

  it("approve rejects expired preview (fail-closed)", async () => {
    const db = makeMockDb({
      campaign_jobs: [{ id: "job_2", status: "pending_approval", preview_ttl: nowMinus1h, tenant_id: "acc_1" }],
    });
    const app = mountCampaignsApp(db);
    const env = { ...baseEnv, DB: db };

    const res: any = await app.fetch(
      new Request("http://localhost/api/internal/campaigns/job_2/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-StayPuft-Key": "test-staypuft-key" },
        body: JSON.stringify({ approved_by: "pavel" }),
      }),
      env,
    );
    expect(res.status).toBe(409);
    const body: any = await res.json();
    expect(body.error).toContain("expirado");
  });

  it("approve rejects non-pending job (fail-closed)", async () => {
    const db = makeMockDb({
      campaign_jobs: [{ id: "job_3", status: "approved", preview_ttl: nowPlus2h, tenant_id: "acc_1" }],
    });
    const app = mountCampaignsApp(db);
    const env = { ...baseEnv, DB: db };

    const res: any = await app.fetch(
      new Request("http://localhost/api/internal/campaigns/job_3/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-StayPuft-Key": "test-staypuft-key" },
        body: JSON.stringify({ approved_by: "pavel" }),
      }),
      env,
    );
    expect(res.status).toBe(409);
  });

  it("receipt returns per-contact outcomes + summary shape", async () => {
    const db = makeMockDb({
      campaign_jobs: [{ id: "job_4", status: "completed", tenant_id: "acc_1" }],
      campaign_job_targets: [
        {
          id: "tgt_1",
          job_id: "job_4",
          contact_id: "ct_1",
          channel: "whatsapp",
          status: "sent",
          reason: null,
          provider_message_id: "msg_1",
          cost_usd: 0.2,
          sent_at: nowPlus2h,
        },
        {
          id: "tgt_2",
          job_id: "job_4",
          contact_id: "ct_2",
          channel: "whatsapp",
          status: "excluded",
          reason: "dnc",
          provider_message_id: null,
          cost_usd: 0,
          sent_at: null,
        },
      ],
      usage_events: [{ job_id: "job_4", status: "billable", total_cost_usd: 0.2 }],
    });
    const app = mountCampaignsApp(db);
    const env = { ...baseEnv, DB: db };

    const res: any = await app.fetch(
      new Request("http://localhost/api/internal/campaigns/job_4/receipt", {
        method: "POST",
        headers: { "X-StayPuft-Key": "test-staypuft-key" },
        body: JSON.stringify({ confirm_received: true }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.job_id).toBe("job_4");
    expect(body.tenant_id).toBe("acc_1");
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBe(2);
    expect(body.results[0]).toMatchObject({ contact_id: "ct_1", channel: "whatsapp", outcome: "sent", cost_usd: 0.2 });
    expect(body.results[1]).toMatchObject({ contact_id: "ct_2", channel: "whatsapp", outcome: "excluded", reason: "dnc" });
    expect(body.summary).toMatchObject({ sent: 1, excluded: 1, failed: 0, total_cost_usd: 0.2 });
    expect(body.message).toContain("confirmado");
  });

  it("pause then resume a job", async () => {
    const db = makeMockDb({ campaign_jobs: [{ id: "job_5", status: "approved", tenant_id: "acc_1" }] });
    const app = mountCampaignsApp(db);
    const env = { ...baseEnv, DB: db };

    const r1: any = await app.fetch(
      new Request("http://localhost/api/internal/campaigns/job_5/pause", { method: "POST", headers: { "X-StayPuft-Key": "test-staypuft-key" } }),
      env,
    );
    expect(r1.status).toBe(200);
    expect((await r1.json()).status).toBe("paused");

    const r2: any = await app.fetch(
      new Request("http://localhost/api/internal/campaigns/job_5/resume", { method: "POST", headers: { "X-StayPuft-Key": "test-staypuft-key" } }),
      env,
    );
    expect(r2.status).toBe(200);
    expect((await r2.json()).status).toBe("running");
  });
});

describe("processDispatch integration (guardrails -> send -> outcomes + usage_events + caps)", () => {
  let fetchMock: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T16:30:00Z"));
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: "msg_1" } }) });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends approved whatsapp job, writes usage_event + cap increment, no event for excluded", async () => {
    const db = makeMockDb({
      campaign_jobs: [
        {
          id: "job_int_1",
          preview_json: JSON.stringify({ eligible_contact_ids: ["ct_1", "ct_2"], deferred_contact_ids: [] }),
          status: "approved",
          tenant_id: "acc_1",
          channel: "whatsapp",
          message_payload_json: JSON.stringify({ template_id: "hsm_1", template_version: "1", language: "es-MX", variables: {} }),
          schedule_json: JSON.stringify({ start_at: "2026-11-17T16:00:00Z" }),
        },
      ],
      campaign_job_targets: [
        { id: "tgt_sent", job_id: "job_int_1", contact_id: "ct_1", channel: "whatsapp", destination: "+525512345678", status: "pending" },
        { id: "tgt_exc", job_id: "job_int_1", contact_id: "ct_2", channel: "whatsapp", destination: "+525512345679", status: "pending" },
      ],
      sales_contacts: [contactRow, { ...contactRow, id: "ct_2", whatsapp: "+525512345679" }],
      sales_accounts: [accountRow],
      crm_dnc_list: [{ phone: "+525512345679", email: "tel:+525512345679", tenant_id: null }],
      repep_list_version: [repepVersionRow],
      repep_list: [],
      contact_frequency_caps: [],
      whatsapp_hsm_templates: [
        {
          id: "hsm_1",
          tenant_id: "acc_1",
          template_name: "tpl_1",
          template_version: "1",
          language_code: "es-MX",
          category: "utility",
          components_json: "[]",
          variables_json: "[]",
          status: "approved",
          meta_template_id: null,
          created_by_user_id: null,
        },
      ],
    });
    const env = { ...baseEnv, DB: db };

    const result = await processDispatch(env, "job_int_1");
    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);

    const usageInserts = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO usage_events"));
    expect(usageInserts.length).toBe(1);
    expect(usageInserts[0].params[4]).toBe("whatsapp");
    expect(usageInserts[0].params[6]).toBe(0.2);
    expect(usageInserts[0].params[7]).toBe(0.2);
    expect(usageInserts[0].params[8]).toBe("billable");

    const capInserts = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO contact_frequency_caps"));
    expect(capInserts.length).toBe(1);

    const sentUpdate = db.statements.find(
      (s: any) => s.sql.includes("UPDATE campaign_job_targets") && s.params.includes("tgt_sent") && s.sql.includes("status = 'sent'"),
    );
    const excUpdate = db.statements.find(
      (s: any) => s.sql.includes("UPDATE campaign_job_targets") && s.params.includes("tgt_exc") && s.params.includes("excluded"),
    );
    expect(sentUpdate).toBeTruthy();
    expect(excUpdate).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("unapproved job is never dispatched (fail-closed)", async () => {
    const db = makeMockDb({
      campaign_jobs: [{ id: "job_un", status: "pending_approval", tenant_id: "acc_1", channel: "whatsapp" }],
      campaign_job_targets: [{ id: "tgt_un", job_id: "job_un", contact_id: "ct_1", channel: "whatsapp", destination: "+525512345678", status: "pending" }],
    });
    const env = { ...baseEnv, DB: db };

    const result = await processDispatch(env, "job_un");
    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    const updates = db.statements.filter((s: any) => s.sql.includes("UPDATE campaign_job_targets"));
    expect(updates.length).toBe(0);
    const usageInserts = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO usage_events"));
    expect(usageInserts.length).toBe(0);
  });

  it("HSM template not approved -> fail-closed, no Telnyx call, no usage event", async () => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: "msg_x" } }) });
    vi.stubGlobal("fetch", fetchMock);

    const db = makeMockDb({
      campaign_jobs: [
        {
          id: "job_hsm",
          preview_json: JSON.stringify({ eligible_contact_ids: ["ct_1"], deferred_contact_ids: [] }),
          status: "approved",
          tenant_id: "acc_1",
          channel: "whatsapp",
          message_payload_json: JSON.stringify({ template_id: "hsm_draft", template_version: "1", language: "es-MX", variables: {} }),
          schedule_json: JSON.stringify({ start_at: "2026-11-17T16:00:00Z" }),
        },
      ],
      campaign_job_targets: [{ id: "tgt_hsm", job_id: "job_hsm", contact_id: "ct_1", channel: "whatsapp", destination: "+525512345678", status: "pending" }],
      sales_contacts: [contactRow],
      sales_accounts: [accountRow],
      crm_dnc_list: [],
      repep_list_version: [repepVersionRow],
      repep_list: [],
      contact_frequency_caps: [],
      whatsapp_hsm_templates: [
        {
          id: "hsm_draft",
          tenant_id: "acc_1",
          template_name: "tpl_draft",
          template_version: "1",
          language_code: "es-MX",
          category: "utility",
          components_json: "[]",
          variables_json: "[]",
          status: "draft",
          meta_template_id: null,
          created_by_user_id: null,
        },
      ],
    });
    const env = { ...baseEnv, DB: db };

    const result = await processDispatch(env, "job_hsm");
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    const usageInserts = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO usage_events"));
    expect(usageInserts.length).toBe(0);
    const failedUpdate = db.statements.find(
      (s: any) => s.sql.includes("UPDATE campaign_job_targets") && s.params.includes("tgt_hsm") && s.sql.includes("status = 'failed'"),
    );
    expect(failedUpdate).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("missing template -> fail-closed, no default fallback", async () => {
    const db = makeMockDb({
      campaign_jobs: [
        {
          id: "job_notpl",
          preview_json: JSON.stringify({ eligible_contact_ids: ["ct_1"], deferred_contact_ids: [] }),
          status: "approved",
          tenant_id: "acc_1",
          channel: "whatsapp",
          message_payload_json: JSON.stringify({ template_id: "", template_version: "1", language: "es-MX", variables: {} }),
          schedule_json: JSON.stringify({ start_at: "2026-11-17T16:00:00Z" }),
        },
      ],
      campaign_job_targets: [
        { id: "tgt_notpl", job_id: "job_notpl", contact_id: "ct_1", channel: "whatsapp", destination: "+525512345678", status: "pending" },
      ],
      sales_contacts: [contactRow],
      sales_accounts: [accountRow],
      crm_dnc_list: [],
      repep_list_version: [repepVersionRow],
      repep_list: [],
      contact_frequency_caps: [],
      whatsapp_hsm_templates: [],
    });
    const env = { ...baseEnv, DB: db };

    const result = await processDispatch(env, "job_notpl");
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
    const failedUpdate = db.statements.find(
      (s: any) => s.sql.includes("UPDATE campaign_job_targets") && s.sql.includes("status = 'failed'") && s.sql.includes("hsm_template_required"),
    );
    expect(failedUpdate).toBeTruthy();
  });
});

describe("telnyxWebhook POST /messages (G5 inbound opt-out -> auto-DNC)", () => {
  it("BAJA opt-out inserts phone into DNC and returns handled", async () => {
    const db = makeMockDb({ crm_dnc_list: [] });
    const env = { ...baseEnv, DB: db };
    const app = new Hono();
    app.route("/webhooks/telnyx", telnyxRouter as any);

    const res: any = await app.fetch(
      new Request("http://localhost/webhooks/telnyx/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { from: "+525512345678", text: "BAJA" } }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.action).toBe("opt_out_added_to_dnc");
    expect(body.phone_e164).toBe("+525512345678");

    const dncInserts = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO crm_dnc_list"));
    expect(dncInserts.length).toBeGreaterThan(0);
  });

  it("stop emailing opt-out inserts phone into DNC", async () => {
    const db = makeMockDb({ crm_dnc_list: [] });
    const env = { ...baseEnv, DB: db };
    const app = new Hono();
    app.route("/webhooks/telnyx", telnyxRouter as any);

    const res: any = await app.fetch(
      new Request("http://localhost/webhooks/telnyx/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { from: "+525512345678", text: "stop emailing" } }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    const dncInserts = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO crm_dnc_list"));
    expect(dncInserts.length).toBeGreaterThan(0);
  });

  it("non opt-out message is not added to DNC", async () => {
    const db = makeMockDb({ crm_dnc_list: [] });
    const env = { ...baseEnv, DB: db };
    const app = new Hono();
    app.route("/webhooks/telnyx", telnyxRouter as any);

    const res: any = await app.fetch(
      new Request("http://localhost/webhooks/telnyx/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { from: "+525512345678", text: "Estoy interesado, gracias" } }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.action).toBe("no_opt_out_detected");
    const dncInserts = db.insertCalls.filter((i: any) => i.sql.includes("INSERT INTO crm_dnc_list"));
    expect(dncInserts.length).toBe(0);
  });
});
