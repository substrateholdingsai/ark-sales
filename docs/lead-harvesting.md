# Lead Harvesting Pipeline — Ark Sales

Motor de descubrimiento, perfilamiento HTTP gratuito y calificación híbrida (Reglas + Workers AI Llama 3.3 70B) para nutrir el CRM de Ark Sales a $0 USD.

## Arquitectura

1. **Cosecha (`scripts/python/lead_harvester/denue.py`)**:
   - Consulta el API de DENUE (INEGI) o fixtures locales por código SCIAN (`541210`, `531110`, `531210`, `522250`, `561490`).
2. **Perfilamiento HTTP (`scripts/python/lead_harvester/profile.py`)**:
   - Detecta stack tecnológico (`CONTPAQi`, `COI`, `Aspel`, `Shopify`, `WooCommerce`, `WordPress`) y señales de dolor operativo (`DOLOR_SAT`, `DOLOR_MOROSIDAD`, `DOLOR_CFDI`).
   - Registra las evidencias en D1 vía `POST /api/internal/observations/batch`.
3. **Scoring Híbrido (`scoring.py` + `scoring_llm.py`)**:
   - Evalúa primero con reglas deterministas. Si `score >= 40`, consulta `POST /api/internal/leads/:lead_id/classify` (Llama 3.3 70B) para refinar vertical y dolor principal.
4. **Ingesta e Idempotencia (`ingest.py`)**:
   - Envía el `IngestPayload` v3 a `POST /webhooks/ingest`, vinculando `sales_leads`, `sales_accounts` (`acc_<lead_id>`), `sales_contacts` y `sales_observations`.
5. **Cohortes y Observabilidad**:
   - Cohortes SQL dinámicas en `sales_cohorts` accionables por Email (Resend) y Voz AI (Telnyx) desde Super Admin (`/superadmin`).
   - Telemetría de ejecuciones en `harvest_runs` y automatización cada 6 horas vía `.github/workflows/harvest.yml`.
