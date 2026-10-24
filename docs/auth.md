# Autenticación y autorización — CRM Ark Sales (Fase 1)

## Mecanismo elegido
- **JWT HS256** firmado con `CRM_JWT_SECRET` (variable de entorno / secret de Cloudflare).
- Contraseñas hasheadas con **PBKDF2-SHA256** (100k iteraciones, salt aleatorio) usando Web Crypto API (compatible con Cloudflare Workers y sin dependencias nativas).
- Token entregado en `Authorization: Bearer <token>` y cookie HttpOnly `ark_sales_token`.
- Duración del token: 8 horas.

## Roles
- `admin`: acceso total, gestión de usuarios, auditoría.
- `vendedor`: lectura + escritura comercial.
- `lector`: solo lectura.

Se aceptan alias en español/inglés (`administrador`, `seller`, `viewer`, etc.) normalizados internamente.

## Endpoints
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`.
- `POST /api/auth/logout` — invalida cookie.
- `GET /api/auth/me` — usuario actual.
- `POST /api/auth/register` — bootstrap público si no hay usuarios; después solo admin.
- `GET /api/crm/*` — requiere autenticación (401 si no).
- `GET /api/crm/admin/*` — requiere rol admin (403 si no).

## Auditoría
Tabla `crm_audit_log` registra actor, acción, entidad, metadata (sin secretos) e IP.

## Separación de integraciones
- `/widget.js`, `/`, `/demo`, `/api/catalog`, `/api/chat`, `/webhooks/ingest`, `/api/internal/*` permanecen fuera del acceso CRM y se validan por su propio mecanismo (origen, payload, etc.).

## Secretos
- `CRM_JWT_SECRET` debe configurarse en producción (`wrangler secret put CRM_JWT_SECRET`). En desarrollo se usa un valor por defecto no seguro.