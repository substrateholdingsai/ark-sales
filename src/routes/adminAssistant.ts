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

export const ADMIN_TOOLS = [
  {
    name: "list_leads",
    description: "Lista leads recientes del CRM. Solo lectura.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Cantidad máxima de leads a devolver (default 20)." },
      },
    },
  },
  {
    name: "create_lead",
    description: "Crea un nuevo lead en el CRM.",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string", description: "Correo del lead." },
        despacho_nombre: { type: "string", description: "Nombre del despacho." },
        tamano: { type: "string", description: "Tamaño del despacho (1-5, 6-20, 21-50, 50+)." },
      },
      required: ["email"],
    },
  },
  {
    name: "update_lead",
    description: "Actualiza campos de un lead existente.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "ID del lead." },
        email: { type: "string" },
        despacho_nombre: { type: "string" },
        tamano: { type: "string" },
        estado: { type: "string" },
        score: { type: "number" },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "delete_lead",
    description: "Elimina un lead del CRM. Requiere rol admin.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "ID del lead a eliminar." },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "send_email",
    description: "Envía un correo electrónico vía Resend. Si no hay API key, opera en modo simulado.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Correo destino." },
        subject: { type: "string", description: "Asunto del correo." },
        html: { type: "string", description: "Contenido HTML del correo." },
      },
      required: ["to", "subject"],
    },
  },
  {
    name: "trigger_voice_call",
    description: "Dispara una llamada de cortesía vía Telnyx Voice AI.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Número telefónico destino." },
        despacho_nombre: { type: "string" },
        industry: { type: "string" },
        lead_id: { type: "string" },
        account_id: { type: "string" },
        contact_id: { type: "string" },
        custom_message: { type: "string" },
      },
      required: ["to"],
    },
  },
  {
    name: "get_metrics",
    description: "Devuelve conteos básicos del CRM (leads, accounts, contacts, opportunities, tasks, campaigns).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_accounts",
    description: "Lista cuentas/despachos del CRM.",
    parameters: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "create_account",
    description: "Crea una cuenta/despacho en el CRM.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        size: { type: "string" },
        city: { type: "string" },
        origin: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_account",
    description: "Actualiza una cuenta/despacho.",
    parameters: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        name: { type: "string" },
        size: { type: "string" },
        city: { type: "string" },
        origin: { type: "string" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "delete_account",
    description: "Elimina una cuenta y sus dependencias. Requiere confirm=true y rol admin.",
    parameters: {
      type: "object",
      properties: { account_id: { type: "string" }, confirm: { type: "boolean" } },
      required: ["account_id"],
    },
  },
  {
    name: "list_contacts",
    description: "Lista contactos del CRM, opcionalmente filtrados por cuenta.",
    parameters: {
      type: "object",
      properties: { account_id: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "create_contact",
    description: "Crea un contacto en el CRM.",
    parameters: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        whatsapp: { type: "string" },
        title: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_contact",
    description: "Actualiza un contacto.",
    parameters: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        whatsapp: { type: "string" },
        title: { type: "string" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "delete_contact",
    description: "Elimina un contacto. Requiere confirm=true y rol admin.",
    parameters: {
      type: "object",
      properties: { contact_id: { type: "string" }, confirm: { type: "boolean" } },
      required: ["contact_id"],
    },
  },
  {
    name: "enrich_contact",
    description: "Enriquece un contacto buscando su teléfono, WhatsApp y perfil en Doctoralia y Google.",
    parameters: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "ID del contacto (ej. ct_xxx o ctc_xxx)." },
        name: { type: "string", description: "Nombre o apellido del médico si se desea sobrescribir." },
        auto_apply: { type: "boolean", description: "Si es true, actualiza el contacto automáticamente en BD (default true)." },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "list_voice_campaigns",
    description: "Lista campañas de voz AI.",
    parameters: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "create_voice_campaign",
    description: "Crea una campaña de voz AI.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        dolor_principal: { type: "string" },
        tenant_id: { type: "string" },
      },
      required: ["name"],
    },
  },
];

adminAssistantRouter.post("/", async (c) => handleAdminAssistant(c));
adminAssistantRouter.post("/chat", async (c) => handleAdminAssistant(c));
adminAssistantRouter.post("/query", async (c) => handleAdminAssistant(c));
adminAssistantRouter.post("/message", async (c) => handleAdminAssistant(c));

async function executeAdminTool(name: string, args: any, env: Env, user: any): Promise<any> {
  const db = env?.DB;
  if (!db) return { success: false, error: "DB no disponible" };

  try {
    // Restricción de borrado para rol vendedor
    if (["delete_lead", "delete_account", "delete_contact"].includes(name) && user?.role !== "admin") {
      return { success: false, error: "Permiso denegado: solo administradores pueden eliminar registros." };
    }

    if (name === "list_leads") {
      const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 100);
      const { results } = await db
        .prepare("SELECT id, email, despacho_nombre, tamano, estado, score, created_at FROM sales_leads ORDER BY created_at DESC LIMIT ?")
        .bind(limit)
        .all();
      return { success: true, count: results?.length || 0, leads: results || [] };
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

    if (name === "update_lead") {
      const leadId = String(args?.lead_id || "").trim();
      if (!leadId) return { success: false, error: "lead_id requerido" };
      const fields: string[] = [];
      const values: any[] = [];
      if (args?.email !== undefined) {
        fields.push("email = ?");
        values.push(String(args.email).trim().toLowerCase());
      }
      if (args?.despacho_nombre !== undefined) {
        fields.push("despacho_nombre = ?");
        values.push(args.despacho_nombre);
      }
      if (args?.tamano !== undefined) {
        fields.push("tamano = ?");
        values.push(args.tamano);
      }
      if (args?.estado !== undefined) {
        fields.push("estado = ?");
        values.push(args.estado);
      }
      if (args?.score !== undefined) {
        fields.push("score = ?");
        values.push(Number(args.score));
      }
      if (fields.length === 0) return { success: false, error: "Sin campos para actualizar" };
      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(leadId);
      await db.prepare(`UPDATE sales_leads SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
      await writeAudit(db, user, "update_lead", leadId, args);
      return { success: true, lead_id: leadId, updated: fields.length - 1 };
    }

    if (name === "delete_lead") {
      const leadId = String(args?.lead_id || "").trim();
      if (!leadId) return { success: false, error: "lead_id requerido" };
      await db.prepare("DELETE FROM sales_leads WHERE id = ?").bind(leadId).run();
      await writeAudit(db, user, "delete_lead", leadId, {});
      return { success: true, lead_id: leadId, deleted: true };
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

    if (name === "trigger_voice_call") {
      const to = String(args?.to || "").trim();
      if (!to) return { success: false, error: "Número destino requerido" };
      const result = await dispararLlamadaCortesia(env, {
        to,
        despachoNombre: args?.despacho_nombre,
        industry: args?.industry,
        leadId: args?.lead_id,
        accountId: args?.account_id,
        contactId: args?.contact_id,
        customMessage: args?.custom_message,
      });
      return result;
    }

    if (name === "get_metrics") {
      const counts: any = {};
      for (const table of ["sales_leads", "sales_accounts", "sales_contacts", "sales_opportunities", "sales_tasks", "voice_campaigns"]) {
        try {
          const row: any = await db.prepare("SELECT COUNT(*) as n FROM " + table).first();
          counts[table] = row ? row.n : 0;
        } catch {
          counts[table] = null;
        }
      }
      return { success: true, metrics: counts };
    }

    if (name === "list_accounts") {
      const limit = Math.min(Math.max(Number(args?.limit || 20), 1), 100);
      try {
        const r: any = await db.prepare("SELECT id, name, size, city, origin, created_at FROM sales_accounts ORDER BY created_at DESC LIMIT ?").bind(limit).all();
        return { success: true, count: (r.results || []).length, accounts: r.results || [] };
      } catch (err: any) {
        return { success: false, error: err?.message || "DB_ERROR" };
      }
    }

    if (name === "create_account") {
      const nameVal = String(args?.name || "").trim();
      if (!nameVal) return { success: false, error: "Nombre requerido" };
      const id = "acc_" + crypto.randomUUID();
      try {
        await db.prepare("INSERT INTO sales_accounts (id, name, size, city, origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
          .bind(id, nameVal, args?.size || null, args?.city || null, args?.origin || "manual").run();
        await writeAudit(db, user, "create_account", id, { name: nameVal });
        return { success: true, account_id: id, name: nameVal };
      } catch (err: any) {
        return { success: false, error: err?.message || "DB_ERROR" };
      }
    }

    if (name === "update_account") {
      const accountId = String(args?.account_id || "").trim();
      if (!accountId) return { success: false, error: "account_id requerido" };
      const fields: string[] = [];
      const values: any[] = [];
      if (args?.name !== undefined) { fields.push("name = ?"); values.push(args.name); }
      if (args?.size !== undefined) { fields.push("size = ?"); values.push(args.size); }
      if (args?.city !== undefined) { fields.push("city = ?"); values.push(args.city); }
      if (args?.origin !== undefined) { fields.push("origin = ?"); values.push(args.origin); }
      if (fields.length === 0) return { success: false, error: "Sin campos" };
      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(accountId);
      try {
        await db.prepare("UPDATE sales_accounts SET " + fields.join(", ") + " WHERE id = ?").bind(...values).run();
        await writeAudit(db, user, "update_account", accountId, args || {});
        return { success: true, account_id: accountId, updated: fields.length - 1 };
      } catch (err: any) {
        return { success: false, error: err?.message || "DB_ERROR" };
      }
    }

    if (name === "delete_account") {
      const accountId = String(args?.account_id || "").trim();
      if (!accountId) return { success: false, error: "account_id requerido" };
      if (args?.confirm !== true) return { requires_confirmation: true, message: "Reenvia con confirm=true para eliminar la cuenta." };
      try {
        await db.prepare("DELETE FROM sales_accounts WHERE id = ?").bind(accountId).run();
        await writeAudit(db, user, "delete_account", accountId, {});
        return { success: true, account_id: accountId, deleted: true };
      } catch (err: any) {
        return { success: false, error: err?.message || "DB_ERROR" };
      }
    }

    if (name === "list_contacts") {
      const limit = Math.min(Math.max(Number(args?.limit || 20), 1), 100);
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

    if (name === "create_contact") {
      const contactName = String(args?.name || "").trim();
      if (!contactName) return { success: false, error: "Nombre requerido" };
      const id = "ctc_" + crypto.randomUUID();
      try {
        await db.prepare("INSERT INTO sales_contacts (id, account_id, name, email, phone, whatsapp, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
          .bind(id, args?.account_id || null, contactName, args?.email || null, args?.phone || null, args?.whatsapp || null, args?.title || null).run();
        await writeAudit(db, user, "create_contact", id, { name: contactName });
        return { success: true, contact_id: id, name: contactName };
      } catch (err: any) {
        return { success: false, error: err?.message || "DB_ERROR" };
      }
    }

    if (name === "update_contact") {
      const contactId = String(args?.contact_id || "").trim();
      if (!contactId) return { success: false, error: "contact_id requerido" };
      const fields: string[] = [];
      const values: any[] = [];
      if (args?.name !== undefined) { fields.push("name = ?"); values.push(args.name); }
      if (args?.email !== undefined) { fields.push("email = ?"); values.push(args.email); }
      if (args?.phone !== undefined) { fields.push("phone = ?"); values.push(args.phone); }
      if (args?.whatsapp !== undefined) { fields.push("whatsapp = ?"); values.push(args.whatsapp); }
      if (args?.title !== undefined) { fields.push("title = ?"); values.push(args.title); }
      if (fields.length === 0) return { success: false, error: "Sin campos" };
      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(contactId);
      try {
        await db.prepare("UPDATE sales_contacts SET " + fields.join(", ") + " WHERE id = ?").bind(...values).run();
        await writeAudit(db, user, "update_contact", contactId, args || {});
        return { success: true, contact_id: contactId, updated: fields.length - 1 };
      } catch (err: any) {
        return { success: false, error: err?.message || "DB_ERROR" };
      }
    }

    if (name === "delete_contact") {
      const contactId = String(args?.contact_id || "").trim();
      if (!contactId) return { success: false, error: "contact_id requerido" };
      if (args?.confirm !== true) return { requires_confirmation: true, message: "Reenvia con confirm=true para eliminar el contacto." };
      try {
        await db.prepare("DELETE FROM sales_contacts WHERE id = ?").bind(contactId).run();
        await writeAudit(db, user, "delete_contact", contactId, {});
        return { success: true, contact_id: contactId, deleted: true };
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

    if (name === "list_voice_campaigns") {
      const limit = Math.min(Math.max(Number(args?.limit || 20), 1), 100);
      try {
        const r: any = await db.prepare("SELECT id, name, status, tenant_id, dolor_principal, total_targets, created_at FROM voice_campaigns ORDER BY created_at DESC LIMIT ?").bind(limit).all();
        return { success: true, count: (r.results || []).length, campaigns: r.results || [] };
      } catch (err: any) {
        return { success: false, error: err?.message || "DB_ERROR" };
      }
    }

    if (name === "create_voice_campaign") {
      const campaignName = String(args?.name || "").trim();
      if (!campaignName) return { success: false, error: "Nombre requerido" };
      const id = "vcamp_" + crypto.randomUUID();
      try {
        await db.prepare("INSERT INTO voice_campaigns (id, tenant_id, name, description, dolor_principal, assistant_id, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
          .bind(id, args?.tenant_id || null, campaignName, args?.description || null, args?.dolor_principal || null, null, (user && (user.sub || user.id)) || null).run();
        await writeAudit(db, user, "create_voice_campaign", id, { name: campaignName });
        return { success: true, campaign_id: id, name: campaignName };
      } catch (err: any) {
        return { success: false, error: err?.message || "DB_ERROR" };
      }
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
         VALUES (?, ?, ?, 'lead', ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(`aud_${crypto.randomUUID()}`, user?.sub || user?.id || null, action, entityId, JSON.stringify(payload || {}))
      .run();
  } catch {
    // Audit log table may not exist in all environments; ignore.
  }
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
    "Eres el Asistente AI de ARK para super administradores y administradores de tenant. " +
    "Puedes consultar y modificar leads, cuentas, contactos y campañas del CRM mediante herramientas. " +
    "Si te piden buscar datos, teléfono o WhatsApp de un médico o contacto, utiliza la herramienta enrich_contact. " +
    "Ejecuta cambios solo cuando el usuario lo solicite de forma explícita y confirma el resultado. " +
    "Responde en español de México, de forma concisa, técnica y profesional.";

  let reply = "";
  const toolsCalled: { name: string; args: any; result: any }[] = [];

  try {
    if (c.env.AI && typeof c.env.AI.run === "function") {
      const modelName = c.env.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
      const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: (tenant_id ? `[Tenant: ${tenant_id}] ` : "") + message },
      ];

      let iterations = 0;
      const maxIterations = 4;
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
        else reply = "Sin respuesta del asistente AI.";
        break;
      }
      if (!reply) reply = "Sin respuesta del asistente AI.";
    } else {
      // Deterministic fallback: support explicit simple commands for tests/offline use.
      const lower = message.toLowerCase();
      if (lower.includes("crear lead") || lower.includes("create lead")) {
        const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        const email = emailMatch ? emailMatch[0] : `lead_${Date.now()}@example.com`;
        const result = await executeAdminTool("create_lead", { email }, c.env, user);
        toolsCalled.push({ name: "create_lead", args: { email }, result });
        reply = result.success
          ? `Lead creado con ID ${result.lead_id} (${result.email}).`
          : `No se pudo crear el lead: ${result.error}`;
      } else if (lower.includes("eliminar lead") || lower.includes("delete lead")) {
        const idMatch = message.match(/lead_[a-zA-Z0-9-]+/);
        if (idMatch) {
          const result = await executeAdminTool("delete_lead", { lead_id: idMatch[0] }, c.env, user);
          toolsCalled.push({ name: "delete_lead", args: { lead_id: idMatch[0] }, result });
          reply = result.success ? `Lead ${idMatch[0]} eliminado.` : `No se pudo eliminar: ${result.error}`;
        } else {
          reply = "Indica el ID del lead a eliminar (ej. lead_xxx).";
        }
      } else if (lower.includes("listar leads") || lower.includes("list leads")) {
        const result = await executeAdminTool("list_leads", { limit: 20 }, c.env, user);
        toolsCalled.push({ name: "list_leads", args: { limit: 20 }, result });
        reply = result.success
          ? `Se encontraron ${result.count} leads.`
          : `No se pudieron listar: ${result.error}`;
      } else if (lower.includes("enriquecer") || lower.includes("doctoralia") || lower.includes("buscar telefono")) {
        const ctcMatch = message.match(/ct[c]?_[a-zA-Z0-9-]+/);
        if (ctcMatch) {
          const result = await executeAdminTool("enrich_contact", { contact_id: ctcMatch[0] }, c.env, user);
          toolsCalled.push({ name: "enrich_contact", args: { contact_id: ctcMatch[0] }, result });
          reply = result.found
            ? `Contacto enriquecido con éxito. Teléfono: ${result.phone || '-'}, WhatsApp: ${result.whatsapp || '-'}`
            : `Búsqueda completada pero no se hallaron números en perfil público. Enlaces: Google (${result.google_search_url})`;
        } else {
          reply = "Indica el ID del contacto a enriquecer (ej. ct_xxx).";
        }
      } else {
        reply =
          "Asistente AI (modo determinista): recibí tu consulta" +
          (tenant_id ? ` para el tenant ${tenant_id}` : "") +
          ". Workers AI no está disponible en este entorno de prueba.";
      }
    }
  } catch (err: any) {
    reply = "Error consultando al asistente AI: " + (err?.message || "desconocido");
  }

  if (!reply || !reply.trim()) reply = "Sin respuesta del asistente AI.";

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
