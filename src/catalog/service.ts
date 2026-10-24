import { D1Database } from "@cloudflare/workers-types";
import { ProductConfig } from "../types";

export const FAIL_CLOSED_MESSAGE = "Permíteme verificar la disponibilidad de esa solución con mi equipo.";

export class CatalogService {
  constructor(private db: D1Database) {}

  /**
   * Consulta el catálogo completo desde sales_config en D1.
   * Fail-Closed: Si la base de datos no responde o el catálogo está vacío,
   * arroja o retorna un estado no disponible sin inventar información ni precios.
   */
  async getCatalog(): Promise<{
    success: boolean;
    products?: Record<string, ProductConfig>;
    error?: string;
    message?: string;
  }> {
    try {
      if (!this.db) {
        return {
          success: false,
          error: "DATABASE_UNAVAILABLE",
          message: FAIL_CLOSED_MESSAGE,
        };
      }

      const { results } = await this.db
        .prepare("SELECT * FROM sales_config WHERE status IN ('active', 'waitlist', 'beta')")
        .all<ProductConfig>();

      if (!results || results.length === 0) {
        return {
          success: false,
          error: "CATALOG_EMPTY",
          message: FAIL_CLOSED_MESSAGE,
        };
      }

      const mappedProducts: Record<string, ProductConfig> = {};
      for (const item of results) {
        let features: string[] = [];
        try {
          features = JSON.parse(item.features_json);
        } catch {
          features = [];
        }
        mappedProducts[item.product_key] = {
          ...item,
          features,
        };
      }

      return {
        success: true,
        products: mappedProducts,
      };
    } catch (err: any) {
      console.error("[CatalogService] Error consultando catálogo D1:", err);
      return {
        success: false,
        error: err.message || "CATALOG_FETCH_FAILED",
        message: FAIL_CLOSED_MESSAGE,
      };
    }
  }

  async getProductByKey(productKey: string): Promise<ProductConfig | null> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM sales_config WHERE product_key = ? LIMIT 1")
        .bind(productKey)
        .first<ProductConfig>();

      if (!result) return null;

      try {
        result.features = JSON.parse(result.features_json);
      } catch {
        result.features = [];
      }

      return result;
    } catch (err) {
      console.error(`[CatalogService] Error obteniendo producto ${productKey}:`, err);
      return null;
    }
  }
}
