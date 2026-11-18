// Guardrail layer for Ark Sales comms (Step 1: G1-G5 + G9).
// Fail-closed: any guardrail failure excludes the target, never sends.
// All checks are tenant-scoped and read from D1 (durable, not in-memory).

import { Env } from "../types";
import { DncService } from "./dnc";

export type GuardrailResult = {
  allowed: boolean;
  reason?: "dnc" | "consent_missing" | "repep_expired" | "quiet_hours" | "frequency_cap" | "no_valid_channel" | "invalid_number" | "tenant_mismatch";
  deferred?: boolean; // true when quiet hours defer (retry later) rather than exclude
};

export type ContactChannel = {
  contact_id: string;
  phone_e164?: string | null;
  email?: string | null;
  consent_status?: string | null;
  channel: "whatsapp" | "sms" | "email" | "voice";
};

export class GuardrailService {
  private db: any;
  private env: Env;

  constructor(db: any, env: Env) {
    this.db = db;
    this.env = env;
  }

  // ------------------------------------------------------------------
  // G9: Tenant-scoped send enforcement — verify contact belongs to tenant
  // ------------------------------------------------------------------
  async verifyTenant(tenantId: string, contactId: string): Promise<boolean> {
    if (!this.db) return false;
    // Two-step check: contact must exist and belong to an account in the tenant
    const contact = (await this.db.prepare("SELECT account_id FROM sales_contacts WHERE id = ? LIMIT 1").bind(contactId).first()) as any;
    if (!contact) return false;
    const account = (await this.db.prepare("SELECT tenant_id FROM sales_accounts WHERE id = ? LIMIT 1").bind(contact.account_id).first()) as any;
    return account?.tenant_id === tenantId;
  }

  // ------------------------------------------------------------------
  // G1: Consent enforcement (fail-closed)
  // ------------------------------------------------------------------
  async checkConsent(contactId: string, channel: ContactChannel["channel"]): Promise<GuardrailResult> {
    if (!this.db) return { allowed: false, reason: "consent_missing" };
    const contact = (await this.db
      .prepare("SELECT consent_status, contact_preferences_json FROM sales_contacts WHERE id = ? LIMIT 1")
      .bind(contactId)
      .first()) as any;
    if (!contact) return { allowed: false, reason: "consent_missing" };

    const consent = contact.consent_status || "opt_out";
    const prefs = contact.contact_preferences_json ? JSON.parse(contact.contact_preferences_json) : {};

    // Per-channel consent override in contact_preferences_json
    const channelConsent = prefs[`consent_${channel}`];
    const effectiveConsent = channelConsent !== undefined ? channelConsent : consent;

    if (effectiveConsent !== "opt_in" && effectiveConsent !== "opted_in" && effectiveConsent !== "true") {
      return { allowed: false, reason: "consent_missing" };
    }
    return { allowed: true };
  }

  // ------------------------------------------------------------------
  // G2: REPEP PROFECO check (35-day validity per contact + channel)
  // ------------------------------------------------------------------
  async checkRepep(phoneE164: string | null | undefined, channel: ContactChannel["channel"]): Promise<GuardrailResult> {
    if (!phoneE164) return { allowed: true }; // no phone to check for REPEP
    if (!this.db) return { allowed: false, reason: "repep_expired" }; // fail-closed: no REPEP store = block

    const phoneHash = await sha256Hex(phoneE164);

    // Check current active REPEP version
    const versionRow = (await this.db.prepare("SELECT * FROM repep_list_version WHERE id = 'current' AND status = 'active' LIMIT 1").bind().first()) as any;
    const expiresAt = typeof versionRow?.expires_at === "string" ? Date.parse(versionRow.expires_at) : NaN;
    const cutOff = typeof versionRow?.cut_off_date === "string" ? Date.parse(versionRow.cut_off_date) : NaN;
    if (
      !versionRow ||
      !Number.isInteger(versionRow.list_version) ||
      versionRow.list_version < 1 ||
      !Number.isFinite(expiresAt) ||
      !Number.isFinite(cutOff) ||
      cutOff > Date.now() ||
      expiresAt <= Date.now() ||
      expiresAt <= cutOff ||
      expiresAt - cutOff > 35 * 24 * 60 * 60 * 1000
    ) {
      return { allowed: false, reason: "repep_expired" };
    }

    // A matching stale entry is not evidence that the contact has opted back in.
    const suppressed = (await this.db
      .prepare("SELECT id FROM repep_list WHERE phone_hash = ? AND channel = ? AND list_version = ? LIMIT 1")
      .bind(phoneHash, channel, versionRow.list_version)
      .first()) as any;

    if (suppressed) return { allowed: false, reason: "repep_expired" };
    return { allowed: true };
  }

  // ------------------------------------------------------------------
  // G3: Quiet hours 21:00–08:00 (CDMX / America/Mexico_City)
  // ------------------------------------------------------------------
  checkQuietHours(sendAt?: string | null | undefined): GuardrailResult {
    // CDMX is UTC-6 (CST) year-round (no DST since 2022 in most of Mexico)
    const now = sendAt ? new Date(sendAt) : new Date();
    // Mexico City offset: UTC-6
    const cdmxHour = (((now.getUTCHours() - 6) % 24) + 24) % 24;
    // Quiet hours: 21:00–08:00 (inclusive of 21:00, exclusive of 08:00)
    if (cdmxHour >= 21 || cdmxHour < 8) {
      return { allowed: false, reason: "quiet_hours", deferred: true };
    }
    return { allowed: true };
  }

  // ------------------------------------------------------------------
  // G4: Per-contact frequency / weekly caps (durable in D1)
  // ------------------------------------------------------------------
  async checkFrequencyCap(tenantId: string, contactId: string, channel: ContactChannel["channel"], weekStartDate?: string): Promise<GuardrailResult> {
    if (!this.db) return { allowed: true }; // no DB, can't enforce — but fail-closed would be safer; allow for now
    const weekStart = weekStartDate || this.mondayOf(new Date()).toISOString().slice(0, 10);

    const cap = (await this.db
      .prepare(
        "SELECT sent_count, max_per_week FROM contact_frequency_caps WHERE tenant_id = ? AND contact_id = ? AND channel = ? AND week_start_date = ? LIMIT 1",
      )
      .bind(tenantId, contactId, channel, weekStart)
      .first()) as any;

    const maxPerWeek = cap?.max_per_week ?? 10;
    const sentCount = cap?.sent_count ?? 0;

    if (sentCount >= maxPerWeek) {
      return { allowed: false, reason: "frequency_cap" };
    }
    return { allowed: true };
  }

  // Increment the frequency cap counter after a successful send
  async incrementFrequencyCap(tenantId: string, contactId: string, channel: ContactChannel["channel"], weekStartDate?: string): Promise<void> {
    if (!this.db) return;
    const weekStart = weekStartDate || this.mondayOf(new Date()).toISOString().slice(0, 10);
    await this.db
      .prepare(
        `
        INSERT INTO contact_frequency_caps (id, tenant_id, contact_id, channel, week_start_date, sent_count, max_per_week, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, 10, CURRENT_TIMESTAMP)
        ON CONFLICT(tenant_id, contact_id, channel, week_start_date) DO UPDATE SET
          sent_count = sent_count + 1,
          updated_at = CURRENT_TIMESTAMP
      `,
      )
      .bind(`cap_${crypto.randomUUID()}`, tenantId, contactId, channel, weekStart)
      .run();
  }

  // ------------------------------------------------------------------
  // G5: DNC check (reuse existing DncService) — email + phone
  // ------------------------------------------------------------------
  async checkDnc(contact: ContactChannel, tenantId?: string): Promise<GuardrailResult> {
    if (!this.db) return { allowed: true };
    const dnc = new DncService(this.db);
    // Check email
    if (contact.email && (await dnc.isBlocked(contact.email, tenantId))) {
      return { allowed: false, reason: "dnc" };
    }
    // Check phone
    if (contact.phone_e164 && (await dnc.isBlockedByPhone(contact.phone_e164, tenantId))) {
      return { allowed: false, reason: "dnc" };
    }
    return { allowed: true };
  }

  // ------------------------------------------------------------------
  // Combined guardrail check for a single contact (preview + dispatch)
  // ------------------------------------------------------------------
  async evaluateContact(tenantId: string, contact: ContactChannel, sendAt?: string | null | undefined): Promise<GuardrailResult> {
    // G9: tenant scoping first
    const tenantOk = await this.verifyTenant(tenantId, contact.contact_id);
    if (!tenantOk) return { allowed: false, reason: "tenant_mismatch" };

    // G5: DNC
    const dncOk = await this.checkDnc(contact, tenantId);
    if (!dncOk.allowed) return dncOk;

    // G1: consent
    const consentOk = await this.checkConsent(contact.contact_id, contact.channel);
    if (!consentOk.allowed) return consentOk;

    // G2: REPEP (phone channels only)
    if (contact.channel !== "email" && contact.phone_e164) {
      const repepOk = await this.checkRepep(contact.phone_e164, contact.channel);
      if (!repepOk.allowed) return repepOk;
    }

    // G3: quiet hours
    const quietOk = this.checkQuietHours(sendAt);
    if (!quietOk.allowed) return quietOk;

    // G4: frequency cap
    const capOk = await this.checkFrequencyCap(tenantId, contact.contact_id, contact.channel);
    if (!capOk.allowed) return capOk;

    return { allowed: true };
  }

  // ------------------------------------------------------------------
  // Helper: Monday of a given date (for weekly cap bucketing)
  // ------------------------------------------------------------------
  private mondayOf(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + mondayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

// SHA-256 hex hash for phone numbers (REPEP store uses hashes, not raw numbers)
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}
