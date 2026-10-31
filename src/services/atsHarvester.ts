// Colector de Señales de Compra en ATS a $0 USD — Inspirado en Harvey
// Extrae vacantes activas de Greenhouse, Lever y Ashby sin necesidad de credenciales ni APIs de pago.
// Las vacantes abiertas revelan necesidades inmediatas de software y servicios.

export interface AtsJob {
  id: string;
  title: string;
  department?: string;
  location?: string;
  postedAt?: string;
  atsSource: "greenhouse" | "lever" | "ashby" | "workable";
  matchedProduct?: "ledger" | "angel" | "altum" | "commerce";
  signalStrength: "high" | "medium" | "low";
  suggestedHook: string;
}

export interface AtsHarvestResult {
  company: string;
  ats: string;
  totalJobs: number;
  relevantSignals: AtsJob[];
}

export class AtsHarvester {
  /**
   * Clasifica un título de vacante contra los productos del ecosistema ARK.
   */
  static classifyJob(jobTitle: string, dept: string = ""): { product?: "ledger" | "angel" | "altum" | "commerce"; strength: "high" | "medium" | "low"; hook: string } | null {
    const text = (jobTitle + " " + dept).toLowerCase();

    // 1. Dolor Fiscal y Contable -> Ark Ledger
    if (/(tax|fiscal|contador|contabilidad|cfo|auditor|auditora|anexo\s*24|cfdi|tesoreria|finanzas)/i.test(text)) {
      return {
        product: "ledger",
        strength: "high",
        hook: `Vimos que tienen abierta la vacante de '${jobTitle}'. Ark Ledger automatiza el cierre fiscal CFF, conciliación Anexo 24 y timbrado CFDI 4.0 con sello SHA-256 mientras cubren la posición.`
      };
    }

    // 2. Dolor de Cartera Morosa y Cobranza -> Ark Angel
    if (/(cobranza|collection|credito|crédito|recuperacion|recuperación|cartera|riesgo\s*crediticio)/i.test(text)) {
      return {
        product: "angel",
        strength: "high",
        hook: `Detectamos su búsqueda de '${jobTitle}'. Ark Angel despliega agentes de voz con IA y WhatsApp para recuperar cartera vencida y promesas de pago con motor legal fail-closed.`
      };
    }

    // 3. Expansión Inmobiliaria / Sureste -> ALTUM Sureste
    if (/(inmobiliari|real\s*estate|proptech|tulum|merida|mérida|riviera\s*maya|cancun|cancún|bacalar|holbox)/i.test(text)) {
      return {
        product: "altum",
        strength: "medium",
        hook: `Notamos su actividad en el sector y región para '${jobTitle}'. ALTUM Sureste ofrece reservas directas y macrolotes con certeza jurídica ante RPP Yucatán/Quintana Roo.`
      };
    }

    // 4. Comercio Digital y Ventas -> Ark Commerce
    if (/(ecommerce|e-commerce|tienda\s*en\s*linea|shopify|woocommerce|retail)/i.test(text)) {
      return {
        product: "commerce",
        strength: "medium",
        hook: `Vimos su vacante para '${jobTitle}'. Ark Commerce habilita tienda digital edge-first con pedidos por WhatsApp y checkout SPEI sin comisiones por transacción.`
      };
    }

    return null;
  }

  /**
   * Consulta vacantes públicas de Greenhouse
   * URL: https://boards-api.greenhouse.io/v1/boards/{boardToken}/jobs
   */
  static async fetchGreenhouse(boardToken: string): Promise<AtsHarvestResult> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) {
      throw new Error(`Greenhouse API retornó HTTP ${res.status}`);
    }
    const data: any = await res.json();
    const rawJobs = Array.isArray(data.jobs) ? data.jobs : [];
    const signals: AtsJob[] = [];

    for (const j of rawJobs) {
      const title = j.title || "";
      const dept = j.departments?.[0]?.name || "";
      const loc = j.location?.name || "";
      const classification = this.classifyJob(title, dept);

      if (classification) {
        signals.push({
          id: String(j.id),
          title,
          department: dept,
          location: loc,
          postedAt: j.updated_at,
          atsSource: "greenhouse",
          matchedProduct: classification.product,
          signalStrength: classification.strength,
          suggestedHook: classification.hook
        });
      }
    }

    return {
      company: boardToken,
      ats: "greenhouse",
      totalJobs: rawJobs.length,
      relevantSignals: signals
    };
  }

  /**
   * Consulta vacantes públicas de Lever
   * URL: https://api.lever.co/v0/postings/{company}?mode=json
   */
  static async fetchLever(companyToken: string): Promise<AtsHarvestResult> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(companyToken)}?mode=json`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) {
      throw new Error(`Lever API retornó HTTP ${res.status}`);
    }
    const data: any = await res.json();
    const rawJobs = Array.isArray(data) ? data : [];
    const signals: AtsJob[] = [];

    for (const j of rawJobs) {
      const title = j.text || "";
      const dept = j.categories?.team || j.categories?.department || "";
      const loc = j.categories?.location || "";
      const classification = this.classifyJob(title, dept);

      if (classification) {
        signals.push({
          id: String(j.id),
          title,
          department: dept,
          location: loc,
          postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
          atsSource: "lever",
          matchedProduct: classification.product,
          signalStrength: classification.strength,
          suggestedHook: classification.hook
        });
      }
    }

    return {
      company: companyToken,
      ats: "lever",
      totalJobs: rawJobs.length,
      relevantSignals: signals
    };
  }

  /**
   * Consulta vacantes públicas de Ashby
   * URL: https://api.ashbyhq.com/posting-api/job-board/{company}
   */
  static async fetchAshby(companyToken: string): Promise<AtsHarvestResult> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(companyToken)}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) {
      throw new Error(`Ashby API retornó HTTP ${res.status}`);
    }
    const data: any = await res.json();
    const rawJobs = Array.isArray(data.jobs) ? data.jobs : [];
    const signals: AtsJob[] = [];

    for (const j of rawJobs) {
      const title = j.title || "";
      const dept = j.department || "";
      const loc = j.location || "";
      const classification = this.classifyJob(title, dept);

      if (classification) {
        signals.push({
          id: String(j.id),
          title,
          department: dept,
          location: loc,
          postedAt: j.publishedAt,
          atsSource: "ashby",
          matchedProduct: classification.product,
          signalStrength: classification.strength,
          suggestedHook: classification.hook
        });
      }
    }

    return {
      company: companyToken,
      ats: "ashby",
      totalJobs: rawJobs.length,
      relevantSignals: signals
    };
  }
}
