/**
 * Direcciones de la aplicación.
 *
 * Hasta ahora toda la aplicación vivía en una sola URL (`/`): la pantalla era
 * únicamente estado de React, así que no se podía compartir el enlace de una
 * cotización, recargar sin volver al inicio, ni usar atrás/adelante del
 * navegador. Aquí vive la correspondencia entre cada pantalla y su dirección,
 * en un único sitio para que no se desincronicen.
 *
 * Las pantallas de detalle llevan el identificador en la ruta
 * (`/cotizaciones/<id>`), que es lo que permite abrirlas directamente.
 */

export type Screen =
  | "landing"
  | "login"
  | "register"
  | "reset-password"
  | "policy-data"
  | "policy-terms"
  | "policy-payments"
  | "dashboard"
  | "importer-profile"
  | "quotes"
  | "new-quote"
  | "quote-detail"
  | "responses"
  | "response-detail"
  | "chats"
  | "team-channel"
  | "orders"
  | "order-detail"
  | "documentos"
  | "pagos"
  | "courses"
  | "imp-dashboard"
  | "imp-profile"
  | "imp-advisors"
  | "imp-quotes"
  | "adv-dashboard"
  | "adv-available"
  | "adv-my-quotes"
  | "admin-dashboard"
  | "admin-empresas"
  | "admin-usuarios"
  | "admin-cotizantes"
  | "admin-soporte"
  | "admin-certificaciones"
  | "admin-respaldos"
  | "admin-asignacion"
  | "admin-landing"
  | "admin-correos"
  | "create-response"
  | "notifications"
  | "user-profile"
  | "help-support"
  | "tendencias"
  | "catalogos"
  | "imp-catalogos"
  | "tendencia-detalle"
  | "tendencias-enviar"
  | "tendencias-aprobacion"
  | "diseno"
  | "reto"
  | "admin-reto"
  | "admin-tipografia";

/** Qué identificador viaja en la ruta de una pantalla de detalle. */
export type ParamRuta = "quote" | "response" | "order" | "importer" | "conversation" | "tendencia";

export interface Ruta {
  screen: Screen;
  /** Segmentos fijos. El identificador, si lo hay, va detrás de ellos. */
  path: string;
  param?: ParamRuta;
}

/**
 * El orden importa: se busca coincidencia exacta antes que con parámetro, para
 * que `/cotizaciones/nueva` no se interprete como la cotización «nueva».
 */
export const RUTAS: Ruta[] = [
  { screen: "landing", path: "/" },
  { screen: "login", path: "/login" },
  { screen: "register", path: "/registro" },
  { screen: "reset-password", path: "/restablecer-password" },
  { screen: "policy-data", path: "/politica-de-datos" },
  { screen: "policy-terms", path: "/terminos" },
  { screen: "policy-payments", path: "/politica-de-pagos" },

  // Solicitante
  { screen: "dashboard", path: "/inicio" },
  { screen: "quotes", path: "/cotizaciones" },
  { screen: "new-quote", path: "/cotizaciones/nueva" },
  { screen: "quote-detail", path: "/cotizaciones", param: "quote" },
  { screen: "responses", path: "/respuestas" },
  { screen: "response-detail", path: "/respuestas", param: "response" },
  { screen: "orders", path: "/ordenes" },
  { screen: "order-detail", path: "/ordenes", param: "order" },
  { screen: "importer-profile", path: "/empresas", param: "importer" },
  // Tendencias: feed y ficha públicos. Las rutas fijas van antes que la ficha
  // (/tendencias/<id>) para que "enviar" no se lea como un identificador.
  { screen: "tendencias", path: "/tendencias" },
  { screen: "tendencias-enviar", path: "/tendencias/enviar" },
  { screen: "tendencias-aprobacion", path: "/tendencias/aprobacion" },
  { screen: "tendencia-detalle", path: "/tendencias", param: "tendencia" },
  { screen: "reto", path: "/reto" },
  // Espacio del designer: portadas e imágenes de lo aprobado en Tendencias.
  { screen: "diseno", path: "/diseno" },
  { screen: "catalogos", path: "/catalogos" },

  // Comunes
  { screen: "chats", path: "/chats" },
  { screen: "chats", path: "/chats", param: "conversation" },
  // Canal interno de administración y soporte. Va aparte de `/chats` para que
  // no se mezcle con los tickets de clientes y empresas.
  { screen: "team-channel", path: "/equipo" },
  { screen: "documentos", path: "/documentos" },
  { screen: "pagos", path: "/pagos" },
  { screen: "courses", path: "/cursos" },
  { screen: "notifications", path: "/notificaciones" },
  { screen: "user-profile", path: "/perfil" },
  { screen: "help-support", path: "/ayuda" },

  // Empresa importadora
  { screen: "imp-dashboard", path: "/empresa" },
  { screen: "imp-quotes", path: "/empresa/cotizaciones" },
  { screen: "imp-advisors", path: "/empresa/asesores" },
  { screen: "imp-profile", path: "/empresa/perfil" },
  { screen: "imp-catalogos", path: "/empresa/catalogos" },

  // Asesor
  { screen: "adv-dashboard", path: "/asesor" },
  { screen: "adv-available", path: "/asesor/disponibles" },
  { screen: "adv-my-quotes", path: "/asesor/cotizaciones" },
  { screen: "create-response", path: "/asesor/responder", param: "quote" },

  // Administración de la plataforma
  { screen: "admin-dashboard", path: "/admin" },
  { screen: "admin-empresas", path: "/admin/empresas" },
  { screen: "admin-usuarios", path: "/admin/usuarios" },
  { screen: "admin-cotizantes", path: "/admin/cotizantes" },
  { screen: "admin-soporte", path: "/admin/soporte" },
  { screen: "admin-certificaciones", path: "/admin/certificaciones" },
  { screen: "admin-respaldos", path: "/admin/respaldos" },
  { screen: "admin-asignacion", path: "/admin/asignacion" },
  { screen: "admin-landing", path: "/admin/landing" },
  { screen: "admin-correos", path: "/admin/correos" },
  { screen: "admin-tipografia", path: "/admin/tipografia" },
  { screen: "admin-reto", path: "/admin/reto" },
];

export const RUTA_RESTABLECER = "/restablecer-password";

const PANTALLAS = new Set<string>(RUTAS.map((r) => r.screen));

/**
 * ¿Es `valor` una pantalla conocida?
 *
 * Lo usa la navegación del sidebar para no tener que mantener una segunda lista
 * de pantallas a mano: esa duplicación hacía que una entrada nueva del menú
 * quedara muerta —el botón no hacía nada— hasta acordarse de añadirla también
 * allí.
 */
export function esPantalla(valor: string): valor is Screen {
  return PANTALLAS.has(valor);
}

export interface DestinoRuta {
  screen: Screen;
  param?: ParamRuta;
  id?: string;
}

function limpiar(pathname: string): string {
  const sinBarra = pathname.replace(/\/+$/, "");
  return sinBarra || "/";
}

/**
 * Dirección de una pantalla. Si la pantalla espera un identificador y no se le
 * pasa ninguno, cae a su ruta sin parámetro (la del listado), que es lo que
 * corresponde: una pantalla de detalle sin nada seleccionado no tiene detalle.
 */
export function rutaDe(screen: Screen, id?: string): string {
  const conParam = RUTAS.find((r) => r.screen === screen && r.param);
  if (conParam && id) {
    return `${conParam.path}/${encodeURIComponent(id)}`;
  }

  const sinParam = RUTAS.find((r) => r.screen === screen && !r.param);
  if (sinParam) {
    return sinParam.path;
  }

  // Pantalla de solo detalle sin id: se queda en su ruta base.
  return conParam ? conParam.path : "/";
}

/** Pantalla e identificador que corresponden a una dirección. */
export function destinoDe(pathname: string): DestinoRuta | null {
  const ruta = limpiar(pathname);

  const exacta = RUTAS.find((r) => !r.param && limpiar(r.path) === ruta);
  if (exacta) {
    return { screen: exacta.screen };
  }

  for (const candidata of RUTAS) {
    if (!candidata.param) {
      continue;
    }
    const base = limpiar(candidata.path);
    const prefijo = base === "/" ? "/" : `${base}/`;
    if (!ruta.startsWith(prefijo)) {
      continue;
    }
    const resto = ruta.slice(prefijo.length);
    // Un solo segmento: `/cotizaciones/<id>` sí, `/cotizaciones/<id>/algo` no.
    if (!resto || resto.includes("/")) {
      continue;
    }
    return { screen: candidata.screen, param: candidata.param, id: decodeURIComponent(resto) };
  }

  return null;
}
