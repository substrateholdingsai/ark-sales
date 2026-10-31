import { describe, it, expect, vi } from "vitest";
import { CatalogService, FAIL_CLOSED_MESSAGE } from "../src/catalog/service";

describe("CatalogService (Cero Hardcoding & Fail-Closed)", () => {
  it("debe retornar FAIL_CLOSED_MESSAGE si la base de datos no está disponible", async () => {
    const service = new CatalogService(null as any);
    const result = await service.getCatalog();

    expect(result.success).toBe(false);
    expect(result.message).toBe(FAIL_CLOSED_MESSAGE);
    expect(result.error).toBe("DATABASE_UNAVAILABLE");
  });

  it("debe retornar FAIL_CLOSED_MESSAGE si el catálogo está vacío", async () => {
    const mockDb: any = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    };

    const service = new CatalogService(mockDb);
    const result = await service.getCatalog();

    expect(result.success).toBe(false);
    expect(result.message).toBe(FAIL_CLOSED_MESSAGE);
    expect(result.error).toBe("CATALOG_EMPTY");
  });

  it("debe cargar productos y parsear features_json dinámicamente desde D1 (Cero hardcoding)", async () => {
    const mockDb: any = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: "cfg_ledger_01",
              product_key: "ledger",
              name: "Ark Ledger",
              price_mxn: 399,
              billing_period: "mensual",
              description: "Motor fiscal SHA-256",
              features_json: '["Calculadoras SAT", "Sello SHA-256"]',
              status: "active",
            },
            {
              id: "cfg_bundle_01",
              product_key: "bundle",
              name: "Bundle Total",
              price_mxn: 997,
              billing_period: "mensual",
              description: "Infraestructura operativa agéntica completa",
              features_json: '["Ledger", "Angel", "Commerce"]',
              status: "active",
            },
          ],
        }),
      }),
    };

    const service = new CatalogService(mockDb);
    const result = await service.getCatalog();

    expect(result.success).toBe(true);
    expect(result.products).toBeDefined();
    expect(result.products!["ledger"].price_mxn).toBe(399);
    expect(result.products!["ledger"].features).toContain("Sello SHA-256");
    expect(result.products!["bundle"].price_mxn).toBe(997);
  });

  it("debe procesar productos con precio por uso en USD (Ark Angel) y add-ons en MXN (Ark Ledger)", async () => {
    const mockDb: any = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: "cfg_angel_voice",
              product_key: "angel_voice",
              name: "Ark Angel — Voz IA",
              price_mxn: 5.0,
              price_usd: 0.25,
              currency: "USD",
              billing_period: "por_minuto",
              unit: "minuto",
              pricing_model: "usage",
              description: "Llamada con IA en tiempo real",
              features_json: '["Voz en tiempo real", "Motor Legal fail-closed"]',
              status: "active",
            },
            {
              id: "cfg_ledger",
              product_key: "ledger",
              name: "Ark Ledger (Cierre Fiscal)",
              price_mxn: 6000.0,
              currency: "MXN",
              billing_period: "mensual",
              unit: "mes",
              pricing_model: "subscription",
              min_monthly_mxn: 4500.0,
              description: "Módulo Fiscal y Contable",
              features_json: '["CFF", "CFDI 4.0", "SHA-256 + QR"]',
              status: "active",
            },
          ],
        }),
      }),
    };

    const service = new CatalogService(mockDb);
    const result = await service.getCatalog();

    expect(result.success).toBe(true);
    expect(result.products!["angel_voice"].price_usd).toBe(0.25);
    expect(result.products!["angel_voice"].pricing_model).toBe("usage");
    expect(result.products!["ledger"].price_mxn).toBe(6000);
    expect(result.products!["ledger"].features).toContain("SHA-256 + QR");
  });
});
