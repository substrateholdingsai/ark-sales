import { describe, it, expect } from "vitest";
import { app } from "../src/index";
import { getAltumAsset, ALTUM_ASSETS } from "../src/client/altumAssets";

describe("ALTUM Sureste Tenant & Design System Isolation Suite", () => {
  it("debe cargar la página showcase /altum con aislamiento estricto y tokens de diseño", async () => {
    const res = await app.request("http://localhost/altum");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    // Verifica elementos clave del manifiesto y diseño caribeño
    expect(html).toContain("ALTUM");
    expect(html).toContain("Sureste & Caribe Mexicano");
    expect(html).toContain("Cada propiedad tiene una línea de horizonte y una línea de agua");
    expect(html).toContain("Villa Cenote Cristal");
    expect(html).toContain("Residencia Montejo Norte");
    expect(html).toContain("Lote Punta Cocos Reserva");
    expect(html).toContain("Macrolote Ribera Bacalar");
    
    // Verifica aislamiento de CSS: clases con prefijo altum y tokens de color
    expect(html).toContain(".altum-theme");
    expect(html).toContain("--altum-cal: #F7F4ED");
    expect(html).toContain("--altum-cenote: #0E6B7A");
    expect(html).toContain("--altum-coral: #C9573F");
    expect(html).toContain("--altum-chukum: #D9C9B0");
    
    // Verifica que no se contaminan selectores globales de Ark
    expect(html).not.toContain("bg-slate-900");
    expect(html).not.toContain("bg-slate-950");
  });

  it("debe responder 200 en la ruta alterna /altum-sureste", async () => {
    const res = await app.request("http://localhost/altum-sureste");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("ALTUM");
  });

  it("debe entregar los assets vectoriales de ALTUM con MIME correcto", async () => {
    const faviconRes = await app.request("http://localhost/assets/altum/favicon.svg");
    expect(faviconRes.status).toBe(200);
    expect(faviconRes.headers.get("content-type")).toContain("image/svg+xml");
    const faviconSvg = await faviconRes.text();
    expect(faviconSvg).toContain("<svg");

    const logoRes = await app.request("http://localhost/assets/altum/logo-lockup.svg");
    expect(logoRes.status).toBe(200);
    expect(logoRes.headers.get("content-type")).toContain("image/svg+xml");

    const grecaRes = await app.request("http://localhost/assets/altum/pattern-greca.svg");
    expect(grecaRes.status).toBe(200);
    expect(grecaRes.headers.get("content-type")).toContain("image/svg+xml");

    const manifestRes = await app.request("http://localhost/assets/altum/manifest.json");
    expect(manifestRes.status).toBe(200);
    expect(manifestRes.headers.get("content-type")).toContain("application/json");
  });

  it("debe retornar 404 al solicitar un asset que no existe", async () => {
    const res = await app.request("http://localhost/assets/altum/archivo_inexistente.svg");
    expect(res.status).toBe(404);
  });

  it("getAltumAsset debe retornar null si el archivo no existe", () => {
    expect(getAltumAsset("no_existe.svg")).toBeNull();
    expect(getAltumAsset("favicon.svg")).not.toBeNull();
  });
});
