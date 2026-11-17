// Campaign job contract routes (Step 4: G8).
// Sales worker = executor. Internal routes under /api/internal/campaigns/*,
// protected by the same internal-key auth as /api/internal/* (src/routes/internal.ts:84-125).

import { Hono } from "hono";
import { Env } from "../types";
import { GuardrailService, ContactChannel } from "../services/guardrails";
import { UsageEventsService, UNIT_COSTS_USD } from "../services/usage";
import { WhatsAppService } from "../services/whatsapp";
import { HsmTemplateService, HsmTemplate } from "../services/hsmTemplates";
import { normalizarTelefonoE164 } from "../voice/telnyx";
import { interpolateTemplate } from "../routes/superadmin";

export type CampaignVariables = { user?: string | null; tenant?: string | null };

export const campaignsRouter = new Hono<{ Bindings: Env; Variables: CampaignVariables }>();

// ------------------------------------------------------------------
// Auth middleware: same as /api/internal/* — X-StayPuft-Key / X-Ark-Internal-Key / Bearer
// ------------------------------------------------------------------
campaignsRouter.use("*", async (c, next) => {
  const expectedStayPuft = c.env?.STAYPUFT_API_KEY;
  const expectedToken = c.env?.INTERNAL_API_TOKEN;
  const expectedService = c.env?.INTERNAL_SERVICE_KEY;

  const authHeader = c.req.header("Authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const provided = c.req.header("X-StayPuft-Key") || c.req.header("X-Ark-Internal-Key") || c.req.header("X-Internal-Token") || bearer;

  if (!provided) {
    return c.json({ error: "Unauthorized: invalid or missing internal key." }, 401);
  }

  let tenant: string | null = null;
  let user: string | null = null;

  if (expectedStayPuft && provided === expectedStayPuft) {
    user = "staypuft";
  } else if ((expectedService || expectedToken) && (provided === expectedService || provided === expectedToken)) {
    user = "internal_service";
  } else if ((c.env?.ENVIRONMENT || "development") === "production") {
    return c.json({ error: "Unauthorized: internal key not configured." }, 401);
  }

  c.set("user", user);
  c.set("tenant", tenant);
  await next();
});

// ------------------------------------------------------------------
// POST /api/internal/campaigns/dispatch
// Creates a job in pending_approval (CRM can never create approved).
// With dry_run: true, persists a pending job and returns its preview.
// ------------------------------------------------------------------
campaignsRouter.post("/dispatch", async (c) => {
  try {
    const body = await c.req.json();
    const { job_id, idempotency_key, tenant_id, sender_brand, channel, audience, message, schedule, approval_required = true, dry_run = false } = body || {};

    if (!job_id || !idempotency_key || !tenant_id || !sender_brand || !channel || !audience || !message) {
      return c.json({ error: "job_id, idempotency_key, tenant_id, sender_brand, channel, audience, message are required." }, 400);
    }

    if (channel === "sms") return c.json({ error: "SMS_OUT_OF_SCOPE" }, 400);
    if (channel === "voice") return c.json({ error: "VOICE_NOT_CONFIGURED" }, 400);
    if (!["whatsapp", "email"].includes(channel)) {
      return c.json({ error: "channel must be whatsapp | email." }, 400);
    }
    if (
      !["explicit", "filter"].includes(audience.mode) ||
      (audience.mode === "explicit" &&
        (!Array.isArray(audience.contact_ids) ||
          audience.contact_ids.length === 0 ||
          audience.contact_ids.some((id: unknown) => typeof id !== "string" || !id) ||
          new Set(audience.contact_ids).size !== audience.contact_ids.length)) ||
      approval_required !== true
    ) {
      return c.json({ error: "Se requiere una audiencia válida sin duplicados y aprobación." }, 400);
    }

    if (!c.env.DB) {
      return c.json({ error: "D1 no disponible." }, 503);
    }

    const db = c.env.DB;
    const guardrails = new GuardrailService(db, c.env);

    if (channel === "whatsapp") {
      try {
        const hsm = new HsmTemplateService(db);
        const template = await hsm.getById(message.template_id);
        if (!template || (template.tenant_id !== null && template.tenant_id !== tenant_id)) {
          return c.json({ error: "HSM_TEMPLATE_NOT_FOUND" }, 400);
        }
        const resolved = await hsm.resolveForSend({
          tenantId: tenant_id,
          templateName: template.template_name,
          templateVersion: template.template_version,
          languageCode: template.language_code,
          variables: message.variables || {},
        });
        if (resolved.id !== template.id) return c.json({ error: "HSM_TEMPLATE_ID_MISMATCH" }, 400);
      } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : "HSM_TEMPLATE_INVALID" }, 400);
      }
    }

    // Idempotency: check if job already exists
    const existing = await db.prepare("SELECT * FROM campaign_jobs WHERE idempotency_key = ? LIMIT 1").bind(idempotency_key).first<any>();
    if (existing) {
      if (
        existing.id !== job_id ||
        existing.tenant_id !== tenant_id ||
        existing.sender_brand !== sender_brand ||
        existing.channel !== channel ||
        existing.message_payload_json !== JSON.stringify(message) ||
        existing.audience_payload_json !== JSON.stringify(audience) ||
        existing.schedule_json !== JSON.stringify(schedule || {})
      ) {
        return c.json({ error: "La clave de idempotencia pertenece a otro borrador." }, 409);
      }
      if (existing.status !== "pending_approval" || !dry_run) {
        return c.json({ job_id: existing.id, status: existing.status, message: "Job already exists for this idempotency key." }, 200);
      }
    }

    // Resolve audience contacts from D1 (CRM system of record — contact never moves)
    let contacts: Array<{ contact_id: string; phone_e164?: string | null; email?: string | null; consent_status?: string | null; name?: string | null }> = [];

    if (audience.mode === "explicit" && Array.isArray(audience.contact_ids)) {
      for (const cid of audience.contact_ids) {
        const row = await db
          .prepare(
            `SELECT c.id, c.phone, c.whatsapp, c.email, c.consent_status, c.name, a.tenant_id
           FROM sales_contacts c
           JOIN sales_accounts a ON a.id = c.account_id
           WHERE c.id = ? AND a.tenant_id = ? LIMIT 1`,
          )
          .bind(cid, tenant_id)
          .first<any>();
        if (row) {
          const phoneNorm = row.phone ? normalizarTelefonoE164(row.phone) : null;
          const waNorm = row.whatsapp ? normalizarTelefonoE164(row.whatsapp) : null;
          const phoneE164 = channel === "whatsapp" ? (waNorm?.valid ? waNorm.e164 : null) : phoneNorm?.valid ? phoneNorm.e164 : null;
          contacts.push({
            contact_id: row.id,
            phone_e164: phoneE164,
            email: row.email,
            consent_status: row.consent_status,
            name: row.name,
          });
        }
      }
    } else if (audience.mode === "filter") {
      // Build filter query scoped to tenant
      let query = `
        SELECT c.id, c.phone, c.whatsapp, c.email, c.consent_status, c.name, a.tenant_id
        FROM sales_contacts c
        JOIN sales_accounts a ON a.id = c.account_id
        WHERE a.tenant_id = ?
      `;
      const params: any[] = [tenant_id];
      if (audience.filter?.account_ids && Array.isArray(audience.filter.account_ids)) {
        const placeholders = audience.filter.account_ids.map(() => "?").join(",");
        query += ` AND c.account_id IN (${placeholders})`;
        params.push(...audience.filter.account_ids);
      }
      if (audience.filter?.has_phone) {
        query += " AND (c.phone IS NOT NULL AND c.phone != '' OR c.whatsapp IS NOT NULL AND c.whatsapp != '')";
      }
      if (audience.filter?.has_email) {
        query += " AND c.email IS NOT NULL AND c.email != ''";
      }
      if (audience.filter?.consent_status) {
        query += " AND c.consent_status = ?";
        params.push(audience.filter.consent_status);
      }
      const limit = Math.min(Math.max(parseInt(String(audience.filter?.limit ?? 500), 10) || 1, 1), 500);
      query += ` LIMIT ?`;
      params.push(limit);

      const { results } = await db
        .prepare(query)
        .bind(...params)
        .all<any>();
      for (const row of results || []) {
        const phoneNorm = row.phone ? normalizarTelefonoE164(row.phone) : null;
        const waNorm = row.whatsapp ? normalizarTelefonoE164(row.whatsapp) : null;
        const phoneE164 = channel === "whatsapp" ? (waNorm?.valid ? waNorm.e164 : null) : phoneNorm?.valid ? phoneNorm.e164 : null;
        contacts.push({
          contact_id: row.id,
          phone_e164: phoneE164,
          email: row.email,
          consent_status: row.consent_status,
          name: row.name,
        });
      }
    }

    const audienceTotal = contacts.length;
    if (audience.mode === "explicit" && audienceTotal !== audience.contact_ids.length) {
      return c.json({ error: "La audiencia contiene contactos inexistentes o de otro tenant." }, 400);
    }

    const destinationFor = (ct: (typeof contacts)[number]) => (channel === "email" ? ct.email || "" : ct.phone_e164 || "");

    if (!existing) {
      const now = new Date().toISOString();
      const statements = [
        db
          .prepare(
            `INSERT INTO campaign_jobs (
            id, idempotency_key, tenant_id, sender_brand, channel,
            message_payload_json, audience_payload_json, schedule_json,
            status, preview_ttl, approval_required, created_by_user_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', NULL, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          )
          .bind(
            job_id,
            idempotency_key,
            tenant_id,
            sender_brand,
            channel,
            JSON.stringify(message),
            JSON.stringify(audience),
            JSON.stringify(schedule || {}),
            c.get("user") ?? null,
          ),
        ...contacts.map((ct) =>
          db
            .prepare(
              `INSERT INTO campaign_job_targets (id, job_id, tenant_id, contact_id, channel, destination, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            )
            .bind(`tgt_${crypto.randomUUID()}`, job_id, tenant_id, ct.contact_id, channel, destinationFor(ct), now, now),
        ),
      ];
      await db.batch(statements);
    } else {
      const saved = await db
        .prepare("SELECT contact_id, destination FROM campaign_job_targets WHERE job_id = ? ORDER BY created_at ASC")
        .bind(job_id)
        .all<any>();
      const targets = new Map((saved.results || []).map((target: any) => [target.contact_id, target.destination]));
      if (targets.size !== contacts.length || contacts.some((ct) => targets.get(ct.contact_id) !== destinationFor(ct))) {
        return c.json({ error: "La audiencia cambió. Crea un trabajo nuevo." }, 409);
      }
    }

    // ------------------------------------------------------------------
    // DRY RUN / PREVIEW: evaluate guardrails read-only, return counts
    // ------------------------------------------------------------------
    if (dry_run) {
      const sendAt = schedule?.start_at || null;
      const excluded: Array<{ contact_id: string; channel: string; reason: string }> = [];
      let wouldSend = 0;
      let deferred = 0;

      for (const ct of contacts) {
        const channelContact: ContactChannel = {
          contact_id: ct.contact_id,
          phone_e164: ct.phone_e164,
          email: ct.email,
          consent_status: ct.consent_status,
          channel: channel as ContactChannel["channel"],
        };

        // No valid channel for this channel type
        if (channel === "whatsapp" && !ct.phone_e164) {
          excluded.push({ contact_id: ct.contact_id, channel, reason: "no_valid_channel" });
          continue;
        }
        if (channel === "sms" && !ct.phone_e164) {
          excluded.push({ contact_id: ct.contact_id, channel, reason: "no_valid_channel" });
          continue;
        }
        if (channel === "email" && !ct.email) {
          excluded.push({ contact_id: ct.contact_id, channel, reason: "no_valid_channel" });
          continue;
        }
        if (channel === "voice" && !ct.phone_e164) {
          excluded.push({ contact_id: ct.contact_id, channel, reason: "no_valid_channel" });
          continue;
        }

        const result = await guardrails.evaluateContact(tenant_id, channelContact, sendAt);
        if (!result.allowed) {
          if (result.deferred) {
            deferred++;
          } else {
            excluded.push({ contact_id: ct.contact_id, channel, reason: result.reason || "excluded" });
          }
          continue;
        }
        wouldSend++;
      }

      const unitCost = UNIT_COSTS_USD[channel as keyof typeof UNIT_COSTS_USD] ?? 0;
      const costEstimate = { channel, unit_cost_usd: unitCost, total_usd: Math.round((wouldSend * unitCost + Number.EPSILON) * 100) / 100 };

      // Preview TTL: 2 hours from now
      const previewTtl = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      const preview = {
        job_id,
        status: "pending_approval",
        preview_ttl: previewTtl,
        audience_total: audienceTotal,
        would_send: wouldSend,
        excluded_by_rule: excluded,
        deferred,
        cost_estimate: costEstimate,
      };
      const update = await db
        .prepare("UPDATE campaign_jobs SET preview_ttl = ?, preview_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_approval'")
        .bind(previewTtl, JSON.stringify(preview), job_id)
        .run();
      if (!update.meta.changes) return c.json({ error: "El trabajo ya no está pendiente." }, 409);
      return c.json(preview, 200);
    }

    // ------------------------------------------------------------------
    // Real dispatch: create job in pending_approval
    // ------------------------------------------------------------------
    return c.json(
      {
        job_id,
        status: "pending_approval",
        audience_total: audienceTotal,
        message: "Job created in pending_approval. A preview is required before approval.",
      },
      201,
    );
  } catch (err: any) {
    return c.json({ error: err?.message || "Error creando campaña." }, 500);
  }
});

// ------------------------------------------------------------------
// HSM template approval flow (G6): submit / approve / reject / list
// Protected by the same internal-key auth as the rest of /api/internal/campaigns.
// ------------------------------------------------------------------
campaignsRouter.post("/templates", async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: "D1 no disponible." }, 503);
    const db = c.env.DB;
    const hsm = new HsmTemplateService(db);
    const body = await c.req.json().catch(() => ({}));
    const { tenant_id, template_name, template_version, language_code, category, components_json, variables_json, created_by_user_id } = body || {};

    if (!template_name || !components_json) {
      return c.json({ error: "template_name and components_json are required." }, 400);
    }

    const { id, template } = await hsm.submit({
      tenantId: tenant_id ?? null,
      templateName: template_name,
      templateVersion: template_version ?? undefined,
      languageCode: language_code ?? undefined,
      category: category ?? undefined,
      componentsJson: components_json,
      variablesJson: variables_json ?? undefined,
      createdByUserId: c.get("user") ?? created_by_user_id ?? null,
    });

    return c.json({ id, template, message: "Plantilla HSM creada en estado draft." }, 201);
  } catch (err: any) {
    return c.json({ error: err?.message || "Error creando plantilla HSM." }, 500);
  }
});

campaignsRouter.post("/templates/:template_id/approve", async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: "D1 no disponible." }, 503);
    const db = c.env.DB;
    const hsm = new HsmTemplateService(db);
    const templateId = c.req.param("template_id");
    const body = await c.req.json().catch(() => ({}));
    const { approved_by } = body || {};

    const template = await hsm.approve(templateId, approved_by ?? c.get("user") ?? null);
    if (!template) {
      return c.json({ error: "Plantilla no encontrada o no se puede aprobar (estado actual no admite aprobación)." }, 409);
    }
    return c.json({ template_id: template.id, status: template.status, message: "Plantilla HSM aprobada." }, 200);
  } catch (err: any) {
    return c.json({ error: err?.message || "Error aprobando plantilla HSM." }, 500);
  }
});

campaignsRouter.post("/templates/:template_id/reject", async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: "D1 no disponible." }, 503);
    const db = c.env.DB;
    const hsm = new HsmTemplateService(db);
    const templateId = c.req.param("template_id");
    const body = await c.req.json().catch(() => ({}));
    const { rejected_by } = body || {};

    const template = await hsm.reject(templateId, rejected_by ?? c.get("user") ?? null);
    if (!template) {
      return c.json({ error: "Plantilla no encontrada o no se puede rechazar (estado actual no admite rechazo)." }, 409);
    }
    return c.json({ template_id: template.id, status: template.status, message: "Plantilla HSM rechazada." }, 200);
  } catch (err: any) {
    return c.json({ error: err?.message || "Error rechazando plantilla HSM." }, 500);
  }
});

campaignsRouter.get("/templates", async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: "D1 no disponible." }, 503);
    const db = c.env.DB;
    const hsm = new HsmTemplateService(db);
    const tenant_id = c.req.query("tenant_id") ?? undefined;
    const status = c.req.query("status") ?? undefined;
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : undefined;

    const templates = await hsm.list({ tenantId: tenant_id, status: status as any, limit });
    return c.json({ templates, count: templates.length }, 200);
  } catch (err: any) {
    return c.json({ error: err?.message || "Error listando plantillas HSM." }, 500);
  }
});

// ------------------------------------------------------------------
// POST /api/internal/campaigns/{job_id}/approve
// Pavel approves after preview. Fail-closed: only approved jobs dispatch.
// ------------------------------------------------------------------
campaignsRouter.post("/:job_id/approve", async (c) => {
  try {
    const jobId = c.req.param("job_id");
    const body = await c.req.json().catch(() => ({}));
    const { approved_by } = body || {};

    if (!c.env.DB) return c.json({ error: "D1 no disponible." }, 503);
    const db = c.env.DB;

    const job = await db.prepare("SELECT * FROM campaign_jobs WHERE id = ? LIMIT 1").bind(jobId).first<any>();
    if (!job) return c.json({ error: "Job no encontrado." }, 404);

    if (job.status !== "pending_approval") {
      return c.json({ error: `Solo se pueden aprobar jobs en pending_approval (actual: ${job.status}).` }, 409);
    }

    // Preview TTL check
    const expiresAt = typeof job.preview_ttl === "string" ? Date.parse(job.preview_ttl) : NaN;
    if (!job.preview_json || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return c.json({ error: "Preview expirado. Re-previsualizar y volver a aprobar." }, 409);
    }

    const now = new Date().toISOString();
    const updated = await db
      .prepare(
        `UPDATE campaign_jobs SET status = 'approved', approved_by_user_id = ?, approved_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_approval' AND preview_ttl = ? AND preview_ttl > ?`,
      )
      .bind(approved_by ?? c.get("user") ?? null, now, jobId, job.preview_ttl, now)
      .run();
    if (!updated.meta.changes) return c.json({ error: "La vista previa cambió o el trabajo ya no está pendiente." }, 409);

    return c.json(
      {
        job_id: jobId,
        status: "approved",
        approved_by: approved_by ?? c.get("user") ?? null,
        approved_at: now,
        message: "Job aprobado. Listo para despacho.",
      },
      200,
    );
  } catch (err: any) {
    return c.json({ error: err?.message || "Error aprobando campaña." }, 500);
  }
});

// ------------------------------------------------------------------
// POST /api/internal/campaigns/{job_id}/receipt
// Per-contact outcomes for CRM reconciliation.
// ------------------------------------------------------------------
campaignsRouter.post("/:job_id/receipt", async (c) => {
  try {
    const jobId = c.req.param("job_id");
    const { confirm_received } = await c.req.json().catch(() => ({}));

    if (!c.env.DB) return c.json({ error: "D1 no disponible." }, 503);
    const db = c.env.DB;

    const job = await db.prepare("SELECT * FROM campaign_jobs WHERE id = ? LIMIT 1").bind(jobId).first<any>();
    if (!job) return c.json({ error: "Job no encontrado." }, 404);

    const targets = await db.prepare("SELECT * FROM campaign_job_targets WHERE job_id = ? ORDER BY created_at ASC").bind(jobId).all<any>();

    const results = (targets.results || []).map((t: any) => ({
      contact_id: t.contact_id,
      channel: t.channel,
      outcome: t.status,
      reason: t.reason ?? null,
      provider_message_id: t.provider_message_id ?? null,
      cost_usd: t.cost_usd ?? 0,
      sent_at: t.sent_at ?? null,
    }));

    const summary = results.reduce(
      (acc: any, r: any) => {
        if (r.outcome === "sent" || r.outcome === "delivered") acc.sent++;
        else if (r.outcome === "excluded") acc.excluded++;
        else if (r.outcome === "failed") acc.failed++;
        return acc;
      },
      { sent: 0, excluded: 0, failed: 0, total_cost_usd: 0 },
    );

    const usage = await new UsageEventsService(db).totalForJob(jobId);
    summary.total_cost_usd = Math.round((usage.totalCostUsd + Number.EPSILON) * 100) / 100;

    return c.json(
      {
        job_id: jobId,
        tenant_id: job.tenant_id,
        status: job.status,
        results,
        summary,
        usage: { billable_events: usage.eventCount, total_cost_usd: summary.total_cost_usd },
        message: confirm_received ? "Recibo confirmado por el CRM." : "Recibo disponible para reconciliación del CRM.",
      },
      200,
    );
  } catch (err: any) {
    return c.json({ error: err?.message || "Error obteniendo recibo." }, 500);
  }
});

// ------------------------------------------------------------------
// GET /api/internal/campaigns/{job_id} — inspect job status
// ------------------------------------------------------------------
campaignsRouter.get("/:job_id", async (c) => {
  try {
    const jobId = c.req.param("job_id");
    if (!c.env.DB) return c.json({ error: "D1 no disponible." }, 503);
    const db = c.env.DB;

    const job = await db.prepare("SELECT * FROM campaign_jobs WHERE id = ? LIMIT 1").bind(jobId).first<any>();
    if (!job) return c.json({ error: "Job no encontrado." }, 404);

    const targetStats = await db.prepare(`SELECT status, COUNT(*) as cnt FROM campaign_job_targets WHERE job_id = ? GROUP BY status`).bind(jobId).all<any>();

    return c.json(
      {
        job_id: job.id,
        idempotency_key: job.idempotency_key,
        tenant_id: job.tenant_id,
        sender_brand: job.sender_brand,
        channel: job.channel,
        status: job.status,
        preview_ttl: job.preview_ttl,
        approval_required: Boolean(job.approval_required),
        approved_by_user_id: job.approved_by_user_id,
        approved_at: job.approved_at,
        created_at: job.created_at,
        updated_at: job.updated_at,
        targets: targetStats.results || [],
      },
      200,
    );
  } catch (err: any) {
    return c.json({ error: err?.message || "Error consultando campaña." }, 500);
  }
});

// ------------------------------------------------------------------
// POST /api/internal/campaigns/{job_id}/pause
// POST /api/internal/campaigns/{job_id}/resume
// ------------------------------------------------------------------
campaignsRouter.post("/:job_id/pause", async (c) => {
  return pauseOrResume(c, "pause");
});
campaignsRouter.post("/:job_id/resume", async (c) => {
  return pauseOrResume(c, "resume");
});

async function pauseOrResume(c: any, action: "pause" | "resume") {
  try {
    const jobId = c.req.param("job_id");
    if (!c.env.DB) return c.json({ error: "D1 no disponible." }, 503);
    const db = c.env.DB;

    const job = await db.prepare("SELECT status FROM campaign_jobs WHERE id = ? LIMIT 1").bind(jobId).first();
    if (!job) return c.json({ error: "Job no encontrado." }, 404);

    let newStatus: string;
    if (action === "pause") {
      if (job.status !== "running" && job.status !== "approved") return c.json({ error: "Solo se puede pausar un job running o approved." }, 409);
      newStatus = "paused";
    } else {
      if (job.status !== "paused") return c.json({ error: "Solo se puede reanudar un job paused." }, 409);
      newStatus = "running";
    }

    await db.prepare(`UPDATE campaign_jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(newStatus, jobId).run();

    return c.json({ job_id: jobId, status: newStatus, message: `Job ${action === "pause" ? "pausado" : "reanudado"}.` }, 200);
  } catch (err: any) {
    return c.json({ error: err?.message || "Error cambiando estado de campaña." }, 500);
  }
}

// ------------------------------------------------------------------
// Dispatch processor: picks up approved jobs, evaluates guardrails,
// sends via provider, writes outcomes + usage_events.
// Called by the queue consumer or cron. Fail-closed at every step.
// ------------------------------------------------------------------
export async function processDispatch(env: Env, jobId?: string): Promise<{ processed: number; succeeded: number; failed: number }> {
  if (!env.DB) return { processed: 0, succeeded: 0, failed: 0 };
  const db = env.DB;
  const guardrails = new GuardrailService(db, env);
  const usageEvents = new UsageEventsService(db);
  const whatsApp = new WhatsAppService(env);
  const hsm = new HsmTemplateService(db);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Fetch approved (or running) jobs
  let jobs: any[] = [];
  if (jobId) {
    const j = await db.prepare("SELECT * FROM campaign_jobs WHERE id = ? AND status IN ('approved', 'running') LIMIT 1").bind(jobId).first<any>();
    if (j) jobs = [j];
  } else {
    const { results } = await db.prepare("SELECT * FROM campaign_jobs WHERE status IN ('approved', 'running') ORDER BY created_at ASC LIMIT 10").all<any>();
    jobs = results || [];
  }

  for (const job of jobs) {
    const tenantId = job.tenant_id;
    const channel = job.channel;
    const unitCost = UNIT_COSTS_USD[channel as keyof typeof UNIT_COSTS_USD] ?? 0;

    const scheduleJson = job.schedule_json ? JSON.parse(job.schedule_json) : {};
    if (scheduleJson.start_at) {
      const startAt = Date.parse(scheduleJson.start_at);
      if (!Number.isFinite(startAt)) throw new Error("INVALID_CAMPAIGN_SCHEDULE");
      if (startAt > Date.now()) continue;
    }

    const running = await db
      .prepare("UPDATE campaign_jobs SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('approved', 'running')")
      .bind(job.id)
      .run();
    if (!running.meta.changes) continue;

    // Fetch pending + deferred targets (deferred = quiet-hours retry candidates)
    const targets = await db
      .prepare("SELECT * FROM campaign_job_targets WHERE job_id = ? AND status IN ('pending', 'deferred') ORDER BY created_at ASC")
      .bind(job.id)
      .all<any>();

    for (const target of targets.results || []) {
      const claim = await db
        .prepare(
          `UPDATE campaign_job_targets SET status = 'processing', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status IN ('pending', 'deferred')
           AND EXISTS (SELECT 1 FROM campaign_jobs WHERE id = ? AND status = 'running')`,
        )
        .bind(target.id, job.id)
        .run();
      if (!claim.meta.changes) continue;
      processed++;

      // G9: tenant re-verification at send time
      const tenantOk = await guardrails.verifyTenant(tenantId, target.contact_id);
      if (!tenantOk) {
        await db
          .prepare(`UPDATE campaign_job_targets SET status = 'excluded', reason = 'tenant_mismatch', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(target.id)
          .run();
        failed++;
        continue;
      }

      const current = await db
        .prepare(
          `SELECT c.phone, c.whatsapp, c.email FROM sales_contacts c
           JOIN sales_accounts a ON a.id = c.account_id WHERE c.id = ? AND a.tenant_id = ? LIMIT 1`,
        )
        .bind(target.contact_id, tenantId)
        .first<{ phone: string | null; whatsapp: string | null; email: string | null }>();
      const destination = target.destination;
      const rawPhone = channel === "whatsapp" ? current?.whatsapp : current?.phone;
      const normalized = rawPhone ? normalizarTelefonoE164(rawPhone) : null;
      const phoneE164 = normalized?.valid ? normalized.e164 : null;
      const email = current?.email ?? null;
      const currentDestination = channel === "email" ? email : phoneE164;
      if (!currentDestination || currentDestination !== destination) {
        await db
          .prepare(`UPDATE campaign_job_targets SET status = 'excluded', reason = 'destination_changed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(target.id)
          .run();
        continue;
      }

      const contact: ContactChannel = {
        contact_id: target.contact_id,
        phone_e164: phoneE164,
        email: email,
        channel: channel as ContactChannel["channel"],
      };

      // Full guardrail evaluation (read-only checks)
      const result = await guardrails.evaluateContact(tenantId, contact);

      if (!result.allowed) {
        // G3 quiet-hours defers (retry in next window) instead of excluding.
        const status = result.deferred ? "deferred" : "excluded";
        await db
          .prepare(`UPDATE campaign_job_targets SET status = ?, reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(status, result.reason || "excluded", target.id)
          .run();
        continue; // excluded/deferred — no send, no usage event
      }

      // Attempt send
      let sendResult: { success: boolean; messageId?: string; error?: string; costUsd?: number; simulated?: boolean } = { success: false };

      if (channel === "whatsapp") {
        const messageJson = job.message_payload_json ? JSON.parse(job.message_payload_json) : {};
        const templateId = messageJson.template_id;
        if (!templateId) {
          // Fail-closed: no template specified → never send.
          await db
            .prepare(`UPDATE campaign_job_targets SET status = 'failed', reason = 'hsm_template_required', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .bind(target.id)
            .run();
          failed++;
          continue;
        }
        let resolvedTemplate: HsmTemplate | null = null;
        try {
          const template = await hsm.getById(templateId);
          if (!template || (template.tenant_id !== null && template.tenant_id !== tenantId)) {
            throw new Error("HSM_TEMPLATE_NOT_FOUND");
          }
          resolvedTemplate = await hsm.resolveForSend({
            tenantId: job.tenant_id,
            templateName: template.template_name,
            templateVersion: template.template_version,
            languageCode: template.language_code,
            variables: messageJson.variables || {},
          });
          if (resolvedTemplate.id !== template.id) throw new Error("HSM_TEMPLATE_ID_MISMATCH");
        } catch (err: any) {
          // Fail-closed: template not found / not approved / variables missing → never reach Telnyx.
          await db
            .prepare(`UPDATE campaign_job_targets SET status = 'failed', reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .bind(err?.message || "hsm_template_resolution_failed", target.id)
            .run();
          failed++;
          continue;
        }
        sendResult = await whatsApp.send({
          to: destination,
          templateName: resolvedTemplate.template_name,
          templateVersion: resolvedTemplate.template_version,
          languageCode: resolvedTemplate.language_code,
          variables: messageJson.variables || {},
          senderBrand: job.sender_brand,
        });
      } else if (channel === "email") {
        // Email via Resend (existing pattern from internalEmail.ts / superadmin.ts)
        const messageJson = job.message_payload_json ? JSON.parse(job.message_payload_json) : {};
        const fromEmail = env.RESEND_FROM_EMAIL || "ventas@mail.arksystems.site";
        const vars = { ...(messageJson.variables || {}), despacho_nombre: job.sender_brand };
        const subject = interpolateTemplate(messageJson.subject || "Comunicación ARK", vars);
        const html = interpolateTemplate(messageJson.body || "", vars);

        // Pre-send gate (existing gate.ts)
        const { PreSendGate } = await import("../services/gate");
        const gate = PreSendGate.check(subject, html);
        if (!gate.ok) {
          await db
            .prepare(`UPDATE campaign_job_targets SET status = 'excluded', reason = 'pre_send_gate', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .bind(target.id)
            .run();
          continue;
        }

        if (env.RESEND_API_KEY) {
          try {
            const resp = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: fromEmail.includes("<") ? fromEmail : `ARK Systems <${fromEmail}>`,
                to: [destination],
                subject: gate.sanitizedSubject || subject,
                html: gate.sanitizedBody || html,
              }),
            });
            if (resp.ok) {
              const data: any = await resp.json();
              sendResult =
                typeof data.id === "string" && data.id ? { success: true, messageId: data.id } : { success: false, error: "RESEND_INVALID_RESPONSE" };
            } else {
              sendResult = { success: false, error: `RESEND_${resp.status}`, costUsd: 0 };
            }
          } catch (e: any) {
            sendResult = { success: false, error: e?.message || "RESEND_ERROR", costUsd: 0 };
          }
        } else {
          sendResult = { success: false, error: "RESEND_API_KEY_NOT_CONFIGURED", costUsd: 0 };
        }
      } else if (channel === "voice") {
        sendResult = { success: false, error: "VOICE_NOT_CONFIGURED", costUsd: 0 };
      } else if (channel === "sms") {
        // SMS out of scope for this build
        sendResult = { success: false, error: "SMS_OUT_OF_SCOPE", costUsd: 0 };
      }

      const now = new Date().toISOString();

      if (sendResult.success && !sendResult.simulated && sendResult.messageId) {
        // Write usage event (billable)
        await usageEvents.write({
          jobId: job.id,
          tenantId,
          contactId: target.contact_id,
          channel: channel as "whatsapp" | "sms" | "email" | "voice",
          units: 1,
          status: "billable",
        });

        // Increment frequency cap
        await guardrails.incrementFrequencyCap(tenantId, target.contact_id, channel as ContactChannel["channel"]);

        await db
          .prepare(
            `UPDATE campaign_job_targets SET status = 'sent', provider_message_id = ?, cost_usd = ?, sent_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          )
          .bind(sendResult.messageId, unitCost, now, target.id)
          .run();

        succeeded++;
      } else {
        // Failed send — write zero-cost audit usage event
        await usageEvents.write({
          jobId: job.id,
          tenantId,
          contactId: target.contact_id,
          channel: channel as "whatsapp" | "sms" | "email" | "voice",
          units: 0,
          status: "audit_zero",
        });

        await db
          .prepare(`UPDATE campaign_job_targets SET status = 'failed', reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(sendResult.error || "send_failed", target.id)
          .run();
        failed++;
      }
    }

    // Check if all targets are done
    const remaining = await db
      .prepare("SELECT COUNT(*) as cnt FROM campaign_job_targets WHERE job_id = ? AND status IN ('pending', 'deferred', 'processing')")
      .bind(job.id)
      .first<any>();

    if (Number(remaining?.cnt || 0) === 0) {
      await db.prepare("UPDATE campaign_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'").bind(job.id).run();
    }
  }

  return { processed, succeeded, failed };
}
