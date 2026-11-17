# Ark Sales — Comms Review (Read-Only)
**Repo:** ark-sales (working copy, C:\Users\PAV\Desktop\e-commerce\ark-sales)  
**Date:** 2026-11-16 evening · **Deploy:** NO · **Changes:** none (read-only + written proposal)  
**Reference checklist:** docs/map.md (CAMPAIGN_DISPATCH_V1 shape, Arkangel guardrails)  
**Decision in force:** Arkangel = full collections only; Sales worker = comms home for CANACO (bulk/scheduled/sequenced/AI-voice sends); 1:1 manual messages stay wa.me links in Ledger CRM; CRM = system of record, contact never moves.

---

## 1. Sending capability today

| Channel | What the worker can actually send | Functions / endpoints | Lines |
|---|---|---|---|
| WhatsApp | **Nothing in the worker.** WhatsApp is wa.me links only; the user clicks and sends outside the worker (unchanged, per decision). | `https://wa.me/<phone>?text=...` built client-side; MCP exposes `whatsapp_link` | src/client/crmPage.ts:3693, :1259, :1381; src/routes/mcp.ts:282 |
| Telnyx Voice AI call | Outbound AI conversation | `fetch("https://api.telnyx.com/v2/ai/conversations")` behind `POST /api/crm/voice/outbound-ai` | src/routes/telnyxVoiceAi.ts:418, :480 |
| Telnyx Call Control | Courtesy call (speak + hangup) | `dispararLlamadaCortesía()` → `fetch("https://api.telnyx.com/v2/calls")`; exposed via `POST /webhooks/telnyx/call` and `POST /api/superadmin/voice/call` | src/voice/telnyx.ts:86, :175; src/routes/telnyxWebhook.ts:53; src/routes/superadmin.ts:681 |
| Voice batch (campaign) | Batch Telnyx AI calls to campaign targets | `POST /api/superadmin/voice/campaigns/:id/dispatch`; cohort launcher `POST /api/superadmin/cohorts/:id/launch-voice` | src/routes/superadmin.ts:871, :1629 |
| Email | Resend transactional email | `fetch("https://api.resend.com/emails")` in 5 places; also LLM tool `enviar_propuesta` | src/routes/internalEmail.ts:197, :507; src/routes/superadmin.ts:520, :1534, :2151; src/tools/index.ts:498 |
| SMS | **Not found.** No SMS provider or route in src/. | — | not found |
| Sender brand (email) | `RESEND_FROM_EMAIL` = "ARK Systems <ventas@mail.arksystems.site>" | wrangler.toml var; fallback in send code | wrangler.toml:49; internalEmail.ts:192, 510 |

WhatsApp send functions, Meta HSM handling, and SMS: **not found** anywhere in src/.

## 2. Guardrails today

| Guardrail (Arkangel checklist) | Exists | Where | Completeness |
|---|---|---|---|
| Consent / opt-in storage per contact + brand | Schema + UI only | `sales_contacts.consent_status`, `contact_preferences_json` | migrations/0004_crm_data_model.sql:26-27; written by src/routes/crmContacts.ts:170-175, :213-227 and src/routes/webhooks.ts:293; edited in CRM UI src/client/crmPage.ts:4536, :4702 | **Storage exists but is never enforced on any send path** — no send checks consent_status or per-brand consent |
| Suppression / opt-out list | Yes (email only) | `crm_dnc_list` (email UNIQUE, phone nullable, tenant_id NULL=global); `DncService` | migrations/0013_harvey_sales_engine.sql:5-15; src/services/dnc.ts:5-46 (`isBlocked(email, tenantId)`, `add()`) | Checked on email sends: tools/index.ts:450 (`enviarPropuesta`), superadmin.ts:480 (`templates/:id/send`), superadmin.ts:1504 (cohorts launch-email). Phone-based suppression not enforced; no brand scoping beyond tenant_id OR NULL |
| Inbound opt-out handling ("BAJA"/"STOP" → auto-DNC) | Detector only, not wired to inbound | `IntentHandler.classifyDeterministic` matches opt-out incl. "baja" | src/services/intentHandler.ts:17-18, :47-57; exposed at `POST /api/superadmin/intent/classify` superadmin.ts:1289-1305 | **No inbound WhatsApp/SMS webhook exists** (webhooks.ts is lead ingest only), so no inbound opt-out processing and no auto-DNC insertion from inbound messages |
| REPEP PROFECO check (35-day validity) | **Not found** | — | not found in src/ or migrations/ |
| Quiet hours 21:00–08:00 | **Not found** | — | not found (src/agents/prompts.ts:69 mentions Ark Angel's "Motor Legal Fail-Closed" / fuera de horario, but that is Ark Angel, not ark-sales code) |
| Frequency / weekly caps per contact | Partial, not per-contact | StayPuft email limits 20/hr + 100/day; in-memory tool quotas 3 emails / 2 calls per lead per session | src/routes/internalEmail.ts:387-447; src/tools/index.ts:13-22, :460-466, :713-719 | **No durable per-contact weekly cap**; quotas are in-memory (lost on worker restart) and operator-level, not contact-level |
| Template handling (Meta HSM) | **Not found for WhatsApp** | Email HTML templates only: `email_templates` table + `interpolateTemplate({{var}})`; 4 seeded templates | migrations/0008_superadmin_templates_campaigns.sql:5-17, :88-316; src/routes/superadmin.ts:20-24 | No WhatsApp/Meta HSM template registry, approval flow, or channel-specific templates |
| Sender-brand identification | Partial (email only) | `RESEND_FROM_EMAIL` | wrangler.toml:49 | No brand/header identification for WhatsApp, SMS, or voice sends |

Additional relevant send guards: DNC checked before email (above); Pre-Send deterministic gate for email quality (`PreSendGate.check`) src/services/gate.ts:90-165, used at internalEmail.ts:453 and superadmin.ts:496, 1518; internal rate limit 120 req/min src/routes/internal.ts:73-115; single-lead rate limit 60/hr internal.ts:331-341.

## 3. Job / campaign intake today

**No bulk-send, campaign, or scheduled-send endpoint exists under a CRM→Sales job contract.** The only campaign-shaped endpoints are internal ops tools: voice campaigns (src/routes/superadmin.ts:702 create, :871 dispatch, targets at :775), email batch via cohorts (`/cohorts/:id/launch-email` :1463, `/cohorts/:id/launch-voice` :1629), and the CANACO daily batch (`/canaco/dispatch-batch` :2084). None has preview + approval + receipt semantics, none is the executor contract the CRM needs.

**Single-lead endpoint:** `POST /api/internal/leads` exists at src/routes/internal.ts:368-554. It accepts exactly one lead object (rejects arrays at :384-386), requires tenant_id + cohort + source + source_url and ≥1 contact channel (:412-453), enforces allowlist tenants `{acc_ark_ledger, acc_futura_capital}` (:443) + `sales_accounts` existence (:459-462) + cohort existence (:465-468), dedups on phone/email/IG/FB/website (:471-503), rate-limits 60 creates/hr (:331-341), writes an immutable `crm_audit_log` entry (:546-551), and deliberately has no side effects: no email, no WhatsApp, no voice, no task (:45-46 of CONNECTOR.md corroborates). Auth: `X-StayPuft-Key` / `X-Ark-Internal-Key`. Not deployed to production: no remote D1 applied (database_id in wrangler.toml:12 is a placeholder; map.md:549-573 still lists remote D1/queues/secrets/deploy as pending).

`POST /api/internal/leads/ingest` exists (federated lead ingest, CANACO SIEM/webhook) src/routes/internal.ts:135-324 — not a comms job endpoint.

**Auth on internal routes:** one shared middleware src/routes/internal.ts:84-125 accepts `X-StayPuft-Key` / `X-Ark-Internal-Key` / `X-Internal-Token` / `Authorization: Bearer`; 120 req/min rate limit (:113-115); in production it 401s if no key is configured (:107-109). `STAYPUFT_API_KEY` grants operator=staypuft full internal access (:99-100).

**Tenant scoping on sends:** enforced only in `POST /api/internal/leads` (allowlist + account row existence, internal.ts:456-462). Superadmin routes are gated by `requireAuth()` + `requireRole("admin")` superadmin.ts:16-17. Campaign dispatch loops (voice :911-984; cohort launch-voice :1721-1778) store `tenant_id` on targets but do **not** re-verify tenant ownership at send time. Email dispatch history filters by `account_id OR recipient_email` with no tenant boundary internalEmail.ts:644-650. `voice_campaigns`/`voice_campaign_targets`/`email_templates`/`email_dispatches`/`crm_dnc_list` all carry `tenant_id` with indexes migrations/0008:19-21, :40-42, :61-62, :81-83; migrations/0013:14-15 — but no universal tenant-scoped send enforcement point exists.

## 4. Usage / billing logging today

| Artifact | Exists | Where | What it captures |
|---|---|---|---|
| `email_dispatches` dispatch log | Yes | migrations/0008_superadmin_templates_campaigns.sql:24-38 | id, tenant_id, account_id, contact_id, template_slug, recipient, subject, status (sent/failed/simulated), resend_id, error_message, created_at — **no unit cost, no credit ledger** |
| `sales_voice_sessions.cost_usd` | Yes | migrations/0007_telnyx_voice_ai.sql:5 | per-session Telnyx voice cost |
| `usage_events` table / credit-bag ledger | **Not found** | — | grep for usage_events / credit_ledger / credit_bag across src/ and migrations/: nothing |

Verdict: there is **nothing equivalent to Arkangel's usage_events**. Per-message/minute unit-cost logging and a per-tenant credit ledger for deducting bundle credits do not exist.

## 5. Multi-tenant isolation on sends

Enforcement points that exist:
1. `ALLOWED_TENANTS = {acc_ark_ledger, acc_futura_capital}` + `sales_accounts` existence check in `POST /api/internal/leads` src/routes/internal.ts:443-462 (intake only, not sends).
2. `tenant_id` columns + indexes on email_templates, email_dispatches, voice_campaigns, voice_campaign_targets, crm_dnc_list (migrations cited in §2).
3. Superadmin routes require admin role src/routes/superadmin.ts:16-17.
4. DNC `isBlocked(email, tenantId)` scopes by `tenant_id = ? OR tenant_id IS NULL` src/services/dnc.ts:15-21.

Gaps: dispatch loops do not re-verify that a target belongs to the job's tenant (superadmin.ts:911-984, :1721-1778); email dispatch reads allow matching by account_id OR recipient_email without tenant boundary internalEmail.ts:644-650; no send path checks `consent_status` or brand ownership. A job contract must add tenant-scoped send enforcement before the first real send.

## 6. Test setup

- Command: `npm test` → `vitest run` package.json:13. Lint: `npm run lint` (eslint, --max-warnings 0) :11. Typecheck: `npm run typecheck` (`tsc --noEmit`) :15. Build: `npm run build` = `wrangler deploy --dry-run` :10.
- Local run result (this machine, no production data touched): **32 test files, 31 passed / 1 failed; 267 tests, 264 passed / 3 failed.** The failure is pre-existing in `tests/fintech_webhook_ingest.test.ts:47,97,152` (expects HTTP 201, receives 202 — an environment/status discrepancy; I changed no code).
- Comms-related existing tests: tests/telnyx_voice.test.ts (13 tests), tests/telnyx_voice_ai.test.ts, tests/superadmin.test.ts (12/12), tests/canaco_mailing_campaign.test.ts, tests/conekta.test.ts.
- No tests exist for a bulk-send/campaign job contract, preview/approval flow, usage_events, or credit ledger.
- Note: docs/map.md:542 claims "172 pruebas / 27 suites" (verified 2026-11-05); that figure is stale versus the current local suite (267 tests / 32 files).

---

## Gap list vs Arkangel guardrail checklist (build order dependencies)

| # | Missing guardrail | Must exist before first real send? |
|---|---|---|
| G1 | Consent enforcement on send (check `sales_contacts.consent_status` per contact + brand) | **Yes** (fail-closed) |
| G2 | REPEP PROFECO check (35-day validity per contact/campaign) | **Yes** |
| G3 | Quiet hours 21:00–08:00 (CDMX) on all sends | **Yes** |
| G4 | Per-contact frequency / weekly caps (durable, not in-memory) | **Yes** |
| G5 | Inbound opt-out handling ("BAJA"/"STOP" → auto-DNC, no re-send) — requires inbound WA/SMS webhook or CRM webhook | **Yes** |
| G6 | WhatsApp / Meta HSM template handling (WhatsApp is currently wa.me-only, §1) | **Yes** for WhatsApp channel |
| G7 | `usage_events` table + per-tenant credit ledger (messages × unit cost) | **Yes** for billing |
| G8 | Bulk/scheduled campaign job endpoint with preview (dry-run) + approval + receipt | **Yes** (the core contract) |
| G9 | Tenant-scoped send enforcement at dispatch time | **Yes** |
| G10 | Provider failure handling (Telnyx 429 → backoff/retry; invalid number → failed, no retry) | Before scaling |

Build order (prerequisites first):
1. **Guardrail layer:** G1–G5 (consent, REPEP, quiet hours, frequency caps, inbound opt-out→DNC), tenant-scoped (G9). No send may pass this layer.
2. **Billing layer:** G7 (`usage_events` + credit deduct hook), per-channel unit costs (WhatsApp $0.20, voice $0.25/min, SMS $0.15, email $0.06 per docs/CANACO_ARK_LEDGER_STRATEGY.md:43-48).
3. **Channel templates:** G6 (Meta HSM WhatsApp templates) if WhatsApp bulk is in scope.
4. **Job contract:** G8 — dispatch endpoint, preview/dry-run, approval, receipt (see proposal below).
5. **Provider resilience:** G10 (Telnyx 429 handling, invalid numbers), pacing (respect Resend free tier 100/day per docs/CANACO_ARK_LEDGER_STRATEGY.md:119-122), pause/resume.
6. **First real send** — only after 1–5 are in place and Pavel has approved via the contract approval step.

---

## Proposal — job contract (CAMPAIGN_DISPATCH_V1 adapted; Sales worker = executor)

Design only. No code. Endpoints are internal (`/api/internal/*`), protected by the existing internal-key auth (src/routes/internal.ts:84-125) — same key surface as `POST /api/internal/leads` (CONNECTOR.md:14-15). Tenant id comes from the authenticated operator context and from the payload; the worker rejects any job whose contacts do not belong to `tenant_id` (fail-closed).

### A. Job payload the CRM sends

`POST /api/internal/campaigns/dispatch` — idempotent via `idempotency_key`; creates job in status `pending_approval` (never `approved` by the CRM itself).

```json
{
  "job_id": "uuid",
  "idempotency_key": "uuid",
  "tenant_id": "acc_ark_ledger",
  "sender_brand": "ARK Systems · CANACO",
  "channel": "whatsapp" | "sms" | "email" | "voice",
  "audience": {
    "mode": "explicit" | "filter",
    "contact_ids": ["ct_...", ...],        // sales_contacts.id (CRM system of record; contact never moves)
    "filter": { "account_ids": [...], "cohort_id": "...", "has_phone": true, "has_email": true, "consent_status": "opt_in" }
  },
  "message": {
    "template_id": "tmpl_... | hsm_whatsapp_...",   // email template slug or Meta HSM template name
    "template_version": "1",
    "variables": { "despacho_nombre": "...", ... },  // global defaults; per-contact override optional
    "body": "fallback free text",
    "language": "es-MX"
  },
  "schedule": { "start_at": "2026-11-17T09:00:00-06:00", "expire_at": "..." },
  "approval_required": true
}
```

Audience semantics: contacts are referenced by **CRM contact IDs** (`sales_contacts.id`), not copied into the worker. The worker resolves phone/email from D1 at send time. `mode: "explicit"` = exact list; `mode: "filter"` = cohort/account filter resolved against `sales_contacts`/`sales_accounts` scoped to `tenant_id`.

### B. Preview / dry-run response (before anything is sent)

`POST /api/internal/campaigns/dispatch` with `dry_run: true`, or a dedicated preview endpoint, returns without sending:

```json
{
  "job_id": "...",
  "status": "preview_ready",
  "preview_ttl": "2026-11-17T11:00:00-06:00",
  "audience_total": N,
  "would_send": M,
  "excluded_by_rule": [
    { "contact_id": "ct_...", "channel": "whatsapp", "reason": "dnc" | "quiet_hours" | "consent_missing" | "repep_expired" | "frequency_cap" | "no_valid_channel" | "invalid_number" }
  ],
  "deferred": K,                        // outside schedule window / quiet hours
  "cost_estimate": { "channel": "whatsapp", "unit_cost_usd": 0.20, "total_usd": M * 0.20 }
}
```

Counts are exact per contact, computed by running the full guardrail layer (G1–G5, G9) in read-only mode. Preview does not create sends, usage_events, or ledger entries.

### C. Approval step (Pavel)

`POST /api/internal/campaigns/{job_id}/approve` — admin (Pavel) approves after preview; worker flips job `pending_approval → approved`. Fail-closed rules:
- The dispatch consumer picks up only jobs with status `approved` (not `pending_approval`, not `draft`).
- Approval references the preview `preview_ttl`; expired previews require re-preview.
- CRM receives a webhook/hook on approval and on completion; CRM never sends directly — it stays the system of record, contact never moves.
- One approval per job; re-edit of payload requires re-preview and re-approval.

### D. Dispatch

- Paced queue consumption (respect provider limits: Resend free tier 100 emails/day per docs/CANACO_ARK_LEDGER_STRATEGY.md:119-122; Telnyx rate limits).
- Pause/resume via job status (`paused` stops dequeuing; in-flight targets finish).
- Provider failure handling: Telnyx 429 → exponential backoff + requeue, target stays `pending` (not failed); invalid number / unreachable → target `failed` with reason, no blind retry; Resend HTTP error → `failed` + error_message recorded.
- Each target lands in a per-target outcome table with `status ∈ {sent, delivered, excluded, failed}`, `reason`, `provider_message_id`, `cost_usd`, `sent_at`.

### E. Receipt back to the CRM

Worker posts (or CRM polls) `POST /api/internal/campaigns/{job_id}/receipt` with per-contact outcomes:

```json
{
  "job_id": "...",
  "tenant_id": "acc_ark_ledger",
  "status": "completed | partially_failed",
  "results": [
    { "contact_id": "ct_...", "channel": "whatsapp", "outcome": "sent|delivered|excluded|failed",
      "reason": "...", "provider_message_id": "...", "cost_usd": 0.20, "sent_at": "..." }
  ],
  "summary": { "sent": M, "excluded": E, "failed": F, "total_cost_usd": X }
}
```

CRM reconciles against its contact records (contact IDs are CRM-owned). The CRM does not import contacts; it only records outcomes.

### F. Usage events for billing (credit-bag ledger)

For every billable send the worker writes a usage event (new table, not yet present — gap G7):

```
usage_events: id, job_id, tenant_id, contact_id, channel, units, unit_cost_usd, total_cost_usd, created_at
```

`units` = messages for WhatsApp/SMS/email, minutes for voice. `total_cost_usd = units × unit_cost_usd`. The credit-bag/bundle ledger (owned outside this worker, per Arkangel pattern) deducts `total_cost_usd` per tenant from the bundle. No event is written for excluded sends; failed sends may write a zero-cost event for auditing. All cost figures use the pricing in docs/CANACO_ARK_LEDGER_STRATEGY.md:43-48.

---

## Status of this review

No code was changed, no migration applied, no deploy performed, no live send made, no test run against production data. The local suite was run once (`npm test`, vitest) purely for the §6 count: 32 files / 267 tests, with one pre-existing unrelated failure in tests/fintech_webhook_ingest.test.ts. Full citations are inline above; anything not found in the codebase is marked "not found" rather than guessed.

Artifact: reports/ark_sales_comms_review_20261116.md (this file).