import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Decimal from "decimal.js";
import { type QuoteResult } from "./quoteEngine";

export interface PdfParams {
  quoteId: string;
  unit: any;
  project: any;
  calculation: QuoteResult;
}

export async function drawBrandedPdf(params: PdfParams): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const width = page.getWidth();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cenote = rgb(14 / 255, 107 / 255, 122 / 255);
  const grafito = rgb(26 / 255, 43 / 255, 59 / 255);
  const chukum = rgb(217 / 255, 201 / 255, 176 / 255);

  page.drawRectangle({ x: 0, y: page.getHeight() - 70, width, height: 70, color: cenote });
  page.drawText("ALTUM SURESTE", { x: 50, y: page.getHeight() - 42, size: 20, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Real Estate Caribe Mexicano", { x: 50, y: page.getHeight() - 58, size: 9, font, color: rgb(1, 1, 1) });
  page.drawText("COTIZACIÓN DE UNIDAD INMOBILIARIA", {
    x: width - 340,
    y: page.getHeight() - 45,
    size: 12,
    font: fontBold,
    color: cenote,
  });

  let y = page.getHeight() - 110;
  const field = (label: string, value: string) => {
    page.drawText(label, { x: 50, y, size: 8.5, font, color: grafito });
    page.drawText(value, { x: 50, y: y - 14, size: 11, font: fontBold, color: cenote });
    y -= 34;
  };

  page.drawText("DETALLE DE LA COTIZACIÓN", { x: 50, y, size: 12, font: fontBold, color: cenote });
  y -= 24;
  field("Número de cotización:", params.quoteId);
  field("Proyecto:", params.project.name);
  field("Unidad:", `${params.unit.block || ""} ${params.unit.unit_number || ""}`.trim());
  field("Nivel / Tipo:", `${params.unit.level ?? "-"} / ${params.unit.unit_type ?? "-"}`);
  field("Superficie:", `${params.unit.area_m2} m²`);
  field("Precio por m²:", new Decimal(String(params.unit.price_per_m2)).toFixed(2));
  field("Precio lista:", params.calculation.list_price_mxn);
  field("Descuento:", `-${params.calculation.discount_amount_mxn} (${params.calculation.discount_pct}%)`);
  field("TOTAL DE VENTA:", params.calculation.total_sale_mxn);
  field("Enganche:", `${params.calculation.down_payment_amount_mxn} (${params.calculation.down_payment_pct}%)`);
  field("Mensualidad:", `${params.calculation.monthly_amount_mxn} x ${params.calculation.monthly_count}`);
  field("Plan de pagos:", params.calculation.payment_plan ?? "Contado");

  y -= 10;
  page.drawRectangle({ x: 50, y: y - 4, width: 120, height: 16, color: chukum });
  page.drawText("TABLA DE PAGOS MENSUALES", { x: 55, y, size: 9, font: fontBold, color: cenote });
  y -= 24;
  page.drawText("Nº", { x: 50, y, size: 8.5, font: fontBold, color: grafito });
  page.drawText("Monto (MXN)", { x: 90, y, size: 8.5, font: fontBold, color: grafito });
  y -= 16;

  const visiblePayments = params.calculation.monthly_breakdown.slice(0, 40);
  if (visiblePayments.length === 0) {
    page.drawText("Contado (sin mensualidades)", { x: 50, y, size: 9, font, color: grafito });
    y -= 18;
  } else {
    for (const p of visiblePayments) {
      page.drawText(String(p.payment_number), { x: 50, y, size: 9, font, color: grafito });
      page.drawText(p.amount_mxn, { x: 90, y, size: 9, font, color: cenote });
      y -= 16;
    }
  }
  const remaining = params.calculation.monthly_breakdown.length - 40;
  if (remaining > 0) {
    page.drawText(`... y ${remaining} mensualidad(es) más.`, { x: 50, y, size: 8, font, color: grafito });
    y -= 18;
  }
  page.drawText(`Resto distribuido: ${params.calculation.remainder_cents} centavos en los primeros pagos.`, {
    x: 50,
    y: y - 6,
    size: 8,
    font,
    color: grafito,
  });
  y -= 22;

  page.drawText(`Estatus: borrador  ·  Generado: ${new Date(params.calculation.computed_at).toLocaleString("es-MX")}`, {
    x: 50,
    y: 40,
    size: 8,
    font,
    color: rgb(100 / 255, 116 / 255, 139 / 255),
  });
  page.drawText("ALTUM Sureste · Tenant acc_altum_sureste · Este documento es una cotización, no es un comprobante fiscal.", {
    x: 50,
    y: 28,
    size: 7.5,
    font,
    color: rgb(100 / 255, 116 / 255, 139 / 255),
  });

  return pdf.save();
}
