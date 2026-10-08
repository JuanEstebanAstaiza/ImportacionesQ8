import { useState, type JSX } from "react";
import { BarChart3, Newspaper, Package, ShieldCheck } from "lucide-react";

import { CuradorAdmin } from "./CuradorAdmin";
import { CuradorEdiciones } from "./CuradorEdiciones";
import { CuradorMetricas } from "./CuradorMetricas";
import { CuradorProductos } from "./CuradorProductos";

type Pestana = "ediciones" | "productos" | "metricas" | "admin";

/**
 * Panel del curador de Tendencias semanales (especificación, sección 07):
 * ediciones con portada y vista previa móvil, catálogo de productos con
 * cálculo de fechas en vivo, métricas y, para el admin, accesos y parámetros.
 */
export function PanelCurador({ esAdmin }: { esAdmin: boolean }): JSX.Element {
  const [pestana, setPestana] = useState<Pestana>("ediciones");

  const pestanas: { clave: Pestana; titulo: string; icono: typeof Newspaper }[] = [
    { clave: "ediciones", titulo: "Ediciones", icono: Newspaper },
    { clave: "productos", titulo: "Productos", icono: Package },
    { clave: "metricas", titulo: "Métricas", icono: BarChart3 },
    ...(esAdmin ? [{ clave: "admin" as const, titulo: "Administración", icono: ShieldCheck }] : []),
  ];
  const activa = pestana === "admin" && !esAdmin ? "ediciones" : pestana;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Curaduría de Tendencias</h1>
        <p className="text-sm text-muted-foreground">Prepara y programa la edición semanal. Sin precios: el comprador pide propuestas.</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Secciones del panel">
        {pestanas.map(({ clave, titulo, icono: Icono }) => (
          <button
            key={clave}
            type="button"
            onClick={() => setPestana(clave)}
            aria-current={activa === clave ? "page" : undefined}
            className={`-mb-px inline-flex flex-shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activa === clave
                ? "border-primary text-primary dark:border-accent dark:text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icono className="h-4 w-4" />
            {titulo}
          </button>
        ))}
      </nav>
      {activa === "ediciones" && <CuradorEdiciones esAdmin={esAdmin} />}
      {activa === "productos" && <CuradorProductos />}
      {activa === "metricas" && <CuradorMetricas />}
      {activa === "admin" && esAdmin && <CuradorAdmin />}
    </div>
  );
}
