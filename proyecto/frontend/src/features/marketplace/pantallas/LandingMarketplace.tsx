import { BadgeCheck, Globe2, Handshake, Store, Truck } from "lucide-react";

import { LandingApp, type ContenidoLandingApp, type PropsLandingApp } from "@/components/landing/LandingApp";

const CONTENIDO: ContenidoLandingApp = {
  appId: "marketplace",
  nombre: "Zarpi Marketplace",
  acento: "#3A86FF",
  eyebrow: "Zarpi Marketplace",
  titulo: "Comercio global con múltiples proveedores,",
  tituloResaltado: "en un solo lugar.",
  texto: "Descubre catálogos de proveedores verificados, compara ofertas y compra con condiciones claras. Vende tus productos a compradores de todo el país desde una sola tienda.",
  ctaPrimario: "Explorar el marketplace",
  ctaSecundario: "Quiero vender",
  puntos: [
    { icono: BadgeCheck, texto: "Proveedores verificados por Zarpi" },
    { icono: Globe2, texto: "Catálogo de varios proveedores en una sola búsqueda" },
  ],
  estadisticas: [
    { valor: "120+", etiqueta: "Proveedores" },
    { valor: "8.500", etiqueta: "Productos" },
    { valor: "24 h", etiqueta: "Respuesta media" },
    { valor: "15", etiqueta: "Categorías" },
  ],
  pasosTitulo: "Del catálogo a tu bodega en cuatro pasos.",
  pasos: [
    { titulo: "Explora", texto: "Busca por categoría, proveedor o referencia y compara precios y mínimos de compra." },
    { titulo: "Elige", texto: "Arma tu pedido con productos de uno o varios proveedores." },
    { titulo: "Compra", texto: "Confirma el pedido con condiciones y tiempos de entrega visibles." },
    { titulo: "Recibe", texto: "Sigue el estado del pedido y califica al proveedor al recibirlo." },
  ],
  valorTitulo: "Pensado para compradores y proveedores.",
  bloques: [
    {
      icono: Store,
      titulo: "Tienda para proveedores",
      texto: "Publica tu catálogo una vez y llega a más compradores.",
      items: ["Perfil de empresa y catálogo propio", "Gestión de pedidos en un panel", "Visibilidad frente a compradores nuevos"],
    },
    {
      icono: Handshake,
      titulo: "Compra con confianza",
      texto: "Información clara antes de comprar.",
      items: ["Precios y mínimos por proveedor", "Calificaciones de otros compradores", "Chat directo con el proveedor"],
    },
    {
      icono: Truck,
      titulo: "Logística visible",
      texto: "Sabe cuándo llega tu pedido.",
      items: ["Tiempos de entrega por producto", "Seguimiento del estado del pedido", "Registro de cada operación"],
    },
  ],
  cierreTitulo: "¿Listo para comprar o vender en el marketplace?",
  cierreTexto: "Usa tu misma cuenta de Zarpi para entrar a todos los productos de la suite.",
};

export function LandingMarketplace(props: Omit<PropsLandingApp, "contenido">) {
  return <LandingApp contenido={CONTENIDO} {...props} />;
}
