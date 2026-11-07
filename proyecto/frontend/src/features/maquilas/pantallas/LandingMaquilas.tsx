import { BadgeCheck, ClipboardList, Factory, Scissors, Workflow } from "lucide-react";

import { LandingApp, type ContenidoLandingApp, type PropsLandingApp } from "@shared/landing/LandingApp";

const CONTENIDO: ContenidoLandingApp = {
  appId: "maquilas",
  nombre: "Zarpi Maquilas",
  acento: "#FF007A",
  eyebrow: "Zarpi Maquilas",
  titulo: "Producción industrial y talleres de confección,",
  tituloResaltado: "con pedidos bajo control.",
  texto: "Encuentra talleres y plantas de manufactura para producir tus diseños, cotiza por lote y gestiona cada pedido de producción desde el corte hasta la entrega.",
  ctaPrimario: "Cotizar producción",
  ctaSecundario: "Soy taller o planta",
  puntos: [
    { icono: BadgeCheck, texto: "Talleres y plantas verificados por Zarpi" },
    { icono: ClipboardList, texto: "Seguimiento del pedido por etapas de producción" },
  ],
  estadisticas: [
    { valor: "60+", etiqueta: "Talleres" },
    { valor: "12", etiqueta: "Tipos de proceso" },
    { valor: "300", etiqueta: "Unidades mínimas" },
    { valor: "48 h", etiqueta: "Cotización" },
  ],
  pasosTitulo: "De tu diseño al producto terminado.",
  pasos: [
    { titulo: "Describe", texto: "Cuenta qué quieres producir: referencia, cantidades, materiales y fechas." },
    { titulo: "Cotiza", texto: "Recibe propuestas de talleres con precio por unidad y tiempos." },
    { titulo: "Produce", texto: "Aprueba muestras y sigue cada etapa: corte, confección, acabado." },
    { titulo: "Entrega", texto: "Recibe el lote terminado y cierra el pedido con el taller." },
  ],
  valorTitulo: "Manufactura con orden, para marcas y talleres.",
  bloques: [
    {
      icono: Scissors,
      titulo: "Talleres de confección",
      texto: "Capacidad disponible para tu próxima colección.",
      items: ["Perfil con procesos y capacidad", "Fotos y referencias de trabajos previos", "Pedidos nuevos sin intermediarios"],
    },
    {
      icono: Factory,
      titulo: "Plantas de manufactura",
      texto: "Producción industrial de mayor volumen.",
      items: ["Cotización por lote y por proceso", "Control de calidad por etapa", "Acuerdos de entrega por escrito"],
    },
    {
      icono: Workflow,
      titulo: "Gestión de pedidos",
      texto: "Todo el pedido en un solo lugar.",
      items: ["Estado por etapa de producción", "Chat con el taller y adjuntos", "Historial de cada orden"],
    },
  ],
  cierreTitulo: "¿Tienes una producción por arrancar?",
  cierreTexto: "Usa tu misma cuenta de Zarpi para entrar a todos los productos de la suite.",
};

export function LandingMaquilas(props: Omit<PropsLandingApp, "contenido">) {
  return <LandingApp contenido={CONTENIDO} {...props} />;
}
