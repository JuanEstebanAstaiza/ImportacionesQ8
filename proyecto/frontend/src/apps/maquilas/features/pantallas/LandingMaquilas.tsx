import { BadgeCheck, ClipboardList, Factory, Scissors, Workflow } from "lucide-react";

import { LandingApp, type ContenidoLandingApp, type PropsLandingApp } from "@shared/landing/LandingApp";

const CONTENIDO: ContenidoLandingApp = {
  appId: "maquilas",
  prototipo: false,
  nombre: "Zarpi Maquilas",
  acento: "#FF007A",
  eyebrow: "Zarpi Maquilas",
  titulo: "Fabrica tus productos con maquilas verificadas",
  tituloResaltado: "y crea tu propia marca.",
  texto: "Encuentra talleres y plantas que fabrican lo que imaginas, compara propuestas por cantidad, aprueba la muestra y sigue cada etapa de la producción hasta la entrega.",
  ctaPrimario: "Fabrica tu marca",
  ctaSecundario: "Registra tu maquila",
  puntos: [
    { icono: BadgeCheck, texto: "Maquilas verificadas por Zarpi: RUT y cámara de comercio revisados" },
    { icono: ClipboardList, texto: "Seguimiento del pedido por etapas de producción" },
  ],
  estadisticas: [
    { valor: "100 %", etiqueta: "Maquilas verificadas" },
    { valor: "3 pasos", etiqueta: "Para registrar tu maquila" },
    { valor: "Por etapas", etiqueta: "Seguimiento de producción" },
    { valor: "1 cuenta", etiqueta: "Para toda la suite Zarpi" },
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

/** Landing pública de Zarpi Maquilas. «Registra tu maquila» lleva al registro propio de las maquiladoras. */
export function LandingMaquilas({ onRegistrarMaquila, ...props }: Omit<PropsLandingApp, "contenido" | "onCtaSecundario"> & { onRegistrarMaquila: () => void }) {
  return <LandingApp contenido={CONTENIDO} onCtaSecundario={onRegistrarMaquila} {...props} />;
}
