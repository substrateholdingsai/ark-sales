import { Hono } from "hono";
import { Env } from "../types";
import { verifyJwt } from "../auth/jwt";
import { getJwtSecret } from "../auth/middleware";

export const mcpRouter = new Hono<{ Bindings: Env }>();

// ── DEFINICIÓN DEL CATÁLOGO DE TOOLS MCP ──
const MCP_TOOLS = [
  {
    name: "buscar_prospectos_cosechados",
    description: "Busca y filtra prospectos comerciales cosechados del DENUE e internet por Ark Systems, enriquecidos con teléfonos, WhatsApp, score y señales de dolor comercial.",
    inputSchema: {
      type: "object",
      properties: {
        plaza: {
          type: "string",
          description: "Plaza objetivo. Valores: 'campeche', 'cancun', 'riviera_maya', 'merida', 'cdmx', 'monterrey', 'guadalajara', 'all'.",
        },
        tenant: {
          type: "string",
          description: "Tenant / Vertical: 'futura_capital' (salud, clínicas, turismo médico) o 'ark_ledger' (despachos contables, fiscalistas).",
        },
        query: {
          type: "string",
          description: "Término de búsqueda o especialidad (ej. 'clinica', 'cirugia', 'dental', 'cardiologo', 'contable').",
        },
        con_whatsapp: {
          type: "boolean",
          description: "Si es true, solo retorna prospectos con número de WhatsApp directo verificado.",
        },
        min_score: {
          type: "number",
          description: "Calificación mínima de propensión de compra (0 a 100).",
        },
        limit: {
          type: "number",
          description: "Cantidad máxima de resultados (1 a 100, por defecto 25).",
        },
      },
    },
  },
  {
    name: "exportar_prospectos_hubspot",
    description: "Exporta prospectos cosechados directamente en el formato JSON nativo de HubSpot CRM (propiedades firstname, lastname, company, phone, mobilephone, email, city, etc.), listos para ser importados o consumidos por Claude en HubSpot.",
    inputSchema: {
      type: "object",
      properties: {
        plaza: {
          type: "string",
          description: "Plaza a exportar (ej. 'campeche', 'cancun', 'merida', 'all').",
        },
        tenant: {
          type: "string",
          description: "Vertical o tenant (ej. 'futura_capital', 'ark_ledger').",
        },
        con_whatsapp: {
          type: "boolean",
          description: "Filtrar únicamente contactos con WhatsApp.",
        },
        limit: {
          type: "number",
          description: "Número de contactos a exportar (máx. 100).",
        },
      },
    },
  },
  {
    name: "obtener_resumen_plazas",
    description: "Consulta el inventario en tiempo real de leads cosechados disponibles por plaza geográfica, cobertura de WhatsApp y verticales de negocio en Cloudflare D1.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sincronizar_leads_a_hubspot",
    description: "Empuja directamente un lote de prospectos cosechados al CRM de HubSpot del cliente utilizando su token de aplicación privada (HubSpot Private App Access Token).",
    inputSchema: {
      type: "object",
      required: ["hubspot_access_token"],
      properties: {
        hubspot_access_token: {
          type: "string",
          description: "Token de acceso privado de HubSpot (comienza con 'pat-na1-...').",
        },
        plaza: {
          type: "string",
          description: "Plaza a sincronizar (ej. 'campeche', 'merida', 'cancun').",
        },
        query: {
          type: "string",
          description: "Filtro opcional por especialidad o palabra clave.",
        },
        con_whatsapp: {
          type: "boolean",
          description: "Si es true, solo sincroniza contactos que tengan WhatsApp.",
        },
        limit: {
          type: "number",
          description: "Cantidad máxima de contactos a crear en HubSpot (máx. 50).",
        },
      },
    },
  },
];

// ── RECURSOS MCP DISPONIBLES (RESOURCES) ──
const MCP_RESOURCES = [
  {
    uri: "ark://plazas/inventario",
    name: "Inventario General de Plazas Cosechadas",
    description: "Resumen actualizado de leads, teléfonos y cobertura de prospección por ciudad.",
    mimeType: "application/json",
  },
  {
    uri: "ark://leads/recientes",
    name: "Últimos Prospectos Cosechados",
    description: "Lista de los 50 contactos más recientes ingresados en Cloudflare D1.",
    mimeType: "application/json",
  },
];

// ── AUTENTICACIÓN FLEXIBLE PARA CLIENTES MCP ──
async function validarAuthMcp(c: any): Promise<{ autorizado: boolean; tenant?: string; error?: string }> {
  const authHeader = c.req.header("Authorization") || c.req.header("authorization") || "";
  let token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    token = c.req.header("x-api-key") || c.req.query("token") || c.req.query("api_key") || "";
  }

  const expectedToken = c.env.INTERNAL_API_TOKEN;
  const isProd = (c.env.ENVIRONMENT || "development") === "production";

  // Si no hay token provisto
  if (!token) {
    if (!isProd) {
      return { autorizado: true, tenant: "acc_futura_capital" };
    }
    return { autorizado: false, error: "Missing Bearer token. Use Authorization: Bearer <API_KEY>" };
  }

  // Token interno del sistema
  if (expectedToken && token === expectedToken) {
    return { autorizado: true };
  }

  // Tokens con prefijo Ark Live (ej. ark_live_sk_futura_... o ark_live_sk_ledger_...)
  if (token.startsWith("ark_live_sk_")) {
    const tenant = token.includes("ledger") ? "acc_ark_ledger" : "acc_futura_capital";
    return { autorizado: true, tenant };
  }

  // JWT de sesión de CRM existente
  const secret = getJwtSecret(c.env);
  if (secret) {
    try {
      const payload = await verifyJwt(token, secret);
      if (payload) {
        return { autorizado: true };
      }
    } catch {
      // continuar
    }
  }

  if (!isProd) {
    return { autorizado: true, tenant: "acc_futura_capital" };
  }

  return { autorizado: false, error: "Invalid API Key or Bearer token." };
}

// ── HELPER DE CONSULTA DE LEADS EN D1 ──
async function consultarLeadsD1(env: Env, args: any, tenantRestringido?: string) {
  const limit = Math.min(100, Math.max(1, Number(args.limit) || 25));
  const plaza = (args.plaza || "").toLowerCase().trim();
  const query = (args.query || "").toLowerCase().trim();
  const tenant = tenantRestringido || (args.tenant ? (args.tenant.startsWith("acc_") ? args.tenant : `acc_${args.tenant}`) : "");
  const conWa = args.con_whatsapp === true || args.con_whatsapp === "true";
  const minScore = args.min_score !== undefined && args.min_score !== null ? Number(args.min_score) : null;

  let sql = `
    SELECT 
      c.id, c.name, c.email, c.phone, c.whatsapp, c.title, c.notes,
      a.id AS account_id, a.name AS account_name, a.city AS account_city,
      a.state AS account_state, a.industry AS account_industry, a.tenant_id,
      l.score, l.dolor_detectado, l.conversation_summary, c.created_at
    FROM sales_contacts c
    LEFT JOIN sales_accounts a ON c.account_id = a.id
    LEFT JOIN sales_leads l ON l.id = c.id OR (c.email IS NOT NULL AND l.email = c.email) OR (c.phone IS NOT NULL AND l.telefono = c.phone)
    WHERE 1=1
  `;
  const params: any[] = [];

  // Filtro de Tenant
  if (tenant) {
    sql += " AND (a.tenant_id = ? OR a.tenant_id IS NULL)";
    params.push(tenant);
  }

  // Filtro de Plaza
  if (plaza && plaza !== "all") {
    if (plaza === "campeche") {
      sql += " AND (a.city LIKE '%campeche%' OR a.city LIKE '%carmen%' OR c.phone LIKE '981%' OR c.phone LIKE '938%' OR c.whatsapp LIKE '981%' OR c.whatsapp LIKE '938%')";
    } else if (plaza === "cancun") {
      sql += " AND ((a.city LIKE '%cancun%' OR a.city LIKE '%cancún%' OR a.city LIKE '%benito%' OR a.city LIKE '%quintana%') AND a.city NOT LIKE '%tulum%' AND a.city NOT LIKE '%playa%')";
    } else if (plaza === "riviera_maya" || plaza === "tulum" || plaza === "playa") {
      sql += " AND (a.city LIKE '%tulum%' OR a.city LIKE '%playa%' OR a.city LIKE '%cozumel%' OR a.city LIKE '%solidaridad%')";
    } else if (plaza === "merida") {
      sql += " AND (a.city LIKE '%merida%' OR a.city LIKE '%mérida%' OR a.city LIKE '%yucat%')";
    } else if (plaza === "cdmx") {
      sql += " AND (a.city LIKE '%cdmx%' OR a.city LIKE '%méxico%' OR a.city LIKE '%mexico%' OR c.phone LIKE '55%')";
    } else if (plaza === "monterrey") {
      sql += " AND (a.city LIKE '%monterrey%' OR a.city LIKE '%san pedro%' OR a.city LIKE '%nuevo león%' OR c.phone LIKE '81%')";
    } else if (plaza === "guadalajara") {
      sql += " AND (a.city LIKE '%guadalajara%' OR a.city LIKE '%zapopan%' OR a.city LIKE '%jalisco%' OR c.phone LIKE '33%')";
    } else {
      sql += " AND a.city LIKE ?";
      params.push(`%${plaza}%`);
    }
  }

  // Filtro de WhatsApp
  if (conWa) {
    sql += " AND c.whatsapp IS NOT NULL AND c.whatsapp != '' AND c.whatsapp != '-'";
  }

  // Filtro de Score
  if (minScore !== null && !isNaN(minScore)) {
    sql += " AND (l.score >= ? OR (l.score IS NULL AND ? <= 50))";
    params.push(minScore, minScore);
  }

  // Filtro de Búsqueda
  if (query) {
    sql += " AND (c.name LIKE ? OR a.name LIKE ? OR c.title LIKE ? OR l.dolor_detectado LIKE ? OR a.city LIKE ?)";
    params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
  }

  sql += " ORDER BY c.created_at DESC LIMIT ?";
  params.push(limit);

  const stmt = env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all();

  return (results || []).map((row: any) => {
    // Extraer nombre y apellido
    const rawName = (row.name || "Sin nombre").trim();
    const parts = rawName.split(" ");
    const firstname = parts[0] || "";
    const lastname = parts.slice(1).join(" ") || "";
    const wa = (row.whatsapp && row.whatsapp !== "-") ? row.whatsapp : null;
    const phone = (row.phone && row.phone !== "-") ? row.phone : (wa || null);

    return {
      contact_id: row.id,
      nombre: rawName,
      firstname,
      lastname,
      empresa: row.account_name || "Consultorio / Clínica",
      ciudad: row.account_city || "No especificada",
      estado: row.account_state || "México",
      telefono: phone,
      whatsapp: wa,
      whatsapp_link: wa ? `https://wa.me/${wa.replace(/\D/g, "")}` : null,
      email: (row.email && row.email !== "-") ? row.email : null,
      especialidad: row.title || "Salud y Medicina",
      score_prospeccion: row.score || 70,
      dolor_comercial: row.dolor_detectado || "interes_expansion",
      resumen_ia: row.conversation_summary || null,
      tenant: row.tenant_id || "acc_futura_capital",
      fecha_cosecha: row.created_at,
    };
  });
}

// ── EJECUTOR DE TOOLS MCP ──
async function ejecutarToolMcp(env: Env, name: string, args: any, tenantRestringido?: string) {
  if (name === "buscar_prospectos_cosechados") {
    const leads = await consultarLeadsD1(env, args, tenantRestringido);
    return {
      total_encontrados: leads.length,
      criterios: {
        plaza: args.plaza || "todas",
        filtro_whatsapp: Boolean(args.con_whatsapp),
        min_score: args.min_score || "sin filtro",
        query: args.query || "sin filtro",
      },
      prospectos: leads,
    };
  }

  if (name === "exportar_prospectos_hubspot") {
    const leads = await consultarLeadsD1(env, args, tenantRestringido);
    const hubspotPayload = leads.map((lead: any) => ({
      properties: {
        firstname: lead.firstname,
        lastname: lead.lastname,
        company: lead.empresa,
        phone: lead.telefono || "",
        mobilephone: lead.whatsapp || "",
        email: lead.email || "",
        city: lead.ciudad,
        state: lead.estado,
        country: "Mexico",
        jobtitle: lead.especialidad,
        hs_lead_status: "NEW",
        lifecyclestage: "lead",
        ark_score: String(lead.score_prospeccion),
        ark_pain_point: lead.dolor_comercial,
        ark_harvest_date: lead.fecha_cosecha,
        ark_source: "Ark Systems DENUE Harvester",
      },
    }));

    return {
      formato: "HubSpot CRM Batch Contacts v3",
      total_exportados: hubspotPayload.length,
      hubspot_batch_payload: hubspotPayload,
      instrucciones_api: "Para importar directamente a HubSpot, envía este array a POST https://api.hubapi.com/crm/v3/objects/contacts/batch/create",
    };
  }

  if (name === "obtener_resumen_plazas") {
    const totalStmt = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_contactos,
        COUNT(CASE WHEN whatsapp IS NOT NULL AND whatsapp != '' AND whatsapp != '-' THEN 1 END) as con_whatsapp,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' AND email != '-' THEN 1 END) as con_email
      FROM sales_contacts
    `).first<any>();

    // Conteos por plaza
    const accountsStmt = await env.DB.prepare(`
      SELECT city, COUNT(*) as n FROM sales_accounts GROUP BY city
    `).all<any>();

    const desgloseCiudades: Record<string, number> = {};
    (accountsStmt.results || []).forEach((row: any) => {
      const c = row.city || "Sin ciudad";
      desgloseCiudades[c] = (desgloseCiudades[c] || 0) + (row.n || 0);
    });

    return {
      sistema: "ARK SYSTEMS Lead Harvester & D1 Ingest Pipeline",
      metricas_globales: {
        total_contactos: totalStmt?.total_contactos || 0,
        con_whatsapp_directo: totalStmt?.con_whatsapp || 0,
        con_email_corporativo: totalStmt?.con_email || 0,
        tasa_cobertura_whatsapp: totalStmt?.total_contactos
          ? `${Math.round(((totalStmt.con_whatsapp || 0) / totalStmt.total_contactos) * 100)}%`
          : "0%",
      },
      plazas_activas: [
        { plaza: "campeche", nombre: "San Francisco de Campeche & Ciudad del Carmen", estado: "Campeche", vertical: "Clínicas, Especialidades Médicas & Hospitales" },
        { plaza: "cancun", nombre: "Cancún (Zona Médica & Puerto Cancún)", estado: "Quintana Roo", vertical: "Turismo Médico, Estética, Cirugía Plástica & Dental" },
        { plaza: "riviera_maya", nombre: "Playa del Carmen, Tulum & Cozumel", estado: "Quintana Roo", vertical: "Wellness, Dental, Clínicas Internacionales" },
        { plaza: "merida", nombre: "Mérida (Altabrisa & Montejo)", estado: "Yucatán", vertical: "Medicina Especializada, Hospitales & Firmas Contables" },
      ],
      desglose_por_municipio: desgloseCiudades,
    };
  }

  if (name === "sincronizar_leads_a_hubspot") {
    const token = args.hubspot_access_token;
    if (!token || typeof token !== "string" || !token.startsWith("pat-")) {
      throw new Error("Token de HubSpot inválido. Debe comenzar con 'pat-na1-...' o similar.");
    }

    const leads = await consultarLeadsD1(env, { ...args, limit: Math.min(50, Number(args.limit) || 20) }, tenantRestringido);
    if (!leads.length) {
      return { status: "empty", mensaje: "No se encontraron prospectos que coincidan con los filtros." };
    }

    const inputs = leads.map((lead: any) => ({
      properties: {
        firstname: lead.firstname,
        lastname: lead.lastname,
        company: lead.empresa,
        phone: lead.telefono || "",
        mobilephone: lead.whatsapp || "",
        email: lead.email || "",
        city: lead.ciudad,
        state: lead.estado,
        country: "Mexico",
        jobtitle: lead.especialidad,
        hs_lead_status: "NEW",
        lifecyclestage: "lead",
      },
    }));

    try {
      const resp = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/create", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs }),
      });

      const hubspotResp: any = await resp.json();
      if (!resp.ok) {
        return {
          status: "error",
          http_status: resp.status,
          hubspot_error: hubspotResp.message || "Error al sincronizar con HubSpot",
          leads_preparados: leads.length,
        };
      }

      return {
        status: "success",
        mensaje: `Se sincronizaron exitosamente ${inputs.length} prospectos directamente en tu HubSpot CRM.`,
        contactos_creados: hubspotResp.results?.length || inputs.length,
        hubspot_response: hubspotResp,
      };
    } catch (err: any) {
      return { status: "error", error: err.message || "Error de red contactando la API de HubSpot." };
    }
  }

  throw new Error(`Herramienta '${name}' no reconocida por el servidor MCP.`);
}

// ── DESPACHADOR CENTRAL DE MENSAJES JSON-RPC 2.0 (MCP SPEC) ──
async function procesarMensajeJsonRpc(env: Env, rpc: any, tenantRestringido?: string): Promise<any> {
  const id = rpc.id;
  const method = rpc.method;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: {
          name: "ark-sales-mcp",
          version: "1.0.0",
        },
        instructions: "Servidor oficial de ARK Systems para acceso de agentes y CRMs (Claude, HubSpot, Cursor) a prospectos comerciales cosechados del DENUE y enriquecidos.",
      },
    };
  }

  if (method === "notifications/initialized") {
    return null; // Las notificaciones no devuelven respuesta
  }

  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: MCP_TOOLS,
      },
    };
  }

  if (method === "tools/call") {
    const toolName = rpc.params?.name;
    const toolArgs = rpc.params?.arguments || {};
    try {
      const data = await ejecutarToolMcp(env, toolName, toolArgs, tenantRestringido);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
          isError: false,
        },
      };
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Error ejecutando ${toolName}: ${err.message || String(err)}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  if (method === "resources/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        resources: MCP_RESOURCES,
      },
    };
  }

  if (method === "resources/read") {
    const uri = rpc.params?.uri;
    if (uri === "ark://plazas/inventario") {
      const resumen = await ejecutarToolMcp(env, "obtener_resumen_plazas", {}, tenantRestringido);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(resumen, null, 2),
            },
          ],
        },
      };
    }
    if (uri === "ark://leads/recientes") {
      const leads = await consultarLeadsD1(env, { limit: 50 }, tenantRestringido);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(leads, null, 2),
            },
          ],
        },
      };
    }
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: `Resource '${uri}' not found` },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method '${method}' not found` },
  };
}

// ── ENDPOINTS HTTP & SSE DEL SERVIDOR MCP ──

/**
 * GET /mcp/sse
 * Canal Server-Sent Events (SSE) para Claude Desktop, Claude Coworker y conectores remotos.
 */
mcpRouter.get("/sse", async (c) => {
  const auth = await validarAuthMcp(c);
  if (!auth.autorizado) {
    return c.text(`event: error\ndata: ${JSON.stringify({ error: auth.error })}\n\n`, 401, {
      "Content-Type": "text/event-stream",
    });
  }

  const sessionId = `mcp_${crypto.randomUUID()}`;
  const endpointUrl = `/mcp/messages?sessionId=${sessionId}`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      // Enviar el evento 'endpoint' exigido por la especificación MCP 2024-11-05
      controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpointUrl}\n\n`));
      // Comentario inicial de conexión activa
      controller.enqueue(encoder.encode(`: ark-sales-mcp-connected ${new Date().toISOString()}\n\n`));
    },
    cancel() {
      // Conexión finalizada por el cliente
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

/**
 * POST /mcp/messages
 * Endpoint de recepción de mensajes JSON-RPC para la sesión SSE.
 */
mcpRouter.post("/messages", async (c) => {
  const auth = await validarAuthMcp(c);
  if (!auth.autorizado) {
    return c.json({ error: auth.error || "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }, 400);
  }

  const respuestaRpc = await procesarMensajeJsonRpc(c.env, body, auth.tenant);
  if (respuestaRpc === null) {
    return new Response(null, { status: 204 });
  }

  return c.json(respuestaRpc, 200, {
    "Access-Control-Allow-Origin": "*",
  });
});

/**
 * POST /mcp
 * Endpoint JSON-RPC 2.0 directo (Streamable HTTP / Stateless POST).
 * Permite a cualquier agente (Cursor, Claude Code, HubSpot Custom Action, Python) llamar sin SSE.
 */
mcpRouter.post("/", async (c) => {
  const auth = await validarAuthMcp(c);
  if (!auth.autorizado) {
    return c.json({ jsonrpc: "2.0", error: { code: -32000, message: auth.error || "Unauthorized" } }, 401);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }, 400);
  }

  const respuestaRpc = await procesarMensajeJsonRpc(c.env, body, auth.tenant);
  return c.json(respuestaRpc || { jsonrpc: "2.0", result: "ok" });
});

/**
 * GET /mcp
 * Portal de documentación y configuración rápida para conectar Claude y HubSpot.
 */
mcpRouter.get("/", async (c) => {
  return c.json({
    name: "Ark Systems Lead Harvester MCP Server",
    status: "active",
    protocol: "Model Context Protocol (MCP) 2024-11-05",
    endpoints: {
      sse: "https://sales.arksystems.site/mcp/sse",
      messages: "https://sales.arksystems.site/mcp/messages",
      direct_post: "https://sales.arksystems.site/mcp",
    },
    tools_disponibles: MCP_TOOLS.map((t) => t.name),
    configuracion_claude_desktop: {
      mcpServers: {
        "ark-sales": {
          url: "https://sales.arksystems.site/mcp/sse",
          headers: {
            Authorization: "Bearer <TU_API_KEY>",
          },
        },
      },
    },
    integracion_hubspot: {
      metodo: "Sincronización directa vía tool 'sincronizar_leads_a_hubspot' o exportación batch",
      hubspot_api: "https://api.hubapi.com/crm/v3/objects/contacts/batch/create",
    },
  });
});
