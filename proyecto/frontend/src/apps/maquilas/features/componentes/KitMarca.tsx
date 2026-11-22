import { Palette } from "lucide-react";

import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { useMarcas } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import type { ArchivoMaquila, ColorMarca } from "@apps/maquilas/features/tipos";

/** Muestras de color de una paleta, con su código para copiarlo a mano. */
export function Paleta({ colores, tamano = "md" }: { colores: ColorMarca[]; tamano?: "sm" | "md" }) {
  if (!colores.length) return null;
  const lado = tamano === "sm" ? "h-5 w-5" : "h-10 w-10";
  return (
    <ul className="flex flex-wrap gap-3">
      {colores.map((c) => (
        <li key={`${c.hex}-${c.nombre}`} className="flex items-center gap-2">
          <span className={`${lado} rounded-lg border border-border`} style={{ backgroundColor: c.hex }} aria-hidden="true" />
          {tamano === "md" && (
            <span className="text-xs"><span className="block font-medium">{c.nombre || "Color"}</span><span className="text-muted-foreground">{c.hex}</span></span>
          )}
          {tamano === "sm" && <span className="sr-only">{c.nombre || c.hex}</span>}
        </li>
      ))}
    </ul>
  );
}

/** El kit de una marca como lo ve quien fabrica o diseña: logo, colores, letras y archivos. */
export function KitMarca({ marca }: {
  marca: { nombre?: string; eslogan?: string; logo: ArchivoMaquila | null; paleta: ColorMarca[]; tipografias: string[]; archivos?: ArchivoMaquila[] };
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          {marca.logo ? <ImagenArchivo src={marca.logo.url} alt={`Logo de ${marca.nombre ?? "la marca"}`} className="absolute inset-0 h-full w-full object-contain" />
            : <Palette className="m-auto mt-4 h-6 w-6 text-muted-foreground" aria-hidden="true" />}
        </div>
        <div>
          <p className="font-semibold">{marca.nombre}</p>
          {marca.eslogan && <p className="text-sm text-muted-foreground">{marca.eslogan}</p>}
        </div>
      </div>
      <Paleta colores={marca.paleta} />
      {marca.tipografias.length > 0 && <p className="text-sm"><span className="text-muted-foreground">Tipografías:</span> {marca.tipografias.join(" · ")}</p>}
      {!!marca.archivos?.length && <ArchivosVista archivos={marca.archivos} tamano="sm" />}
    </div>
  );
}

/** Selector «Con mi marca» para adjuntar el kit a una solicitud. No se muestra si no hay marcas. */
export function SelectorMarca({ valor, onCambiar }: { valor: string; onCambiar: (id: string) => void }) {
  const { data } = useMarcas();
  if (!data?.length) return null;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">Con mi marca (opcional)</span>
      <select value={valor} onChange={(e) => onCambiar(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
        <option value="">Sin adjuntar marca</option>
        {data.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      <span className="text-xs text-muted-foreground">La maquila recibe tu logo, colores, tipografías y archivos de marca.</span>
    </label>
  );
}
