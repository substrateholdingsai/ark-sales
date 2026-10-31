# Telnyx Voice AI Agents Setup (ark-sales)

## Speech-to-Text (STT)
- Engine: Deepgram Nova-2
- Language: es-MX (fallback es)

## LLM Engine
- meta-llama/Meta-Llama-3.3-70B-Instruct o gpt-4o-mini

## Text-to-Speech (TTS)
- Provider: Cartesia Sonic o ElevenLabs Multilingual v2
- Voice: Mexicana ejecutiva formal, velocidad 1.05x

## Webhook Tools
- URL base: https://sales.arksystems.site/webhooks/telnyx/voice-ai/tools
- Eventos: https://sales.arksystems.site/webhooks/telnyx/voice-ai/events

## System Prompt
Basado en SYSTEM_PROMPTS.closer y SYSTEM_PROMPTS.intake de src/agents/prompts.ts:

"Habla de forma concisa, ejecutiva y natural para el mercado mexicano. No hagas monólogos largos; mantén turnos de conversación de 2 a 3 frases máximo."
"Identifica si el despacho sufre por cobranza morosa (Ark Angel) o contingencias fiscales SAT (Ark Ledger). Ofrece el Paquete Enterprise con consumo sugerido de $8,000 a $12,000 MXN mensuales."

## Outbound AI
- Endpoint: POST /api/crm/voice/outbound-ai
- Payload: { lead_id, to, despacho_nombre, dolor_principal }
- Telnyx API: POST https://api.telnyx.com/v2/ai/conversations
