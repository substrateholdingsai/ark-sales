// Matriz de Intenciones y Escalamiento — Inspirado en Harvey (ethanplusai/harvey)
// Clasifica respuestas entrantes con salvaguardas deterministas antes de invocar al LLM.

export type IntentType =
  | "interested"
  | "objection"
  | "question"
  | "wrong_person"
  | "not_interested"
  | "unsubscribe"
  | "escalate";

export interface IntentAnalysis {
  intent: IntentType;
  confidence: number;
  deterministic: boolean;
  shouldAutoReply: boolean;
  requiresHumanEscalation: boolean;
  permanentDnc: boolean;
  recommendedAction: string;
}

// Expresiones regulares deterministas de alta prioridad (anulan cualquier salida de LLM)
const OPT_OUT_RE = /\b(desuscribir|dar\s*de\s*baja|baja|remover|removerme|no\s*me\s*interesa\s*m[aá]s|no\s*vuelvas\s*a\s*escribir|unsubscribe|opt\s*out|remove\s*me|leave\s*me\s*alone|stop\s*emailing)\b/i;
const ESCALATE_RE = /\b(abogad[oa]s?|profeco|condusef|demanda|denuncia|acoso|spam\s*report|reportar|accion\s*legal|acci[oó]n\s*legal|lawyer|attorney|legal\s*action|gdpr|can-spam|harassment)\b/i;
const NOT_INTERESTED_RE = /\b(no\s*gracias|por\s*ahora\s*no|no\s*estamos\s*interesados?|no\s*nos\s*interesa|not\s*interested|pass\s*for\s*now)\b/i;
const WRONG_PERSON_RE = /\b(no\s*soy\s*la\s*persona|habla\s*con|el\s*encargado\s*es|escr[ií]bele\s*a|wrong\s*person|reach\s*out\s*to)\b/i;

export class IntentHandler {
  /**
   * Clasifica determinísticamente el texto de respuesta.
   * Si detecta opt-out o escalamiento legal, toma la decisión de inmediato sin riesgo de alucinación del LLM.
   */
  static classifyDeterministic(messageText: string): IntentAnalysis | null {
    const text = (messageText || "").trim();
    if (!text) return null;

    // 1. Escalamiento crítico legal o quejas (Prioridad Máxima)
    if (ESCALATE_RE.test(text)) {
      return {
        intent: "escalate",
        confidence: 0.99,
        deterministic: true,
        shouldAutoReply: false,
        requiresHumanEscalation: true,
        permanentDnc: false,
        recommendedAction: "Detener agente inmediatamente y notificar al Administrador de Ark Sales vía alerta/SuperAdmin."
      };
    }

    // 2. Opt-out estricto / Unsubscribe (Cumplimiento CAN-SPAM / PROFECO)
    if (OPT_OUT_RE.test(text)) {
      return {
        intent: "unsubscribe",
        confidence: 0.99,
        deterministic: true,
        shouldAutoReply: false,
        requiresHumanEscalation: false,
        permanentDnc: true,
        recommendedAction: "Agregar contacto a DNC list de por vida. Nunca responder ni reintentar."
      };
    }

    // 3. No interesado categórico
    if (NOT_INTERESTED_RE.test(text)) {
      return {
        intent: "not_interested",
        confidence: 0.95,
        deterministic: true,
        shouldAutoReply: false,
        requiresHumanEscalation: false,
        permanentDnc: false,
        recommendedAction: "Cerrar hilo en CRM como no_interesado. No enviar mensajes adicionales."
      };
    }

    // 4. Persona equivocada / Re-enrutamiento
    if (WRONG_PERSON_RE.test(text)) {
      return {
        intent: "wrong_person",
        confidence: 0.90,
        deterministic: true,
        shouldAutoReply: true,
        requiresHumanEscalation: false,
        permanentDnc: false,
        recommendedAction: "Agradecer cortesmente y solicitar el contacto o correo de la persona indicada."
      };
    }

    return null;
  }

  /**
   * Genera el payload de directriz para Llama 3.3 cuando el mensaje requiere respuesta.
   */
  static getResponseGuideline(intent: IntentType, stage: string = "contactado"): string {
    switch (intent) {
      case "interested":
        return "El prospecto muestra interés. Propón de 2 a 3 horarios específicos de 15 minutos para agendar una sesión breve. Mantén el mensaje en menos de 50 palabras sin rodeos ni clichés.";
      case "objection":
        return "El prospecto planteó una objeción (presupuesto, tiempo o solución actual). Reconoce su punto con empatía, aporta 1 solo dato de prueba concreto y cierra con 1 sola pregunta directa.";
      case "question":
        return "El prospecto hizo una pregunta puntual. Responde directamente la duda sin evadir y conecta con el caso específico de su operación.";
      case "wrong_person":
        return "Agradece cálidamente su tiempo y pregunta por el nombre o correo del responsable del área en su organización.";
      case "not_interested":
      case "unsubscribe":
      case "escalate":
      default:
        return "NO RESPONDER. El sistema automatizado se encarga de este estado.";
    }
  }
}
