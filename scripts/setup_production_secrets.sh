#!/bin/bash
# Setup de secretos para Lead Harvesting en producción
set -e

echo "Configurando secretos de Ark Sales..."

wrangler whoami || { echo "Ejecuta 'wrangler login' primero"; exit 1; }

read -p "Ingresa tu token de INEGI DENUE: " INEGI_TOKEN
echo "$INEGI_TOKEN" | wrangler secret put INEGI_TOKEN

INTERNAL_API_TOKEN=$(openssl rand -hex 32)
echo "$INTERNAL_API_TOKEN" | wrangler secret put INTERNAL_API_TOKEN
echo "Guarda este token para GitHub Actions: $INTERNAL_API_TOKEN"

CRM_JWT_SECRET=$(openssl rand -hex 32)
echo "$CRM_JWT_SECRET" | wrangler secret put CRM_JWT_SECRET
echo "CRM_JWT_SECRET criptográfico configurado en Cloudflare Workers."

WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "$WEBHOOK_SECRET" | wrangler secret put WEBHOOK_SECRET
echo "WEBHOOK_SECRET configurado en Cloudflare Workers."

echo "Secretos configurados. Ahora configura estos mismos valores en:"
echo "   GitHub -> Settings -> Secrets and variables -> Actions"
echo "   - INEGI_TOKEN"
echo "   - INTERNAL_API_TOKEN"