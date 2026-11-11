# Conector StayPuft — Ark Sales (`scripts/python/ark_sales.py`)

Helper de línea de comandos para el operador StayPuft (Marina) contra el worker
Ark Sales (`sales.arksystems.site`, D1 `ark-sales-db`). Usa el mismo método de
autenticación que los demás endpoints internos: cabecera `X-StayPuft-Key`.

## Variables de entorno

- `ARK_SALES_API`: Base de la API interna (default `http://localhost:8787/api/internal`).
- `STAYPUFT_API_KEY`: Clave del operador StayPuft (obligatoria, nunca se hardcodea).

## Comandos

### `add-lead` — Alta de un solo lead

```
python3 scripts/python/ark_sales.py add-lead --json '<json>'
```

Envía un `POST /api/internal/leads` con un único objeto de lead. Rechaza arreglos
y payloads masivos (un solo lead por request).

Campos del body: `tenant_id`, `cohort`, `firm_name`, `contact_name`, `contact_role`,
`city`, `state`, `phone`, `whatsapp`, `email`, `website`, `instagram`,
`instagram_url`, `facebook`, `facebook_url`, `source`, `source_url`, `score`, `pain`,
`products`, `notes`.

Obligatorios: `firm_name`, `tenant_id`, `cohort`, `source`, `source_url`. Al menos un
canal de contacto: `phone`, `email`, `website`, `instagram` o `facebook`.

Comportamiento del endpoint (fail-closed):

- Auth: `X-StayPuft-Key` requerida (401 sin ella). Solo tenants `acc_ark_ledger` y
  `acc_futura_capital`; cohort existente para ese tenant (p. ej. `ark_ledger_despachos`
  para Ledger).
- Teléfono: solo México E.164 (`+52` + 10 dígitos nacionales). Malformed → `null`,
  nunca se prefiere `+52` ciegamente, nunca se inventa.
- Source permitida: `instagram_manual`, `facebook_manual`, `web_manual`, `referral`,
  `harvester`. Se rechaza explícitamente `x`, `twitter`, `x_manual`.
- Deduplicación antes del insert: mismo teléfono (E.164), mismo email (lowercase),
  mismo handle de Instagram (lowercase, sin `@`), misma Facebook URL, o mismo dominio
  de sitio web + misma firma. Duplicado → HTTP 200 `{"created": false, "duplicate": true,
  "lead_id": "<existente>"}` sin crear ni sobrescribir.
- Nuevo lead: HTTP 201 `{"lead_id": "<generado>", "status": "nuevo", "created": true,
  "duplicate": false}`. Etapa `nuevo`. No hay efectos colaterales: sin email, sin
  WhatsApp, sin llamada de voz, sin tarea de agente, sin enriquecimiento automático.
- Auditoría: una entrada inmutable en `crm_audit_log` (actor `staypuft`,
  acción `lead_create_single`, lead, tenant, cohort, source, source_url, timestamp).
- Límite de tasa: 60 creates por hora por clave de operador (429 tras excederlo).
- Lecturas acotadas (LIMIT 1 / LIMIT 100); no carga la tabla completa de leads.

Ejemplo de verificación (local, sin ingestar hasta que Pavel apruebe):

```
python3 scripts/python/ark_sales.py add-lead --json '{"tenant_id":"acc_ark_ledger","cohort":"ark_ledger_despachos","firm_name":"Despacho Ejemplo SA","contact_name":"Ana Ejemplo","contact_role":"Contacto","city":"Guadalajara","state":"Jalisco","phone":"+529990000000","whatsapp":null,"email":"ana@example.com","website":"https://example.com/","instagram":"despacho_ejemplo","instagram_url":"https://www.instagram.com/despacho_ejemplo/","facebook":null,"facebook_url":null,"source":"instagram_manual","source_url":"https://www.instagram.com/despacho_ejemplo/","score":50,"pain":"Ejemplo ficticio","products":["ledger"],"notes":"Datos de ejemplo completamente ficticios"}'
```

Respuesta esperada (201):

```json
{"lead_id":"lead_manual_...","status":"nuevo","created":true,"duplicate":false}
```

No desplegar a producción. Ingestión del ejemplo solo tras aprobación de Pavel.
