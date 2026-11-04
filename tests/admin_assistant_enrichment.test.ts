import { describe, it, expect } from "vitest";
import { app } from "../src/index";
import { ADMIN_TOOLS, runDeterministicFallback } from "../src/routes/adminAssistant";

describe("Admin AI Assistant & Contact Enrichment Suite", () => {
  it("ADMIN_TOOLS must contain the top 5 high-impact tools", () => {
    const toolNames = ADMIN_TOOLS.map((t) => t.name);
    expect(toolNames).toHaveLength(5);
    expect(toolNames).toContain("get_metrics");
    expect(toolNames).toContain("list_contacts");
    expect(toolNames).toContain("enrich_contact");
    expect(toolNames).toContain("create_lead");
    expect(toolNames).toContain("send_email");
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

  it("runDeterministicFallback answers database access query gracefully", async () => {
    const mockEnv: any = {};
    const fallback = await runDeterministicFallback(
      "Hola! ya tienes acceso a la base de datos?",
      null,
      mockEnv,
      { role: "admin", sub: "u_1" }
    );
    expect(fallback.reply).toContain("Conectado");
  });

  it("runDeterministicFallback answers metrics query gracefully", async () => {
    const mockEnv: any = {};
    const fallback = await runDeterministicFallback(
      "Dame las métricas del crm",
      null,
      mockEnv,
      { role: "admin", sub: "u_1" }
    );
    expect(fallback.reply).toContain("Métricas");
  });
});
