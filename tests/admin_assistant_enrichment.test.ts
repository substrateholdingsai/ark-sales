import { describe, it, expect } from "vitest";
import { app } from "../src/index";
import { ADMIN_TOOLS } from "../src/routes/adminAssistant";

describe("Admin AI Assistant & Contact Enrichment Suite", () => {
  it("ADMIN_TOOLS must contain all expected tools including enrich_contact", () => {
    const toolNames = ADMIN_TOOLS.map((t) => t.name);
    expect(toolNames).toContain("list_leads");
    expect(toolNames).toContain("create_lead");
    expect(toolNames).toContain("update_lead");
    expect(toolNames).toContain("delete_lead");
    expect(toolNames).toContain("send_email");
    expect(toolNames).toContain("trigger_voice_call");
    expect(toolNames).toContain("get_metrics");
    expect(toolNames).toContain("list_accounts");
    expect(toolNames).toContain("create_account");
    expect(toolNames).toContain("update_account");
    expect(toolNames).toContain("delete_account");
    expect(toolNames).toContain("list_contacts");
    expect(toolNames).toContain("create_contact");
    expect(toolNames).toContain("update_contact");
    expect(toolNames).toContain("delete_contact");
    expect(toolNames).toContain("enrich_contact");
    expect(toolNames).toContain("list_voice_campaigns");
    expect(toolNames).toContain("create_voice_campaign");
  });

  it("serves /admin-assistant.js widget bundle with HTTP 200", async () => {
    const res = await app.request("https://sales.arksystems.site/admin-assistant.js", {
      method: "GET",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/javascript");
    const text = await res.text();
    expect(text).toContain("__ARK_ADMIN_ASSISTANT_LOADED__");
    expect(text).toContain("Asistente AI");
  });

  it("rejects unauthenticated requests to /api/admin/assistant with 401", async () => {
    const res = await app.request("https://sales.arksystems.site/api/admin/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hola asistente" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated requests to /api/crm/contacts/ct_123/enrich with 401", async () => {
    const res = await app.request("https://sales.arksystems.site/api/crm/contacts/ct_123/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_apply: true }),
    });
    expect(res.status).toBe(401);
  });
});
