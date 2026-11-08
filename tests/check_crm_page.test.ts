import { describe, it, expect } from "vitest";
import { renderCrmHtml } from "../src/client/crmPage";
import { renderSuperAdminHtml } from "../src/client/superAdminPage";

describe("Validate Client HTML Output", () => {
  it("renderCrmHtml must contain valid JavaScript in all script tags", () => {
    const html = renderCrmHtml();
    expect(html).toContain("<!DOCTYPE html>");
    
    const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      count++;
      const code = match[1];
      expect(() => new Function(code)).not.toThrow();
    }
  });

  it("renderCrmHtml must contain dynamic city and plaza resolver functions", () => {
    const html = renderCrmHtml();
    expect(html).toContain("resolverPlaza");
    expect(html).toContain("resolverPlazaContacto");
    expect(html).toContain("actualizarOpcionesFiltroCiudades");
    expect(html).toContain("campeche");
    expect(html).toContain("🏰 Campeche");
  });

  it("renders note follow-up actions with a due date and current-user assignment", () => {
    const html = renderCrmHtml();
    expect(html).toContain("Crear seguimiento");
    expect(html).toContain("crearSeguimientoDesdeNota(event, this)");
    expect(html).toContain("owner_user_id: state.user.id");
    expect(html).toContain("Fecha de vencimiento");
    expect(html).toContain("Guardar tarea");
  });

  it("renders contact notes in the contact edit modal and saves them separately", () => {
    const html = renderCrmHtml();
    expect(html).toContain("Notas del contacto");
    expect(html).toContain("cargarNotasContacto(c.id)");
    expect(html).toContain("&type=note&limit=50");
    expect(html).toContain("guardarNotaContacto()");
    expect(html).toContain("contact_id: contact.id");
  });

  it("renders WhatsApp Studio modal with multi-tenant templates, super admin default number and zero-cost deep linking", () => {
    const html = renderCrmHtml();
    // Modal container
    expect(html).toContain("modalWhatsAppStudio");
    expect(html).toContain("WhatsApp Studio");
    expect(html).toContain("CERO COSTO · wa.me");
    expect(html).toContain("https://wa.me/");

    // Super Admin Default number
    expect(html).toContain("+525648564149");
    expect(html).toContain("+52 56 4856 4149");

    // Tenants
    expect(html).toContain("Ark Technologies");
    expect(html).toContain("Futura Capital");
    expect(html).toContain("wsTenantSelect");
    expect(html).toContain("wsNumeroEmisor");

    // Templates for Futura Capital (Doctors & Real Estate) and Ark (Accounting & CFDI)
    expect(html).toContain("Torre Médica MB");
    expect(html).toContain("Preventa Consultorios para Médicos Especialistas");
    expect(html).toContain("Ark Ledger — Cierre Fiscal Masivo & CFDI 4.0 SAT");
    expect(html).toContain("Ark Angel — Cobranza Inteligente IA con Riel CoDi® Banxico");
    expect(html).toContain("Ticket Digital de Cobro / Activación CoDi® Banxico");

    // JS Action functions
    expect(html).toContain("abrirModalWhatsAppStudio");
    expect(html).toContain("dispararEnvioWhatsApp");
    expect(html).toContain("copiarTextoWhatsApp");
  });

  it("renderSuperAdminHtml must contain valid JavaScript in all script tags", () => {
    const html = renderSuperAdminHtml();
    expect(html).toContain("<!DOCTYPE html>");
    
    const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      count++;
      const code = match[1];
      try {
        new Function(code);
      } catch (e: any) {
        console.error("SuperAdmin error message:", e.message);
        // Let's find error location using vm
        // @ts-ignore -- node:vm available in Vitest/node runtime
        const vm = require("node:vm");
        try {
          new vm.Script(code, { filename: "superadmin_inline.js" });
        } catch (vmErr: any) {
          console.error("VM Syntax error:", vmErr.stack);
        }
        throw e;
      }
    }
  });
});
