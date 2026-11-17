import { D1Database } from "@cloudflare/workers-types";
import { AuditService } from "../../auth/audit";
import { listPriceCentsFromUnit, normalizeQuoteInputs, computeQuote, validateQuoteInputs, QuoteError, type QuoteResult, type QuoteInputs } from "./quoteEngine";

export const ALTUM_TENANT_ID = "acc_altum_sureste";
export const ALTUM_PROJECT_ID = "re_proj_altum_merida";

export interface PricingRuleView {
  version: string;
  name: string;
  max_discount_pct: number;
  max_down_payment_pct: number;
  allow_monthly: boolean;
}

export async function loadActivePricingRule(db: D1Database, tenantId: string): Promise<PricingRuleView | null> {
  const row: any = await db
    .prepare(`SELECT version, name, rules_json FROM re_pricing_rules WHERE tenant_id = ? AND is_active = 1 LIMIT 1`)
    .bind(tenantId)
    .first();

  if (!row) return null;

  let rules: any = {};
  try {
    rules = typeof row.rules_json === "string" ? JSON.parse(row.rules_json) : {};
  } catch {
    rules = {};
  }

  return {
    version: String(row.version),
    name: String(row.name),
    max_discount_pct: Number(rules.max_discount_pct ?? 15),
    max_down_payment_pct: Number(rules.max_down_payment_pct ?? 50),
    allow_monthly: rules.allow_monthly !== false,
  };
}

export interface MasterplanUnit {
  id: string;
  block: string | null;
  level: number | null;
  unit_number: string | null;
  area_m2: number;
  price_per_m2: number;
  list_price: number | null;
  status: string;
  unit_type: string | null;
  floor_plan_url: string | null;
  is_demo: boolean;
}

export interface MasterplanBlock {
  block: string;
  units: MasterplanUnit[];
}

export interface MasterplanData {
  project: {
    id: string;
    tenant_id: string;
    name: string;
    city: string | null;
    currency: string;
    total_units: number | null;
    is_demo: boolean;
  };
  blocks: MasterplanBlock[];
  unit_count: number;
  truncated: boolean;
}

export async function getMasterplanData(db: D1Database, projectId: string, tenantId: string, pageSize: number): Promise<MasterplanData | null> {
  const projectRow: any = await db
    .prepare(
      `SELECT id, tenant_id, name, city, currency, total_units, is_demo, created_at
       FROM re_projects WHERE id = ? AND tenant_id = ? LIMIT 1`,
    )
    .bind(projectId, tenantId)
    .first();

  if (!projectRow) return null;

  const { results: unitRows }: any = await db
    .prepare(
      `SELECT id, block, level, unit_number, area_m2, price_per_m2, list_price, status, unit_type, floor_plan_url, is_demo
       FROM re_units WHERE project_id = ? ORDER BY block, level, unit_number LIMIT ?`,
    )
    .bind(projectId, pageSize)
    .all();

  const units: MasterplanUnit[] = (unitRows || []).map((row: any) => ({
    id: row.id,
    block: row.block,
    level: row.level,
    unit_number: row.unit_number,
    area_m2: row.area_m2,
    price_per_m2: row.price_per_m2,
    list_price: row.list_price,
    status: row.status,
    unit_type: row.unit_type,
    floor_plan_url: row.floor_plan_url,
    is_demo: row.is_demo === 1,
  }));

  const blocks = new Map<string, MasterplanUnit[]>();
  for (const u of units) {
    const key = u.block || "Sin bloque";
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key)!.push(u);
  }

  return {
    project: {
      id: projectRow.id,
      tenant_id: projectRow.tenant_id,
      name: projectRow.name,
      city: projectRow.city,
      currency: projectRow.currency,
      total_units: projectRow.total_units,
      is_demo: projectRow.is_demo === 1,
    },
    blocks: Array.from(blocks.entries()).map(([block, units]) => ({ block, units })),
    unit_count: units.length,
    truncated: units.length >= pageSize,
  };
}

export interface UnitDetail {
  id: string;
  project_id: string;
  project_name: string;
  project_city: string | null;
  project_currency: string;
  project_tenant_id: string;
  block: string | null;
  level: number | null;
  unit_number: string | null;
  area_m2: number;
  price_per_m2: number;
  list_price: number | null;
  status: string;
  unit_type: string | null;
  floor_plan_url: string | null;
  is_demo: boolean;
}

export async function getUnitDetail(db: D1Database, unitId: string, tenantId: string): Promise<UnitDetail | null> {
  const row: any = await db
    .prepare(
      `SELECT u.id, u.project_id, u.block, u.level, u.unit_number, u.area_m2, u.price_per_m2, u.list_price,
              u.status, u.unit_type, u.floor_plan_url, u.is_demo,
              p.name AS project_name, p.city, p.currency, p.tenant_id
       FROM re_units u
       JOIN re_projects p ON p.id = u.project_id
       WHERE u.id = ? AND p.tenant_id = ? LIMIT 1`,
    )
    .bind(unitId, tenantId)
    .first();

  if (!row) return null;

  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.project_name,
    project_city: row.city,
    project_currency: row.currency,
    project_tenant_id: row.tenant_id,
    block: row.block,
    level: row.level,
    unit_number: row.unit_number,
    area_m2: row.area_m2,
    price_per_m2: row.price_per_m2,
    list_price: row.list_price,
    status: row.status,
    unit_type: row.unit_type,
    floor_plan_url: row.floor_plan_url,
    is_demo: row.is_demo === 1,
  };
}

export interface ChangeStatusResultOk {
  ok: true;
  unit: { id: string; status: string; previous_status: string };
}
export interface ChangeStatusResultFail {
  ok: false;
  status: 404;
  error: string;
}
export type ChangeStatusResult = ChangeStatusResultOk | ChangeStatusResultFail;

export async function changeUnitStatus(
  db: D1Database,
  actorUserId: string,
  actorEmail: string,
  ip: string | null,
  unitId: string,
  status: string,
  tenantId: string,
): Promise<ChangeStatusResult> {
  const row: any = await db
    .prepare(
      `SELECT u.id, u.block, u.unit_number, u.status AS old_status, u.project_id, p.tenant_id
       FROM re_units u JOIN re_projects p ON p.id = u.project_id
       WHERE u.id = ? AND p.tenant_id = ? LIMIT 1`,
    )
    .bind(unitId, tenantId)
    .first();

  if (!row) {
    return { ok: false, status: 404, error: "Unidad no encontrada para este tenant." };
  }

  await db.prepare(`UPDATE re_units SET status = ? WHERE id = ?`).bind(status, unitId).run();

  await new AuditService(db).record({
    actor_user_id: actorUserId,
    actor_email: actorEmail,
    action: "re.unit_status_changed",
    entity_type: "re_unit",
    entity_id: unitId,
    metadata: {
      project_id: row.project_id,
      block: row.block,
      unit_number: row.unit_number,
      from: row.old_status,
      to: status,
      changed_by: actorUserId,
      changed_by_email: actorEmail,
    },
    ip,
  });

  return { ok: true, unit: { id: unitId, status, previous_status: row.old_status } };
}

export interface CreateQuoteActor {
  user_id: string;
  email: string;
}

export interface CreateQuoteResultOk {
  ok: true;
  quote: {
    id: string;
    unit_id: string;
    status: string;
    tenant_id: string;
    currency: string;
    created_by: string;
    created_at: string;
  };
  calculation: QuoteResult;
}
export interface CreateQuoteResultFail {
  ok: false;
  status: number;
  error: string;
}
export type CreateQuoteResult = CreateQuoteResultOk | CreateQuoteResultFail;

export async function createRealEstateQuote(
  db: D1Database,
  actor: CreateQuoteActor,
  ip: string | null,
  tenantId: string,
  raw: QuoteInputs,
): Promise<CreateQuoteResult> {
  let inputs: ReturnType<typeof validateQuoteInputs>;
  try {
    inputs = validateQuoteInputs(raw);
  } catch (err: any) {
    if (err instanceof QuoteError) return { ok: false, status: err.status, error: err.message };
    throw err;
  }

  const unitRow: any = await db
    .prepare(
      `SELECT u.id, u.project_id, u.area_m2, u.price_per_m2, u.list_price, u.status,
              p.tenant_id, p.currency
       FROM re_units u JOIN re_projects p ON p.id = u.project_id
       WHERE u.id = ? AND p.tenant_id = ? LIMIT 1`,
    )
    .bind(inputs.unit_id, tenantId)
    .first();

  if (!unitRow) {
    return { ok: false, status: 404, error: "Unidad no encontrada para este tenant." };
  }

  const rule = await loadActivePricingRule(db, tenantId);
  if (!rule) {
    return { ok: false, status: 503, error: "Reglas de precios no configuradas para este tenant (fail-closed)." };
  }

  let normalized: ReturnType<typeof normalizeQuoteInputs>;
  try {
    normalized = normalizeQuoteInputs(inputs, rule);
  } catch (err: any) {
    if (err instanceof QuoteError) return { ok: false, status: err.status, error: err.message };
    throw err;
  }

  const listPriceCents = listPriceCentsFromUnit({
    areaM2: unitRow.area_m2,
    pricePerM2: unitRow.price_per_m2,
    explicitListPrice: unitRow.list_price,
  });

  let calculation: QuoteResult;
  try {
    calculation = computeQuote(normalized, listPriceCents, rule);
  } catch (err: any) {
    if (err instanceof QuoteError) return { ok: false, status: err.status, error: err.message };
    throw err;
  }

  const quoteId = `re_quote_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO re_quotes (
        id, unit_id, account_id, contact_id, opportunity_id,
        discount_pct, discount_amount, total_sale,
        down_payment_pct, down_payment_amount, down_payment_count,
        monthly_pct, monthly_amount, monthly_count, payment_plan,
        status, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?, ?)`,
    )
    .bind(
      quoteId,
      inputs.unit_id,
      inputs.account_id ?? null,
      inputs.contact_id ?? null,
      inputs.opportunity_id ?? null,
      normalized.discount_pct,
      calculation.discount_amount_cents / 100,
      calculation.total_sale_cents / 100,
      normalized.down_payment_pct,
      calculation.down_payment_amount_cents / 100,
      normalized.down_payment_count,
      calculation.monthly_pct,
      calculation.monthly_amount_cents / 100,
      normalized.monthly_count,
      normalized.payment_plan,
      actor.user_id,
      now,
    )
    .run();

  await new AuditService(db).record({
    actor_user_id: actor.user_id,
    actor_email: actor.email,
    action: "re.quote_created",
    entity_type: "re_quote",
    entity_id: quoteId,
    metadata: {
      unit_id: inputs.unit_id,
      project_id: unitRow.project_id,
      rule_version: rule.version,
      rule_name: rule.name,
      inputs: {
        discount_pct: normalized.discount_pct,
        down_payment_pct: normalized.down_payment_pct,
        monthly_count: normalized.monthly_count,
        payment_plan: normalized.payment_plan,
      },
      result_cents: {
        list_price_cents: calculation.list_price_cents,
        discount_amount_cents: calculation.discount_amount_cents,
        total_sale_cents: calculation.total_sale_cents,
        down_payment_amount_cents: calculation.down_payment_amount_cents,
        monthly_amount_cents: calculation.monthly_amount_cents,
        monthly_count: calculation.monthly_count,
        remainder_cents: calculation.remainder_cents,
      },
    },
    ip,
  });

  return {
    ok: true,
    quote: {
      id: quoteId,
      unit_id: inputs.unit_id,
      status: "borrador",
      tenant_id: tenantId,
      currency: unitRow.currency,
      created_by: actor.user_id,
      created_at: now,
    },
    calculation,
  };
}

export interface ConvertQuoteResultOk {
  ok: true;
  opportunity_id: string;
  quote_id: string;
  stage: string;
  quote_status: string;
  email_sent: boolean;
  whatsapp_sent: boolean;
}
export interface ConvertQuoteResultFail {
  ok: false;
  status: number;
  error: string;
}
export type ConvertQuoteResult = ConvertQuoteResultOk | ConvertQuoteResultFail;

export async function convertRealEstateQuote(
  db: D1Database,
  actor: CreateQuoteActor,
  ip: string | null,
  tenantId: string,
  quoteId: string,
): Promise<ConvertQuoteResult> {
  const quote: any = await db
    .prepare(
      `SELECT q.id, q.unit_id, q.account_id, q.contact_id, q.opportunity_id, q.total_sale, q.status, q.created_by,
              u.project_id, p.currency
       FROM re_quotes q
       JOIN re_units u ON u.id = q.unit_id
       JOIN re_projects p ON p.id = u.project_id
       WHERE q.id = ? AND p.tenant_id = ? LIMIT 1`,
    )
    .bind(quoteId, tenantId)
    .first();

  if (!quote) {
    return { ok: false, status: 404, error: "Cotización no encontrada para este tenant." };
  }
  if (quote.status !== "borrador") {
    return {
      ok: false,
      status: 409,
      error: `Sólo se puede convertir una cotización en estado borrador (actual: ${quote.status}).`,
    };
  }

  const opportunityId = `opp_${crypto.randomUUID().slice(0, 12)}`;

  await db
    .prepare(
      `INSERT INTO sales_opportunities (
        id, account_id, contact_id, lead_id, stage, owner_user_id,
        products_interest_json, estimated_value, currency, expected_close_date, loss_reason,
        created_at, updated_at
      ) VALUES (?, ?, ?, NULL, 'nuevo', ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
    .bind(
      opportunityId,
      quote.account_id ?? null,
      quote.contact_id ?? null,
      actor.user_id,
      JSON.stringify([quote.unit_id]),
      quote.total_sale,
      quote.currency ?? "MXN",
    )
    .run();

  await db.prepare(`UPDATE re_quotes SET status = 'aceptada' WHERE id = ?`).bind(quoteId).run();

  await new AuditService(db).record({
    actor_user_id: actor.user_id,
    actor_email: actor.email,
    action: "re.quote_converted",
    entity_type: "re_quote",
    entity_id: quoteId,
    metadata: {
      opportunity_id: opportunityId,
      unit_id: quote.unit_id,
      stage: "nuevo",
      estimated_value: quote.total_sale,
      currency: quote.currency,
      email_sent: false,
      whatsapp_sent: false,
    },
    ip,
  });

  return {
    ok: true,
    opportunity_id: opportunityId,
    quote_id: quoteId,
    stage: "nuevo",
    quote_status: "aceptada",
    email_sent: false,
    whatsapp_sent: false,
  };
}
