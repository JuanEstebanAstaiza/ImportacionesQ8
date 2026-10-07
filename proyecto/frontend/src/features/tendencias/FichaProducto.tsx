import { useEffect, useState, type ReactNode } from "react";
import {
  Bookmark,
  CalendarClock,
  ClipboardList,
  Factory,
  FlaskConical,
  ImageOff,
  Maximize2,
  Megaphone,
  Plane,
  Ship,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { abrirArchivoEnPestana } from "@/lib/abrir-archivo";
import {
  tendenciasService,
  type ModoTransporte,
  type ProductoTendencia,
} from "@/services/tendencias.service";
import type { PrefillSolicitud } from "@/features/tendencias/prefill";
import { fechaCorta, fechaLarga, fechaLocal } from "@/features/tendencias/formato";
import { EstadoChip, EtiquetaRequisitos, PieInformativo } from "@/features/tendencias/ui";

/** Lo que se lleva al formulario de solicitud al pulsar «Pedir propuestas». */
export function prefillDe(producto: ProductoTendencia, edicionId: string | null): PrefillSolicitud {
  return {
    origen: "tendencias",
    nombre: producto.nombre,
    descripcion: producto.que_pedir_en_cotizacion || producto.por_que_ahora,
    lineaProducto: producto.linea_producto,
    pais: producto.pais_origen,
    fotos: producto.fotos,
    revisarRequisitos: producto.revisar_requisitos,
    tendenciaEdicionId: edicionId,
    tendenciaProductoId: producto.id,
  };
}

type FichaProductoProps = {
  producto: ProductoTendencia;
  /** Edición desde la que se abrió; null para un guardado sin edición. */
  edicionId: string | null;
  /** Hoy en Bogotá ("YYYY-MM-DD"), como lo calcula el backend. */
  hoy: string;
  guardado: boolean;
  onAlternarGuardado: () => void;
  onPedirPropuestas: () => void;
  onCerrar: () => void;
};

type Hito = { clave: string; etiqueta: string; fecha: string; resalte?: boolean };

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Galeria({ producto }: { producto: ProductoTendencia }) {
  const [indice, setIndice] = useState(0);
  const fotos = producto.fotos.slice(0, 5);
  const actual = fotos[Math.min(indice, fotos.length - 1)];

  if (!actual) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-muted text-muted-foreground sm:aspect-[4/3]">
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }

  const ampliar = async () => {
    const resultado = await abrirArchivoEnPestana(actual, producto.nombre);
    if (!resultado.ok) toast.error(resultado.motivo || "No se pudo abrir la foto.");
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={ampliar}
        title="Ver foto en tamaño completo"
        className="group relative block w-full overflow-hidden rounded-xl bg-muted"
      >
        <ImagenArchivo src={actual} alt={producto.nombre} className="aspect-square w-full sm:aspect-[4/3]" />
        <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-80 group-hover:opacity-100">
          <Maximize2 className="h-4 w-4" />
        </span>
      </button>
      {fotos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {fotos.map((foto, i) => (
            <button
              key={`${foto}-${i}`}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Foto ${i + 1}`}
              aria-current={i === indice}
              className={`shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === indice ? "border-primary dark:border-accent" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <ImagenArchivo src={foto} alt={`${producto.nombre} ${i + 1}`} className="h-14 w-14" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Línea de tiempo simple: hoy → fecha límite → en bodega → temporada, en orden de fecha. */
function LineaTiempo({ hitos, hoy }: { hitos: Hito[]; hoy: string }) {
  const ordenados = [...hitos].sort((a, b) => (fechaLocal(a.fecha)?.getTime() ?? 0) - (fechaLocal(b.fecha)?.getTime() ?? 0));
  const hoyFecha = fechaLocal(hoy)?.getTime() ?? 0;
  return (
    <ol className="relative grid gap-1" style={{ gridTemplateColumns: `repeat(${ordenados.length}, minmax(0, 1fr))` }}>
      <span aria-hidden className="absolute top-[7px] h-0.5 bg-border" style={{ left: `${50 / ordenados.length}%`, right: `${50 / ordenados.length}%` }} />
      {ordenados.map((hito) => {
        const pasado = hito.clave !== "hoy" && (fechaLocal(hito.fecha)?.getTime() ?? 0) < hoyFecha;
        const punto =
          hito.clave === "hoy"
            ? "bg-foreground"
            : hito.resalte
              ? "bg-primary ring-4 ring-primary/20 dark:bg-accent dark:ring-accent/25"
              : "bg-white border-2 border-muted-foreground";
        return (
          <li key={hito.clave} className="relative flex min-w-0 flex-col items-center text-center">
            <span className={`relative z-10 h-4 w-4 rounded-full ${punto}`} />
            <span className={`mt-2 text-[11px] font-semibold leading-tight ${pasado ? "text-muted-foreground line-through" : ""}`}>
              {hito.etiqueta}
            </span>
            <span className="text-[11px] text-muted-foreground">{hito.clave === "hoy" ? fechaCorta(hito.fecha) : `~ ${fechaCorta(hito.fecha)}`}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Seccion({ icono: Icono, titulo, children }: { icono: typeof Ship; titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-5">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em]">
        <Icono className="h-4 w-4 text-primary dark:text-accent" />
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export function FichaProducto({
  producto,
  edicionId,
  hoy,
  guardado,
  onAlternarGuardado,
  onPedirPropuestas,
  onCerrar,
}: FichaProductoProps) {
  const [modo, setModo] = useState<ModoTransporte>(producto.transporte_sugerido || "mar");
  const hoyIso = hoy || hoyLocal();
  const { fechas } = producto;

  useEffect(() => {
    setModo(producto.transporte_sugerido || "mar");
    tendenciasService.registrarEvento("producto_visto", {
      producto_id: producto.id,
      ...(edicionId ? { edicion_id: edicionId } : {}),
    });
  }, [producto.id, edicionId]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  const cambiarModo = (nuevo: ModoTransporte) => {
    if (nuevo === modo) return;
    setModo(nuevo);
    tendenciasService.registrarEvento("modo_cambiado", {
      modo: nuevo,
      producto_id: producto.id,
      ...(edicionId ? { edicion_id: edicionId } : {}),
    });
  };

  const limite = modo === "mar" ? fechas.limite_mar : fechas.limite_aereo;
  const texto = modo === "mar" ? fechas.texto_mar : fechas.texto_aereo;
  const limitePasado = !!limite && (fechaLocal(limite.fecha)?.getTime() ?? 0) < (fechaLocal(hoyIso)?.getTime() ?? 0);

  const hitos: Hito[] = [{ clave: "hoy", etiqueta: "Hoy", fecha: hoyIso }];
  if (limite) hitos.push({ clave: "limite", etiqueta: "Fecha límite", fecha: limite.fecha, resalte: true });
  if (fechas.fecha_en_bodega) hitos.push({ clave: "bodega", etiqueta: "En bodega", fecha: fechas.fecha_en_bodega });
  if (producto.temporada) hitos.push({ clave: "temporada", etiqueta: producto.temporada.nombre, fecha: producto.temporada.fecha });

  const tieneGuia = !!(producto.guia_para_quien || producto.guia_angulos?.length || producto.guia_donde || producto.guia_contenido);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={producto.nombre}>
      <button type="button" aria-label="Cerrar ficha" onClick={onCerrar} className="absolute inset-0 cursor-default bg-black/60" />
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:max-w-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Tendencias · Ficha de producto
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onAlternarGuardado}
              aria-pressed={guardado}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                guardado ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${guardado ? "fill-current" : ""}`} />
              {guardado ? "Guardado" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          <Galeria producto={producto} />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{producto.categoria_visible}</p>
            <h2 className="text-2xl font-bold leading-tight tracking-tight">{producto.nombre}</h2>
            <div className="flex flex-wrap gap-1.5">
              <EstadoChip fechas={fechas} />
              {producto.revisar_requisitos && <EtiquetaRequisitos />}
            </div>
            <p className="pt-1 text-sm leading-relaxed">{producto.por_que_ahora}</p>
          </div>

          {producto.revisar_requisitos && (
            <div className="flex gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Este producto puede requerir permisos o registros (INVIMA, ICA, etiquetado). Revísalo con la nacionalizadora.</p>
            </div>
          )}

          <Seccion icono={CalendarClock} titulo="Cuándo pedirlo">
            {fechas.estado === "todo_el_anio" || !fechas.limite_mar ? (
              <p className="text-sm text-muted-foreground">
                No depende de una temporada: lo puedes pedir en cualquier momento del año. El tiempo real de llegada lo da cada nacionalizadora en su propuesta.
              </p>
            ) : (
              <>
                <div role="radiogroup" aria-label="Modo de transporte" className="inline-flex rounded-lg bg-muted p-1">
                  {([
                    { clave: "mar", etiqueta: "Por mar", icono: Ship },
                    { clave: "aereo", etiqueta: "Aéreo", icono: Plane },
                  ] as const).map(({ clave, etiqueta, icono: Icono }) => (
                    <button
                      key={clave}
                      type="button"
                      role="radio"
                      aria-checked={modo === clave}
                      onClick={() => cambiarModo(clave)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
                        modo === clave ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icono className="h-3.5 w-3.5" />
                      {etiqueta}
                      {producto.transporte_sugerido === clave && <span className="font-normal opacity-70">· sugerido</span>}
                    </button>
                  ))}
                </div>
                {texto && <p className="text-base font-semibold">{texto}</p>}
                {limitePasado && (
                  <p className="text-sm text-muted-foreground">
                    {modo === "mar"
                      ? "La fecha estimada por mar ya pasó. Revisa la opción aérea."
                      : "La fecha estimada ya pasó para esta temporada."}
                  </p>
                )}
                <div className="rounded-xl border border-border p-4">
                  <LineaTiempo hitos={hitos} hoy={hoyIso} />
                </div>
                {limite?.aviso_cierre_fabricas && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Factory className="mt-0.5 h-4 w-4 shrink-0" />
                    La fecha se adelantó por el cierre de fábricas del Año Nuevo chino.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Son fechas estimadas
                  {fechas.fecha_en_bodega ? `, para tenerlo en tu bodega hacia el ${fechaLarga(fechas.fecha_en_bodega)}` : ""}.
                  El tiempo real lo da cada nacionalizadora en su propuesta.
                </p>
              </>
            )}
          </Seccion>

          {tieneGuia && (
            <Seccion icono={Megaphone} titulo="Cómo venderlo">
              <dl className="space-y-3 text-sm">
                {producto.guia_para_quien && (
                  <div>
                    <dt className="font-semibold">Para quién</dt>
                    <dd className="mt-0.5 leading-relaxed text-muted-foreground">{producto.guia_para_quien}</dd>
                  </div>
                )}
                {producto.guia_angulos?.length > 0 && (
                  <div>
                    <dt className="font-semibold">Ángulos de venta</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {producto.guia_angulos.slice(0, 3).map((angulo) => (
                        <span key={angulo} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                          {angulo}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {producto.guia_donde && (
                  <div>
                    <dt className="font-semibold">Dónde venderlo</dt>
                    <dd className="mt-0.5 leading-relaxed text-muted-foreground">{producto.guia_donde}</dd>
                  </div>
                )}
                {producto.guia_contenido && (
                  <div>
                    <dt className="font-semibold">Ideas de contenido</dt>
                    <dd className="mt-0.5 leading-relaxed text-muted-foreground">{producto.guia_contenido}</dd>
                  </div>
                )}
              </dl>
            </Seccion>
          )}

          {producto.que_pedir_en_cotizacion && (
            <Seccion icono={ClipboardList} titulo="Qué pedir en la cotización">
              <p className="whitespace-pre-line text-sm leading-relaxed">{producto.que_pedir_en_cotizacion}</p>
              <p className="text-xs text-muted-foreground">Este texto se copia a tu solicitud al pedir propuestas; lo puedes ajustar.</p>
            </Seccion>
          )}

          <section aria-disabled className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-4 opacity-80">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                Valídalo antes de importar
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Próximamente</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Una página de prueba para medir el interés de tus clientes antes de hacer el pedido.</p>
            </div>
          </section>

          <PieInformativo />
        </div>

        <footer className="border-t border-border bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onPedirPropuestas}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#EDF953] text-sm font-bold text-[#16151B] transition-opacity hover:opacity-90"
          >
            Pedir propuestas
          </button>
        </footer>
      </div>
    </div>
  );
}
