-- seed/altum_demo_real_estate.sql
-- Datos de demostración para el vertical Real Estate (tenant ALTUM Sureste).
-- SOLO para entorno local/demo. NO aplicar en producción sin aprobación de Pavel.
-- Todos los registros llevan is_demo = 1. Los lotes SOLETTA son referencia legacy de
-- crmlinmex.com y NO son ventas de Altum.

-- Proyecto Altum Mérida (demo)
INSERT OR REPLACE INTO re_projects (id, tenant_id, name, city, currency, total_units, is_demo, created_at)
VALUES (
  're_proj_altum_merida',
  'acc_altum_sureste',
  'Altum Mérida',
  'Mérida',
  'MXN',
  80,
  1,
  datetime('now')
);

-- 80 unidades: 4 torres × 20 unidades, precios variables, estatus mixtos
-- (mayoría disponible, algunos apartado/vendido, uno bloqueado)
WITH RECURSIVE gen(n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM gen WHERE n < 80
),
base AS (
  SELECT
    n,
    CASE (n - 1) / 20 WHEN 0 THEN 'Torre A' WHEN 1 THEN 'Torre B' WHEN 2 THEN 'Torre C' ELSE 'Torre D' END AS block,
    ((n - 1) % 20) / 4 + 1 AS level,
    CASE (n - 1) / 20 WHEN 0 THEN 'Torre A' WHEN 1 THEN 'Torre B' WHEN 2 THEN 'Torre C' ELSE 'Torre D' END || '-' || printf('%02d', ((n - 1) % 20) + 1) AS unit_number,
    CAST(45 + (abs(random()) % 76) AS REAL) AS area_m2,
    CAST(18000 + (abs(random()) % 14001) AS REAL) AS price_per_m2,
    CASE WHEN abs(random()) % 100 < 60 THEN 'disponible'
         WHEN abs(random()) % 100 < 72 THEN 'apartado'
         WHEN abs(random()) % 100 < 79 THEN 'vendido'
         ELSE 'bloqueado' END AS status,
    CASE n % 4 WHEN 0 THEN 'Estudio' WHEN 1 THEN '1 recámara' WHEN 2 THEN '2 recámaras' ELSE '3 recámaras' END AS unit_type
  FROM gen
)
INSERT INTO re_units (id, project_id, block, level, unit_number, area_m2, price_per_m2, list_price, status, unit_type, is_demo, created_at)
SELECT
  're_unit_' || printf('%03d', n),
  're_proj_altum_merida',
  block,
  level,
  unit_number,
  area_m2,
  price_per_m2,
  ROUND(area_m2 * price_per_m2, 2),
  status,
  unit_type,
  1,
  datetime('now')
FROM base;

-- SOLETTA referencia legacy (crmlinmex.com) — NO son ventas de Altum, solo referencia visual
INSERT OR REPLACE INTO re_projects (id, tenant_id, name, city, currency, total_units, is_demo, created_at)
VALUES (
  're_proj_soletta_referencia',
  'acc_altum_sureste',
  'SOLETTA (referencia legacy crmlinmex.com — NO VENTAS ALTUM)',
  'Mérida',
  'MXN',
  2,
  1,
  datetime('now')
);

INSERT INTO re_units (id, project_id, block, level, unit_number, area_m2, price_per_m2, list_price, status, unit_type, is_demo, created_at) VALUES
  ('re_unit_soletta_003', 're_proj_soletta_referencia', 'E3', 1, 'Unit 3', 160.0, 5000.0, 800000.0, 'vendido', 'Lote', 1, datetime('now')),
  ('re_unit_soletta_017', 're_proj_soletta_referencia', 'E3', 1, 'Unit 17', 160.0, 5512.5, 882000.0, 'vendido', 'Lote', 1, datetime('now'));

-- Plantilla de propuesta para borrador de cotización (demo, nunca se envía sin aprobación)
INSERT OR REPLACE INTO email_templates (id, tenant_id, name, slug, category, subject, html_content, variables_json, is_active)
VALUES (
  'tmpl_demo_propuesta_enterprise',
  'acc_altum_sureste',
  'ALTUM · Propuesta Enterprise (borrador demo)',
  'propuesta_enterprise',
  'propuesta',
  'ALTUM Sureste · Propuesta para {{contacto_nombre}} — {{propiedad_nombre}}',
  '<p>Estimado/a {{contacto_nombre}}:</p><p>Borrador de propuesta para <strong>{{propiedad_nombre}}</strong> en {{region_destino}}. Monto de reserva {{monto_apartado}} MXN. CLABE STP {{clabe_stp}}.</p><p><a href="{{checkout_url}}">Revisar propuesta</a></p><p style="color:#6B7682;font-size:12px;">Borrador preparado por Ark Sales CRM. No se envía correo ni WhatsApp sin dry_run y aprobación de Pavel en el chat.</p>',
  '["contacto_nombre","propiedad_nombre","region_destino","clabe_stp","monto_apartado","checkout_url"]',
  1
);
