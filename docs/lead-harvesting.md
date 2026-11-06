# Lead Harvesting Pipeline — Ark Sales

Motor de descubrimiento, perfilamiento HTTP gratuito y calificación híbrida (Reglas + Workers AI Llama 3.3 70B) para nutrir el CRM de Ark Sales a $0 USD.

## Arquitectura

1. **Cosecha (`scripts/python/lead_harvester/denue.py`)**:
   - Consulta el API de DENUE (INEGI) o fixtures locales. Los perfiles generales usan códigos SCIAN; `fintech_credit_app` busca términos de crédito en ocho plazas y conserva el código devuelto por DENUE, sin asignar uno por suposición.
2. **Perfilamiento HTTP (`scripts/python/lead_harvester/profile.py`)**:
   - Detecta stack tecnológico (`CONTPAQi`, `COI`, `Aspel`, `Shopify`, `WooCommerce`, `WordPress`), señales de dolor operativo y señales web de préstamos/crédito digital.
   - Registra las evidencias en D1 vía `POST /api/internal/observations/batch`.
3. **Scoring Híbrido (`scoring.py` + `scoring_llm.py`)**:
   - Evalúa primero con reglas deterministas. Si `score >= 40`, consulta `POST /api/internal/leads/:lead_id/classify` (Llama 3.3 70B) para refinar vertical y dolor principal.
4. **Ingesta e Idempotencia (`ingest.py`)**:
   - Envía el `IngestPayload` v3 a `POST /webhooks/ingest`, vinculando `sales_leads`, `sales_accounts` (`acc_<lead_id>`), `sales_contacts` y `sales_observations`.
   - El perfil `fintech_credit_app` asigna la cuenta al tenant comercial Ark Ledger y enruta la oferta principal a cobranza de Ark Angel; Ledger queda como producto complementario.
5. **Cohortes y Observabilidad**:
   - Cohortes SQL dinámicas en `sales_cohorts` accionables por Email (Resend) y Voz AI (Telnyx) desde Super Admin (`/superadmin`).
   - Telemetría de ejecuciones en `harvest_runs`. La cosecha programada está desactivada; el workflow es manual.

## Piloto fintech de crédito por app

`fintech_credit_app` es un perfil de **candidatos**, no una confirmación de que cada empresa tenga una app o preste directamente. DENUE registra establecimientos, puede no capturar empresas digitales y sus búsquedas pueden incluir falsos positivos. El perfil consulta cinco términos de búsqueda en CDMX, Monterrey, Guadalajara, Querétaro, Puebla, Mérida, Tijuana y León; el filtro `--plaza` permite limitar una corrida. No usa un SCIAN predeterminado. El perfilamiento web conserva señales encontradas, pero la ausencia de sitio o evidencia no descarta automáticamente al candidato.

Para revisar la configuración sin cosechar ni ingerir:

```bash
cd scripts/python
python -m lead_harvester.main --profile fintech_credit_app --plaza cdmx --limit 25 --dry-run
```

`--dry-run` solo imprime la configuración: no consulta DENUE ni valida el volumen. Antes de una corrida real, revisar manualmente el límite, la plaza y los resultados esperados; toda corrida real puede crear leads en CRM.
