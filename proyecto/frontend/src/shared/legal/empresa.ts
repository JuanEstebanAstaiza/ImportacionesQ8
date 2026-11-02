/**
 * Identificación legal de quien opera Zarpi.
 *
 * La pasarela de pagos y el Estatuto del Consumidor (Ley 1480 de 2011, art. 50)
 * exigen que el sitio muestre razón social, NIT, dirección y teléfono del
 * prestador. Los documentos legales y el pie de la landing leen de aquí.
 *
 * Fuente: los documentos aprobados en docs/ («Zarpi - Términos y Condiciones»,
 * «Zarpi - Política de Tratamiento de Datos Personales» y «Zarpi - Política de
 * Pagos, Cancelaciones y Reembolsos», versión 1.0).
 */
export const EMPRESA = {
  marca: "Zarpi",
  razonSocial: "ZARPI S.A.S.",
  nit: "902.106.417-6",
  matricula: "1296722-16",
  camaraComercio: "Cámara de Comercio de Cali",
  direccion: "Carrera 39 # 5B-100",
  ciudad: "Cali",
  domicilio: "Carrera 39 # 5B-100, Cali, Valle del Cauca, Colombia",
  telefono: "+57 311 222 6945",
  correo: "contacto@zarpi.co",
  sitio: "https://zarpi.co",
  pasarela: "ePayco",
} as const;

export const LEGAL_VERSION = "1.0";
export const LEGAL_VIGENTE_DESDE = "5 de octubre de 2026";
