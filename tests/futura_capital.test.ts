import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PreSendGate } from "../src/services/gate";
import { interpolateTemplate } from "../src/routes/superadmin";
import { ToolExecutor } from "../src/tools";
import { SYSTEM_PROMPTS, AGENT_GUARDRAILS } from "../src/agents/prompts";
import app from "../src/index";

describe("Tenant Onboarding: Futura Capital Partners (0014_tenant_futura_capital.sql)", () => {
  const sqlPath = join(process.cwd(), "migrations", "0014_tenant_futura_capital.sql");
  const sqlContent = readFileSync(sqlPath, "utf-8");

  it("debe registrar el tenant acc_futura_capital y a los 3 ejecutivos reales (Enrique Xacur, Jaqueline Madera y Jaime)", () => {
    expect(sqlContent).toContain("'acc_futura_capital'");
    expect(sqlContent).toContain("'enrique@futuracapital.mx'");
    expect(sqlContent).toContain("'+529992182895'");
    expect(sqlContent).toContain("Jaqueline Madera");
    expect(sqlContent).toContain("'+529993817508'");
    expect(sqlContent).toContain("'+525639241169'");
    expect(sqlContent).toContain("Calle 20 #109A");
  });

  it("debe incluir los 9 desarrollos activos en sales_config con m², MSI, cashback, rentas garantizadas y mapas reales", () => {
    const expectedKeys = [
      "futura_recoleta",
      "futura_soletta_chicxulub",
      "futura_soletta_sisal",
      "futura_azureno",
      "futura_aldea_balha",
      "futura_logistic_park",
      "futura_mb_medical_tower",
      "futura_the_mb_hotel",
      "futura_paseos_temozon",
    ];
    for (const key of expectedKeys) {
      expect(sqlContent).toContain(`'${key}'`);
    }
    expect(sqlContent).toContain("133 m²");
    expect(sqlContent).toContain("180 m del mar");
    expect(sqlContent).toContain("Christus Muguerza");
    expect(sqlContent).toContain("2863-2023");
    expect(sqlContent).toContain("Escritura 2130");
  });

  it("NUNCA debe exponer porcentajes de comisión de broker ni cuentas bancarias dentro de sales_config", () => {
    const cleanSql = sqlContent.replace(/--.*$/gm, "");
    const salesConfigInserts = cleanSql.match(/INSERT OR REPLACE INTO sales_config[\s\S]*?\);/gi) || [];
    expect(salesConfigInserts.length).toBe(9);
    for (const stmt of salesConfigInserts) {
      expect(stmt.toLowerCase()).not.toContain("comision");
      expect(stmt.toLowerCase()).not.toContain("comisión");
      expect(stmt.toLowerCase()).not.toContain("cuentabanco");
    }
  });

  it("debe resguardar los contratos, cuentas bancarias y los 2 desarrollos pausados (Velamar y Rosa Palmar) en tenant_commission_rules", () => {
    expect(sqlContent).toContain("'comm_futura_velamar'");
    expect(sqlContent).toContain("'comm_futura_rosa_palmar'");
    expect(sqlContent).toContain("'pausado'");
    expect(sqlContent).toContain("cuenta_banco_url");
    expect(sqlContent).toContain("contrato_url");
  });

  it("debe registrar el Playbook Oficial de Objeciones en tenant_objection_playbooks", () => {
    expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS tenant_objection_playbooks");
    expect(sqlContent).toContain("Fideicomiso F/5803");
    expect(sqlContent).toContain("MBSP Rentas");
    expect(sqlContent).toContain("10 años al 7% anual");
  });

  it("la plantilla HTML de Futura Capital debe pasar el PreSendGate de Harvey sin violaciones", () => {
    const subject = "Futura Capital: Ficha de inversión {{desarrollo_nombre}} para {{contacto_nombre}}";
    const match = sqlContent.match(/'<!DOCTYPE html>[\s\S]*?<\/html>'/);
    expect(match).toBeTruthy();
    const rawHtml = match![0].slice(1, -1);

    const vars = {
      contacto_nombre: "Ing. Carlos Méndez",
      desarrollo_nombre: "Soletta Sisal",
      desarrolladora: "GRUPO LINMEX",
      ubicacion: "Sisal, Yucatán",
      precio_mxn: "$1,034,880 MXN",
      enganche_pct: "20% ($206,976 MXN)",
      fecha_entrega: "MAY 2028",
      clabe_stp: "646180123456789012",
      monto_apartado: "$20,000.00 MXN",
      agenda_url: "https://futuracapital.mx",
    };

    const renderedSub = interpolateTemplate(subject, vars);
    const renderedHtml = interpolateTemplate(rawHtml, vars);
    const gate = PreSendGate.check(renderedSub, renderedHtml);
    expect(gate.ok).toBe(true);
    expect(gate.reasons).toEqual([]);
  });

  it("debe registrar las señales de cosecha inmobiliaria en signal_catalog y las 4 cohortes de Futura Capital", () => {
    expect(sqlContent).toContain("'SENAL_BROKER_INMOBILIARIO'");
    expect(sqlContent).toContain("'SENAL_SALUD_ESPECIALISTA'");
    expect(sqlContent).toContain("'SENAL_LOGISTICA_CEDIS'");
    expect(sqlContent).toContain("'SENAL_INVERSION_PATRIMONIAL'");
    expect(sqlContent).toContain("'WHATSAPP_CORPORATIVO'");
    expect(sqlContent).toContain("'futura_medicos_merida'");
    expect(sqlContent).toContain("'futura_logistica_progreso'");
    expect(sqlContent).toContain("'futura_brokers_aliados'");
  });

  it("ToolExecutor.diagnosticarDespacho debe enrutar leads de Futura Capital al closer con sus desarrollos exactos", () => {
    const executor = new ToolExecutor({} as any);
    const diag = executor.diagnosticarDespacho("inversion_consultorio_medico", "11-30", ["futura_mb_medical_tower"]);
    expect(diag.especialista_asignado).toBe("closer");
    expect(diag.productos_recomendados).toContain("futura_mb_medical_tower");
    expect(diag.dolor_detectado).toBe("inversion_consultorio_medico");
  });

  it("debe permitir CORS para https://futuracapital.mx y https://partners.futuracapital.mx", async () => {
    const resMain = await app.fetch(
      new Request("https://sales.arksystems.site/health", {
        method: "GET",
        headers: { Origin: "https://futuracapital.mx" },
      }),
      {} as any
    );
    expect(resMain.headers.get("access-control-allow-origin")).toBe("https://futuracapital.mx");

    const resPartners = await app.fetch(
      new Request("https://sales.arksystems.site/health", {
        method: "GET",
        headers: { Origin: "https://partners.futuracapital.mx" },
      }),
      {} as any
    );
    expect(resPartners.headers.get("access-control-allow-origin")).toBe("https://partners.futuracapital.mx");
  });

  it("SYSTEM_PROMPTS y AGENT_GUARDRAILS deben incluir el playbook de Futura Capital, ejecutivos titulares y prohibición de revelar comisiones", () => {
    expect(SYSTEM_PROMPTS.intake).toContain("Futura Capital Partners");
    expect(SYSTEM_PROMPTS.closer).toContain("Enrique Xacur");
    expect(SYSTEM_PROMPTS.closer).toContain("Jaqueline Madera");
    expect(SYSTEM_PROMPTS.closer).toContain("MB Medical Tower");
    expect(AGENT_GUARDRAILS).toContain("Jamás reveles porcentajes de comisión de brokers");
  });
});
