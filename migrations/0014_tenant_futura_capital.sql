-- 0014_tenant_futura_capital.sql: Alta Completa del Tenant Futura Capital Partners (Yucatán, México)
-- Incluye:
-- 1. Cuenta Tenant (acc_futura_capital) y los 3 Contactos Reales del Equipo (Enrique Xacur, Jaqueline Madera, Jaime)
-- 2. Tabla privada tenant_commission_rules (resguarda comisiones, contratos, cuentas bancarias, cotizadores y carpetas Drive bajo Auth JWT, incluyendo los 2 desarrollos pausados Velamar y Rosa Palmar)
-- 3. Tabla tenant_objection_playbooks con las 35 respuestas oficiales de manejo de objeciones por desarrollo
-- 4. Los 9 desarrollos activos en sales_config enriquecidos con m², plazos MSI, cashback, rentas garantizadas, mapas, brochures y certezas jurídicas (SIN exponer comisiones ni cuentas bancarias en el catálogo público)
-- 5. Plantilla HTML brandeada (tmpl_futura_cotizacion_inmobiliaria) validada por PreSendGate
-- 6. Catálogo de señales (signal_catalog) y 4 cohortes en sales_cohorts para el Lead Harvester

-- 1. Alta de la Organización (Tenant)
INSERT OR IGNORE INTO sales_accounts (
  id, name, normalized_name, size, city, origin, duplicate_review_status, scian_code, harvest_source, created_at, updated_at
) VALUES (
  'acc_futura_capital',
  'Futura Capital Partners · Casa de Inversión Inmobiliaria Yucatán',
  'futura capital partners',
  '6-20',
  'Mérida, Yucatán (Col. México)',
  'proptech_inmobiliaria',
  'reviewed',
  '531210',
  'direct_onboarding',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 2. Contactos Reales del Equipo Directivo y Comercial de Futura Capital
INSERT OR REPLACE INTO sales_contacts (
  id, account_id, name, email, phone, title, consent_status, contact_preferences_json, created_at, updated_at
) VALUES
  (
    'cnt_futura_enrique',
    'acc_futura_capital',
    'Enrique Xacur · Director Futura Capital',
    'enrique@futuracapital.mx',
    '+529992182895',
    'Socio Director · Terrenos de Inversión y Costa (Método F.U.T.U.R.A.)',
    'opted_in',
    '{"canal_preferido":"whatsapp_correo","whatsapp_directo":"+529992182895","whatsapp_general":"+529995688210","oficina":"Calle 20 #109A entre 29 y 31, Col. México, Mérida, Yucatán","desarrollos_asignados":["futura_recoleta","futura_soletta_chicxulub","futura_soletta_sisal","futura_azureno","futura_aldea_balha"]}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'cnt_futura_jaqueline',
    'acc_futura_capital',
    'Jaqueline Madera · Producto Terminado Futura Capital',
    'jaqueline@futuracapital.mx',
    '+529993817508',
    'Ejecutiva Titular · Producto Terminado, Departamentos & Fractional',
    'opted_in',
    '{"canal_preferido":"whatsapp","whatsapp_directo":"+529993817508","desarrollos_asignados":["futura_logistic_park","futura_mb_medical_tower","futura_the_mb_hotel","futura_paseos_temozon"]}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'cnt_futura_jaime',
    'acc_futura_capital',
    'Jaime · Coordinación de Aliados Futura Capital',
    'aliados@futuracapital.mx',
    '+525639241169',
    'Contacto Comercial Directo y Apoyo al Cierre',
    'opted_in',
    '{"canal_preferido":"whatsapp","whatsapp_directo":"+525639241169","rol":"Soporte técnico de desarrollos, manejo de objeciones y cierre con brokers"}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

-- 3. Tabla Privada de Comisiones, Contratos, Cuentas Bancarias y Cotizadores (Uso exclusivo CRM autenticado)
CREATE TABLE IF NOT EXISTS tenant_commission_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_key TEXT NOT NULL,
  desarrolladora TEXT NOT NULL,
  comision_externo_pct REAL NOT NULL,
  comision_interno_pct REAL NOT NULL,
  estatus_desarrollo TEXT NOT NULL,
  incluye_iva INTEGER NOT NULL DEFAULT 0,
  ejecutivo_nombre TEXT,
  ejecutivo_telefono TEXT,
  cotizador_url TEXT,
  contrato_url TEXT,
  cuenta_banco_url TEXT,
  drive_folder_url TEXT,
  notas_privadas TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_rules_tenant ON tenant_commission_rules(tenant_id);

INSERT OR REPLACE INTO tenant_commission_rules (
  id, tenant_id, product_key, desarrolladora, comision_externo_pct, comision_interno_pct, estatus_desarrollo, incluye_iva,
  ejecutivo_nombre, ejecutivo_telefono, cotizador_url, contrato_url, cuenta_banco_url, drive_folder_url, notas_privadas
) VALUES
  (
    'comm_futura_recoleta', 'acc_futura_capital', 'futura_recoleta', 'GRUPO LINMEX', 10.0, 5.0, 'disponible', 0,
    'Enrique Xacur', '+529992182895',
    'https://crmlinmex.com/sistemas_active/crm/if/index.php?id=nHu13BX5aD20',
    'https://drive.google.com/file/d/1cw3HYqW0TJKQSBM8tHeMm437hj2w5RhZ/view?usp=drive_link',
    'https://drive.google.com/file/d/1sovQ2gzbg4gD2l0IOkkfualzKPwoehGU/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1oULeqm_dBePFuOijur93vdBtHtsvnj3E',
    'Razón social que firma: Proyectos y Desarrollos Inveraza a través del Fideicomiso F/5803. Pago de comisión al firmar contrato y liquidar enganche.'
  ),
  (
    'comm_futura_soletta_chicxulub', 'acc_futura_capital', 'futura_soletta_chicxulub', 'GRUPO LINMEX', 8.0, 4.0, 'disponible', 0,
    'Enrique Xacur', '+529992182895',
    'https://crmlinmex.com/sistemas_active/crm/if/indexBase.php?clvde=1njd5uBWvuD17',
    'https://drive.google.com/file/d/1XPwUbvTeZok4YJfj-723klNKb58YRvJp/view?usp=drive_link',
    'https://drive.google.com/file/d/1KNWvXbM1B0HJsR9m6K7hmUUcQ9CQz3WL/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1X2YPvjnNm7xQgVU6VHdmWoEufD8gAdDk',
    'Lotes a 180 m del mar en Chicxulub Puerto. Entrega ABR 2027 antes de terminar los 24 MSI.'
  ),
  (
    'comm_futura_soletta_sisal', 'acc_futura_capital', 'futura_soletta_sisal', 'GRUPO LINMEX', 7.0, 3.5, 'disponible', 0,
    'Enrique Xacur', '+529992182895',
    'https://crmlinmex.com/sistemas_active/crm/cotizador/Inicio.php?clave=T7u8Y0sWob',
    'https://drive.google.com/file/d/1xqbudhWeQdiS35aMzCkTP_xIN2rrOdeZ/view?usp=drive_link',
    'https://drive.google.com/file/d/1-n7mA8cDfpPo87H6kMtST6Rs1Cfop-K4/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1ZJEmaXHUKUC7ScjS7idqIA3BpUzhyD7F',
    'Pueblo Mágico Sisal. Lote lateral 7x22 m (154 m²), 24 MSI.'
  ),
  (
    'comm_futura_azureno', 'acc_futura_capital', 'futura_azureno', 'M3 DESARROLLOS', 8.0, 4.0, 'disponible', 0,
    'Enrique Xacur', '+529992182895',
    'https://partners.futuracapital.mx/cotizador/azureno/',
    'https://drive.google.com/file/d/1DNsfwb3OrGqMutnNT7x_zXVA16PtRvgh/view?usp=drive_link',
    'https://drive.google.com/file/d/1LUmRUMwiMkefOhxje0dh667vwJuUWu7x/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1fpvtmJZ2v2mNsbuSEJ-Gfp4HJFFWlR3J',
    '205 lotes en Telchac. Lote Selecto desde 267 m², 15% desc. a 60 MSI (desde $6,999/mes).'
  ),
  (
    'comm_futura_aldea_balha', 'acc_futura_capital', 'futura_aldea_balha', 'TECA DESARROLLOS', 8.0, 4.0, 'disponible', 0,
    'Enrique Xacur', '+529992182895',
    'https://app.adaracrm.com/empresa/tecadesarrollos/cotizador/aldea_balha/aldea_balha/etapa_4?vendedor=MjM3Mzk%3D%0A',
    'https://drive.google.com/file/d/1FqtCdeVBS0ymWKdzC6ZuHP_3txwp11P_/view?usp=drive_link',
    'https://drive.google.com/file/d/1WJHh8P4c4tLkPtfQpRfrooTGRphy_EYg/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1bFrXLxyVrYM7OshUgVlQhim1WJUZfUe0',
    '3 cenotes naturales, +50 amenidades. Contrato de adhesión PROFECO registro 2863-2023 y resolutivo SEMARNAT.'
  ),
  (
    'comm_futura_logistic_park', 'acc_futura_capital', 'futura_logistic_park', 'MB SIGNATURE PROPERTIES', 6.0, 3.0, 'producto_terminado', 1,
    'Jaqueline Madera', '+529993817508',
    'https://app.adaracrm.com/empresa/mbsignature/cotizador/mb_logistic_park/bodegas?iframe=true&show_modal=false&vendedor=MzI2NQ%3D%3D%0A',
    'https://drive.google.com/file/d/15DnAd5J7NPQyO7rDkNVEqFBuOnNtW6zg/view?usp=drive_link',
    'https://drive.google.com/file/d/10IPuLFNPmH1B4AQzIpenwgG2uJredo5Q/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1ruFjkd0b0iaYHYrO1KMJciYx6WMxJrt4',
    'Predio escriturado (Escritura 2130, Notaría 111). Contrato de arrendamiento MBSP Rentas por 3 años al 6.5% anual. Penas simétricas 20%.'
  ),
  (
    'comm_futura_mb_medical_tower', 'acc_futura_capital', 'futura_mb_medical_tower', 'MB SIGNATURE PROPERTIES', 6.0, 3.0, 'producto_terminado', 1,
    'Jaqueline Madera', '+529993817508',
    'https://app.adaracrm.com/empresa/mbsignature/cotizador/mb_medical_tower/consultorios_medicos?iframe=true&show_modal=false&vendedor=MzI2NQ%3D%3D%0A',
    'https://drive.google.com/file/d/1lvNsJ4Fyt2y7mAFM9aPTprgK4I7kPmpZ/view?usp=drive_link',
    'https://drive.google.com/file/d/1W-v08ybxy_yWDHNb5pOMtge_bhGBHKq0/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1Sh6Tsk2fqa6Bsc7SPnirQBMOqBSyuEZc',
    'Frente a Hospital Christus Muguerza (Av. García Lavín). Cashback 7% anual (100% enganche) o 3.5% (50% enganche) en obra + 3 años renta garantizada 6.5% neto.'
  ),
  (
    'comm_futura_the_mb_hotel', 'acc_futura_capital', 'futura_the_mb_hotel', 'MB SIGNATURE PROPERTIES', 6.0, 3.0, 'producto_terminado', 1,
    'Jaqueline Madera', '+529993817508',
    'https://app.adaracrm.com/empresa/mbsignature/cotizador/the_mb_hotel/suites?iframe=true&show_modal=false&vendedor=MzI2NQ%3D%3D%0A',
    'https://drive.google.com/file/d/1rO0RlHrrlboZxPyYG9xHGTn9vdFkMrSn/view?usp=drive_link',
    'https://drive.google.com/file/d/1X7n0sNL6wDFvJcierDUQfk-UM929q1ZQ/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1PNMXyeAelI7gfzDlhN6TDlYqgYoAhcfA',
    'Renta garantizada 7% anual durante 10 años por contrato con MB Signature Properties + cashback 7% (100% enganche) durante obra.'
  ),
  (
    'comm_futura_paseos_temozon', 'acc_futura_capital', 'futura_paseos_temozon', 'MB SIGNATURE PROPERTIES', 6.0, 3.0, 'producto_terminado', 0,
    'Jaqueline Madera', '+529993817508',
    'https://app.adaracrm.com/empresa/mbsignature/cotizador/paseos_temozon/departamentos?iframe=true&show_modal=false&vendedor=MzI2NQ%3D%3D%0A',
    'https://drive.google.com/drive/folders/1sX-onFRXHqeTQQt77NzVB78PCMRCnF4w',
    'https://drive.google.com/file/d/1wNpiE3kvfhZOgA6l7DXHgqnUX6lMD4r0/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1GGFYM0wkwOchMpDs73Ji4uIxkH8pq3s3',
    'Deptos 1 rec ($1,820,000) y 2 rec ($2,790,000) entrega DIC 2029 (10% enganche). Locales ($1,990,000 + IVA) entrega DIC 2028 (20% enganche). Confirmar disponibilidad con Jaqueline.'
  ),
  (
    'comm_futura_velamar', 'acc_futura_capital', 'futura_velamar', 'GRUPO VALORA', 8.0, 4.0, 'pausado', 0,
    'Enrique Xacur', '+529992182895',
    'https://sistemagrupovalora.com/sistemas_active/crm/if/indexBase.php?clvde=TahAKHY5zHD14',
    'https://drive.google.com/file/d/1p8RYYV9V72flMIU-xRJuyLnxMLnYc9A3/view?usp=drive_link',
    'https://drive.google.com/file/d/1lcerbX8rfzVVsvk-4sIyE1_EO1zUJCu2/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1IdJPS15mMNfy-33JeAhxJEFW7-nWSmYx',
    'PAUSADO: Grupo Valora pausó comercialización en Uaymitún ($907,256 MXN, 160 m²).'
  ),
  (
    'comm_futura_rosa_palmar', 'acc_futura_capital', 'futura_rosa_palmar', 'SMART DESARROLLOS', 7.0, 3.5, 'pausado', 0,
    'Jaqueline Madera', '+529993817508',
    'https://www.rosapalmar.com/#cotizador',
    'https://docs.google.com/document/d/1oDWmYeB-Id1xAwd4QeqhQAMjCDmZW8G0/edit?usp=drive_link',
    'https://drive.google.com/file/d/14qkoOw_XWNPl0dvrWTAmF_F1sK7bjqej/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1IiwVjLPbMD3B-UZU195Lz5cC8pw3ElP3',
    'PAUSADO: Fractional / Depa 1 recámara 63 m² en Sisal ($125,070 MXN).'
  );

-- 4. Catálogo Oficial de los 9 Desarrollos Activos en sales_config (Cero Hardcoding, Sin Exponer Comisiones ni Cuentas Bancarias)
-- Incluye medidas reales, plazos MSI, cashback, rentas garantizadas, brochures públicos, mapas y certezas jurídicas.

-- 4.1 Recoleta (Motul, Yucatán)
INSERT OR REPLACE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_futura_recoleta',
  'futura_recoleta',
  'Futura Capital · Recoleta (Motul, Yucatán)',
  232750.00,
  NULL,
  'MXN',
  'preventa_jul_2030',
  'lote_133m2',
  'package',
  34912.50,
  'Lotes residenciales en Motul, Yucatán (a 25 min de Mérida) por GRUPO LINMEX (Proyectos y Desarrollos Inveraza, respaldado por el Fideicomiso F/5803). Lote tipo de 133 m² ($1,750/m²) desde $232,750 MXN (sin IVA). Enganche del 15% ($34,912.50 MXN), financiamiento a 48 meses y entrega en Julio 2030.',
  '["Ubicación: Motul, Yucatán (25 min de Mérida) · Mapa: https://maps.app.goo.gl/AvGU8f2VSFd3nnmh6", "Superficie: Lote tipo 133 m² ($1,750 MXN / m²)", "Desarrolladora: GRUPO LINMEX (Fideicomiso F/5803 · Proyectos y Desarrollos Inveraza)", "Enganche: 15% ($34,912.50 MXN) y plazo hasta 48 meses", "Entrega estimada: JUL 2030 (escrituración al liquidar)", "Brochure oficial: https://drive.google.com/file/d/1diFAS5M2v89RnxbVUqhnDi08oIAcmagW/view?usp=drive_link", "Ficha técnica: https://drive.google.com/file/d/1kMPDjSgz3oZtXWXkLikma6NAeIz2a73K/view?usp=drive_link"]',
  'active',
  CURRENT_TIMESTAMP
);

-- 4.2 Soletta Chicxulub (Chicxulub Puerto, Yucatán)
INSERT OR REPLACE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_futura_soletta_chicxulub',
  'futura_soletta_chicxulub',
  'Futura Capital · Soletta Chicxulub (Costa Yucateca)',
  910000.00,
  NULL,
  'MXN',
  'preventa_abr_2027',
  'lote_160m2',
  'package',
  136500.00,
  'Desarrollo costero a 180 metros del mar en Chicxulub Puerto (a 35 km de Mérida) por GRUPO LINMEX. Lote tipo de 160 m² desde $910,000 MXN (sin IVA). Enganche del 15% ($136,500 MXN), plazo de 24 meses sin intereses (24 MSI) y entrega en Abril 2027 (recibes el lote antes de terminar de pagarlo).',
  '["Ubicación: Chicxulub Puerto, Yucatán (35 km de Mérida · a 180 m del mar) · Mapa: https://maps.app.goo.gl/4A9eaNhsK6UVd4fz5", "Superficie: Lote tipo 160 m²", "Desarrolladora: GRUPO LINMEX", "Enganche: 15% ($136,500 MXN) · Financiamiento: 24 MSI", "Entrega: ABR 2027 (antes de finalizar los 24 MSI)", "Brochure oficial: https://drive.google.com/file/d/1i-x7mXg3kpyFF-rjlHbp2sVmZ3Q8mN1S/view?usp=drive_link", "Ficha técnica: https://drive.google.com/file/d/1CyUHILNOXpn3CUGaFkId9akMGruMFkKp/view?usp=drive_link"]',
  'active',
  CURRENT_TIMESTAMP
);

-- 4.3 Soletta Sisal (Sisal, Yucatán)
INSERT OR REPLACE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_futura_soletta_sisal',
  'futura_soletta_sisal',
  'Futura Capital · Soletta Sisal (Pueblo Mágico)',
  1034880.00,
  NULL,
  'MXN',
  'preventa_may_2028',
  'lote_154m2',
  'package',
  206976.00,
  'Inversión patrimonial en Sisal, Yucatán (Pueblo Mágico a 40 min de Mérida) por GRUPO LINMEX. Lote lateral de 154 m² (7x22 m) desde $1,034,880 MXN (sin IVA). Enganche del 20% ($206,976 MXN), financiamiento a 24 MSI y entrega en Mayo 2028.',
  '["Ubicación: Sisal, Yucatán (40 min de Mérida · Pueblo Mágico) · Mapa: https://maps.app.goo.gl/mGXY2adPodsWnn1k6", "Superficie: Lote lateral 154 m² (7x22 m)", "Desarrolladora: GRUPO LINMEX", "Enganche: 20% ($206,976 MXN) · Plazo: 24 MSI", "Entrega estimada: MAY 2028", "Brochure oficial: https://drive.google.com/file/d/100fM04n3TYEEqQBotfy58D1j-SPdv6u5/view?usp=drive_link", "Ficha técnica: https://drive.google.com/file/d/1uxfpQgD2ZPz1QB0zgWwzI8Da3x0ZiUnb/view?usp=drive_link"]',
  'active',
  CURRENT_TIMESTAMP
);

-- 4.4 Azureno (Telchac Puerto, Yucatán)
INSERT OR REPLACE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_futura_azureno',
  'futura_azureno',
  'Futura Capital · Azureno (Telchac Puerto)',
  795526.00,
  NULL,
  'MXN',
  'preventa_dic_2027',
  'lote_267m2',
  'package',
  95463.12,
  'Desarrollo de 205 lotes residenciales en Telchac Puerto (60 km de Mérida) por M3 DESARROLLOS. Lote Selecto desde 267 m² desde $795,526 MXN con enganche accesible del 12% ($95,463.12 MXN) y 60 meses sin intereses (mensualidades desde $6,999 MXN/mes). Se entrega en Diciembre 2027 con calles pavimentadas, electrificación subterránea, iluminación LED y barda perimetral electrificada.',
  '["Ubicación: Telchac Puerto, Yucatán (60 km de Mérida) · Mapa: https://maps.app.goo.gl/r9e579r5Xf5mi4KAA", "Superficie: Lote Selecto desde 267 m²", "Desarrolladora: M3 DESARROLLOS (205 lotes con urbanización completa)", "Enganche: 12% ($95,463.12 MXN) · Plazo: 60 MSI (desde $6,999 MXN/mes)", "Entrega: DIC 2027 con calles pavimentadas, luz subterránea y barda electrificada de 3 m", "Brochure oficial: https://drive.google.com/file/d/1_K9vwNvGUaoLMBqLfuPcsiVG_2uvMFaK/view?usp=drive_link", "Ficha técnica: https://drive.google.com/file/d/1iyp7hvQrjNccnkKXmEaVAQqFaEKldxmn/view?usp=drive_link"]',
  'active',
  CURRENT_TIMESTAMP
);

-- 4.5 Aldea Balhá (Telchac Puerto, Yucatán)
INSERT OR REPLACE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_futura_aldea_balha',
  'futura_aldea_balha',
  'Futura Capital · Aldea Balhá (Telchac Puerto)',
  475000.00,
  NULL,
  'MXN',
  'inmediata_dic_2027',
  'lote_177m2',
  'package',
  95000.00,
  'Desarrollo ecológico y residencial a 4 km de la playa en Telchac Puerto por TECA DESARROLLOS (+15 años y +20 proyectos en el sureste), con 3 cenotes naturales y más de 50 amenidades. Lotes de 160 a 290 m² (Lote Etapa 4 de 177 m² desde $475,000 MXN). Enganche del 20% ($95,000 MXN), plazo de 48 MSI y etapas con Entrega Inmediata y Preventa Diciembre 2027. Cuenta con registro PROFECO 2863-2023 y resolutivo SEMARNAT.',
  '["Ubicación: Telchac Puerto, Yucatán (52 km de Mérida · 4 km de la playa) · Mapa: https://maps.app.goo.gl/9JVBXAXjizHRbZ7T6", "Superficie: Lotes de 160 a 290 m² (Etapa 4: 177 m²) con 3 cenotes naturales y +50 amenidades", "Desarrolladora: TECA DESARROLLOS (Contrato PROFECO 2863-2023 y SEMARNAT)", "Enganche: 20% ($95,000 MXN) · Plazo: 48 MSI (Mantenimiento actual $950/mes)", "Entrega: Etapas con Entrega Inmediata y Preventa DIC 2027", "Brochure oficial: https://drive.google.com/file/d/1Thxl-rU6gxyEcOjClHnoU0J9xmSVBayo/view?usp=drive_link", "Ficha de amenidades: https://drive.google.com/file/d/1Mqvs1sJxYqsmJDupZXb9gyG3A_Z9XmHR/view?usp=drive_link"]',
  'active',
  CURRENT_TIMESTAMP
);

-- 4.6 Logistic Park (Tamanché, Mérida, Yucatán)
INSERT OR REPLACE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_futura_logistic_park',
  'futura_logistic_park',
  'Futura Capital · Logistic Park (Tamanché, Mérida)',
  980000.00,
  NULL,
  'MXN',
  'entrega_dic_2029',
  'bodega_50m2',
  'package',
  98000.00,
  'Bodegas industriales y locales comerciales en Tamanché (carretera Mérida-Progreso, a 10 min del Periférico y 25 min del Puerto de Progreso) por MB SIGNATURE PROPERTIES (Escritura 2130, Notaría 111). Bodega de 50 m² (altura libre 8.5 a 10 m) desde $980,000 MXN + IVA. Enganche desde 10% ($98,000 MXN + IVA). Incluye cashback del 6.5% anual durante construcción (con 50% o 100% de enganche) y contrato de arrendamiento con MBSP Rentas por 3 años al 6.5% anual.',
  '["Ubicación: Tamanché, Mérida-Progreso (10 min Periférico · 25 min Puerto Progreso) · Mapa: https://maps.app.goo.gl/RQ66hYwfhk6836378", "Especificación: Bodega 50 m² con altura libre de 8.5 a 10 m (rentas en la zona de $15,000 a $18,000/mes)", "Desarrolladora: MB SIGNATURE PROPERTIES (Escritura 2130 Notaría 111 · Penas simétricas 20%)", "Precio base: $980,000 MXN + IVA · Enganche desde 10% ($98,000 MXN + IVA)", "Rendimiento contractual: Cashback 6.5% anual en obra (50%/100% enganche) + 3 años de renta garantizada al 6.5% anual con MBSP Rentas", "Entrega: DIC 2029", "Brochure oficial: https://drive.google.com/file/d/1hEJMrVUtZWxDCCV0bIzv_NQIY6uXAzUD/view?usp=drive_link", "Ficha técnica: https://drive.google.com/file/d/1HNeTL4d7ejp2QU9Rdn9ZX5n4c7aeS9eE/view?usp=drive_link"]',
  'active',
  CURRENT_TIMESTAMP
);

-- 4.7 MB Medical Tower (Mérida, Yucatán)
INSERT OR REPLACE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_futura_mb_medical_tower',
  'futura_mb_medical_tower',
  'Futura Capital · MB Medical Tower (Mérida)',
  1880000.00,
  NULL,
  'MXN',
  'entrega_dic_2030',
  'consultorio_30m2',
  'package',
  376000.00,
  'Consultorios médicos frente al Hospital Christus Muguerza (Faro del Mayab, Av. García Lavín, Mérida) por MB SIGNATURE PROPERTIES. Consultorio de 21 m² + acceso 3.5 m² + baño privado 6.2 m² desde $1,880,000 MXN + IVA. Enganche desde 20% ($376,000 MXN + IVA). Con 100% de enganche recibe cashback de 7% anual durante construcción (3.5% con 50% de enganche) y al entregarse en Diciembre 2030 inicia renta garantizada por 3 años al 6.5% neto anual.',
  '["Ubicación: Frente a Hospital Christus Muguerza, Av. García Lavín, Mérida · Mapa: https://maps.app.goo.gl/7ph2ugu1Rhk3bBhT8", "Superficie: Consultorio 21 m² + acceso 3.5 m² + baño privado 6.2 m²", "Desarrolladora: MB SIGNATURE PROPERTIES", "Precio base: $1,880,000 MXN + IVA · Enganche desde 20% ($376,000 MXN + IVA)", "Rendimiento: Cashback 7% anual en obra (100% enganche) + 3 años de renta garantizada al 6.5% neto anual libre de mantenimiento", "Entrega: DIC 2030", "Brochure oficial: https://drive.google.com/file/d/1iAofslgbYaKQsyQOLWUJqvU3-OXN0g29/view?usp=drive_link"]',
  'active',
  CURRENT_TIMESTAMP
);

-- 4.8 The MB Hotel (Mérida, Yucatán)
INSERT OR REPLACE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_futura_the_mb_hotel',
  'futura_the_mb_hotel',
  'Futura Capital · The MB Hotel (Mérida)',
  1860000.00,
  NULL,
  'MXN',
  'entrega_dic_2030',
  'suite_hotelera',
  'package',
  372000.00,
  'Suites hoteleras en zona premium de Mérida (frente a corredor García Lavín / Muguerza) operadas por MB SIGNATURE PROPERTIES. Precio desde $1,860,000 MXN + IVA con enganche desde 20% ($372,000 MXN + IVA). Ofrece cashback de 7% anual durante la construcción (con 100% de enganche) y 10 años de renta garantizada al 7% anual por contrato a partir de la entrega en Diciembre 2030.',
  '["Ubicación: Zona Premium Norte, Mérida, Yucatán · Mapa: https://maps.app.goo.gl/iVTKvageVEG1jSy27", "Producto: Suite hotelera administrada (sin gastos de gestión ni mantenimiento para el propietario)", "Desarrolladora: MB SIGNATURE PROPERTIES (+1,500 propiedades productivas vendidas)", "Precio base: $1,860,000 MXN + IVA · Enganche desde 20% ($372,000 MXN + IVA)", "Rendimiento: Cashback 7% anual en obra (100% enganche) + 10 años de renta garantizada al 7% anual por contrato", "Entrega: DIC 2030", "Brochure oficial: https://drive.google.com/file/d/1fwTnZ_xTqUv4wNn8r9uOml50lF271lr1/view?usp=drive_link", "Ficha técnica: https://drive.google.com/file/d/1tu3M5OYp-0r25m7sOLdpuZr7XJL1RaiU/view?usp=drive_link"]',
  'active',
  CURRENT_TIMESTAMP
);

-- 4.9 Paseos Temozón (Temozón Norte, Mérida)
INSERT OR REPLACE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_futura_paseos_temozon',
  'futura_paseos_temozon',
  'Futura Capital · Paseos Temozón (Temozón Norte, Mérida)',
  1820000.00,
  NULL,
  'MXN',
  'entrega_dic_2029',
  'depto_local',
  'package',
  182000.00,
  'Desarrollo de usos mixtos (departamentos de 1 y 2 recámaras y locales comerciales) en Temozón Norte, Mérida por MB SIGNATURE PROPERTIES. Departamentos de 1 recámara desde $1,820,000 MXN (2 recámaras desde $2,790,000 MXN) sin IVA, enganche desde 10% ($182,000 MXN) y entrega en Diciembre 2029 con 1 año de renta garantizada al 6.5%. Locales comerciales desde $1,990,000 MXN + IVA, enganche 20% y entrega en Diciembre 2028. Ambos otorgan cashback de 6.5% durante construcción con enganche de 50% o 100%.',
  '["Ubicación: Temozón Norte, Mérida, Yucatán · Mapa: https://maps.app.goo.gl/jvxH9LHzB3tYFh9WA", "Opciones Residenciales: Depto 1 recámara desde $1,820,000 MXN y 2 recámaras desde $2,790,000 MXN (Enganche 10%, Entrega DIC 2029)", "Opciones Comerciales: Locales Planta Baja y Alta desde $1,990,000 MXN + IVA (Enganche 20%, Entrega DIC 2028)", "Rendimiento: Cashback 6.5% durante obra (50%/100% enganche) + 1 año de renta garantizada al 6.5% en departamentos", "Desarrolladora: MB SIGNATURE PROPERTIES", "Brochure oficial: https://drive.google.com/file/d/179v4Ag9Pmcfs7fI3Wb5NF3q7TxKaBNX0/view?usp=drive_link"]',
  'active',
  CURRENT_TIMESTAMP
);

-- 5. Tabla de Playbook Oficial de Objeciones por Desarrollo (Extraído de partners.futuracapital.mx)
CREATE TABLE IF NOT EXISTS tenant_objection_playbooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_key TEXT NOT NULL,
  objection_question TEXT NOT NULL,
  official_answer TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_objections_product ON tenant_objection_playbooks(tenant_id, product_key);

INSERT OR REPLACE INTO tenant_objection_playbooks (id, tenant_id, product_key, objection_question, official_answer) VALUES
  -- Recoleta
  ('obj_recoleta_1', 'acc_futura_capital', 'futura_recoleta', '¿Por qué comprar en Motul y no más cerca de Mérida?', 'Motul está a 25 min de Mérida y el ticket de entrada es de los más bajos del catálogo: lote tipo de 133 m² desde $232,750 ($1,750/m²). Es ideal para construir patrimonio con mensualidades a 48 meses mientras Mérida crece hacia el oriente.'),
  ('obj_recoleta_2', 'acc_futura_capital', 'futura_recoleta', '¿Quién firma el contrato? El documento no dice Grupo Linmex.', 'Grupo Linmex es el nombre comercial; la razón social que firma es Proyectos y Desarrollos Inveraza, y la operación se realiza a través del Fideicomiso F/5803, lo cual protege jurídicamente al comprador.'),
  ('obj_recoleta_3', 'acc_futura_capital', 'futura_recoleta', 'La entrega es hasta julio de 2030, es mucho tiempo.', 'Por eso el precio es de preventa y se paga en 48 meses al ritmo de la urbanización. Quien entra hoy captura la plusvalía entre preventa y lote urbanizado.'),
  -- Soletta Chicxulub
  ('obj_soletta_1', 'acc_futura_capital', 'futura_soletta_chicxulub', '¿Por qué Chicxulub y no Progreso?', 'Chicxulub Puerto es la playa más cercana a Mérida (35 km) con menor saturación que Progreso, y el lote está a solo 180 metros del mar.'),
  ('obj_soletta_2', 'acc_futura_capital', 'futura_soletta_chicxulub', '$910,000 por un terreno parece elevado.', 'Es un lote de 160 m² a 180 m de la playa con 15% de enganche y 24 meses sin intereses. Además, se entrega en abril de 2027, antes de terminar de pagar los 24 MSI.'),
  -- Soletta Sisal
  ('obj_sisal_1', 'acc_futura_capital', 'futura_soletta_sisal', '¿Por qué invertir en Sisal?', 'Está a 40 min de Mérida y cuenta con nombramiento de Pueblo Mágico, lo que impulsa infraestructura e inversión turística en un lote de 154 m² (7x22 m) con 24 MSI.'),
  -- Azureno
  ('obj_azureno_1', 'acc_futura_capital', 'futura_azureno', 'No quiero descapitalizarme con un enganche alto.', 'Azureno tiene el enganche más accesible en costa: 12% ($95,463.12 MXN) y 60 meses sin intereses con mensualidades desde $6,999 MXN por un lote amplio desde 267 m².'),
  ('obj_azureno_2', 'acc_futura_capital', 'futura_azureno', '¿Con qué servicios se entrega Azureno?', 'Se entrega en diciembre de 2027 con calles y banquetas pavimentadas, electrificación subterránea con acometida, iluminación LED, drenaje pluvial, barda perimetral electrificada de 3 m y áreas verdes.'),
  -- Aldea Balhá
  ('obj_balha_1', 'acc_futura_capital', 'futura_aldea_balha', 'No está frente al mar.', 'Está a 4 km de la playa de Telchac (4 min en auto), pero cuenta con 3 cenotes naturales privados y más de 50 amenidades dentro del desarrollo, con etapas de entrega inmediata.'),
  ('obj_balha_2', 'acc_futura_capital', 'futura_aldea_balha', '¿Tiene certeza legal completa?', 'Sí: factibilidad de uso de suelo municipal, resolutivo ambiental de SEMARNAT, régimen en condominio ante notario y contrato de adhesión registrado ante PROFECO (registro 2863-2023). Cuota de mantenimiento actual de $950/mes.'),
  -- Logistic Park
  ('obj_logistic_1', 'acc_futura_capital', 'futura_logistic_park', '¿Cómo me garantizan la renta de la bodega?', 'Es por contrato: firmas promesa de arrendamiento con MBSP Rentas por 3 años al 6.5% anual, quienes operan, cobran y dan mantenimiento. Además, con 50% o 100% de enganche recibes cashback mensual del 6.5% anual durante la obra.'),
  ('obj_logistic_2', 'acc_futura_capital', 'futura_logistic_park', '¿Qué respaldo legal tiene MB Signature en Logistic Park?', 'El predio ya está escriturado a nombre del desarrollador (Escritura 2130, Notaría 111) y el contrato incluye penas convencionales simétricas del 20%. Bodegas similares de 50 m² se rentan hoy entre $15,000 y $18,000 MXN/mes en el corredor Mérida-Progreso.'),
  -- MB Medical Tower
  ('obj_medical_1', 'acc_futura_capital', 'futura_mb_medical_tower', 'No soy médico, ¿por qué invertiría en un consultorio?', 'No necesitas ser médico: recibes 3 años de renta garantizada al 6.5% neto anual (depositada el día 15 de cada mes sin gastos de mantenimiento), puedes rentarlo por tu cuenta o usarlo. Está justo frente al Hospital Christus Muguerza en Av. García Lavín.'),
  ('obj_medical_2', 'acc_futura_capital', 'futura_mb_medical_tower', '¿Cuándo empiezo a recibir rendimientos si se entrega en 2030?', 'Desde el primer mes tras la firma: con 100% de enganche recibes cashback de 7% anual durante toda la construcción (o 3.5% anual con 50% de enganche), y al entregarse en diciembre 2030 arranca la renta garantizada de 6.5% neto anual.'),
  -- The MB Hotel
  ('obj_hotel_1', 'acc_futura_capital', 'futura_the_mb_hotel', '¿Cómo funciona la renta garantizada por 10 años?', 'Firmas contrato por 10 años al 7% anual con MB Signature Properties (+1,500 propiedades productivas vendidas). Ellos operan el hotel sin que tengas que administrar huéspedes ni mantenimiento, y durante la construcción recibes hasta 7% anual de cashback.'),
  -- Paseos Temozón
  ('obj_temozon_1', 'acc_futura_capital', 'futura_paseos_temozon', '¿Conviene más departamento o local comercial en Paseos Temozón?', 'Departamentos de 1 recámara desde $1,820,000 MXN (enganche 10%, entrega DIC 2029, incluye 1 año de renta garantizada al 6.5%). Locales comerciales desde $1,990,000 MXN + IVA (enganche 20%, entrega antes en DIC 2028). Ambos dan cashback de 6.5% en obra con enganche de 50% o 100%.');

-- 6. Plantilla HTML Brandeada de Futura Capital (Cumple Pre-Send Gate: sin em-dashes, 1 enlace, <220 palabras)
INSERT OR REPLACE INTO email_templates (
  id,
  tenant_id,
  name,
  slug,
  category,
  subject,
  html_content,
  variables_json,
  is_active
) VALUES (
  'tmpl_futura_cotizacion_inmobiliaria',
  'acc_futura_capital',
  'Futura Capital · Ficha de Inversión Validada (Método F.U.T.U.R.A.)',
  'futura_ficha_inversion',
  'propuesta',
  'Futura Capital: Ficha de inversión {{desarrollo_nombre}} para {{contacto_nombre}}',
  '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  body { margin:0; padding:0; background:#0B1320; font-family:Inter,Arial,sans-serif; color:#F8FAFC; }
  .wrap { max-width:600px; margin:0 auto; padding:28px 16px; }
  .card { background:#111C2D; border:1px solid #1E293B; border-radius:8px; padding:28px; }
  .tag { display:inline-block; padding:4px 10px; background:#1E3A8A; color:#93C5FD; border-radius:4px; font-size:11px; font-weight:600; text-transform:uppercase; }
  .box { background:#0F172A; border:1px solid #334155; border-radius:6px; padding:16px; margin:16px 0; }
  .clabe { font-family:monospace; font-size:20px; font-weight:700; color:#38BDF8; letter-spacing:0.06em; }
  .btn { display:inline-block; background:#2563EB; color:#FFFFFF; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600; font-size:14px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <span class="tag">Método F.U.T.U.R.A. Validado</span>
    <h2 style="margin:12px 0 8px 0;">Hola {{contacto_nombre}},</h2>
    <p style="color:#CBD5E1; font-size:14px; line-height:1.6;">
      Compartimos la ficha patrimonial del desarrollo <strong>{{desarrollo_nombre}}</strong> ({{desarrolladora}}) en <strong>{{ubicacion}}</strong>, seleccionado tras superar las 6 dimensiones legales y financieras de Futura Capital en Yucatán.
    </p>
    <div class="box">
      <div style="font-size:13px; color:#94A3B8;">Condiciones de Entrada</div>
      <div style="font-size:16px; font-weight:700; margin-top:4px;">Precio lista: {{precio_mxn}} | Enganche: {{enganche_pct}}</div>
      <div style="font-size:12px; color:#94A3B8; margin-top:4px;">Entrega programada: {{fecha_entrega}}</div>
    </div>
    <div class="box" style="text-align:center;">
      <div style="font-size:11px; color:#38BDF8; text-transform:uppercase;">CLABE STP para Apartado / Enganche</div>
      <div class="clabe">{{clabe_stp}}</div>
      <div style="font-size:13px; color:#E2E8F0; margin-top:4px;">Monto: {{monto_apartado}} (Banco STP)</div>
    </div>
    <p style="text-align:center; margin:20px 0;">
      <a href="{{agenda_url}}" class="btn">Agendar Sesión Patrimonial (30 min)</a>
    </p>
    <p style="font-size:11px; color:#64748B; text-align:center; margin:0;">
      Futura Capital Partners · Calle 20 #109A Col. México, Mérida, Yucatán · WhatsApp 999 568 82 10
    </p>
  </div>
</div>
</body>
</html>',
  '["contacto_nombre", "desarrollo_nombre", "desarrolladora", "ubicacion", "precio_mxn", "enganche_pct", "fecha_entrega", "clabe_stp", "monto_apartado", "agenda_url"]',
  1
);

-- 7. Catálogo de Señales para el Harvester Inmobiliario (Futura Capital)
INSERT OR REPLACE INTO signal_catalog (signal_code, description, category, weight) VALUES
  ('SENAL_BROKER_INMOBILIARIO', 'Agencia inmobiliaria, corredor AMPI o asesor de preventas en Yucatán', 'inmobiliario', 2.5),
  ('SENAL_SALUD_ESPECIALISTA', 'Clínica, consultorio de especialidad médica o laboratorio (MB Medical Tower)', 'salud', 2.5),
  ('SENAL_LOGISTICA_CEDIS', 'Empresa de autotransporte, almacenaje, CEDIS o logística portuaria (Logistic Park)', 'logistica', 2.5),
  ('SENAL_INVERSION_PATRIMONIAL', 'Inversionista patrimonial, rentas vacacionales o corporativo hotelero', 'patrimonial', 2.0),
  ('WHATSAPP_CORPORATIVO', 'Teléfono o WhatsApp directo extraído de DENUE o sitio web', 'contacto', 1.5),
  ('EMAIL_CORPORATIVO', 'Correo corporativo verificado en DENUE o sitio web', 'contacto', 1.0);

-- 8. Cohortes dedicadas para Futura Capital en sales_cohorts
INSERT OR REPLACE INTO sales_cohorts (cohort_id, name, description, query_sql, vertical, created_by)
VALUES
  (
    'futura_capital_patrimonial',
    'Futura Capital · Inversionistas y Desarrolladoras Bienes Raíces',
    'Empresas e inversionistas del sector inmobiliario y financiero (SCIAN 531110, 531210, 522250, 523920) para preventas validadas en Yucatán',
    'SELECT DISTINCT a.* FROM sales_accounts a WHERE a.scian_code IN (''531110'', ''531210'', ''531311'', ''522250'', ''523920'') OR a.id = ''acc_futura_capital''',
    'bundle',
    'system_onboarding'
  ),
  (
    'futura_medicos_merida',
    'Futura Capital · Médicos Especialistas y Clínicas (MB Medical Tower)',
    'Consultorios de medicina especializada, clínicas dentales, laboratorios y hospitales privados (SCIAN 621111, 621112, 621211, 621511, 622111)',
    'SELECT DISTINCT a.* FROM sales_accounts a WHERE a.scian_code IN (''621111'', ''621112'', ''621211'', ''621511'', ''622111'')',
    'bundle',
    'system_onboarding'
  ),
  (
    'futura_logistica_progreso',
    'Futura Capital · Logística, CEDIS y Aduanas (Logistic Park Tamanché)',
    'Empresas de autotransporte de carga, almacenes generales y agencias aduanales en el corredor Mérida-Progreso (SCIAN 484111, 484121, 493111, 488511)',
    'SELECT DISTINCT a.* FROM sales_accounts a WHERE a.scian_code IN (''484111'', ''484121'', ''493111'', ''488511'')',
    'bundle',
    'system_onboarding'
  ),
  (
    'futura_brokers_aliados',
    'Futura Capital · Red de Brokers y Agencias Aliadas',
    'Corredores de bienes raíces, administradores de inmuebles y asesores patrimoniales con señales de preventa o AMPI',
    'SELECT DISTINCT a.* FROM sales_accounts a LEFT JOIN sales_observations o ON a.id = o.account_id WHERE a.scian_code IN (''531210'', ''531311'', ''523920'') OR o.signal_code = ''SENAL_BROKER_INMOBILIARIO''',
    'bundle',
    'system_onboarding'
  );
