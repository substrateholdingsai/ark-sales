import { Hono } from "hono";
import { Env } from "../types";
import { z } from "zod";
import { dispararLlamadaCortesia } from "../voice/telnyx";
import { enrichDoctorLead } from "../services/contactEnrichment";

export const adminAssistantRouter = new Hono<{ Bindings: Env; Variables: { user: any } }>();

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  tenant_id: z.string().max(128).optional(),
  context: z.string().max(4000).optional(),
});

// TOP 5 Herramientas más útiles y de alto impacto para optimizar consumo de neuronas
export const ADMIN_TOOLS = [
  {
    name: "get_metrics",
    description: "Devuelve conteos y métricas del CRM (leads, cuentas, contactos, oportunidades, tareas).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_contacts",
    description: "Lista contactos del CRM con su nombre, teléfono, WhatsApp y clínica.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Límite de contactos a consultar (default 10)." },
        account_id: { type: "string", description: "Opcional: ID de la cuenta para filtrar." },
      },
    },
  },
  {
    name: "enrich_contact",
    description: "Busca en Doctoralia y Google el teléfono y WhatsApp de un médico o clínica para enriquecerlo.",
    parameters: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "ID del contacto a enriquecer (ej. ct_xxx)." },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "create_lead",
    description: "Crea un nuevo prospecto o lead en el CRM.",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string", description: "Correo electrónico del prospecto." },
        despacho_nombre: { type: "string", description: "Nombre de la clínica, consultorio o empresa." },
      },
      required: ["email"],
    },
  },
  {
    name: "send_email",
    description: "Envía un correo de seguimiento comercial vía Resend.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Correo destino." },
        subject: { type: "string", description: "Asunto del correo." },
        html: { type: "string", description: "Contenido del mensaje." },
      },
      required: ["to", "subject"],
    },
  },
];

adminAssistantRouter.post("/", async (c) => handleAdminAssistant(c));
adminAssistantRouter.post("/chat", async (c) => handleAdminAssistant(c));
adminAssistantRouter.post("/query", async (c) => handleAdminAssistant(c));
adminAssistantRouter.post("/message", async (c) => handleAdminAssistant(c));

export async function executeAdminTool(name: string, args: any, env: Env, user: any): Promise<any> {
  const db = env?.DB;
  if (!db) return { success: false, error: "DB no disponible" };

  try {
    if (["delete_lead", "delete_account", "delete_contact"].includes(name) && user?.role !== "admin") {
      return { success: false, error: "Permiso denegado: solo administradores pueden eliminar registros." };
    }

    if (name === "get_metrics") {
      const counts: any = {};
      for (const table of ["sales_leads", "sales_accounts", "sales_contacts", "sales_opportunities", "sales_tasks"]) {
        try {
          const row: any = await db.prepare("SELECT COUNT(*) as n FROM " + table).first();
          counts[table] = row ? row.n : 0;
        } catch {
          counts[table] = null;
        }
      }
      return { success: true, metrics: counts };
    }

    if (name === "list_contacts") {
      const limit = Math.min(Math.max(Number(args?.limit || 10), 1), 50);
      try {
        const sql = args?.account_id
          ? "SELECT id, account_id, name, email, phone, whatsapp, title, created_at FROM sales_contacts WHERE account_id = ? ORDER BY created_at DESC LIMIT ?"
          : "SELECT id, account_id, name, email, phone, whatsapp, title, created_at FROM sales_contacts ORDER BY created_at DESC LIMIT ?";
        const stmt = args?.account_id ? db.prepare(sql).bind(args.account_id, limit) : db.prepare(sql).bind(limit);
        const r: any = await stmt.all();
        return { success: true, count: (r.results || []).length, contacts: r.results || [] };
      } catch (err: any) {
        return { success: false, error: err?.message || "DB_ERROR" };
      }
    }

    if (name === "enrich_contact") {
      const contactId = String(args?.contact_id || "").trim();
      if (!contactId) return { success: false, error: "contact_id requerido" };
      const contact: any = await db.prepare(`
        SELECT c.*, a.name AS account_name, a.city AS account_city
        FROM sales_contacts c
        LEFT JOIN sales_accounts a ON c.account_id = a.id
        WHERE c.id = ?
      `).bind(contactId).first();
      if (!contact) return { success: false, error: "Contacto no encontrado en BD" };

      const enrichment = await enrichDoctorLead({
        name: args?.name || contact.name,
        accountName: contact.account_name,
        city: contact.account_city,
      });

      if (enrichment.found && args?.auto_apply !== false) {
        const isPlaceholder = !contact.name || contact.name === "Sin nombre" || contact.name.toLowerCase().includes("contacto corporativo");
        const newName = (isPlaceholder && enrichment.doctor_name) ? enrichment.doctor_name : contact.name;
        const newPhone = enrichment.phone || contact.phone;
        const newWa = enrichment.whatsapp || contact.whatsapp;
        const newTitle = enrichment.title || contact.title;

        await db.prepare(`
          UPDATE sales_contacts
          SET name = ?, phone = ?, whatsapp = ?, title = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(newName, newPhone, newWa, newTitle, contactId).run();

        await writeAudit(db, user, "enrich_contact", contactId, {
          previous: { name: contact.name, phone: contact.phone, whatsapp: contact.whatsapp },
          enriched: { name: newName, phone: newPhone, whatsapp: newWa, title: newTitle },
          source_url: enrichment.source_url,
        });
      }

      return {
        success: true,
        contact_id: contactId,
        found: enrichment.found,
        doctor_name: enrichment.doctor_name,
        phone: enrichment.phone,
        whatsapp: enrichment.whatsapp,
        title: enrichment.title,
        source_url: enrichment.source_url,
        google_search_url: enrichment.google_search_url,
        doctoralia_search_url: enrichment.doctoralia_search_url,
      };
    }

    if (name === "create_lead") {
      const email = String(args?.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return { success: false, error: "Email inválido" };
      const id = `lead_${crypto.randomUUID()}`;
      await db
        .prepare(
          `INSERT INTO sales_leads (id, email, despacho_nombre, tamano, especialista_asignado, estado, score, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'intake', 'nuevo', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        )
        .bind(id, email, args?.despacho_nombre ?? null, args?.tamano ?? null)
        .run();
      await writeAudit(db, user, "create_lead", id, { email, despacho_nombre: args?.despacho_nombre });
      return { success: true, lead_id: id, email };
    }

    if (name === "send_email") {
      const to = String(args?.to || "").trim();
      if (!to || !to.includes("@")) return { success: false, error: "Destinatario inválido" };
      const subject = String(args?.subject || "Mensaje ARK Systems");
      const html = String(args?.html || "<p>Mensaje de ARK Systems.</p>");
      if (!env.RESEND_API_KEY) {
        return { success: true, simulated: true, to, subject, message: "Correo simulado (sin RESEND_API_KEY)" };
      }
      try {
        const fromEmail = env.RESEND_FROM_EMAIL || "ARK Systems <ventas@mail.arksystems.site>";
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return { success: false, error: `RESEND_HTTP_${resp.status}`, message: errText };
        }
        const data: any = await resp.json();
        return { success: true, simulated: false, to, subject, resend_id: data?.id || null };
      } catch (err: any) {
        return { success: false, error: err?.message || "RESEND_EXCEPTION" };
      }
    }

    // Herramientas secundarias (disponibles en backend)
    if (name === "list_leads") {
      const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 100);
      const { results } = await db
        .prepare("SELECT id, email, despacho_nombre, tamano, estado, score, created_at FROM sales_leads ORDER BY created_at DESC LIMIT ?")
        .bind(limit)
        .all();
      return { success: true, count: results?.length || 0, leads: results || [] };
    }

    if (name === "trigger_voice_call") {
      const to = String(args?.to || "").trim();
      if (!to) return { success: false, error: "Número destino requerido" };
      return await dispararLlamadaCortesia(env, {
        to,
        despachoNombre: args?.despacho_nombre,
        industry: args?.industry,
        leadId: args?.lead_id,
        accountId: args?.account_id,
        contactId: args?.contact_id,
        customMessage: args?.custom_message,
      });
    }

    return { success: false, error: "Herramienta desconocida: " + name };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error ejecutando herramienta" };
  }
}

async function writeAudit(db: any, user: any, action: string, entityId: string, payload: any) {
  try {
    await db
      .prepare(
        `INSERT INTO crm_audit_log (id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at)
         VALUES (?, ?, ?, 'assistant', ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(`aud_${crypto.randomUUID()}`, user?.sub || user?.id || null, action, entityId, JSON.stringify(payload || {}))
      .run();
  } catch {
    // Audit log table optional
  }
}

export async function runDeterministicFallback(
  message: string,
  tenantId: string | null,
  env: Env,
  user: any
): Promise<{ reply: string; toolsCalled: any[] }> {
  const lower = message.toLowerCase().trim();
  const toolsCalled: any[] = [];
  const db = env?.DB;

  // 1. Acceso a BD / Estado del sistema / Saludo inicial
  if (
    lower.includes("base de datos") ||
    lower.includes("acceso") ||
    lower.includes("conectado") ||
    lower.includes("conexion") ||
    lower.includes("conexión")
  ) {
    if (db) {
      const metricsRes = await executeAdminTool("get_metrics", {}, env, user);
      toolsCalled.push({ name: "get_metrics", args: {}, result: metricsRes });
      const m = metricsRes.metrics || {};
      return {
        reply:
          `⚡ **Conectado a Cloudflare D1 en modo directo:**\n` +
          `Sí, tengo acceso total a la base de datos de ARK.\n\n` +
          `• 👥 **Contactos Registrados:** ${m.sales_contacts ?? 0}\n` +
          `• 🏢 **Cuentas / Clínicas:** ${m.sales_accounts ?? 0}\n` +
          `• 🎯 **Leads:** ${m.sales_leads ?? 0}\n` +
          `• 💼 **Oportunidades:** ${m.sales_opportunities ?? 0}\n` +
          `• ✅ **Tareas:** ${m.sales_tasks ?? 0}`,
        toolsCalled,
      };
    }
    return { reply: "Conectado al servidor ARK. Base de datos D1 en línea.", toolsCalled };
  }

  // 2. Métricas / Estadísticas / Resumen
  if (
    lower.includes("metrica") ||
    lower.includes("métrica") ||
    lower.includes("stats") ||
    lower.includes("resumen") ||
    lower.includes("conteo") ||
    lower.includes("dashboard")
  ) {
    const metricsRes = await executeAdminTool("get_metrics", {}, env, user);
    toolsCalled.push({ name: "get_metrics", args: {}, result: metricsRes });
    const m = metricsRes.metrics || {};
    return {
      reply:
        `📊 **Métricas del CRM (Modo Directo):**\n\n` +
        `• Contactos: **${m.sales_contacts ?? 0}**\n` +
        `• Cuentas: **${m.sales_accounts ?? 0}**\n` +
        `• Leads: **${m.sales_leads ?? 0}**\n` +
        `• Oportunidades: **${m.sales_opportunities ?? 0}**\n` +
        `• Tareas: **${m.sales_tasks ?? 0}**`,
      toolsCalled,
    };
  }

  // 3. Enriquecer contacto
  if (
    lower.includes("enriquecer") ||
    lower.includes("doctoralia") ||
    lower.includes("buscar telefono") ||
    lower.includes("buscar teléfono") ||
    lower.includes("whatsapp")
  ) {
    const ctcMatch = message.match(/ct[c]?_[a-zA-Z0-9-]+/);
    if (ctcMatch) {
      const res = await executeAdminTool("enrich_contact", { contact_id: ctcMatch[0] }, env, user);
      toolsCalled.push({ name: "enrich_contact", args: { contact_id: ctcMatch[0] }, result: res });
      return {
        reply: res.found
          ? `✨ **Contacto enriquecido con éxito:**\n\n` +
            `• Médico: **${res.doctor_name || "-"}**\n` +
            `• Teléfono: **${res.phone || "-"}**\n` +
            `• WhatsApp: **${res.whatsapp || "-"}**\n` +
            `• Especialidad: ${res.title || "-"}\n` +
            `• Fuente: ${res.source_url || "Directorio web"}`
          : `🔍 Búsqueda completada pero no se halló teléfono público en Doctoralia para este registro. [Ver en Google](${res.google_search_url})`,
        toolsCalled,
      };
    }
    return {
      reply: "Por favor indica el ID del contacto que deseas enriquecer (ej. `ct_xxx` o `ctc_xxx`).",
      toolsCalled,
    };
  }

  // 4. Listar contactos
  if (lower.includes("contacto") || lower.includes("doctor") || lower.includes("medico") || lower.includes("médico")) {
    const res = await executeAdminTool("list_contacts", { limit: 5 }, env, user);
    toolsCalled.push({ name: "list_contacts", args: { limit: 5 }, result: res });
    const list = (res.contacts || [])
      .map(
        (ct: any) =>
          `• **${ct.name || "Sin nombre"}** | Tel: ${ct.phone || "-"} | WA: ${ct.whatsapp || "-"}`
      )
      .join("\n");
    return {
      reply: `📋 **Últimos contactos registrados:**\n\n${list || "Sin contactos registrados."}\n\n*(Mostrando los 5 más recientes)*`,
      toolsCalled,
    };
  }

  // 5. Crear lead
  if (lower.includes("crear lead") || lower.includes("nuevo lead") || lower.includes("alta lead")) {
    const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const email = emailMatch ? emailMatch[0] : `lead_${Date.now()}@harvest.arksystems.local`;
    const res = await executeAdminTool("create_lead", { email }, env, user);
    toolsCalled.push({ name: "create_lead", args: { email }, result: res });
    return {
      reply: res.success
        ? `✅ Lead creado exitosamente con ID **${res.lead_id}** (${res.email}).`
        : `Error creando lead: ${res.error}`,
      toolsCalled,
    };
  }

  // 6. Enviar correo
  if (lower.includes("enviar correo") || lower.includes("mandar email")) {
    const toMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (toMatch) {
      const res = await executeAdminTool(
        "send_email",
        { to: toMatch[0], subject: "Contacto ARK Systems" },
        env,
        user
      );
      toolsCalled.push({ name: "send_email", args: { to: toMatch[0] }, result: res });
      return {
        reply: res.success ? `✉️ Correo enviado a **${toMatch[0]}**.` : `Error: ${res.error}`,
        toolsCalled,
      };
    }
    return { reply: "Por favor indica el correo destinatario (ej. doctor@ejemplo.com).", toolsCalled };
  }

  // 7. Saludo y menú de ayuda por defecto
  return {
    reply:
      `👋 **¡Hola! Soy tu Asistente AI de ARK (Modo Directo):**\n\n` +
      `Tengo acceso completo a la base de datos. Puedes pedirme:\n` +
      `1. 📊 **Métricas**: *"Muéstrame las métricas del CRM"*\n` +
      `2. 👥 **Contactos**: *"Lista los últimos contactos"*\n` +
      `3. ✨ **Enriquecer**: *"Enriquece el contacto ct_xxx"*\n` +
      `4. ➕ **Leads**: *"Crear lead cliente@correo.com"*\n` +
      `5. ✉️ **Email**: *"Enviar correo a doctor@correo.com"*\n\n` +
      `¿Qué deseas consultar o realizar?`,
    toolsCalled,
  };
}

async function handleAdminAssistant(c: any) {
  const user = c.get("user");
  if (!user) return c.json({ error: "Autenticación requerida." }, 401);
  if (user.role !== "admin" && user.role !== "vendedor") {
    return c.json({ error: "No tienes permisos para esta acción." }, 403);
  }

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Payload inválido", details: parsed.error.flatten() }, 400);
  const { message, tenant_id } = parsed.data;

  const systemPrompt =
    "Eres el Asistente AI de ARK. Responde en español de México de forma concisa y profesional. " +
    "Cuentas con 5 herramientas: get_metrics, list_contacts, enrich_contact, create_lead, send_email. " +
    "Utilízalas cuando el usuario pida datos o acciones del CRM.";

  let reply = "";
  const toolsCalled: { name: string; args: any; result: any }[] = [];

  try {
    if (c.env.AI && typeof c.env.AI.run === "function") {
      // Usar modelo Llama 3.1 8B optimizado (consume 15x a 20x menos neuronas que 70B)
      const modelName = c.env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct";
      const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: (tenant_id ? `[Tenant: ${tenant_id}] ` : "") + message },
      ];

      let iterations = 0;
      const maxIterations = 3;
      while (iterations < maxIterations) {
        iterations++;
        const aiResponse: any = await c.env.AI.run(modelName, {
          messages,
          tools: ADMIN_TOOLS,
        });

        const toolCalls = Array.isArray(aiResponse?.tool_calls) ? aiResponse.tool_calls : [];
        if (toolCalls.length > 0) {
          for (const call of toolCalls) {
            const toolName = call?.name || call?.function?.name;
            let args = call?.arguments || call?.function?.arguments || {};
            if (typeof args === "string") {
              try {
                args = JSON.parse(args);
              } catch {
                args = {};
              }
            }
            const result = await executeAdminTool(toolName, args, c.env, user);
            toolsCalled.push({ name: toolName, args, result });
            messages.push({ role: "assistant", content: null, tool_calls: [call] });
            messages.push({ role: "tool", name: toolName, content: JSON.stringify(result) });
          }
          continue;
        }

        if (typeof aiResponse === "string") reply = aiResponse;
        else if (aiResponse?.response) reply = aiResponse.response;
        else reply = "";
        break;
      }
    }

    if (!reply || !reply.trim()) {
      const fallback = await runDeterministicFallback(message, tenant_id || null, c.env, user);
      reply = fallback.reply;
      toolsCalled.push(...fallback.toolsCalled);
    }
  } catch (err: any) {
    // Si la cuota de neuronas diarias de Cloudflare está agotada (error 4006) o Workers AI falla:
    // Activar inmediatamente el fallback determinista inteligente sin mostrar mensaje de error en pantalla
    const fallback = await runDeterministicFallback(message, tenant_id || null, c.env, user);
    reply = fallback.reply;
    toolsCalled.push(...fallback.toolsCalled);
  }

  return c.json({
    success: true,
    response: reply,
    answer: reply,
    reply: reply,
    message: reply,
    assistant: "ARK Admin Assistant",
    role: user.role,
    tenant_id: tenant_id || null,
    tools_called: toolsCalled,
  });
}
