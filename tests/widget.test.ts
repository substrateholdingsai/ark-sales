import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { Env } from "../src/types";

describe("Chat Widget & Landing Demo Frontend", () => {
  const mockEnv: Env = {
    DB: {} as any,
    AI: null,
    SALES_INGEST_QUEUE: {} as any,
    SALES_AGENT: {} as any,
  };

  it("debe entregar el script de widget en GET /widget.js con los headers adecuados", async () => {
    const req = new Request("http://localhost/widget.js");
    const res = await worker.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    const contentType = res.headers.get("Content-Type");
    expect(contentType).toContain("application/javascript");
    const text = await res.text();
    expect(text).toContain("__ARK_SALES_LOADED__");
    expect(text).toContain("ark-fab");
    expect(text).toContain("El Triador");
    expect(text).toContain("Arquitecto del Bundle");
  });

  it("debe entregar la Landing Page interactiva en GET / con el widget embebido", async () => {
    const req = new Request("http://localhost/");
    const res = await worker.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("ARK Sales");
    expect(html).toContain("El Bundle Total ARK");
    expect(html).toContain('<script src="/widget.js"');
  });

  it("debe entregar la demo en GET /demo", async () => {
    const req = new Request("http://localhost/demo");
    const res = await worker.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("PULSE");
    expect(html).toContain("Enrutamiento por Dolor");
    expect(html).toContain("Llama 3.3 70B");
  });
});
