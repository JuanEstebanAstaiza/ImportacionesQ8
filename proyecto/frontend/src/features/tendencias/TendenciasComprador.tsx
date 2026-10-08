import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import {
  ArchiveRestore,
  Bell,
  BellOff,
  Bookmark,
  CalendarRange,
  ChevronLeft,
  ImageOff,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import {
  tendenciasService,
  type AccesoTendencias,
  type EdicionActual,
  type EdicionCompleta,
  type PortadaEdicion as PortadaEdicionDatos,
  type ProductoGuardado,
  type ProductoTendencia,
} from "@/services/tendencias.service";
import type { PrefillSolicitud } from "@/features/tendencias/prefill";
import { PortadaEdicion } from "@/features/tendencias/PortadaEdicion";
import { CalendarioPedidos } from "@/features/tendencias/CalendarioPedidos";
import { FichaProducto, prefillDe } from "@/features/tendencias/FichaProducto";
import { Paywall } from "@/features/tendencias/Paywall";
import { VistaEdicion } from "@/features/tendencias/VistaEdicion";
import { fechaInstante, fechaLarga, mensajeError } from "@/features/tendencias/formato";
import { Cargando, ErrorCarga, EstadoChip, EtiquetaRequisitos, PieInformativo } from "@/features/tendencias/ui";

/**
 * Tendencias semanales para el comprador (especificación, secciones 01, 05,
 * 07, 09 y 10). El acceso es privado: suscripción pagada o cortesía del equipo
 * de Zarpi; sin acceso se muestra el muro con la portada como adelanto.
 *
 * Solo el contenido de la página: App.tsx la envuelve en el layout.
 */

type Vista = "semana" | "calendario" | "guardados" | "archivo";

const VISTAS: { clave: Vista; etiqueta: string; icono: typeof Sparkles }[] = [
  { clave: "semana", etiqueta: "Esta semana", icono: Sparkles },
  { clave: "calendario", etiqueta: "Calendario", icono: CalendarRange },
  { clave: "guardados", etiqueta: "Guardados", icono: Bookmark },
  { clave: "archivo", etiqueta: "Ediciones anteriores", icono: ArchiveRestore },
];

type FichaAbierta = { producto: ProductoTendencia; edicionId: string | null };

type TendenciasCompradorProps = {
  onPedirPropuestas: (p: PrefillSolicitud) => void;
  /** Edición del enlace del correo semanal (?edicion=...). */
  edicionInicialId?: string | null;
  /** Se abrió desde el correo (?src=aviso). */
  desdeAviso?: boolean;
};

// ── Guardados ────────────────────────────────────────────────────────────────

function ListaGuardados({ estaGuardado, onAbrir, onQuitar }: {
  estaGuardado: (p: ProductoTendencia) => boolean;
  onAbrir: (p: ProductoGuardado) => void;
  onQuitar: (p: ProductoGuardado) => void;
}) {
  const [items, setItems] = useState<ProductoGuardado[] | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setError("");
    setItems(null);
    try {
      setItems(await tendenciasService.getGuardados());
    } catch (e) {
      setError(mensajeError(e, "No pudimos cargar tus guardados."));
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <ErrorCarga mensaje={error} onReintentar={cargar} />;
  if (!items) return <Cargando texto="Cargando tus guardados..." />;

  const visibles = items.filter((p) => estaGuardado(p));

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-bold tracking-tight">Guardados</h2>
        <p className="text-sm text-muted-foreground">Los productos que marcaste, con su estado de hoy.</p>
        {visibles.length === 0 ? (
          <p className="mt-4 rounded-lg bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
            Todavía no guardas productos. Usa el marcador de cada tarjeta para tenerlos a la mano.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {visibles.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <button type="button" onClick={() => onAbrir(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {p.fotos[0] ? (
                    <ImagenArchivo src={p.fotos[0]} alt={p.nombre} className="h-14 w-14 shrink-0 rounded-lg" />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <ImageOff className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold hover:underline">{p.nombre}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.categoria_visible}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <EstadoChip fechas={p.fechas} />
                      {p.revisar_requisitos && <EtiquetaRequisitos />}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuitar(p)}
                  aria-label={`Quitar ${p.nombre} de guardados`}
                  title="Quitar de guardados"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <PieInformativo />
    </div>
  );
}

// ── Ediciones anteriores ─────────────────────────────────────────────────────

function ListaArchivo({ edicionActualId, onAbrir }: {
  edicionActualId: string | null;
  onAbrir: (id: string) => void;
}) {
  const [ediciones, setEdiciones] = useState<PortadaEdicionDatos[] | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setError("");
    setEdiciones(null);
    try {
      setEdiciones(await tendenciasService.getArchivo());
    } catch (e) {
      setError(mensajeError(e, "No pudimos cargar las ediciones anteriores."));
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <ErrorCarga mensaje={error} onReintentar={cargar} />;
  if (!ediciones) return <Cargando texto="Cargando ediciones..." />;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-bold tracking-tight">Ediciones anteriores</h2>
        <p className="text-sm text-muted-foreground">Todas las ediciones publicadas, de la más reciente a la más antigua. Son de solo lectura.</p>
        {ediciones.length === 0 ? (
          <p className="mt-4 rounded-lg bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">Todavía no hay ediciones publicadas.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {ediciones.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(e.id)}
                  className="block w-full rounded-2xl text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <PortadaEdicion
                    compacta
                    preset={e.preset_estilo}
                    numero={e.numero}
                    semanaInicio={e.semana_inicio}
                    tituloLinea1={e.titulo_linea1}
                    tituloLinea2={e.titulo_linea2}
                    subtitulo={e.subtitulo}
                  />
                </button>
                {e.id === edicionActualId && (
                  <p className="mt-1.5 text-xs font-semibold text-primary dark:text-accent">Edición de esta semana</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <PieInformativo />
    </div>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export function TendenciasComprador({ onPedirPropuestas, edicionInicialId = null, desdeAviso = false }: TendenciasCompradorProps) {
  const [acceso, setAcceso] = useState<AccesoTendencias | null>(null);
  const [errorAcceso, setErrorAcceso] = useState("");

  const [vista, setVista] = useState<Vista>("semana");
  const [actual, setActual] = useState<EdicionActual | null>(null);
  const [errorActual, setErrorActual] = useState("");

  // Edición anterior abierta desde el archivo (o desde el enlace del correo).
  const [archivoId, setArchivoId] = useState<string | null>(null);
  const [edicionArchivo, setEdicionArchivo] = useState<EdicionCompleta | null>(null);
  const [errorArchivo, setErrorArchivo] = useState("");

  const [ficha, setFicha] = useState<FichaAbierta | null>(null);
  // Cambios de guardado hechos en esta pantalla, por encima de lo que trajo el backend.
  const [guardadoLocal, setGuardadoLocal] = useState<Record<string, boolean>>({});
  const [avisoSuscrito, setAvisoSuscrito] = useState(false);
  const [cambiandoAviso, setCambiandoAviso] = useState(false);

  const edicionesVistas = useRef(new Set<string>());
  const avisoRegistrado = useRef(false);
  const inicialAplicada = useRef(false);

  const cargarAcceso = useCallback(async () => {
    setErrorAcceso("");
    try {
      const respuesta = await tendenciasService.getAcceso();
      setAcceso(respuesta);
      setAvisoSuscrito(respuesta.aviso_suscrito);
    } catch (e) {
      setErrorAcceso(mensajeError(e, "No pudimos comprobar tu acceso a Tendencias."));
    }
  }, []);

  const cargarActual = useCallback(async () => {
    setErrorActual("");
    try {
      setActual(await tendenciasService.getEdicionActual());
    } catch (e) {
      setErrorActual(mensajeError(e, "No pudimos cargar la edición de esta semana."));
    }
  }, []);

  useEffect(() => { cargarAcceso(); }, [cargarAcceso]);

  const tieneAcceso = !!acceso?.tiene_acceso;

  useEffect(() => {
    if (!tieneAcceso) return;
    cargarActual();
    if (desdeAviso && !avisoRegistrado.current) {
      avisoRegistrado.current = true;
      tendenciasService.registrarEvento("aviso_abierto", edicionInicialId ? { edicion_id: edicionInicialId } : {});
    }
  }, [tieneAcceso, cargarActual, desdeAviso, edicionInicialId]);

  // El enlace del correo puede apuntar a una edición que ya no es la actual.
  useEffect(() => {
    if (!actual || inicialAplicada.current) return;
    inicialAplicada.current = true;
    if (edicionInicialId && edicionInicialId !== actual.edicion?.id) {
      setVista("archivo");
      setArchivoId(edicionInicialId);
    }
  }, [actual, edicionInicialId]);

  const registrarEdicionVista = useCallback((id: string) => {
    if (edicionesVistas.current.has(id)) return;
    edicionesVistas.current.add(id);
    tendenciasService.registrarEvento("edicion_vista", { edicion_id: id });
  }, []);

  useEffect(() => {
    if (vista === "semana" && actual?.edicion) registrarEdicionVista(actual.edicion.id);
  }, [vista, actual, registrarEdicionVista]);

  const cargarArchivo = useCallback(async (id: string) => {
    setEdicionArchivo(null);
    setErrorArchivo("");
    try {
      const edicion = await tendenciasService.getEdicion(id);
      setEdicionArchivo(edicion);
      registrarEdicionVista(edicion.id);
    } catch (e) {
      setErrorArchivo(mensajeError(e, "No pudimos abrir esa edición."));
    }
  }, [registrarEdicionVista]);

  useEffect(() => {
    if (archivoId) cargarArchivo(archivoId);
    else setEdicionArchivo(null);
  }, [archivoId, cargarArchivo]);

  const estaGuardado = useCallback(
    (p: ProductoTendencia) => guardadoLocal[p.id] ?? p.guardado,
    [guardadoLocal],
  );

  const alternarGuardado = async (p: ProductoTendencia, edicionId: string | null) => {
    const nuevo = !estaGuardado(p);
    setGuardadoLocal((prev) => ({ ...prev, [p.id]: nuevo }));
    try {
      if (nuevo) await tendenciasService.guardar(p.id, edicionId);
      else await tendenciasService.quitarGuardado(p.id);
      toast.success(nuevo ? "Guardado en tus productos." : "Quitado de guardados.");
    } catch (e) {
      setGuardadoLocal((prev) => ({ ...prev, [p.id]: !nuevo }));
      toast.error(mensajeError(e, "No se pudo actualizar el guardado."));
    }
  };

  const pedirPropuestas = (p: ProductoTendencia, edicionId: string | null) => {
    tendenciasService.registrarEvento("pedir_propuestas_clic", {
      producto_id: p.id,
      ...(edicionId ? { edicion_id: edicionId } : {}),
    });
    setFicha(null);
    onPedirPropuestas(prefillDe(p, edicionId));
  };

  const alternarAviso = async () => {
    const nuevo = !avisoSuscrito;
    setCambiandoAviso(true);
    setAvisoSuscrito(nuevo);
    try {
      if (nuevo) await tendenciasService.suscribirAviso();
      else await tendenciasService.cancelarAviso();
      toast.success(nuevo ? "Listo: cada lunes te llega la nueva edición." : "Ya no te enviaremos el aviso semanal.");
    } catch (e) {
      setAvisoSuscrito(!nuevo);
      toast.error(mensajeError(e, "No se pudo cambiar el aviso por correo."));
    } finally {
      setCambiandoAviso(false);
    }
  };

  const cambiarVista = (nueva: Vista) => {
    setVista(nueva);
    if (nueva !== "archivo") setArchivoId(null);
  };

  const cerrarFicha = useCallback(() => setFicha(null), []);

  // ── Acceso ──
  if (errorAcceso && !acceso) {
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorCarga mensaje={errorAcceso} onReintentar={cargarAcceso} />
      </div>
    );
  }
  if (!acceso) {
    return (
      <div className="mx-auto max-w-5xl">
        <Cargando texto="Cargando Tendencias..." />
      </div>
    );
  }
  if (!acceso.tiene_acceso) {
    return <Paywall acceso={acceso} onAccesoActivado={cargarAcceso} />;
  }

  const hoy = actual?.hoy ?? "";
  const edicionActualId = actual?.edicion?.id ?? null;

  let contenido: ReactElement;
  if (vista === "calendario") {
    contenido = <CalendarioPedidos />;
  } else if (vista === "guardados") {
    contenido = (
      <ListaGuardados
        estaGuardado={estaGuardado}
        onAbrir={(p) => setFicha({ producto: p, edicionId: p.edicion_id })}
        onQuitar={(p) => alternarGuardado(p, p.edicion_id)}
      />
    );
  } else if (vista === "archivo") {
    if (!archivoId) {
      contenido = <ListaArchivo edicionActualId={edicionActualId} onAbrir={setArchivoId} />;
    } else {
      contenido = (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setArchivoId(null)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Ediciones anteriores
          </button>
          {errorArchivo ? (
            <ErrorCarga mensaje={errorArchivo} onReintentar={() => cargarArchivo(archivoId)} />
          ) : !edicionArchivo ? (
            <Cargando texto="Abriendo la edición..." />
          ) : (
            <>
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {edicionArchivo.id === edicionActualId
                  ? "Esta es la edición de esta semana."
                  : `Edición de solo lectura de la semana del ${fechaLarga(edicionArchivo.semana_inicio, true)}. Los estados de pedido se calculan con la fecha de hoy.`}
              </p>
              <VistaEdicion
                edicion={edicionArchivo}
                estaGuardado={estaGuardado}
                onAlternarGuardado={(p) => alternarGuardado(p, edicionArchivo.id)}
                onAbrir={(p) => setFicha({ producto: p, edicionId: edicionArchivo.id })}
                onPedirPropuestas={(p) => pedirPropuestas(p, edicionArchivo.id)}
              />
              <PieInformativo />
            </>
          )}
        </div>
      );
    }
  } else if (errorActual && !actual) {
    contenido = <ErrorCarga mensaje={errorActual} onReintentar={cargarActual} />;
  } else if (!actual) {
    contenido = <Cargando texto="Cargando la edición de esta semana..." />;
  } else if (!actual.edicion) {
    contenido = (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-border bg-white px-4 py-14 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary dark:text-accent" />
          <p className="mt-3 text-base font-semibold">Todavía no hay una edición publicada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada lunes sale una nueva. Mientras tanto, revisa el calendario de pedidos.
          </p>
          <button
            type="button"
            onClick={() => cambiarVista("calendario")}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            <CalendarRange className="h-4 w-4" />
            Ver calendario
          </button>
        </div>
        <PieInformativo />
      </div>
    );
  } else {
    const edicion = actual.edicion;
    contenido = (
      <div className="space-y-6">
        <VistaEdicion
          edicion={edicion}
          pideATiempo={actual.pide_a_tiempo}
          estaGuardado={estaGuardado}
          onAlternarGuardado={(p) => alternarGuardado(p, edicion.id)}
          onAbrir={(p) => setFicha({ producto: p, edicionId: edicion.id })}
          onPedirPropuestas={(p) => pedirPropuestas(p, edicion.id)}
        />
        <PieInformativo />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {acceso.es_curador
              ? "Vista de curador"
              : acceso.vigente_hasta
                ? acceso.origen === "libre"
                  ? `Acceso libre por tiempo limitado, hasta el ${fechaInstante(acceso.vigente_hasta)}`
                  : `Tu acceso vence el ${fechaInstante(acceso.vigente_hasta)} · ${acceso.origen === "pago" ? "suscripción" : "cortesía del equipo de Zarpi"}`
                : "Acceso activo"}
          </p>
          <div className="flex items-center gap-2.5">
            <span className="hidden text-xs text-muted-foreground sm:inline">Recibe cada lunes la nueva edición en tu correo.</span>
            <button
              type="button"
              role="switch"
              aria-checked={avisoSuscrito}
              onClick={alternarAviso}
              disabled={cambiandoAviso}
              title="Recibe cada lunes la nueva edición en tu correo."
              className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${
                avisoSuscrito
                  ? "border-transparent bg-primary text-white dark:bg-accent dark:text-accent-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cambiandoAviso ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : avisoSuscrito ? (
                <Bell className="h-3.5 w-3.5" />
              ) : (
                <BellOff className="h-3.5 w-3.5" />
              )}
              Aviso semanal por correo{avisoSuscrito ? ": activo" : ""}
            </button>
          </div>
          <p className="w-full text-xs text-muted-foreground sm:hidden">Recibe cada lunes la nueva edición en tu correo.</p>
        </div>

        <nav aria-label="Secciones de Tendencias" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {VISTAS.map(({ clave, etiqueta, icono: Icono }) => {
            const activa = vista === clave;
            return (
              <button
                key={clave}
                type="button"
                onClick={() => cambiarVista(clave)}
                aria-current={activa ? "page" : undefined}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                  activa
                    ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground"
                    : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icono className="h-4 w-4" />
                {etiqueta}
              </button>
            );
          })}
        </nav>
      </div>

      {contenido}

      {ficha && (
        <FichaProducto
          producto={ficha.producto}
          edicionId={ficha.edicionId}
          hoy={hoy}
          guardado={estaGuardado(ficha.producto)}
          onAlternarGuardado={() => alternarGuardado(ficha.producto, ficha.edicionId)}
          onPedirPropuestas={() => pedirPropuestas(ficha.producto, ficha.edicionId)}
          onCerrar={cerrarFicha}
        />
      )}
    </div>
  );
}
