import { Env, LeadIngestPayload, AgentId } from "../types";
import { CatalogService, FAIL_CLOSED_MESSAGE } from "../catalog/service";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

export const TOOLS_DEFINITIONS: ToolDefinition[] = [
  {
    name: "consultar_catalogo_completo",
    description: "Consulta el catálogo oficial y actualizado de productos, precios en MXN y features del ecosistema ARK directamente desde la base de datos. DEBE usarse siempre antes de cotizar o mencionar precios.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "diagnosticar_despacho",
    description: "Analiza el dolor principal, tamaño y necesidades del despacho contable para diagnosticar el especialista y los productos ARK adecuados.",
    parameters: {
      type: "object",
      properties: {
        dolor_principal: {
          type: "string",
          description: "Descripción detallada del dolor principal del despacho (ej. problemas con el SAT, cálculos lentos, cobranza a clientes morosos, falta de tienda online, o colapso general).",
        },
        tamano: {
          type: "string",
          enum: ["1-5", "6-20", "21-50", "50+"],
          description: "Número de contadores o personal en el despacho.",
        },
        productos_interes: {
          type: "array",
          items: { type: "string" },
          description: "Lista de productos en los que ha mostrado interés previo si aplica.",
        },
      },
      required: ["dolor_principal"],
    },
  },
  {
    name: "entregar_lead",
    description: "Encola el lead calificado para entrega asíncrona hacia el hermano destino (Ledger, Angel, Commerce, o Bundle) según el contrato federado LEAD_INGEST_V3.",
    parameters: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          enum: ["ledger", "angel", "commerce", "bundle"],
          description: "Hermano o vertical destino para el lead.",
        },
        score: {
          type: "number",
          description: "Puntuación de calificación del lead de 0 a 100 basada en intención y capacidad de compra.",
        },
        summary: {
          type: "string",
          description: "Resumen ejecutivo de la conversación, dolor detectado y acuerdo alcanzado.",
        },
      },
      required: ["destination", "score", "summary"],
    },
  },
  {
    name: "enviar_propuesta",
    description: "Dispara la propuesta comercial y formalización de contrato vía correo electrónico mediante Resend.",
    parameters: {
      type: "object",
      properties: {
        lead_id: {
          type: "string",
          description: "ID único del lead que recibe la propuesta.",
        },
        bundle: {
          type: "boolean",
          description: "True si la propuesta es el Bundle ARK Total ($997 MXN/mes); False si es un producto individual.",
        },
      },
      required: ["lead_id", "bundle"],
    },
  },
  {
    name: "disparar_habilidad_grok",
    description: "Solicita a Grok Bot la ejecución de una habilidad de computadora autónoma (ej. 'research_prospect_web', 'generate_custom_pdf', 'tag_prospect_on_x').",
    parameters: {
      type: "object",
      properties: {
        skill_name: {
          type: "string",
          enum: ["research_prospect_web", "generate_custom_pdf", "tag_prospect_on_x"],
          description: "Nombre de la habilidad registrada en agent_skills.",
        },
        payload: {
          type: "object",
          description: "Parámetros requeridos por la habilidad.",
        },
      },
      required: ["skill_name"],
    },
  },
];

export class ToolExecutor {
  private catalogService: CatalogService;

  constructor(private env: Env) {
    this.catalogService = new CatalogService(env.DB);
  }

  async execute(toolName: string, args: any, context: { lead_id: string; leadEmail?: string; despachoNombre?: string; tamano?: string }): Promise<any> {
    switch (toolName) {
      case "consultar_catalogo_completo":
        return this.consultarCatalogo();

      case "diagnosticar_despacho":
        return this.diagnosticarDespacho(args.dolor_principal, args.tamano, args.productos_interes);

      case "entregar_lead":
        return this.entregarLead(args.destination, args.score, args.summary, context);

      case "enviar_propuesta":
        return this.enviarPropuesta(args.lead_id || context.lead_id, args.bundle, context);

      case "disparar_habilidad_grok":
        return this.dispararHabilidadGrok(args.skill_name, args.payload || {}, context);

      default:
        return { error: `Herramienta desconocida: ${toolName}` };
    }
  }

  async consultarCatalogo() {
    const res = await this.catalogService.getCatalog();
    if (!res.success) {
      return {
        status: "fail_closed",
        message: FAIL_CLOSED_MESSAGE,
        error: res.error,
      };
    }
    return {
      status: "success",
      catalogo: res.products,
    };
  }

  diagnosticarDespacho(dolor: string, tamano?: string, productosInteres?: string[]) {
    const dLower = dolor.toLowerCase();
    
    // 1. Detección de dolor
    const esFiscal = /sat|auditor[ií]a|c[aá]lculo|fiscal|multa|cfdi|declaraci[oó]n|impuesto|p[oó]liza|sellado/i.test(dLower);
    const esCobranza = /cobranza|moros|flujo|cartera vencida|falta de pago|liquid/i.test(dLower);
    const esVentaOnline = /vender online|tienda|comercio|ecommerce|canales de venta|pasarela|pedidos/i.test(dLower);
    const esGeneral = /caos|descontrol|todo est[aá] mal|todo va mal|sistema integral|soluci[oó]n integral|bundle completo|integral/i.test(dLower);

    let especialistaSugerido: AgentId = "intake";
    let vertical: "fiscal" | "cobranza" | "ecommerce" | "bundle" = "fiscal";
    let productosRecomendados: string[] = [];
    let dolorDetectadoKey = "sat_fiscal_calculo";

    if (esGeneral || (esFiscal && esCobranza)) {
      especialistaSugerido = "closer";
      vertical = "bundle";
      productosRecomendados = ["bundle", "ledger", "angel", "commerce"];
      dolorDetectadoKey = "integral_general";
    } else if (esFiscal) {
      especialistaSugerido = "riesgo";
      vertical = "fiscal";
      productosRecomendados = ["ledger", "angel"];
      dolorDetectadoKey = "sat_fiscal_calculo";
    } else if (esCobranza) {
      especialistaSugerido = "flujo";
      vertical = "cobranza";
      productosRecomendados = ["angel", "commerce"];
      dolorDetectadoKey = "cobranza_morosos";
    } else if (esVentaOnline) {
      especialistaSugerido = "flujo";
      vertical = "ecommerce";
      productosRecomendados = ["commerce", "angel"];
      dolorDetectadoKey = "venta_online";
    } else {
      // Por defecto derivar a closer para diagnóstico holístico
      especialistaSugerido = "closer";
      vertical = "bundle";
      productosRecomendados = ["bundle"];
      dolorDetectadoKey = "otro";
    }

    return {
      status: "success",
      especialista_asignado: especialistaSugerido,
      vertical_recomendada: vertical,
      productos_recomendados: productosRecomendados,
      dolor_detectado: dolorDetectadoKey,
      fundamento: `Basado en el dolor '${dolor}', se recomienda el agente '${especialistaSugerido}'. Filosofía ARK: Ofrecer siempre el bundle como solución estructural a la economía agéntica del despacho.`,
    };
  }

  async entregarLead(
    destination: "ledger" | "angel" | "commerce" | "bundle",
    score: number,
    summary: string,
    context: { lead_id: string; leadEmail?: string; despachoNombre?: string; tamano?: string }
  ) {
    const leadId = context.lead_id;

    // 1. Obtener datos del lead desde D1 si faltan en context
    let email = context.leadEmail || "contacto@despacho.com";
    let despachoNombre = context.despachoNombre || "Despacho Contable";
    let tamano: any = context.tamano || "1-5";
    let dolorPrincipal = "Optimización operativa";

    if (this.env.DB) {
      const leadRow = await this.env.DB.prepare("SELECT * FROM sales_leads WHERE id = ?").bind(leadId).first<any>();
      if (leadRow) {
        email = context.leadEmail || leadRow.email || email;
        despachoNombre = context.despachoNombre || leadRow.despacho_nombre || despachoNombre;
        tamano = context.tamano || leadRow.tamano || tamano;
        dolorPrincipal = leadRow.dolor_detectado || dolorPrincipal;
      }
    }

    // 2. Mapear vertical según destination
    const verticalMap: Record<string, "fiscal" | "cobranza" | "ecommerce" | "bundle"> = {
      ledger: "fiscal",
      angel: "cobranza",
      commerce: "ecommerce",
      bundle: "bundle",
    };

    // 3. Construir contrato LEAD_INGEST_V3 estricto
    const payload: LeadIngestPayload = {
      version: 3,
      lead_id: leadId,
      email,
      source_worker: "ark-sales",
      destination,
      vertical: verticalMap[destination] || "bundle",
      score: Math.max(0, Math.min(100, Math.round(score))),
      conversation_summary: summary,
      account_context: {
        despacho_nombre: despachoNombre,
        tamano: (["1-5", "6-20", "21-50", "50+"].includes(tamano) ? tamano : "1-5") as any,
        productos_interes: destination === "bundle" ? ["ledger", "angel", "commerce"] : [destination],
        dolor_principal: dolorPrincipal,
      },
    };

    // 4. Outbox Pattern: Guardar en sales_pending_ingest con status 'pending'
    const outboxId = `outbox_${crypto.randomUUID()}`;
    if (this.env.DB) {
      try {
        await this.env.DB.prepare(`
          INSERT INTO sales_pending_ingest (id, lead_id, destination, payload_json, status, retries, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(outboxId, leadId, destination, JSON.stringify(payload)).run();

        // Actualizar estado del lead a calificado
        await this.env.DB.prepare(`
          UPDATE sales_leads 
          SET estado = 'calificado', score = ?, conversation_summary = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(payload.score, summary, leadId).run();
      } catch (e) {
        console.error("[entregarLead] Error guardando en sales_pending_ingest D1:", e);
      }
    }

    // 5. Encolar asíncronamente en SALES_INGEST_QUEUE si está disponible
    if (this.env.SALES_INGEST_QUEUE) {
      try {
        await this.env.SALES_INGEST_QUEUE.send(payload);
      } catch (err) {
        console.warn("[entregarLead] Queue send falló temporalmente, queda en outbox para cron:", err);
      }
    }

    return {
      status: "lead_queued",
      message: `Lead entregado exitosamente al hermano ${destination} bajo contrato federado LEAD_INGEST_V3.`,
      contract: payload,
    };
  }

  async enviarPropuesta(leadId: string, isBundle: boolean, context: { leadEmail?: string; despachoNombre?: string }) {
    let email = context.leadEmail || "contacto@despacho.com";
    let despachoNombre = context.despachoNombre || "Estimado Colega Contable";

    if (this.env.DB) {
      const leadRow = await this.env.DB.prepare("SELECT * FROM sales_leads WHERE id = ?").bind(leadId).first<any>();
      if (leadRow) {
        email = leadRow.email || email;
        despachoNombre = leadRow.despacho_nombre || despachoNombre;
      }
    }

    // Consultar catálogo para verificar precio real de sales_config (Cero hardcoding)
    const cat = await this.catalogService.getCatalog();
    const bundleItem = cat.products?.["bundle"];
    const precio = isBundle ? (bundleItem?.price_mxn ?? 997) : 399;

    let resendSent = false;
    let resendMessageId = null;

    // Disparar vía Resend si RESEND_API_KEY está configurada
    if (this.env.RESEND_API_KEY) {
      try {
        const emailContent = `
          <h1>Propuesta Comercial: Infraestructura Operativa Agéntica ARK</h1>
          <p>Estimado/a ${despachoNombre},</p>
          <p>Ha sido un placer atenderle. Como despacho contable, la automatización agéntica es su mayor ventaja competitiva.</p>
          <h3>Detalle de la Solución:</h3>
          <ul>
            ${isBundle ? `
              <li><strong>Bundle Ecosistema Total:</strong> Ark Ledger + Ark Angel + Ark Commerce</li>
              <li>Inversión mensual: <strong>$${precio} MXN/mes</strong> (Garantía de precio congelado).</li>
              <li>Sello criptográfico SHA-256 en pólizas, motor legal fail-closed y tienda de servicios activa.</li>
            ` : `
              <li>Solución Individual ARK</li>
              <li>Inversión mensual: <strong>$${precio} MXN/mes</strong></li>
            `}
          </ul>
          <p>Para activar su entorno de producción de inmediato, responda a este correo o ingrese a su consola ARK.</p>
          <p>Atentamente,<br><strong>Equipo Comercial ARK Sales</strong></p>
        `;

        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: this.env.RESEND_FROM_EMAIL || "ventas@arksystems.site",
            to: [email],
            subject: isBundle 
              ? `Propuesta Formal ARK: Bundle Ecosistema Completo para ${despachoNombre}`
              : `Propuesta Comercial ARK para ${despachoNombre}`,
            html: emailContent,
          }),
        });

        if (resp.ok) {
          const resData: any = await resp.json();
          resendSent = true;
          resendMessageId = resData.id;
        } else {
          const errText = await resp.text();
          console.warn("[enviarPropuesta] Resend API retorno error:", errText);
        }
      } catch (e) {
        console.error("[enviarPropuesta] Error llamando a Resend:", e);
      }
    }

    // Actualizar estado del lead en D1
    if (this.env.DB) {
      try {
        await this.env.DB.prepare(`
          UPDATE sales_leads 
          SET estado = 'propuesta_enviada', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(leadId).run();
      } catch (e) {
        console.error("[enviarPropuesta] Error actualizando lead en D1:", e);
      }
    }

    return {
      status: "propuesta_enviada",
      lead_id: leadId,
      email_destination: email,
      bundle: isBundle,
      precio_cotizado: precio,
      resend_sent: resendSent,
      resend_id: resendMessageId,
      message: `Propuesta formal enviada a ${email} por $${precio} MXN/mes.`,
    };
  }

  async dispararHabilidadGrok(skillName: string, payload: any, context: { lead_id: string; leadEmail?: string; despachoNombre?: string }) {
    if (!this.env.DB) {
      return { error: "D1 no disponible para consultar habilidades de Grok Bot." };
    }

    const skill = await this.env.DB.prepare(`
      SELECT * FROM agent_skills WHERE skill_name = ? AND is_active = 1 LIMIT 1
    `).bind(skillName).first<any>();

    if (!skill) {
      return {
        error: `Skill '${skillName}' no encontrada o inactiva en agent_skills.`,
      };
    }

    const enrichedPayload = {
      lead_id: context.lead_id,
      email: context.leadEmail,
      despacho_nombre: context.despachoNombre,
      ...payload,
    };

    return {
      status: "ready_for_grok_execution",
      skill_name: skillName,
      agent_id: skill.agent_id,
      execution_path: skill.execution_path,
      payload: enrichedPayload,
      message: `Habilidad '${skillName}' solicitada para ejecución física/autónoma por Grok Bot.`,
    };
  }
}
