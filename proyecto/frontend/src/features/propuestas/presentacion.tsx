import { clsx } from "clsx";
import type { BackendPropuesta } from "@/services/business.service";
import { leerPropuesta, pesos as pesosCop } from "@/features/propuestas/calculo";
import type { MotivoEleccion } from "@/services/business.service";

export function leerCondicionesPropuesta(texto: string | null | undefined): { descripcion: string; ventajas: string; detalles: string[] } {
  const vacio = { descripcion: "", ventajas: "", detalles: [] as string[] };
  if (!texto) return vacio;
  const nueva = leerPropuesta(texto);
  if (nueva) {
    const f = nueva.formulario;
    const detalles = [
      f.entrega_modo === "cliente" ? `Puesto en ${f.bodega_ciudad}; flete a ${f.ciudad_destino} a cargo del cliente` : `Entregado en ${f.ciudad_destino}`,
      f.requiere_permisos && f.permiso_cual ? `${f.permiso_cual} (${f.permiso_gestiona === "importadora" ? "incluido" : "lo gestiona el cliente"})` : "",
      `Válida hasta ${new Date(`${nueva.vigencia_hasta}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}`,
    ].filter(Boolean);
    return { descripcion: f.nota || "", ventajas: "", detalles };
  }
  try {
    const datos = JSON.parse(texto) as Record<string, unknown>;
    if (datos && datos.schema === "create-response-v1") {
      const campo = (clave: string) => typeof datos[clave] === "string" ? String(datos[clave]).trim() : "";
      return {
        descripcion: campo("description"),
        ventajas: campo("advantages"),
        detalles: [campo("moq") && `MOQ ${campo("moq")}`, campo("port") && `Puerto ${campo("port")}`, campo("productionTime") && `Producción ${campo("productionTime")}`, campo("shippingTime") && `Envío ${campo("shippingTime")}`].filter(Boolean) as string[],
      };
    }
  } catch {
    // El texto puede ser una observación libre.
  }
  return { ...vacio, descripcion: texto };
}

export function PrecioPropuesta({ propuesta, trm, tamano = "sm" }: { propuesta: BackendPropuesta; trm?: number | null; tamano?: "sm" | "base" }) {
  const nueva = leerPropuesta(propuesta.condiciones_adicionales);
  const clase = clsx("font-semibold", tamano === "base" ? "text-base" : "text-sm");
  if (nueva) return <><p className={clase}>{pesosCop(nueva.totales.total_cop)}</p><p className="text-[11px] text-muted-foreground">con IVA · {pesosCop(nueva.totales.unitario_cop)} por unidad</p></>;
  const precio = `$${Math.round(propuesta.precio_ofrecido_usd * (trm || 1)).toLocaleString("es-CO")} COP`;
  return <><p className={clase}>US${propuesta.precio_ofrecido_usd.toLocaleString("es-CO")}</p>{trm ? <p className="text-[11px] text-muted-foreground">≈ {precio}</p> : null}</>;
}

export type { MotivoEleccion };
