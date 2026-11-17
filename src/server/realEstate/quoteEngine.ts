import { z } from "zod";
import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// Todo el motor de cotizaciones trabaja en centavos enteros. Nunca float para dinero.
export type MoneyCents = number;

export interface PricingRuleLimits {
  version: string;
  name: string;
  max_discount_pct: number;
  max_down_payment_pct: number;
  allow_monthly: boolean;
}

export interface QuoteInputs {
  unit_id: string;
  account_id?: string | null;
  contact_id?: string | null;
  opportunity_id?: string | null;
  discount_pct?: number | null;
  discount_amount?: number | null;
  down_payment_pct?: number | null;
  down_payment_amount?: number | null;
  down_payment_count?: number | null;
  monthly_pct?: number | null;
  monthly_amount?: number | null;
  monthly_count?: number | null;
  payment_plan?: string | null;
}

export interface NormalizedQuoteInputs {
  unit_id: string;
  account_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  discount_pct: number; // %
  discount_amount_cents: MoneyCents;
  down_payment_pct: number; // %
  down_payment_amount_cents: MoneyCents;
  down_payment_count: number; // >= 1
  monthly_pct: number; // % (informativo)
  monthly_amount_cents: MoneyCents; // informativo
  monthly_count: number; // >= 0; 0 = contado
  payment_plan: string | null;
}

export interface MonthlyPayment {
  payment_number: number;
  amount_cents: MoneyCents;
  amount_mxn: string;
}

export interface QuoteResult {
  unit_id: string;
  rule_version: string;
  rule_name: string;
  list_price_cents: MoneyCents;
  list_price_mxn: string;
  discount_pct: number;
  discount_amount_cents: MoneyCents;
  discount_amount_mxn: string;
  total_sale_cents: MoneyCents;
  total_sale_mxn: string;
  down_payment_pct: number;
  down_payment_amount_cents: MoneyCents;
  down_payment_amount_mxn: string;
  down_payment_count: number;
  monthly_pool_cents: MoneyCents;
  monthly_count: number;
  monthly_amount_cents: MoneyCents;
  monthly_amount_mxn: string;
  monthly_pct: number;
  monthly_breakdown: MonthlyPayment[];
  remainder_cents: MoneyCents;
  payment_plan: string | null;
  computed_at: string;
}

export class QuoteError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

// -------- Zod validation schema (inputs validados antes de cualquier cÃ¡lculo) --------

export const QuoteInputSchema: z.ZodType<QuoteInputs> = z.object({
  unit_id: z.string().min(1, "unit_id es obligatorio"),
  account_id: z.string().min(1).optional().nullable(),
  contact_id: z.string().min(1).optional().nullable(),
  opportunity_id: z.string().min(1).optional().nullable(),
  discount_pct: z.number().min(0).max(100).optional().default(0),
  discount_amount: z.number().min(0).optional().default(0),
  down_payment_pct: z.number().min(0).max(100).optional().default(0),
  down_payment_amount: z.number().min(0).optional().default(0),
  down_payment_count: z.number().int().min(1).optional().default(1),
  monthly_pct: z.number().min(0).max(100).optional().default(0),
  monthly_amount: z.number().min(0).optional().default(0),
  monthly_count: z.number().int().min(0).optional().default(0),
  payment_plan: z.string().optional().nullable(),
});

export function validateQuoteInputs(raw: unknown): QuoteInputs {
  const result = QuoteInputSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new QuoteError(400, `Entrada de cotizaciÃ³n invÃ¡lida: ${issues}`);
  }
  return result.data;
}

// -------- Helpers de dinero (centavos enteros, decimal.js, sin float) --------

export function toCents(amount: number | null | undefined): MoneyCents {
  if (amount === null || amount === undefined) return 0;
  if (!Number.isFinite(amount)) throw new QuoteError(400, "Monto no es un nÃºmero vÃ¡lido.");
  const cents = Decimal(String(amount)).mul(100).toDecimalPlaces(0).toNumber();
  if (!Number.isFinite(cents) || cents < 0) throw new QuoteError(400, "Monto no puede ser negativo.");
  return cents;
}

export function toCentsPct(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new QuoteError(400, "Porcentaje debe estar entre 0 y 100.");
  }
  return value;
}

export function centsToMxn(cents: MoneyCents): string {
  return new Decimal(cents).div(100).toFixed(2);
}

export function roundCents(value: number): MoneyCents {
  if (!Number.isFinite(value)) throw new QuoteError(400, "CÃ¡lculo no produce un nÃºmero finito.");
  return Decimal(value).toDecimalPlaces(0).toNumber();
}

/**
 * Precio lista en centavos: valor explÃ­cito almacenado en la unidad si existe,
 * en caso contrario area_m2 * price_per_m2 (cÃ¡lculo determinista, sin float).
 */
export function listPriceCentsFromUnit({
  areaM2,
  pricePerM2,
  explicitListPrice,
}: {
  areaM2: number;
  pricePerM2: number;
  explicitListPrice: number | null | undefined;
}): MoneyCents {
  if (explicitListPrice !== null && explicitListPrice !== undefined) {
    return toCents(explicitListPrice);
  }
  if (!Number.isFinite(areaM2) || areaM2 < 0) throw new QuoteError(400, "area_m2 invÃ¡lida en la unidad.");
  if (!Number.isFinite(pricePerM2) || pricePerM2 < 0) throw new QuoteError(400, "price_per_m2 invÃ¡lido en la unidad.");
  return roundCents(Decimal(String(areaM2)).mul(String(pricePerM2)).mul(100).toNumber());
}

// -------- NormalizaciÃ³n de entradas con reglas de precios (desde D1, nunca hardcoded) --------

export function normalizeQuoteInputs(inputs: QuoteInputs, rule: PricingRuleLimits): NormalizedQuoteInputs {
  const discountPct = toCentsPct(inputs.discount_pct ?? 0);
  const downPaymentPct = toCentsPct(inputs.down_payment_pct ?? 0);
  const monthlyCount = Number.isFinite(inputs.monthly_count ?? 0) ? Math.trunc(inputs.monthly_count ?? 0) : 0;

  if (monthlyCount < 0) {
    throw new QuoteError(400, "La cantidad de mensualidades no puede ser negativa.");
  }
  const downPaymentCount = Number.isFinite(inputs.down_payment_count ?? 0) ? Math.max(1, Math.trunc(inputs.down_payment_count ?? 0)) : 1;

  if (discountPct > rule.max_discount_pct) {
    throw new QuoteError(400, `Descuento mÃ¡ximo permitido para esta versiÃ³n de reglas (${rule.version}): ${rule.max_discount_pct}%.`);
  }
  if (downPaymentPct > rule.max_down_payment_pct) {
    throw new QuoteError(400, `Enganche mÃ¡ximo permitido para esta versiÃ³n de reglas (${rule.version}): ${rule.max_down_payment_pct}%.`);
  }
  if (monthlyCount > 0 && !rule.allow_monthly) {
    throw new QuoteError(400, `Los pagos mensualizados no estÃ¡n permitidos en la versiÃ³n ${rule.version} de reglas.`);
  }

  const discountAmountCents = discountPct > 0 ? 0 : toCents(inputs.discount_amount ?? 0);

  const downPaymentAmountCents = downPaymentPct > 0 ? 0 : toCents(inputs.down_payment_amount ?? 0); // se resuelve contra totalSale en computeQuote

  return {
    unit_id: inputs.unit_id,
    account_id: inputs.account_id ?? null,
    contact_id: inputs.contact_id ?? null,
    opportunity_id: inputs.opportunity_id ?? null,
    discount_pct: discountPct,
    discount_amount_cents: discountAmountCents,
    down_payment_pct: downPaymentPct,
    down_payment_amount_cents: downPaymentAmountCents,
    down_payment_count: downPaymentCount,
    monthly_pct: toCentsPct(inputs.monthly_pct ?? 0),
    monthly_amount_cents: toCents(inputs.monthly_amount ?? 0),
    monthly_count: monthlyCount,
    payment_plan: inputs.payment_plan ?? null,
  };
}

// -------- CÃ¡lculo determinista puro (no hay efectos de colateral, nada de cliente) --------

export function computeQuote(normalized: NormalizedQuoteInputs, listPriceCents: MoneyCents, rule: PricingRuleLimits): QuoteResult {
  if (!Number.isFinite(listPriceCents) || listPriceCents < 0) {
    throw new QuoteError(400, "list_price de la unidad no es vÃ¡lido.");
  }

  // discountAmount = discount_pct ? list_price * (discount_pct / 100) : discount_amount
  let discountAmountCents: MoneyCents;
  if (normalized.discount_pct > 0) {
    discountAmountCents = roundCents(Decimal(listPriceCents).mul(normalized.discount_pct).div(100).toNumber());
  } else {
    discountAmountCents = normalized.discount_amount_cents;
  }
  if (discountAmountCents > listPriceCents) {
    throw new QuoteError(400, "El descuento excede el precio lista de la unidad.");
  }

  // totalSale = list_price - discountAmount
  const totalSaleCents = listPriceCents - discountAmountCents;

  // downPaymentAmount = totalSale * (down_payment_pct / 100) ; si se enviÃ³ monto explÃ­cto (pct = 0) se usa ese monto
  let downPaymentAmountCents: MoneyCents;
  if (normalized.down_payment_pct > 0) {
    downPaymentAmountCents = roundCents(Decimal(totalSaleCents).mul(normalized.down_payment_pct).div(100).toNumber());
  } else {
    downPaymentAmountCents = normalized.down_payment_amount_cents;
  }
  if (downPaymentAmountCents > totalSaleCents) {
    throw new QuoteError(400, "El enganche excede el total de venta.");
  }

  // monthlyPool = totalSale - downPaymentAmount
  const monthlyPoolCents = totalSaleCents - downPaymentAmountCents;

  // monthlyAmount = monthlyPool / monthly_count (centavos enteros, reparto del cÃ©ntimo restante)
  let monthlyAmountCents = 0;
  const monthlyBreakdown: MonthlyPayment[] = [];
  let remainderCents = 0;

  if (normalized.monthly_count > 0) {
    monthlyAmountCents = Math.trunc(monthlyPoolCents / normalized.monthly_count);
    remainderCents = monthlyPoolCents - monthlyAmountCents * normalized.monthly_count;
    for (let i = 1; i <= normalized.monthly_count; i++) {
      const amount = monthlyAmountCents + (i <= remainderCents ? 1 : 0);
      monthlyBreakdown.push({
        payment_number: i,
        amount_cents: amount,
        amount_mxn: centsToMxn(amount),
      });
    }
  }

  const monthlyPct =
    totalSaleCents > 0
      ? roundCents(
          Decimal(monthlyAmountCents * normalized.monthly_count)
            .mul(100)
            .div(totalSaleCents)
            .toNumber(),
        )
      : 0;

  return {
    unit_id: normalized.unit_id,
    rule_version: rule.version,
    rule_name: rule.name,
    list_price_cents: listPriceCents,
    list_price_mxn: centsToMxn(listPriceCents),
    discount_pct: normalized.discount_pct,
    discount_amount_cents: discountAmountCents,
    discount_amount_mxn: centsToMxn(discountAmountCents),
    total_sale_cents: totalSaleCents,
    total_sale_mxn: centsToMxn(totalSaleCents),
    down_payment_pct: normalized.down_payment_pct,
    down_payment_amount_cents: downPaymentAmountCents,
    down_payment_amount_mxn: centsToMxn(downPaymentAmountCents),
    down_payment_count: normalized.down_payment_count,
    monthly_pool_cents: monthlyPoolCents,
    monthly_count: normalized.monthly_count,
    monthly_amount_cents: monthlyAmountCents,
    monthly_amount_mxn: centsToMxn(monthlyAmountCents),
    monthly_pct: monthlyPct,
    monthly_breakdown: monthlyBreakdown,
    remainder_cents: remainderCents,
    payment_plan: normalized.payment_plan,
    computed_at: new Date().toISOString(),
  };
}
