import { useCallback, useEffect, useRef, useState } from "react";
import { Award, ExternalLink, Inbox, Info, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  tendenciasService,
  ETIQUETA_PLATAFORMA,
  type ItemAprobacion,
  type MotivoRechazo,
} from "@/services/tendencias.service";

import { CLASE_BOTON_SECUNDARIO, IconoPlataforma, InsigniaOrigen, haceCuanto, mensajeError } from "./AprobacionComun";
import { FichaAprobacion, formularioDesde, type FormularioFicha, type ModoCola } from "./AprobacionFicha";

/**
 * Cola de revisión en tres columnas: enlaces a la izquierda (más antiguos
 * primero), video en el centro y ficha a la derecha. Al resolver uno pasa al
 * siguiente sin recargar.
 */

export function nombreRemitente(item: ItemAprobacion): string {
  return item.remitente?.nombre || item.remitente?.email || "Remitente desconocido";
}

function FilaCola({ item, activo, onClick }: { item: ItemAprobacion; activo: boolean; onClick: () => void }) {
  const r = item.remitente;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo ? "true" : undefined}
      className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
        activo
          ? "border-primary bg-primary/5 ring-1 ring-primary dark:border-accent dark:bg-accent/10 dark:ring-accent"
          : "border-border bg-white hover:bg-muted/40"
      }`}
    >
      <div className="flex items-start gap-2">
        <IconoPlataforma plataforma={item.plataforma} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{item.nombre || ETIQUETA_PLATAFORMA[item.plataforma]}</p>
            <span className="flex-shrink-0 text-[11px] text-muted-foreground">{haceCuanto(item.fecha_envio)}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground" title={r?.email ?? undefined}>{nombreRemitente(item)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {r && <InsigniaOrigen origen={r.rol} />}
            {r?.en_reto && (
              <span className="inline-flex items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <Award className="h-3 w-3" /> En el reto · {r.aprobados_reto ?? 0} aprobados
              </span>
            )}
          </div>
          {item.nota_remitente && <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">“{item.nota_remitente}”</p>}
        </div>
      </div>
    </button>
  );
}

function VideoAprobacion({ item }: { item: ItemAprobacion }) {
  const vertical = item.plataforma !== "youtube";
  return (
    <div className="space-y-3">
      {item.embed_url ? (
        <div className={vertical ? "mx-auto w-full max-w-[340px]" : "w-full"}>
          <div className={`overflow-hidden rounded-xl bg-black ${vertical ? "aspect-[9/16]" : "aspect-video"}`}>
            <iframe
              key={item.id}
              src={item.embed_url}
              title={`Video de ${item.plataforma_nombre}${item.autor_plataforma ? ` de ${item.autor_plataforma}` : ""}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-muted text-center text-sm text-muted-foreground">
          {item.miniatura_plataforma_url && (
            <img src={item.miniatura_plataforma_url} alt="" referrerPolicy="no-referrer" className="max-h-40 rounded-lg object-contain" />
          )}
          <p>No se pudo armar el reproductor. Ábrelo en la plataforma.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <a
          href={item.url_video}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline dark:text-accent"
        >
          Abrir en {item.plataforma_nombre} <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {item.autor_plataforma && <span className="text-xs text-muted-foreground">Autor: {item.autor_plataforma}</span>}
      </div>

      {item.plataforma === "instagram" && !item.tiene_embed_instagram && (
        <p className="flex items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          El reproductor funciona igual, pero aún no se guardó el código de inserción oficial de esta publicación. Puedes pegarlo en el campo de la derecha.
        </p>
      )}

      <div className="rounded-lg border border-border p-3 text-xs">
        <p className="font-medium text-foreground">Enviado por {nombreRemitente(item)}</p>
        {item.remitente?.email && item.remitente.nombre && <p className="text-muted-foreground">{item.remitente.email}</p>}
        <p className="text-muted-foreground">{new Date(item.fecha_envio).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</p>
        {item.nota_remitente && <p className="mt-2 whitespace-pre-line text-foreground">“{item.nota_remitente}”</p>}
      </div>
    </div>
  );
}

export function ColaAprobacion({
  modo,
  esAdmin = false,
  motivos,
  onRevisado,
}: {
  modo: ModoCola;
  esAdmin?: boolean;
  motivos: { valor: MotivoRechazo; texto: string }[];
  /** Tras aprobar o rechazar: el panel refresca contadores. */
  onRevisado: () => void;
}) {
  const [items, setItems] = useState<ItemAprobacion[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const borradores = useRef(new Map<string, FormularioFicha>());

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const lista = await tendenciasService.cola(modo);
      const ordenada = [...lista].sort((a, b) => a.fecha_envio.localeCompare(b.fecha_envio));
      setItems(ordenada);
      setSeleccionado((actual) => (actual && ordenada.some((i) => i.id === actual) ? actual : ordenada[0]?.id ?? null));
    } catch (e) {
      setError(mensajeError(e, "No se pudo cargar la cola."));
    } finally {
      setCargando(false);
    }
  }, [modo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resuelto = (resultado: ItemAprobacion, mensaje: string) => {
    toast.success(mensaje);
    borradores.current.delete(resultado.id);
    const idx = items.findIndex((i) => i.id === resultado.id);
    // El avance en el reto de quien lo envió cambia al aprobar: se refleja en sus otros envíos.
    const { id: remitenteId, aprobados_reto } = resultado.remitente;
    const quedan = items
      .filter((i) => i.id !== resultado.id)
      .map((i) => (remitenteId && i.remitente.id === remitenteId ? { ...i, remitente: { ...i.remitente, aprobados_reto } } : i));
    const siguiente = quedan[idx] ?? quedan[idx - 1] ?? null;
    setItems(quedan);
    setSeleccionado(siguiente?.id ?? null);
    onRevisado();
  };

  const actual = items.find((i) => i.id === seleccionado) ?? null;

  if (cargando && items.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white p-10 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando la cola…
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
        {error}{" "}
        <button type="button" onClick={() => void cargar()} className="font-medium underline">Reintentar</button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-10 text-center shadow-sm">
        <Inbox className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">{modo === "pendiente" ? "No hay enlaces por revisar" : "No hay productos esperando diseño"}</p>
        <button type="button" onClick={() => void cargar()} className={`${CLASE_BOTON_SECUNDARIO} mt-1`}>
          <RefreshCw className="h-3.5 w-3.5" /> Buscar nuevos
        </button>
      </div>
    );
  }

  return (
    // Tres columnas solo con pantalla ancha; antes, el video va encima del formulario
    // para que no quede aplastado entre la cola y la ficha.
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)_minmax(320px,400px)]">
      <section className="rounded-xl border border-border bg-white p-3 shadow-sm lg:row-span-2 lg:self-start 2xl:row-span-1">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">
            {modo === "pendiente" ? "En cola" : "En diseño"} <span className="font-normal text-muted-foreground">({items.length})</span>
          </p>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={cargando}
            aria-label="Actualizar la cola"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-260px)]">
          {items.map((item) => (
            <FilaCola key={item.id} item={item} activo={item.id === seleccionado} onClick={() => setSeleccionado(item.id)} />
          ))}
        </div>
      </section>

      {actual && (
        <>
          <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <VideoAprobacion item={actual} />
          </section>
          <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <FichaAprobacion
              key={actual.id}
              item={actual}
              modo={modo}
              inicial={borradores.current.get(actual.id) ?? formularioDesde(actual)}
              motivos={motivos}
              onCambio={(f) => borradores.current.set(actual.id, f)}
              onResuelto={resuelto}
              esAdmin={esAdmin}
            />
          </section>
        </>
      )}
    </div>
  );
}
