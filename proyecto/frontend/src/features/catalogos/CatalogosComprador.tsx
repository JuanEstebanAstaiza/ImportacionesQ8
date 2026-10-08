import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Building2,
  Clock,
  Expand,
  Globe,
  Layers,
  Loader2,
  Package,
  Send,
  Sparkles,
} from "lucide-react";

import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import type { PrefillSolicitud } from "@/features/tendencias/prefill";
import { abrirArchivoEnPestana } from "@/lib/abrir-archivo";
import { catalogosService, type Catalogo, type ProductoCatalogo } from "@/services/catalogos.service";

import { CLASE_BOTON_PRIMARIO, Modal, cantidadConUnidad, mensajeError } from "./comun";

/**
 * Catálogos que las empresas le abrieron al comprador. Son gratis y sin
 * precios: desde un producto se pide propuesta directamente a la empresa.
 */

type Empresa = NonNullable<Catalogo["empresa"]>;

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function LogoEmpresa({ empresa, tamano = "h-10 w-10" }: { empresa: Empresa; tamano?: string }) {
  if (empresa.logo_url) {
    return <ImagenArchivo src={empresa.logo_url} alt={`Logo de ${empresa.nombre}`} className={`${tamano} shrink-0 rounded-lg border border-border bg-white`} />;
  }
  return (
    <span className={`${tamano} flex shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white`}>
      {iniciales(empresa.nombre)}
    </span>
  );
}

function Verificada() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300" title="Empresa verificada por Zarpi">
      <BadgeCheck className="h-3.5 w-3.5" /> Verificada
    </span>
  );
}

/** Cómo llegó el catálogo al comprador, dicho desde su lado. */
function motivoAcceso(c: Catalogo): string {
  if (c.acceso_por === "manual") return "Por invitación de la empresa";
  switch (c.criterio) {
    case "tier_minimo":
      return `Para cotizantes ${c.tier_minimo ?? ""} o superior`.replace("  ", " ");
    case "clientes_con_orden":
      return "Para clientes con orden";
    case "suscriptores_zarpi":
      return "Para suscriptores de Tendencias";
    default:
      return "Por invitación de la empresa";
  }
}

function InsigniaExclusivo({ catalogo }: { catalogo: Catalogo }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-[#0f0f0f]">
        <Sparkles className="h-3 w-3" /> Exclusivo para ti
      </span>
      <span className="text-[11px] text-muted-foreground">{motivoAcceso(catalogo)}</span>
    </span>
  );
}

function DetalleProducto({
  producto,
  catalogo,
  onCerrar,
  onPedir,
}: {
  producto: ProductoCatalogo;
  catalogo: Catalogo;
  onCerrar: () => void;
  onPedir: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const foto = producto.fotos[indice] ?? producto.fotos[0];
  const datos: { icono: typeof Package; etiqueta: string; valor: string }[] = [
    { icono: Package, etiqueta: "Cantidad mínima", valor: cantidadConUnidad(producto.cantidad_minima, producto.unidad_cantidad) },
    { icono: Clock, etiqueta: "Tiempo estimado", valor: producto.tiempo_estimado ?? "" },
    { icono: Globe, etiqueta: "Origen", valor: producto.pais_origen },
    { icono: Layers, etiqueta: "Línea", valor: producto.linea_producto ?? "" },
  ].filter((d) => d.valor);

  return (
    <Modal
      titulo={producto.nombre}
      onCerrar={onCerrar}
      ancho="sm:max-w-3xl"
      pie={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            La solicitud va directo a {catalogo.empresa?.nombre ?? "la empresa"}. El precio llega en su propuesta.
          </p>
          <button type="button" onClick={onPedir} className={`${CLASE_BOTON_PRIMARIO} px-4 py-2`}>
            <Send className="h-4 w-4" /> Pedir propuesta
          </button>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          {foto ? (
            <button
              type="button"
              onClick={() => { void abrirArchivoEnPestana(foto); }}
              className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-border"
              title="Ver en tamaño completo"
            >
              <ImagenArchivo src={foto} alt={producto.nombre} className="h-full w-full" />
              <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-80 group-hover:opacity-100">
                <Expand className="h-3.5 w-3.5" />
              </span>
            </button>
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Package className="h-10 w-10" />
            </div>
          )}
          {producto.fotos.length > 1 ? (
            <div className="mt-2 grid grid-cols-5 gap-2">
              {producto.fotos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setIndice(i)}
                  aria-label={`Ver foto ${i + 1}`}
                  className={`aspect-square overflow-hidden rounded-lg border-2 ${i === indice ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
                >
                  <ImagenArchivo src={url} alt={`Foto ${i + 1}`} className="h-full w-full" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {catalogo.empresa ? (
            <div className="flex items-center gap-2">
              <LogoEmpresa empresa={catalogo.empresa} tamano="h-8 w-8" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{catalogo.empresa.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{catalogo.titulo}</p>
              </div>
            </div>
          ) : null}
          {producto.descripcion ? <p className="whitespace-pre-line text-sm leading-relaxed">{producto.descripcion}</p> : null}
          {datos.length > 0 ? (
            <dl className="grid grid-cols-2 gap-2">
              {datos.map(({ icono: Icono, etiqueta, valor }) => (
                <div key={etiqueta} className="rounded-lg bg-muted/40 px-3 py-2">
                  <dt className="flex items-center gap-1 text-[11px] text-muted-foreground"><Icono className="h-3 w-3" /> {etiqueta}</dt>
                  <dd className="mt-0.5 text-sm font-medium">{valor}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {producto.que_pedir_en_cotizacion ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 dark:bg-primary/10">
              <p className="text-[11px] font-medium uppercase tracking-wide text-primary dark:text-violet-200">Al pedir propuesta, indica</p>
              <p className="mt-0.5 whitespace-pre-line text-sm">{producto.que_pedir_en_cotizacion}</p>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function TarjetaProducto({ producto, onAbrir }: { producto: ProductoCatalogo; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-white text-left shadow-sm transition-shadow hover:shadow-md"
    >
      {producto.fotos[0] ? (
        <ImagenArchivo src={producto.fotos[0]} alt={producto.nombre} className="aspect-square w-full" />
      ) : (
        <span className="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground">
          <Package className="h-8 w-8" />
        </span>
      )}
      <span className="flex flex-1 flex-col p-3">
        <span className="line-clamp-2 text-sm font-medium">{producto.nombre}</span>
        {producto.descripcion ? <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{producto.descripcion}</span> : null}
        <span className="mt-auto space-y-0.5 pt-2 text-[11px] text-muted-foreground">
          {producto.cantidad_minima != null ? (
            <span className="flex items-center gap-1"><Package className="h-3 w-3 shrink-0" /> Mín. {cantidadConUnidad(producto.cantidad_minima, producto.unidad_cantidad)}</span>
          ) : null}
          {producto.tiempo_estimado ? (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" /> {producto.tiempo_estimado}</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

export function CatalogosComprador({ onPedirPropuesta }: { onPedirPropuesta: (p: PrefillSolicitud) => void }) {
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [productoId, setProductoId] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    catalogosService
      .disponibles()
      .then((filas) => { if (vigente) setCatalogos(filas); })
      .catch((error) => { if (vigente) toast.error(mensajeError(error, "No se pudieron cargar los catálogos.")); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { empresa: Empresa; catalogos: Catalogo[] }>();
    for (const c of catalogos) {
      const empresa: Empresa = c.empresa ?? { id: c.importador_id, nombre: "Empresa importadora", logo_url: null, verificado: false };
      const grupo = mapa.get(empresa.id) ?? { empresa, catalogos: [] };
      grupo.catalogos.push(c);
      mapa.set(empresa.id, grupo);
    }
    return [...mapa.values()];
  }, [catalogos]);

  const abierto = abiertoId ? catalogos.find((c) => c.id === abiertoId) ?? null : null;
  const productos = useMemo(
    () => (abierto ? [...abierto.productos].filter((p) => p.activo).sort((a, b) => a.orden - b.orden) : []),
    [abierto],
  );
  const producto = productoId ? productos.find((p) => p.id === productoId) ?? null : null;

  function pedir(p: ProductoCatalogo, c: Catalogo) {
    setProductoId(null);
    onPedirPropuesta({
      origen: "catalogo",
      nombre: p.nombre,
      descripcion: p.que_pedir_en_cotizacion || p.descripcion || p.nombre,
      lineaProducto: p.linea_producto,
      pais: p.pais_origen,
      fotos: p.fotos,
      cantidadMinima: p.cantidad_minima,
      unidad: p.unidad_cantidad,
      catalogoProductoId: p.id,
      importadorId: c.importador_id,
    });
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (abierto) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <button type="button" onClick={() => setAbiertoId(null)} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Todos los catálogos
        </button>
        <header className="rounded-xl border border-border bg-white p-4 shadow-sm">
          {abierto.empresa ? (
            <div className="mb-3 flex items-center gap-3">
              <LogoEmpresa empresa={abierto.empresa} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{abierto.empresa.nombre}</p>
                {abierto.empresa.verificado ? <Verificada /> : null}
              </div>
            </div>
          ) : null}
          <h1 className="text-lg font-semibold">{abierto.titulo}</h1>
          {abierto.descripcion ? <p className="mt-1 text-sm text-muted-foreground">{abierto.descripcion}</p> : null}
          <div className="mt-2"><InsigniaExclusivo catalogo={abierto} /></div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sin precios publicados: elige un producto y pide propuesta, la empresa te responde con su precio y condiciones.
          </p>
        </header>

        {productos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
            <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Este catálogo todavía no tiene productos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {productos.map((p) => <TarjetaProducto key={p.id} producto={p} onAbrir={() => setProductoId(p.id)} />)}
          </div>
        )}

        {producto ? (
          <DetalleProducto producto={producto} catalogo={abierto} onCerrar={() => setProductoId(null)} onPedir={() => pedir(producto, abierto)} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <BookOpen className="h-5 w-5 text-primary" /> Catálogos de empresas
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Selecciones de productos que las empresas importadoras compartieron contigo. Son gratis: pide propuesta de cualquier producto y te responden con su precio.
        </p>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-[#0f0f0f]">
            <BookOpen className="h-5 w-5" />
          </span>
          <p className="mx-auto max-w-lg text-sm text-muted-foreground">
            Todavía ninguna empresa te ha abierto un catálogo. Las empresas comparten catálogos selectos con sus clientes: cotiza con ellas, cierra operaciones o suscríbete a Tendencias para desbloquear más.
          </p>
        </div>
      ) : (
        grupos.map(({ empresa, catalogos: deEmpresa }) => (
          <section key={empresa.id} className="space-y-3">
            <div className="flex items-center gap-3">
              <LogoEmpresa empresa={empresa} />
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 truncate text-base font-semibold">{empresa.nombre}</h2>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {empresa.verificado ? <Verificada /> : <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> Empresa importadora</span>}
                  <span>{deEmpresa.length} {deEmpresa.length === 1 ? "catálogo" : "catálogos"}</span>
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {deEmpresa.map((c) => {
                const fotos = [...c.productos].sort((a, b) => a.orden - b.orden).filter((p) => p.activo && p.fotos[0]).slice(0, 3);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAbiertoId(c.id)}
                    className="flex flex-col rounded-xl border border-border bg-white p-4 text-left shadow-sm transition-shadow hover:border-primary/40 hover:shadow-md"
                  >
                    <InsigniaExclusivo catalogo={c} />
                    <span className="mt-2 text-base font-semibold">{c.titulo}</span>
                    {c.descripcion ? <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.descripcion}</span> : null}
                    {fotos.length > 0 ? (
                      <span className="mt-3 flex gap-2">
                        {fotos.map((p) => <ImagenArchivo key={p.id} src={p.fotos[0]} alt={p.nombre} className="h-14 w-14 rounded-lg border border-border" />)}
                      </span>
                    ) : null}
                    <span className="mt-auto flex items-center justify-between pt-3 text-xs">
                      <span className="text-muted-foreground">{c.total_productos} {c.total_productos === 1 ? "producto" : "productos"}</span>
                      <span className="font-medium text-primary dark:text-violet-200">Ver catálogo →</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
