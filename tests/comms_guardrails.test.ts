import { describe, expect, it, vi } from "vitest";
import { GuardrailService } from "../src/services/guardrails";
import { UsageEventsService } from "../src/services/usage";
import { WhatsAppService } from "../src/services/whatsapp";
import { DncService } from "../src/services/dnc";

// Mock crypto.subtle.digest for REPEP phone hashing (preserve randomUUID)
const originalCrypto = (globalThis as any).crypto;
vi.stubGlobal("crypto", {
  ...originalCrypto,
  randomUUID: originalCrypto.randomUUID.bind(originalCrypto),
  subtle: {
    ...originalCrypto.subtle,
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
} as any);

// ------------------------------------------------------------------
// Mock D1 database helper
// ------------------------------------------------------------------
type MockTable = { name: string; rows: any[] };

function makeMockDb(tables: MockTable[] = []): any {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const tableMap = new Map(tables.map((t) => [t.name, t.rows]));

  const prepare = (sql: string) => {
    const normalizedSql = sql.trim();
    const isSelect = /^select/i.test(normalizedSql);
    const isInsert = /^insert/i.test(normalizedSql);
    const isUpdate = /^update/i.test(normalizedSql);

    const sqlLower = normalizedSql.toLowerCase();
    let targetTable: string | null = null;
    for (const t of tables) {
      if (
        sqlLower.includes(` from ${t.name.toLowerCase()} `) ||
        sqlLower.includes(` into ${t.name.toLowerCase()} `) ||
        sqlLower.includes(` update ${t.name.toLowerCase()} `)
      ) {
        targetTable = t.name;
        break;
      }
    }

    const bind = (...params: unknown[]) => {
      statements.push({ sql: normalizedSql, params });

      if (isInsert || isUpdate) {
        return {
          run: () => Promise.resolve({ success: true, meta: { changes: 1 } }),
          first: () => Promise.resolve(null),
        };
      }

      if (isSelect && targetTable) {
        const allRows = tableMap.get(targetTable) || [];
        return {
          run: () => Promise.resolve({ success: true }),
          first: () => Promise.resolve(allRows[0] ?? null),
          all: () => Promise.resolve({ results: allRows }),
        };
      }

      return {
        run: () => Promise.resolve({ success: true }),
        first: () => Promise.resolve(null),
      };
    };

    return { bind };
  };

  return { prepare: prepare as any, statements };
}

// ------------------------------------------------------------------
// GuardrailService tests (Step 1: G1-G5 + G9)
// ------------------------------------------------------------------
describe("GuardrailService (Step 1)", () => {
  describe("G1 Consent enforcement", () => {
    it("blocks send when consent_status is not opt_in", async () => {
      const db = makeMockDb([
        { name: "sales_contacts", rows: [{ id: "ct_1", consent_status: "opt_out", contact_preferences_json: null }] },
        { name: "sales_accounts", rows: [{ id: "acc_1", tenant_id: "acc_1" }] },
      ]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.checkConsent("ct_1", "whatsapp");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("consent_missing");
    });

    it("allows send when consent_status is opt_in", async () => {
      const db = makeMockDb([{ name: "sales_contacts", rows: [{ id: "ct_1", consent_status: "opt_in", contact_preferences_json: null }] }]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.checkConsent("ct_1", "whatsapp");
      expect(result.allowed).toBe(true);
    });

    it("respects per-channel consent override in contact_preferences_json", async () => {
      const db = makeMockDb([
        { name: "sales_contacts", rows: [{ id: "ct_1", consent_status: "opt_in", contact_preferences_json: JSON.stringify({ consent_whatsapp: "opt_out" }) }] },
      ]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.checkConsent("ct_1", "whatsapp");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("consent_missing");
    });
  });

  describe("G2 REPEP PROFECO (35-day validity)", () => {
    it("fails closed when no active REPEP version exists", async () => {
      const db = makeMockDb([]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.checkRepep("+525512345678", "whatsapp");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("repep_expired");
    });

    it("allows send when repep_list is empty (no matching suppression)", async () => {
      const db = makeMockDb([
        {
          name: "repep_list_version",
          rows: [
            {
              id: "current",
              list_version: 1,
              cut_off_date: new Date(Date.now() - 86400000).toISOString(),
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              status: "active",
            },
          ],
        },
        { name: "repep_list", rows: [] },
      ]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.checkRepep("+525512345678", "whatsapp");
      expect(result.allowed).toBe(true);
    });

    it("blocks expired or invalid active versions and stale matching entries", async () => {
      for (const expiresAt of ["2020-01-01", "invalid"]) {
        const db = makeMockDb([{ name: "repep_list_version", rows: [{ list_version: 1, cut_off_date: "2019-12-01", expires_at: expiresAt }] }]);
        expect((await new GuardrailService(db, {} as any).checkRepep("+525512345678", "whatsapp")).allowed).toBe(false);
      }
      const db = makeMockDb([
        {
          name: "repep_list_version",
          rows: [{ list_version: 1, cut_off_date: new Date(Date.now() - 86400000).toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString() }],
        },
        { name: "repep_list", rows: [{ id: "stale", expires_at: "2020-01-01" }] },
      ]);
      expect((await new GuardrailService(db, {} as any).checkRepep("+525512345678", "whatsapp")).allowed).toBe(false);
    });
  });

  describe("G3 Quiet hours 21:00–08:00 CDMX", () => {
    it("defers send at 22:00 CDMX (UTC-6 → 04:00 UTC)", async () => {
      const gs = new GuardrailService(null as any, {} as any);
      const result = gs.checkQuietHours("2026-11-17T04:00:00Z");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("quiet_hours");
      expect(result.deferred).toBe(true);
    });

    it("allows send at 10:00 CDMX (16:00 UTC)", async () => {
      const gs = new GuardrailService(null as any, {} as any);
      const result = gs.checkQuietHours("2026-11-17T16:00:00Z");
      expect(result.allowed).toBe(true);
    });

    it("defers send at 07:00 CDMX (13:00 UTC)", async () => {
      const gs = new GuardrailService(null as any, {} as any);
      const result = gs.checkQuietHours("2026-11-17T13:00:00Z");
      expect(result.allowed).toBe(false);
      expect(result.deferred).toBe(true);
    });
  });

  describe("G4 Per-contact frequency/weekly caps (durable)", () => {
    it("excludes contact over weekly cap", async () => {
      const db = makeMockDb([
        {
          name: "contact_frequency_caps",
          rows: [{ tenant_id: "acc_1", contact_id: "ct_1", channel: "whatsapp", week_start_date: "2026-11-16", sent_count: 10, max_per_week: 10 }],
        },
      ]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.checkFrequencyCap("acc_1", "ct_1", "whatsapp", "2026-11-16");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("frequency_cap");
    });

    it("allows send when under weekly cap", async () => {
      const db = makeMockDb([
        {
          name: "contact_frequency_caps",
          rows: [{ tenant_id: "acc_1", contact_id: "ct_1", channel: "whatsapp", week_start_date: "2026-11-16", sent_count: 3, max_per_week: 10 }],
        },
      ]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.checkFrequencyCap("acc_1", "ct_1", "whatsapp", "2026-11-16");
      expect(result.allowed).toBe(true);
    });
  });

  describe("G5 DNC / opt-out", () => {
    it("excludes contact in DNC email list", async () => {
      const db = makeMockDb([{ name: "crm_dnc_list", rows: [{ email: "baja@example.com", phone: null, tenant_id: null }] }]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.checkDnc({ contact_id: "ct_1", email: "baja@example.com", channel: "email" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("dnc");
    });

    it("excludes contact in DNC phone list", async () => {
      const db = makeMockDb([{ name: "crm_dnc_list", rows: [{ email: "tel:+525512345678", phone: "+525512345678", tenant_id: null }] }]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.checkDnc({ contact_id: "ct_1", phone_e164: "+525512345678", channel: "whatsapp" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("dnc");
    });

    it("allows contact not in DNC", async () => {
      const db = makeMockDb([{ name: "crm_dnc_list", rows: [] }]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.checkDnc({ contact_id: "ct_1", email: "clean@example.com", channel: "email" });
      expect(result.allowed).toBe(true);
    });
  });

  describe("G9 Tenant-scoped send enforcement", () => {
    it("excludes contact that does not belong to the job tenant", async () => {
      const db = makeMockDb([
        { name: "sales_contacts", rows: [{ id: "ct_1", consent_status: "opt_in", contact_preferences_json: null, account_id: "acc_other" }] },
        { name: "sales_accounts", rows: [{ id: "acc_other", tenant_id: "acc_other" }] },
      ]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.verifyTenant("acc_1", "ct_1");
      expect(result).toBe(false);
    });

    it("allows contact that belongs to the job tenant", async () => {
      const db = makeMockDb([
        { name: "sales_contacts", rows: [{ id: "ct_1", consent_status: "opt_in", contact_preferences_json: null, account_id: "acc_1" }] },
        { name: "sales_accounts", rows: [{ id: "acc_1", tenant_id: "acc_1" }] },
      ]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.verifyTenant("acc_1", "ct_1");
      expect(result).toBe(true);
    });
  });

  describe("evaluateContact integration (full guardrail layer)", () => {
    it("blocks send when any guardrail fails (consent missing)", async () => {
      const db = makeMockDb([
        { name: "sales_contacts", rows: [{ id: "ct_1", consent_status: "opt_out", contact_preferences_json: null }] },
        { name: "sales_accounts", rows: [{ id: "acc_1", tenant_id: "acc_1" }] },
        { name: "crm_dnc_list", rows: [] },
        {
          name: "repep_list_version",
          rows: [
            {
              id: "current",
              list_version: 1,
              cut_off_date: new Date(Date.now() - 86400000).toISOString(),
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              status: "active",
            },
          ],
        },
        { name: "repep_list", rows: [] },
        { name: "contact_frequency_caps", rows: [] },
      ]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.evaluateContact(
        "acc_1",
        {
          contact_id: "ct_1",
          phone_e164: "+525512345678",
          channel: "whatsapp",
        },
        "2026-11-17T16:00:00Z",
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("consent_missing");
    });

    it("allows send when all guardrails pass", async () => {
      const db = makeMockDb([
        { name: "sales_contacts", rows: [{ id: "ct_1", consent_status: "opt_in", contact_preferences_json: null }] },
        { name: "sales_accounts", rows: [{ id: "acc_1", tenant_id: "acc_1" }] },
        { name: "crm_dnc_list", rows: [] },
        {
          name: "repep_list_version",
          rows: [
            {
              id: "current",
              list_version: 1,
              cut_off_date: new Date(Date.now() - 86400000).toISOString(),
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              status: "active",
            },
          ],
        },
        { name: "repep_list", rows: [] },
        { name: "contact_frequency_caps", rows: [] },
      ]);
      const gs = new GuardrailService(db, {} as any);
      const result = await gs.evaluateContact(
        "acc_1",
        {
          contact_id: "ct_1",
          phone_e164: "+525512345678",
          channel: "whatsapp",
        },
        "2026-11-17T16:00:00Z",
      );
      expect(result.allowed).toBe(true);
    });
  });
});

// ------------------------------------------------------------------
// UsageEventsService tests (Step 2: G7)
// ------------------------------------------------------------------
describe("UsageEventsService (Step 2: G7)", () => {
  it("writes a billable usage event for a sent message", async () => {
    const db = makeMockDb([{ name: "usage_events", rows: [] }]);
    const ues = new UsageEventsService(db);
    await ues.write({
      jobId: "job_1",
      tenantId: "acc_1",
      contactId: "ct_1",
      channel: "whatsapp",
      units: 1,
      status: "billable",
    });
    const insertCalls = db.statements.filter((s: any) => s.sql.includes("INSERT INTO usage_events"));
    expect(insertCalls.length).toBeGreaterThan(0);
  });

  it("computes total cost for a job", async () => {
    const db = makeMockDb([{ name: "usage_events", rows: [{ total_cost_usd: 0.4, event_count: 2 }] }]);
    const ues = new UsageEventsService(db);
    const total = await ues.totalForJob("job_1");
    expect(total.totalCostUsd).toBe(0.4);
    expect(total.eventCount).toBe(2);
  });

  it("unit cost for WhatsApp is 0.20", () => {
    const ues = new UsageEventsService(null as any);
    expect(ues.getUnitCostUsd("whatsapp")).toBe(0.2);
    expect(ues.getUnitCostUsd("voice")).toBe(0.25);
    expect(ues.getUnitCostUsd("sms")).toBe(0.15);
    expect(ues.getUnitCostUsd("email")).toBe(0.06);
  });

  it("writes zero-cost audit event for failed sends", async () => {
    const db = makeMockDb([{ name: "usage_events", rows: [] }]);
    const ues = new UsageEventsService(db);
    await ues.write({
      jobId: "job_1",
      tenantId: "acc_1",
      contactId: "ct_1",
      channel: "whatsapp",
      units: 0,
      status: "audit_zero",
    });
    const insertCalls = db.statements.filter((s: any) => s.sql.includes("INSERT INTO usage_events"));
    expect(insertCalls.length).toBeGreaterThan(0);
    // Verify the bind params include status = 'audit_zero'
    const insertCall = insertCalls[0];
    expect(insertCall.params[8]).toBe("audit_zero"); // status is the 9th param (index 8)
  });
});

// ------------------------------------------------------------------
// WhatsAppService tests (Step 3: G6)
// ------------------------------------------------------------------
describe("WhatsAppService (Step 3: G6)", () => {
  it("rejects send when TELNYX_API_KEY not configured", async () => {
    const ws = new WhatsAppService({} as any);
    const result = await ws.send({ to: "+525512345678", templateName: "test_template" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("TELNYX_API_KEY_NOT_CONFIGURED");
  });

  it("rejects invalid phone number", async () => {
    const ws = new WhatsAppService({ TELNYX_API_KEY: "key" } as any);
    const result = await ws.send({ to: "invalid", templateName: "test_template" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("INVALID_PHONE_NUMBER");
  });

  it("unit cost is 0.20", () => {
    const ws = new WhatsAppService({} as any);
    expect(ws.getUnitCostUsd()).toBe(0.2);
  });
});

// ------------------------------------------------------------------
// DncService phone support tests (G5)
// ------------------------------------------------------------------
describe("DncService phone support (G5)", () => {
  it("isBlockedByPhone finds phone in DNC list", async () => {
    const db = makeMockDb([{ name: "crm_dnc_list", rows: [{ phone: "+525512345678", email: "tel:+525512345678" }] }]);
    const dnc = new DncService(db);
    const result = await dnc.isBlockedByPhone("+525512345678");
    expect(result).toBe(true);
  });

  it("isBlockedByPhone returns false when phone not in DNC", async () => {
    const db = makeMockDb([{ name: "crm_dnc_list", rows: [] }]);
    const dnc = new DncService(db);
    const result = await dnc.isBlockedByPhone("+525512345678");
    expect(result).toBe(false);
  });

  it("add stores phone-only DNC entry with synthetic email", async () => {
    const db = makeMockDb([{ name: "crm_dnc_list", rows: [] }]);
    const dnc = new DncService(db);
    await dnc.add("", "opt_out", undefined, "+525512345678");
    const insertCalls = db.statements.filter((s: any) => s.sql.includes("INSERT INTO crm_dnc_list"));
    expect(insertCalls.length).toBeGreaterThan(0);
  });
});
