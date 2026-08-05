export type HelpRole = "solicitante" | "importadora" | "asesor";

export interface HelpFaqItem {
  q: string;
  a: string;
}

export interface HelpSupportRoleContent {
  roleLabel: string;
  quickTopics: string[];
  faqs: HelpFaqItem[];
  tips: string[];
}

export const HELP_SUPPORT_CONTENT: Record<HelpRole, HelpSupportRoleContent> = {
  solicitante: {
    roleLabel: "Solicitante",
    quickTopics: ["Cotizaciones", "Comparativa de propuestas", "Negociacion", "Ordenes"],
    faqs: [
      {
        q: "Como creo una cotizacion efectiva?",
        a: "En Nueva cotizacion define producto, calidad, volumen e incoterm. Cuanto mas precisa sea la ficha, mas rapida y util sera la respuesta.",
      },
      {
        q: "Cuando debo usar cotizacion abierta o dirigida?",
        a: "Usa abierta si quieres comparar varias ofertas. Usa dirigida cuando ya conoces la empresa con la que quieres negociar.",
      },
      {
        q: "Como paso de propuesta a orden?",
        a: "En el detalle de respuesta acepta la oferta y continua por el chat para cerrar condiciones antes del seguimiento de orden.",
      },
      {
        q: "Como comparo respuestas de distintas empresas?",
        a: "Evalua precio, incoterm, tiempo de entrega y alcance de personalizacion. No compares solo costo: valida riesgo y trazabilidad.",
      },
      {
        q: "Puedo retomar una negociacion mas tarde?",
        a: "Si. El historial de chat se conserva por cotizacion u orden para continuar en contexto sin perder acuerdos previos.",
      },
      {
        q: "Que hago si no recibo propuestas?",
        a: "Revisa que producto, volumen y pais esten claros. Si falta contexto comercial, actualiza la cotizacion y vuelve a publicarla.",
      },
    ],
    tips: [
      "Completa siempre pais, incoterm y cantidad minima antes de publicar.",
      "Usa el chat para pedir aclaraciones tecnicas sin perder el hilo de la cotizacion.",
      "Revisa respuestas y ordena por ajuste a precio objetivo y plazo.",
    ],
  },
  importadora: {
    roleLabel: "Empresa importadora",
    quickTopics: ["Bandeja comercial", "Asesores", "SLAs de respuesta", "Seguimiento"],
    faqs: [
      {
        q: "Como priorizo cotizaciones en mi bandeja?",
        a: "Ordena por estado y fecha de actualizacion. Atiende primero solicitudes con requisitos completos para mejorar conversion.",
      },
      {
        q: "Como agrego asesores a mi empresa?",
        a: "En Asesores crea usuarios internos y define estado activo. Un asesor activo puede reclamar y responder cotizaciones.",
      },
      {
        q: "Que buenas practicas mejoran el tiempo de respuesta?",
        a: "Mantener catalogo claro, condiciones comerciales listas y plantillas de propuesta reduce tiempos y mejora experiencia del solicitante.",
      },
      {
        q: "Como doy seguimiento a chats con mi equipo?",
        a: "Usa estados y acuerdos por mensaje. Define responsable por conversacion para evitar respuestas duplicadas o contradictorias.",
      },
      {
        q: "Que informacion no debe faltar en una propuesta?",
        a: "Incluye precio, entrega, incoterm, MOQ y condiciones adicionales para que el solicitante pueda decidir sin friccion.",
      },
      {
        q: "Como medir rendimiento de asesores?",
        a: "Monitorea tiempos de primera respuesta, tasa de conversion propuesta-orden y volumen de conversaciones cerradas.",
      },
    ],
    tips: [
      "Mantener empresa y especialidades actualizadas mejora la asignacion de oportunidades.",
      "Activa o desactiva usuarios segun carga operativa del equipo.",
      "Centraliza seguimiento de conversaciones para no duplicar respuestas.",
    ],
  },
  asesor: {
    roleLabel: "Asesor",
    quickTopics: ["Pipeline", "Propuestas", "Escalamiento", "Cierre"],
    faqs: [
      {
        q: "Como reclamo una cotizacion disponible?",
        a: "En Cotizaciones disponibles usa Reclamar para moverla a Mis cotizaciones y empezar la gestion comercial.",
      },
      {
        q: "Como responder una cotizacion sin errores?",
        a: "Completa precio, tiempo, incoterm y condiciones adicionales. Verifica consistencia con la solicitud antes de enviar.",
      },
      {
        q: "Que hago si una negociacion se enfria?",
        a: "Usa chat para retomar contexto, resume avances y deja alternativas concretas de entrega, precio o personalizacion.",
      },
      {
        q: "Como estructuro una propuesta ganadora?",
        a: "Abre con alcance, luego precio y entrega, y cierra con riesgos controlados. Evita respuestas ambiguas o incompletas.",
      },
      {
        q: "Cuando debo escalar una conversacion?",
        a: "Escala cuando cambian condiciones criticas de precio, plazo o cumplimiento legal que requieran validacion interna.",
      },
      {
        q: "Como usar mejor los recursos del curso?",
        a: "Alinea cada leccion con casos reales de cotizaciones activas y aplica checklists en propuestas antes de enviarlas.",
      },
    ],
    tips: [
      "Revisa diariamente cotizaciones disponibles para no perder ventanas de negocio.",
      "Antes de enviar propuesta valida MOQ, plazo y condiciones de personalizacion.",
      "En negociacion usa mensajes cortos con hitos claros para acelerar decisiones.",
    ],
  },
};

export function normalizeHelpRole(role: string): HelpRole {
  if (role === "importadora" || role === "asesor") {
    return role;
  }

  return "solicitante";
}

export function filterFaq(items: HelpFaqItem[], search: string): HelpFaqItem[] {
  const normalized = search.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return items.filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(normalized));
}
