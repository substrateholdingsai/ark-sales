# Backup, monitoreo y recuperación — CRM Ark Sales (Fase 6)

## Respaldos de D1
- Exportar base de datos local/remota:
  `wrangler d1 export ark-sales-db --remote --output backup.sql`
- Restaurar desde archivo:
  `wrangler d1 execute ark-sales-db --remote --file=backup.sql`
- Frecuencia recomendada: diario automatizado vía CI/cron externo.

## Monitoreo
- Errores del Worker se registran en `console.error` y Cloudflare Logs (Tail).
- Auditoría de acciones en `crm_audit_log` (actor, acción, entidad, IP).
- Métricas disponibles en `GET /api/crm/metrics`.

## Retención de datos
- Conversaciones y leads se conservan indefinidamente salvo solicitud de baja (GDPR/consentimiento).
- Logs de auditoría: retención mínima 12 meses.

## Procedimiento de recuperación
1. Detectar incidente (alerta de errores o métricas anómalas).
2. Pausar despliegues (`wrangler deploy` bloqueado).
3. Restaurar último backup válido en staging y verificar.
4. Promover a producción con monitoreo intensivo.
5. Documentar post-mortem y ajustar migraciones si aplica.

## Reversión de despliegue
- Mantener versión anterior del Worker disponible (`wrangler rollback`).
- Migraciones son aditivas; no borrar columnas/tablas en caliente.