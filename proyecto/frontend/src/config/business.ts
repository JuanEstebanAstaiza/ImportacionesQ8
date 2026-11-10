import type { MotivoEleccion } from "@/services/business.service";
import { CATEGORIAS_PRODUCTO } from "@/utils/categorias";

export const MAX_FOTOS_PRODUCTO = 10;
export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
export const COUNTRIES = ["China", "Estados Unidos", "Alemania", "Japón", "India", "Italia", "Francia", "España", "Brasil", "Corea del Sur", "Turquía", "México", "Colombia"];
export const LINES = CATEGORIAS_PRODUCTO;
export const ALL_CATEGORIES = CATEGORIAS_PRODUCTO;
export const SYSTEM_ROOT_FOLDER_NAMES = ["Órdenes", "Cotizaciones", "Respuestas", "Cursos", "Chats", "Certificados"];
export const CORREO_ADMINISTRACION = "admin@zarpi.co";
export const INCOTERM_INCLUYE: Record<string, string> = {
  EXW: "Mercancía en fábrica; tú pones el transporte", FCA: "Entregada al transportista en origen",
  FOB: "Puesta en el barco en origen; flete y seguro aparte", CFR: "Flete hasta el puerto de destino; seguro aparte",
  CIF: "Flete y seguro hasta el puerto de destino", CPT: "Transporte pagado hasta destino; seguro aparte",
  CIP: "Transporte y seguro pagados hasta destino", DAP: "Hasta tu puerta, sin impuestos de importación",
  DPU: "Descargada en destino, sin impuestos", DDP: "Puerta a puerta con impuestos y nacionalización",
};
export const MOTIVOS_ELECCION: { clave: MotivoEleccion; etiqueta: string; ayuda: string }[] = [
  { clave: "precio", etiqueta: "Precio", ayuda: "Me salió mejor en costo" }, { clave: "tiempo", etiqueta: "Tiempo de entrega", ayuda: "Llega antes" },
  { clave: "condiciones", etiqueta: "Condiciones", ayuda: "Lo que incluye, pagos, garantías" }, { clave: "otro", etiqueta: "Otro motivo", ayuda: "Confianza, atención, recomendación..." },
];
