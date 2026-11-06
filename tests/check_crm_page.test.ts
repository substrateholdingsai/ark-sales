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
