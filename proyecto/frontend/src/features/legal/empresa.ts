/**
 * Identificación legal de quien opera Zarpi.
 *
 * Wompi y el Estatuto del Consumidor (Ley 1480 de 2011, art. 50) exigen que el
 * sitio muestre razón social, NIT, dirección y teléfono del prestador. Todos los
 * documentos legales y el pie de la landing leen de aquí, así que basta con
 * reemplazar los valores entre corchetes por los del certificado de Cámara de
 * Comercio y el RUT.
 */
export const EMPRESA = {
  marca: "Zarpi",
  razonSocial: "[RAZÓN SOCIAL S.A.S.]",
  nit: "[NIT 000.000.000-0]",
  domicilio: "[Dirección de notificaciones], [Ciudad], Colombia",
  ciudad: "[Ciudad]",
  telefono: "[+57 300 000 0000]",
  correo: "contacto@zarpi.co",
  sitio: "https://zarpi.co",
} as const;

export const LEGAL_VERSION = "1.0";
export const LEGAL_VIGENTE_DESDE = "5 de octubre de 2026";
