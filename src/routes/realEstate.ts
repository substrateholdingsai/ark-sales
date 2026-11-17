import { Hono } from "hono";
import { PDFDocument } from "pdf-lib";
import { Env } from "../types";
import { AuthVariables, requireAuth, requireRole } from "../auth/middleware";
import { clientIp } from "../auth/audit";
import {
  ALTUM_TENANT_ID,
  getMasterplanData,
  getUnitDetail,
  changeUnitStatus,
  createRealEstateQuote,
  convertRealEstateQuote,
} from "../server/realEstate/service";
import { drawBrandedPdf } from "../server/realEstate/pdfRenderer";
import { normalizeQuoteInputs, computeQuote, listPriceCentsFromUnit, type PricingRuleLimits, type QuoteInputs } from "../server/realEstate/quoteEngine";

export const realEstateRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const MAX_PAGE_SIZE = 100;

function parsePageSize(c: any): number {
  const raw = parseInt(c.req.query("page_size") || c.req.query("limit") || "50", 10);
  if (!Number.isFinite(raw) || raw < 1) return 50;
  return Math.min(raw, MAX_PAGE_SIZE);
}

/**
 * Resolución de tenant con aislamiento fail-closed.
 * - Rol admin: puede indicar cualquier tenant vía cabecera X-Tenant-Id.
 * - Cualquier otro rol: estrictamente acc_altum_sureste (vertical demo Altum).
 */
function resolveTenantId(c: any, user: { role: string } | null): string {
  if (user && user.role === "admin") {
    const header = c.req.header("X-Tenant-Id");
    if (header && header.trim()) return header.trim();
  }
  return ALTUM_TENANT_ID;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/crm/re/projects/:id/masterplan — grid de unidades agrupado por bloque (sólo lectura)
// ─────────────────────────────────────────────────────────────────────────────
realEstateRouter.get("/projects/:id/masterplan", requireAuth(), async (c) => {
  const projectId = c.req.param("id");
  const user = c.get("user");
  const tenantId = resolveTenantId(c, user);

  const data = await getMasterplanData(c.env.DB, projectId, tenantId, parsePageSize(c));
  if (!data) {
    return c.json({ error: "Proyecto no encontrado para este tenant." }, 404);
  }

  return c.json({
    project: data.project,
    tenant_id: tenantId,
    blocks: data.blocks,
    unit_count: data.unit_count,
    truncated: data.truncated,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/crm/re/units/:id — detalle completo de una unidad
// ─────────────────────────────────────────────────────────────────────────────
realEstateRouter.get("/units/:id", requireAuth(), async (c) => {
  const unitId = c.req.param("id");
  const user = c.get("user");
  const tenantId = resolveTenantId(c, user);

  const detail = await getUnitDetail(c.env.DB, unitId, tenantId);
  if (!detail) {
    return c.json({ error: "Unidad no encontrada para este tenant." }, 404);
  }

  return c.json(detail);
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/crm/re/units/:id/status — cambio de estatus con auditoría inmutable
// Solo admin / vendedor.
// ─────────────────────────────────────────────────────────────────────────────
realEstateRouter.patch("/units/:id/status", requireRole("write"), async (c) => {
  const unitId = c.req.param("id");
  const user = c.get("user")!;
  const tenantId = resolveTenantId(c, user);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Cuerpo JSON inválido." }, 400);
  }

  const status = body?.status;
  if (typeof status !== "string" || !["disponible", "apartado", "vendido", "bloqueado"].includes(status)) {
    return c.json({ error: "Estatus inválido. Use: disponible, apartado, vendido o bloqueado." }, 400);
  }

  const result = await changeUnitStatus(c.env.DB, user.sub, user.email, clientIp(c), unitId, status, tenantId);
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as any);
  }

  return c.json({
    id: result.unit.id,
    status: result.unit.status,
    previous_status: result.unit.previous_status,
    audit_action: "re.unit_status_changed",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/crm/re/quotes — cotización determinista, cálculo en servidor
// ─────────────────────────────────────────────────────────────────────────────
realEstateRouter.post("/quotes", requireRole("write"), async (c) => {
  const user = c.get("user")!;
  const tenantId = resolveTenantId(c, user);

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Cuerpo JSON inválido." }, 400);
  }

  const result = await createRealEstateQuote(c.env.DB, { user_id: user.sub, email: user.email }, clientIp(c), tenantId, raw as QuoteInputs);
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as any);
  }

  return c.json({
    quote: result.quote,
    calculation: result.calculation,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/crm/re/quotes/:id/convert — quote => oportunidad stage nuevo
// ─────────────────────────────────────────────────────────────────────────────
realEstateRouter.post("/quotes/:id/convert", requireRole("write"), async (c) => {
  const quoteId = c.req.param("id");
  const user = c.get("user")!;
  const tenantId = resolveTenantId(c, user);

  const result = await convertRealEstateQuote(c.env.DB, { user_id: user.sub, email: user.email }, clientIp(c), tenantId, quoteId);
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as any);
  }

  return c.json({
    opportunity_id: result.opportunity_id,
    quote_id: result.quote_id,
    stage: result.stage,
    quote_status: result.quote_status,
    email_sent: result.email_sent,
    whatsapp_sent: result.whatsapp_sent,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/crm/re/quotes/:id/pdf — PDF de cotización (pdf-lib, sin envío real)
// ─────────────────────────────────────────────────────────────────────────────
realEstateRouter.get("/quotes/:id/pdf", requireAuth(), async (c) => {
  const quoteId = c.req.param("id");
  const user = c.get("user");
  const tenantId = resolveTenantId(c, user);

  const quote: any = await c.env.DB.prepare(
    `SELECT q.id, q.unit_id, q.total_sale, q.status, q.payment_plan, q.created_at,
              u.block, u.level, u.unit_number, u.area_m2, u.price_per_m2, u.list_price, u.unit_type,
              p.id AS project_id, p.name, p.city, p.currency, p.tenant_id
       FROM re_quotes q
       JOIN re_units u ON u.id = q.unit_id
       JOIN re_projects p ON p.id = u.project_id
       WHERE q.id = ? AND p.tenant_id = ? LIMIT 1`,
  )
    .bind(quoteId, tenantId)
    .first();

  if (!quote) {
    return c.json({ error: "Cotización no encontrada para este tenant." }, 404);
  }

  const ruleRow: any = await c.env.DB.prepare(`SELECT version, name, rules_json FROM re_pricing_rules WHERE tenant_id = ? AND is_active = 1 LIMIT 1`)
    .bind(tenantId)
    .first();

  if (!ruleRow) {
    return c.json({ error: "Reglas de precios no configuradas para este tenant (fail-closed)." }, 503);
  }

  let rules: any = {};
  try {
    rules = typeof ruleRow.rules_json === "string" ? JSON.parse(ruleRow.rules_json) : {};
  } catch {
    rules = {};
  }

  const rule: PricingRuleLimits = {
    version: String(ruleRow.version),
    name: String(ruleRow.name),
    max_discount_pct: Number(rules.max_discount_pct ?? 15),
    max_down_payment_pct: Number(rules.max_down_payment_pct ?? 50),
    allow_monthly: rules.allow_monthly !== false,
  };

  // Reconstrucción determinista de los números para el PDF (el cliente nunca calcula precios).
  const normalized = normalizeQuoteInputs(
    {
      unit_id: quote.unit_id,
      discount_pct: quote.discount_pct ?? 0,
      discount_amount: quote.discount_amount ?? 0,
      down_payment_pct: quote.down_payment_pct ?? 0,
      down_payment_amount: quote.down_payment_amount ?? 0,
      monthly_count: quote.monthly_count ?? 0,
      payment_plan: quote.payment_plan ?? null,
    },
    rule,
  );
  const calculation = computeQuote(
    normalized,
    listPriceCentsFromUnit({
      areaM2: quote.area_m2,
      pricePerM2: quote.price_per_m2,
      explicitListPrice: quote.list_price,
    }),
    rule,
  );

  // Intenta plantilla AcroForm de R2 si el operador configuró el bucket; si no, dibujo puro.
  let pdfBytes: Uint8Array;
  try {
    const bucket = c.env.REAL_ESTATE_PDF_TEMPLATE;
    if (bucket) {
      const obj = await bucket.get("cotizacion_altum_template.pdf");
      if (obj) {
        const templateBytes = (await obj.arrayBuffer()) as unknown as ArrayBuffer;
        const pdf = await PDFDocument.load(templateBytes);
        const form = pdf.getForm();
        const setField = (name: string, value: string) => {
          const field = form.getTextField(name);
          if (field) field.setText(value);
        };
        setField("quote_number", quote.id);
        setField("unit", `${quote.block || ""} ${quote.unit_number || ""}`.trim());
        setField("area_m2", `${quote.area_m2} m²`);
        setField("list_price", calculation.list_price_mxn);
        setField("total_sale", calculation.total_sale_mxn);
        setField("down_payment", calculation.down_payment_amount_mxn);
        setField("monthly_amount", calculation.monthly_amount_mxn);
        setField("monthly_count", String(calculation.monthly_count));
        pdfBytes = await pdf.save();
      } else {
        pdfBytes = await drawBrandedPdf({ quoteId, unit: quote, project: { name: quote.project_name, city: quote.project_city }, calculation });
      }
    } else {
      pdfBytes = await drawBrandedPdf({ quoteId, unit: quote, project: { name: quote.project_name, city: quote.project_city }, calculation });
    }
  } catch {
    pdfBytes = await drawBrandedPdf({ quoteId, unit: quote, project: { name: quote.project_name, city: quote.project_city }, calculation });
  }

  return new Response(pdfBytes as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cotizacion_${quoteId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
