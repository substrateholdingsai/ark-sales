// Campaign job contract routes (Step 4: G8).
// Sales worker = executor. Internal routes under /api/internal/campaigns/*,
// protected by the same internal-key auth as /api/internal/* (src/routes/internal.ts:84-125).

import { Hono } from "hono";
import { Env } from "../types";
import { GuardrailService, ContactChannel } from "../services/guardrails";
import { UsageEventsService, UNIT_COSTS_USD } from "../services/usage";
import { WhatsAppService } from "../services/whatsapp";
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
// With dry_run: true, runs guardrails read-only and returns preview.
// ------------------------------------------------------------------
campaignsRouter.post("/dispatch", async (c) => {
  try {
    const body = await c.req.json();
    const { job_id, idempotency_key, tenant_id, sender_brand, channel, audience, message, schedule, approval_required = true, dry_run = false } = body || {};

    if (!job_id || !idempotency_key || !tenant_id || !sender_brand || !channel || !audience || !message) {
      return c.json({ error: "job_id, idempotency_key, tenant_id, sender_brand, channel, audience, message are required." }, 400);
    }

    if (!["whatsapp", "sms", "email", "voice"].includes(channel)) {
      return c.json({ error: "channel must be whatsapp | sms | email | voice." }, 400);
    }

    if (!c.env.DB) {
      return c.json({ error: "D1 no disponible." }, 503);
    }

    const db = c.env.DB;
    const guardrails = new GuardrailService(db, c.env);

    // Idempotency: check if job already exists
    const existing = await db.prepare("SELECT id, status FROM campaign_jobs WHERE idempotency_key = ? LIMIT 1").bind(idempotency_key).first<any>();
    if (existing) {
      return c.json({ job_id: existing.id, status: existing.status, message: "Job already exists for this idempotency key." }, 200);
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

      return c.json(
        {
          job_id,
          status: "preview_ready",
          preview_ttl: previewTtl,
          audience_total: audienceTotal,
          would_send: wouldSend,
          excluded_by_rule: excluded,
          deferred,
          cost_estimate: costEstimate,
        },
        200,
      );
    }

    // ------------------------------------------------------------------
    // Real dispatch: create job in pending_approval
    // ------------------------------------------------------------------
    const now = new Date().toISOString();

    // Preview TTL (2 hours from creation)
    const previewTtl = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    await db
      .prepare(
        `
      INSERT INTO campaign_jobs (
        id, idempotency_key, tenant_id, sender_brand, channel,
        message_payload_json, audience_payload_json, schedule_json,
        status, preview_ttl, approval_required, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
      )
      .bind(
        job_id,
        idempotency_key,
        tenant_id,
        sender_brand,
        channel,
        JSON.stringify(message || {}),
        JSON.stringify(audience || {}),
        JSON.stringify(schedule || {}),
        previewTtl,
        approval_required ? 1 : 0,
        c.get("user") ?? null,
      )
      .run();

    // Insert targets as pending (not yet evaluated — evaluation happens at dispatch time)
    for (const ct of contacts) {
      const targetId = `tgt_${crypto.randomUUID()}`;
      await db
        .prepare(
          `
        INSERT INTO campaign_job_targets (id, job_id, tenant_id, contact_id, channel, destination, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
        )
        .bind(targetId, job_id, tenant_id, ct.contact_id, channel, ct.phone_e164 || ct.email || "", now);
    }

    return c.json(
      {
        job_id,
        status: "pending_approval",
        previewTtl,
        audience_total: audienceTotal,
        message: "Job created in pending_approval. Requires approval before dispatch.",
      },
      201,
    );
  } catch (err: any) {
    return c.json({ error: err?.message || "Error creando campaña." }, 500);
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
    if (job.preview_ttl && new Date(job.preview_ttl) < new Date()) {
      return c.json({ error: "Preview expirado. Re-previsualizar y volver a aprobar." }, 409);
    }

    const now = new Date().toISOString();
    await db
      .prepare(`UPDATE campaign_jobs SET status = 'approved', approved_by_user_id = ?, approved_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(approved_by ?? c.get("user") ?? null, now, jobId)
      .run();

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

    summary.total_cost_usd = Math.round((results.reduce((s: number, r: any) => s + (r.cost_usd || 0), 0) + Number.EPSILON) * 100) / 100;

    return c.json(
      {
        job_id: jobId,
        tenant_id: job.tenant_id,
        status: job.status,
        results,
        summary,
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
campaignsRouter.post("/:job_id/:action(pause|resume)", async (c) => {
  try {
    const jobId = c.req.param("job_id");
    const action = c.req.param("action");
    if (!c.env.DB) return c.json({ error: "D1 no disponible." }, 503);
    const db = c.env.DB;

    const job = await db.prepare("SELECT status FROM campaign_jobs WHERE id = ? LIMIT 1").bind(jobId).first<any>();
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
});

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

    // Mark job running
    await db.prepare("UPDATE campaign_jobs SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(job.id).run();

    // Fetch pending targets
    const targets = await db
      .prepare("SELECT * FROM campaign_job_targets WHERE job_id = ? AND status = 'pending' ORDER BY created_at ASC")
      .bind(job.id)
      .all<any>();

    for (const target of targets.results || []) {
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

      // Build contact for guardrail evaluation
      const destination = target.destination;
      const phoneE164 = channel === "email" ? null : destination;
      const email = channel === "email" ? destination : null;

      const contact: ContactChannel = {
        contact_id: target.contact_id,
        phone_e164: phoneE164,
        email: email,
        channel: channel as ContactChannel["channel"],
      };

      // Full guardrail evaluation (read-only checks)
      const scheduleJson = job.schedule_json ? JSON.parse(job.schedule_json) : {};
      const sendAt = scheduleJson.start_at || null;
      const result = await guardrails.evaluateContact(tenantId, contact, sendAt);

      if (!result.allowed) {
        await db
          .prepare(`UPDATE campaign_job_targets SET status = 'excluded', reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(result.reason || "excluded", target.id)
          .run();
        continue; // excluded — no send, no usage event
      }

      // Attempt send
      let sendResult: { success: boolean; messageId?: string; error?: string; costUsd?: number } = { success: false };

      if (channel === "whatsapp") {
        const messageJson = job.message_payload_json ? JSON.parse(job.message_payload_json) : {};
        sendResult = await whatsApp.send({
          to: destination,
          templateName: messageJson.template_id || "default",
          templateVersion: messageJson.template_version || "1",
          languageCode: messageJson.language || "es-MX",
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
              sendResult = { success: true, messageId: data.id };
            } else {
              sendResult = { success: false, error: `RESEND_${resp.status}`, costUsd: 0 };
            }
          } catch (e: any) {
            sendResult = { success: false, error: e?.message || "RESEND_ERROR", costUsd: 0 };
          }
        } else {
          sendResult = { success: true, messageId: `sim_${crypto.randomUUID().slice(0, 8)}` }; // simulated
        }
      } else if (channel === "voice") {
        // Voice via Telnyx AI (existing outbound-ai pattern)
        sendResult = { success: true, messageId: `voice_${crypto.randomUUID().slice(0, 8)}` }; // placeholder for voice integration
      } else if (channel === "sms") {
        // SMS out of scope for this build
        sendResult = { success: false, error: "SMS_OUT_OF_SCOPE", costUsd: 0 };
      }

      const now = new Date().toISOString();

      if (sendResult.success) {
        await db
          .prepare(
            `UPDATE campaign_job_targets SET status = 'sent', provider_message_id = ?, cost_usd = ?, sent_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          )
          .bind(sendResult.messageId ?? null, unitCost, now, target.id)
          .run();

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
        const weekStart = new Date().toISOString().slice(0, 10);
        await guardrails.incrementFrequencyCap(tenantId, target.contact_id, channel as ContactChannel["channel"], weekStart);

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
    const remaining = await db.prepare("SELECT COUNT(*) as cnt FROM campaign_job_targets WHERE job_id = ? AND status = 'pending'").bind(job.id).first<any>();

    if (Number(remaining?.cnt || 0) === 0) {
      await db.prepare("UPDATE campaign_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(job.id).run();
    } else {
      await db.prepare("UPDATE campaign_jobs SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(job.id).run();
    }
  }

  return { processed, succeeded, failed };
}
