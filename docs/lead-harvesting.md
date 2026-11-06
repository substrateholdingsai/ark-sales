# Lead Harvesting Pipeline — Ark Sales

Motor de descubrimiento, perfilamiento HTTP gratuito y calificación híbrida (Reglas + Workers AI Llama 3.3 70B) para nutrir el CRM de Ark Sales a $0 USD.

## Arquitectura

1. **Cosecha (`scripts/python/lead_harvester/denue.py`, `sipres.py`)**:
   - DENUE ofrece perfiles generales y `fintech_credit_app`. SIPRES aporta registros públicos de SOFOM activas, con ID y ficha oficial; el código SCIAN no se inventa.
2. **Perfilamiento HTTP (`scripts/python/lead_harvester/profile.py`)**:
   - Detecta stack tecnológico (`CONTPAQi`, `COI`, `Aspel`, `Shopify`, `WooCommerce`, `WordPress`), señales de dolor operativo y señales web de préstamos/crédito digital.
   - Registra las evidencias en D1 vía `POST /api/internal/observations/batch`.
3. **Scoring Híbrido (`scoring.py` + `scoring_llm.py`)**:
   - Evalúa primero con reglas deterministas. Si `score >= 40`, consulta `POST /api/internal/leads/:lead_id/classify` (Llama 3.3 70B) para refinar vertical y dolor principal.
4. **Ingesta e Idempotencia (`ingest.py`)**:
   - Envía el `IngestPayload` v3 a `POST /webhooks/ingest`, vinculando `sales_leads`, `sales_accounts` (`acc_<lead_id>`), `sales_contacts` y `sales_observations`.
   - Los perfiles `fintech_credit_app` y `sipres_sofom` asignan la cuenta al tenant comercial Ark Ledger y enrutan la oferta principal a cobranza de Ark Angel; Ledger queda como producto complementario.
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

## Piloto SIPRES / SOFOM

`sipres_sofom` consulta el registro público de [SIPRES](https://webapps.condusef.gob.mx/SIPRES/jsp/pub/index.jsp) con los sectores SOFOM E.N.R. y E.R. y filtra el estatus “En operación”. Prioriza nombres con referencias a crédito, préstamos, financiamiento, consumo o nómina, pero esa selección no confirma uso de app ni que el crédito sea el producto principal. El registro contiene datos corporativos de la institución; el sitio y las señales públicas deben revisarse antes de contacto comercial.

El límite de SIPRES es de 50 instituciones por ejecución. Para obtener una vista previa local sin ingesta, scoring externo ni escrituras a CRM:

```bash
cd scripts/python
python -m lead_harvester.main --source sipres --limit 50 --preview --skip-enrich
```

La opción `--preview` no escribe leads ni observaciones y muestra los datos de la fuente oficial en la salida. En GitHub Actions, activa `preview_only` para revisar los candidatos sin ingesta; déjalo desactivado para importar a producción. REDECO puede incorporarse después como un perfil separado de despachos de cobranza.
