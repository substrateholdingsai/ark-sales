// WhatsApp Meta HSM template registry + approval flow (Step 3: G6).
// Fail-closed: a template must exist and be approved (status='approved')
// before any WhatsApp send. No "default" fallback, no guessing.

export type HsmTemplateStatus = "draft" | "submitted" | "approved" | "rejected" | "paused";

export interface HsmTemplate {
  id: string;
  tenant_id: string | null;
  template_name: string;
  template_version: string;
  language_code: string;
  category: string;
  components_json: string;
  variables_json: string; // expected variable names (JSON array of strings)
  status: HsmTemplateStatus;
  meta_template_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmitTemplateParams {
  tenantId?: string | null;
  templateName: string;
  templateVersion?: string;
  languageCode?: string;
  category?: string;
  componentsJson: string;
  variablesJson?: string;
  createdByUserId?: string | null;
}

export class HsmTemplateService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async submit(params: SubmitTemplateParams): Promise<{ id: string; template: HsmTemplate }> {
    if (!this.db) throw new Error("HSM_TEMPLATE_STORE_UNAVAILABLE");
    const id = `hsm_${crypto.randomUUID()}`;
    const templateVersion = params.templateVersion ?? "1";
    const languageCode = params.languageCode ?? "es-MX";
    const category = params.category ?? "utility";
    const variablesJson = params.variablesJson ?? "[]";

    await this.db
      .prepare(
        `
        INSERT INTO whatsapp_hsm_templates (
          id, tenant_id, template_name, template_version, language_code,
          category, components_json, variables_json, status,
          created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      )
      .bind(
        id,
        params.tenantId ?? null,
        params.templateName,
        templateVersion,
        languageCode,
        category,
        params.componentsJson,
        variablesJson,
        params.createdByUserId ?? null,
      )
      .run();

    const template = await this.getById(id);
    if (!template) throw new Error("HSM_TEMPLATE_CREATE_FAILED");
    return { id, template };
  }

  async getById(id: string): Promise<HsmTemplate | null> {
    if (!this.db) return null;
    const row = (await this.db.prepare("SELECT * FROM whatsapp_hsm_templates WHERE id = ? LIMIT 1").bind(id).first()) as any;
    return row ? (row as HsmTemplate) : null;
  }

  async list(params?: { tenantId?: string | null; status?: HsmTemplateStatus; limit?: number }): Promise<HsmTemplate[]> {
    if (!this.db) return [];
    let query = "SELECT * FROM whatsapp_hsm_templates WHERE 1=1";
    const binds: unknown[] = [];
    if (params?.tenantId !== undefined) {
      query += " AND tenant_id = ?";
      binds.push(params.tenantId);
    }
    if (params?.status) {
      query += " AND status = ?";
      binds.push(params.status);
    }
    query += " ORDER BY created_at DESC";
    if (params?.limit) {
      query += " LIMIT ?";
      binds.push(params.limit);
    }
    const { results } = await this.db
      .prepare(query)
      .bind(...binds)
      .all();
    return (results || []) as HsmTemplate[];
  }

  async approve(id: string, approvedByUserId?: string | null): Promise<HsmTemplate | null> {
    if (!this.db) return null;
    await this.db
      .prepare(
        `UPDATE whatsapp_hsm_templates
         SET status = 'approved', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status IN ('draft', 'submitted', 'rejected')`,
      )
      .bind(id)
      .run();
    return this.getById(id);
  }

  async reject(id: string, rejectedByUserId?: string | null): Promise<HsmTemplate | null> {
    if (!this.db) return null;
    await this.db
      .prepare(
        `UPDATE whatsapp_hsm_templates
         SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status IN ('draft', 'submitted', 'approved')`,
      )
      .bind(id)
      .run();
    return this.getById(id);
  }

  /**
   * Resolve + validate an HSM template for send. Fail-closed:
   * throws if not found, not approved, or variables missing.
   * Never returns a "default" template.
   */
  async resolveForSend(params: {
    tenantId?: string | null;
    templateName: string;
    templateVersion?: string;
    languageCode?: string;
    variables?: Record<string, any>;
  }): Promise<HsmTemplate> {
    if (!this.db) throw new Error("HSM_TEMPLATE_STORE_UNAVAILABLE");
    const templateVersion = params.templateVersion ?? "1";
    const languageCode = params.languageCode ?? "es-MX";

    const row = (await this.db
      .prepare(
        `SELECT * FROM whatsapp_hsm_templates
         WHERE template_name = ?
           AND template_version = ?
           AND language_code = ?
           AND (tenant_id = ? OR tenant_id IS NULL)
         ORDER BY CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END, updated_at DESC
         LIMIT 1`,
      )
      .bind(params.templateName, templateVersion, languageCode, params.tenantId ?? null)
      .first()) as any;

    if (!row) {
      throw new Error(`HSM_TEMPLATE_NOT_FOUND: ${params.templateName}:${templateVersion}:${languageCode}`);
    }
    if (row.status !== "approved") {
      throw new Error(`HSM_TEMPLATE_NOT_APPROVED: ${row.status}`);
    }

    // Validate supplied variables against variables_json (expected names)
    let expectedVars: unknown;
    try {
      expectedVars = JSON.parse(row.variables_json || "[]");
    } catch {
      throw new Error("HSM_TEMPLATE_INVALID_VARIABLES");
    }
    if (!Array.isArray(expectedVars) || expectedVars.some((variable) => typeof variable !== "string" || !variable)) {
      throw new Error("HSM_TEMPLATE_INVALID_VARIABLES");
    }
    const missing = expectedVars.filter((variable) => typeof params.variables?.[variable] !== "string" || !params.variables[variable].trim());
    if (missing.length > 0) {
      throw new Error(`HSM_TEMPLATE_MISSING_VARIABLES: ${missing.join(",")}`);
    }

    return row as HsmTemplate;
  }
}
