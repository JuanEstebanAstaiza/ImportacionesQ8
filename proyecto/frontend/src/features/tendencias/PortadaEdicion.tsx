import type { CSSProperties } from "react";

import { PRESETS, type PresetEstilo } from "@/services/tendencias.service";

/**
 * Portada de una edición de Tendencias con uno de los cuatro presets de la
 * especificación (sección 06). No hay editor libre de colores: el curador
 * elige un preset y la marca no se rompe.
 *
 * Las manchas son tres formas desenfocadas en posiciones fijas por preset,
 * como en la home de zarpi.co.
 */

type PortadaEdicionProps = {
  preset: PresetEstilo;
  numero?: number | null;
  semanaInicio?: string | null;
  tituloLinea1: string;
  tituloLinea2: string;
  subtitulo: string;
  /** Más baja, para la vista previa del curador y las tarjetas del archivo. */
  compacta?: boolean;
  className?: string;
};

const POSICIONES_MANCHAS: Record<PresetEstilo, [CSSProperties, CSSProperties, CSSProperties]> = {
  lavanda: [
    { top: "-30%", right: "-10%", width: "55%", height: "120%" },
    { bottom: "-40%", left: "20%", width: "35%", height: "80%" },
    { top: "10%", left: "-15%", width: "30%", height: "70%" },
  ],
  violeta: [
    { top: "-35%", left: "-10%", width: "50%", height: "110%" },
    { bottom: "-45%", right: "5%", width: "40%", height: "90%" },
    { top: "20%", right: "-15%", width: "30%", height: "80%" },
  ],
  amarillo: [
    { bottom: "-40%", right: "-5%", width: "50%", height: "110%" },
    { top: "-30%", left: "35%", width: "30%", height: "70%" },
    { top: "5%", left: "-15%", width: "35%", height: "90%" },
  ],
  noche: [
    { top: "-30%", right: "10%", width: "45%", height: "110%" },
    { bottom: "-50%", left: "-5%", width: "40%", height: "90%" },
    { top: "15%", right: "-20%", width: "30%", height: "70%" },
  ],
};

function semanaDe(fecha?: string | null): string {
  if (!fecha) return "";
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

export function PortadaEdicion({
  preset,
  numero,
  semanaInicio,
  tituloLinea1,
  tituloLinea2,
  subtitulo,
  compacta = false,
  className = "",
}: PortadaEdicionProps) {
  const paleta = PRESETS[preset] ?? PRESETS.lavanda;
  const posiciones = POSICIONES_MANCHAS[preset] ?? POSICIONES_MANCHAS.lavanda;
  const semana = semanaDe(semanaInicio);

  return (
    <section
      className={`relative overflow-hidden rounded-2xl ${compacta ? "px-5 py-6" : "px-6 py-10 sm:px-10 sm:py-14"} ${className}`}
      style={{ backgroundColor: paleta.fondo, color: paleta.texto }}
    >
      {paleta.manchas.map((color, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-full opacity-60"
          style={{ ...posiciones[i], backgroundColor: color, filter: compacta ? "blur(28px)" : "blur(56px)" }}
        />
      ))}
      <div className="relative">
        <p className={`font-semibold uppercase tracking-[0.18em] ${compacta ? "text-[10px]" : "text-xs"}`} style={{ opacity: 0.8 }}>
          Tendencias{numero ? ` · Edición ${numero}` : ""}{semana ? ` · Semana del ${semana}` : ""}
        </p>
        <h1 className={`mt-3 font-bold leading-[1.05] tracking-tight ${compacta ? "text-2xl" : "text-4xl sm:text-5xl"}`}>
          <span className="block">{tituloLinea1 || "Título"}</span>
          <span className="block" style={{ color: paleta.acento }}>{tituloLinea2 || "segunda línea"}</span>
        </h1>
        <p className={`mt-3 max-w-xl ${compacta ? "text-xs" : "text-base sm:text-lg"}`} style={{ opacity: 0.85 }}>
          {subtitulo}
        </p>
      </div>
    </section>
  );
}
