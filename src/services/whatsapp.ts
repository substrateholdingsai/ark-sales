// WhatsApp Business API sender via Telnyx (Step 3: G6).
// Real Telnyx WhatsApp Business API v2 send — not wa.me links.

import { Env } from "../types";

export interface WhatsAppSendParams {
  to: string; // E.164 (+52...)
  templateName: string;
  templateVersion?: string;
  languageCode?: string;
  variables?: Record<string, string>;
  senderBrand?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

const WHATSAPP_UNIT_COST_USD = 0.2; // per docs/CANACO_ARK_LEDGER_STRATEGY.md:43-48

export class WhatsAppService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async send(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
    const to = params.to;
    if (!to || !/^\+\d{10,15}$/.test(to)) {
      return { success: false, error: "INVALID_PHONE_NUMBER", simulated: false };
    }

    const apiKey = this.env.TELNYX_API_KEY;
    if (!apiKey) {
      // No real send without API key — fail-closed, simulated only for local dev
      return {
        success: false,
        error: "TELNYX_API_KEY_NOT_CONFIGURED",
        simulated: false,
      };
    }

    const templateName = params.templateName;
    const languageCode = params.languageCode || "es-MX";
    const templateVersion = params.templateVersion || "1";

    // Build Telnyx WhatsApp Business API v2 message payload
    const components: any[] = [];
    if (params.variables && Object.keys(params.variables).length > 0) {
      components.push({
        type: "body",
        parameters: Object.values(params.variables).map((v) => ({ type: "text", text: v })),
      });
    }

    const payload: any = {
      to,
      channel: "whatsapp",
      from: this.env.TELNYX_PHONE_NUMBER || "+525500000000",
      content_type: "template",
      content: {
        template: {
          name: templateName,
          language: { code: languageCode },
          policy: "deterministic",
          ...(templateVersion ? { version: templateVersion } : {}),
          ...(components.length > 0 ? { components } : {}),
        },
      },
    };

    try {
      const response = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return {
          success: false,
          error: `TELNYX_HTTP_${response.status}`,
          messageId: errBody,
          simulated: false,
        };
      }

      const data: any = await response.json();
      const messageId = data?.data?.id || data?.id || data?.message_id || `wa_${crypto.randomUUID().slice(0, 8)}`;

      return {
        success: true,
        messageId,
        simulated: false,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "WHATSAPP_SEND_EXCEPTION",
        simulated: false,
      };
    }
  }

  getUnitCostUsd(): number {
    return WHATSAPP_UNIT_COST_USD;
  }
}
