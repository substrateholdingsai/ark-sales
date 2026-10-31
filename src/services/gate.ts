// Pre-Send Deterministic Gate — Inspirado en la arquitectura Harvey (ethanplusai/harvey)
// Las instrucciones al LLM son un piso, no una garantía.
// Este guardián valida determinísticamente todo correo saliente antes del despacho.

export const BANNED_PHRASES: string[] = [
  // Clichés de IA en inglés (Harvey)
  "act now",
  "buy now",
  "click here",
  "click below",
  "limited time",
  "exclusive deal",
  "special offer",
  "risk-free",
  "no obligation",
  "100% free",
  "make money",
  "guaranteed results",
  "i hope this finds you well",
  "hope this email finds you well",
  "i hope this email finds you",
  "picture this",
  "what if i told you",
  "in today's fast-paced world",
  "game-changer",
  "game changer",
  "cutting-edge solution",
  "revolutionize your",
  "unlock your",
  "supercharge your",
  "as an ai",
  "i'm an ai",
  "i am an ai",
  "as a language model",
  
  // Clichés de IA en español
  "en el mundo acelerado de hoy",
  "en el dinámico mundo de hoy",
  "cambiará las reglas del juego",
  "solución revolucionaria",
  "solución de vanguardia",
  "espero que te encuentres muy bien",
  "espero que este correo te encuentre bien",
  "espero que estés teniendo un excelente día",
  "imagina esto",
  "qué pasaría si te dijera",
  "desbloquea tu potencial",
  "potencia tus resultados",
  "lleva tu negocio al siguiente nivel",
  "como inteligencia artificial",
  "como modelo de lenguaje",
  "soy una ia",
  "sin compromiso alguno",
  "100% garantizado",
  "duplica tus ingresos",
];

const MERGE_TAG_RE = /\{\{\s*[\w.]+\s*\}\}|\{[\w.]+\}(?!\})/g;
const URL_RE = /https?:\/\/\S+/gi;
const EM_DASH_RE = /—|–/g; // Em dash and en dash

export interface GateOptions {
  emailType?: "outreach_1" | "followup_2" | "breakup_3" | "general";
  maxWordsOverride?: number;
  maxLinks?: number;
  maxSubjectLen?: number;
  autoSanitizeDashes?: boolean;
}

export interface GateResult {
  ok: boolean;
  reasons: string[];
  sanitizedSubject: string;
  sanitizedBody: string;
  wordCount: number;
  linkCount: number;
}

function countWords(text: string): number {
  if (!text) return 0;
  // Limpia tags HTML si los hay para contar palabras reales
  const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return 0;
  return clean.split(/\s+/).length;
}

export class PreSendGate {
  /**
   * Revisa determinísticamente un correo antes de ser despachado.
   * Si no pasa las reglas de calidad, bloquea el envío (fail-closed).
   */
  static check(
    subject: string,
    body: string,
    options: GateOptions = {}
  ): GateResult {
    const reasons: string[] = [];
    const autoSanitize = options.autoSanitizeDashes !== false;
    let sSubject = subject || "";
    let sBody = body || "";

    // 1. Sanitización / Detección de Em-Dashes (IA Tell #1)
    if (EM_DASH_RE.test(sSubject) || EM_DASH_RE.test(sBody)) {
      if (autoSanitize) {
        // Reemplazar em dash por comas o puntos según contexto
        sSubject = sSubject.replace(EM_DASH_RE, ", ").replace(/\s{2,}/g, " ").trim();
        sBody = sBody.replace(EM_DASH_RE, ", ").replace(/\s{2,}/g, " ");
      } else {
        reasons.push("em_dash_detected: El correo contiene guiones largos (—), un marcador característico de IA.");
      }
    }

    // 2. Detección estricta de variables no resueltas (Fail-Closed)
    const subjectTags = sSubject.match(MERGE_TAG_RE);
    const bodyTags = sBody.match(MERGE_TAG_RE);
    if (subjectTags || bodyTags) {
      const leaked = [...(subjectTags || []), ...(bodyTags || [])].join(", ");
      reasons.push(`unresolved_merge_tags: Contiene variables sin renderizar: ${leaked}`);
    }

    // 3. Chequeo de frases prohibidas / spam triggers
    const lowerSub = sSubject.toLowerCase();
    const lowerBody = sBody.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (lowerSub.includes(phrase) || lowerBody.includes(phrase)) {
        reasons.push(`banned_phrase_detected: Contiene frase cliché o spam trigger '${phrase}'`);
      }
    }

    // 4. Límites de longitud de asunto
    const maxSubLen = options.maxSubjectLen || 90;
    if (sSubject.length > maxSubLen) {
      reasons.push(`subject_too_long: El asunto tiene ${sSubject.length} caracteres (máximo ${maxSubLen})`);
    }

    // 5. Conteo y límites de palabras
    const wordCount = countWords(sBody);
    let maxWords = 220; // techo general
    if (options.emailType === "outreach_1") maxWords = options.maxWordsOverride || 90;
    else if (options.emailType === "followup_2") maxWords = options.maxWordsOverride || 80;
    else if (options.emailType === "breakup_3") maxWords = options.maxWordsOverride || 45;
    else if (options.maxWordsOverride) maxWords = options.maxWordsOverride;

    if (wordCount > maxWords) {
      reasons.push(`body_too_long: El cuerpo tiene ${wordCount} palabras (máximo ${maxWords} para tipo ${options.emailType || "general"})`);
    }

    // 6. Límite de enlaces (Evita caer en carpeta de spam / promociones)
    const links = sBody.match(URL_RE) || [];
    const maxLinks = options.maxLinks !== undefined ? options.maxLinks : 1;
    if (links.length > maxLinks) {
      reasons.push(`too_many_links: Contiene ${links.length} enlaces (máximo permitido: ${maxLinks})`);
    }

    return {
      ok: reasons.length === 0,
      reasons,
      sanitizedSubject: sSubject,
      sanitizedBody: sBody,
      wordCount,
      linkCount: links.length,
    };
  }
}
