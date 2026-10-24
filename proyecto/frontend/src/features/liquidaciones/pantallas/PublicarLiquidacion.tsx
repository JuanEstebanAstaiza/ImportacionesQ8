import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { FileText, Loader2, Package, Truck, X } from "lucide-react";

import { Button, Card, Input, Select, Textarea } from "@/components/design-system";
import { FotoLote } from "@/features/liquidaciones/componentes/MediosLote";
import { ReglasZarpi } from "@/features/liquidaciones/componentes/ReglasZarpi";
import { SubirArchivo } from "@/features/liquidaciones/componentes/SubirArchivo";
import { CONDICIONES, ENTREGAS, ORDEN_CONDICIONES, UNIDADES_VENTA, cop, fechaCorta } from "@/features/liquidaciones/constantes";
import { useGuardarLote, useLote, useParametros } from "@/features/liquidaciones/useLiquidaciones";
import type { Condicion, DocumentoRef, Entrega, LoteEntrada, MedioRef, UnidadVenta } from "@/features/liquidaciones/tipos";

const CIUDADES = [
  "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Pereira", "Manizales", "Cúcuta",
  "Ibagué", "Santa Marta", "Villavicencio", "Pasto", "Neiva", "Armenia", "Montería", "Valledupar", "Popayán",
];

function Seccion({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card padding="md">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{titulo}</p>
        {extra}
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

/**
 * «Publicar liquidación». Entra como «Pendiente de revisión»: el equipo de Zarpi
 * la revisa antes de publicarla. Con `loteId` edita una que está en revisión o
 * que se rechazó, y al guardar vuelve a revisión.
 */
export function PublicarLiquidacion({ loteId, onListo, onCancelar }: { loteId?: string; onListo: () => void; onCancelar: () => void }) {
  const { data: parametros } = useParametros();
  const { data: existente, isLoading: cargando } = useLote(loteId ?? "");
  const guardar = useGuardarLote();

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidades, setUnidades] = useState("");
  const [unidadVenta, setUnidadVenta] = useState<UnidadVenta>("unidades");
  const [condicion, setCondicion] = useState<Condicion>("nuevo");
  const [detalleCondicion, setDetalleCondicion] = useState("");
  const [fotos, setFotos] = useState<MedioRef[]>([]);
  const [videos, setVideos] = useState<MedioRef[]>([]);
  const [ficha, setFicha] = useState<DocumentoRef | null>(null);
  const [precio, setPrecio] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [entrega, setEntrega] = useState<Entrega>("vendedor_despacha");
  const [requiereRegistro, setRequiereRegistro] = useState(false);
  const [registro, setRegistro] = useState("");
  const [dias, setDias] = useState(10);
  const [destacado, setDestacado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  // Al editar, el formulario arranca con lo publicado.
  useEffect(() => {
    if (!existente) return;
    setNombre(existente.nombre);
    setDescripcion(existente.descripcion);
    setCategoria(existente.categoria);
    setUnidades(String(existente.unidades));
    setUnidadVenta(existente.unidad_venta);
    setCondicion(existente.condicion);
    setDetalleCondicion(existente.detalle_condicion ?? "");
    setFotos(existente.fotos);
    setVideos(existente.videos);
    setFicha(existente.ficha_tecnica);
    setPrecio(String(existente.precio_cop));
    setCiudad(existente.ciudad);
    setEntrega(existente.entrega);
    setRequiereRegistro(existente.requiere_registro_sanitario);
    setRegistro(existente.registro_sanitario ?? "");
    setDias(existente.dias_cierre);
    setDestacado(existente.destacado);
  }, [existente]);

  const p = parametros;
  const fotosMin = p?.fotos_min ?? 3;
  const fotosMax = p?.fotos_max ?? 8;
  const videosMax = p?.videos_max ?? 2;
  const diasMax = p?.dias_max_cierre ?? 15;
  const categorias = p?.categorias ?? [];
  const precioNumero = Number(precio.replace(/\D/g, "")) || 0;
  const unidadesNumero = Number(unidades.replace(/\D/g, "")) || 0;
  const precioUnidad = precioNumero && unidadesNumero ? Math.floor(precioNumero / unidadesNumero) : 0;
  const fechaCierre = useMemo(() => new Date(Date.now() + dias * 86400000).toISOString(), [dias]);
  const ciudades = useMemo(() => (ciudad && !CIUDADES.includes(ciudad) ? [ciudad, ...CIUDADES] : CIUDADES), [ciudad]);

  useEffect(() => {
    if (!categoria && categorias.length) setCategoria(categorias[0]);
  }, [categoria, categorias]);

  function validar(): Record<string, string> {
    const e: Record<string, string> = {};
    if (nombre.trim().length < 3) e.nombre = "Escribe el nombre del producto";
    if (!unidadesNumero) e.unidades = "¿Cuántas unidades tiene el lote?";
    if (condicion !== "nuevo" && !detalleCondicion.trim()) e.detalleCondicion = "Explica el estado de la mercancía";
    if (fotos.length < fotosMin) e.fotos = `Sube mínimo ${fotosMin} fotos reales del lote`;
    if (!precioNumero) e.precio = "Escribe el precio del lote completo";
    if (!ciudad) e.ciudad = "Elige la ciudad donde está la mercancía";
    if (requiereRegistro && !registro.trim()) e.registro = "Escribe el número de registro o notificación sanitaria";
    return e;
  }

  async function enviar() {
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length) {
      toast.error("Revisa los campos marcados");
      return;
    }
    const datos: LoteEntrada = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      categoria,
      unidades: unidadesNumero,
      unidad_venta: unidadVenta,
      condicion,
      detalle_condicion: condicion === "nuevo" ? null : detalleCondicion.trim(),
      fotos: fotos.map((f) => f.id),
      videos: videos.map((v) => v.id),
      ficha_tecnica_id: ficha?.id ?? null,
      precio_cop: precioNumero,
      ciudad,
      entrega,
      requiere_registro_sanitario: requiereRegistro,
      registro_sanitario: requiereRegistro ? registro.trim() : null,
      dias_cierre: dias,
      destacado,
    };
    try {
      await guardar.mutateAsync({ id: loteId, datos });
      toast.success("Enviada a revisión. Te avisamos cuando el equipo de Zarpi la publique.");
      onListo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar la liquidación");
    }
  }

  if (loteId && cargando) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{loteId ? "Editar liquidación" : "Publicar liquidación"}</h1>
          <p className="text-sm text-muted-foreground">Entra como «Pendiente de revisión». El equipo de Zarpi la revisa antes de publicarla.</p>
          {existente?.rechazo && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm dark:border-rose-500/30 dark:bg-rose-500/10">
              <p className="font-medium text-rose-700 dark:text-rose-300">El equipo pidió cambios</p>
              <p className="text-foreground">{existente.rechazo.motivos.join("; ")}</p>
              {existente.rechazo.nota && <p className="text-muted-foreground">«{existente.rechazo.nota}»</p>}
            </div>
          )}
        </div>

        <Seccion titulo="Producto">
          <Input label="Nombre del producto" placeholder="Ej. Licuadoras de 1,5 L, 600 W" value={nombre} maxLength={160}
            onChange={(e) => setNombre(e.target.value)} error={errores.nombre} />
          <Textarea label="Descripción" rows={3} maxLength={2000} placeholder="Referencia, especificaciones y para qué tipo de negocio sirve."
            value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
            <Select label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="Unidades del lote" inputMode="numeric" placeholder="150" value={unidades}
              onChange={(e) => setUnidades(e.target.value.replace(/\D/g, ""))} error={errores.unidades} />
            <Select label="Se cuentan en" value={unidadVenta} onChange={(e) => setUnidadVenta(e.target.value as UnidadVenta)}>
              {(Object.keys(UNIDADES_VENTA) as UnidadVenta[]).map((u) => <option key={u} value={u}>{UNIDADES_VENTA[u].plural}</option>)}
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Se vende el lote completo. Si quieres vender por partes, publica varios lotes.</p>
        </Seccion>

        <Seccion titulo="Estado de la mercancía">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ORDEN_CONDICIONES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCondicion(c)}
                className={clsx(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                  condicion === c ? "border-accent bg-accent/10 font-medium" : "border-border hover:border-muted-foreground/40",
                )}
              >
                <span className={clsx("h-2 w-2 rounded-full", CONDICIONES[c].dot)} />{CONDICIONES[c].label}
              </button>
            ))}
          </div>
          {condicion !== "nuevo" && (
            <Input label="Explica el estado" placeholder="Ej. Caja exterior abierta en la inspección; producto sin uso." maxLength={500}
              value={detalleCondicion} onChange={(e) => setDetalleCondicion(e.target.value)} error={errores.detalleCondicion} />
          )}
        </Seccion>

        <Seccion titulo="Fotos y videos reales del lote" extra={<span className="text-xs text-muted-foreground">{fotos.length} de mínimo {fotosMin}</span>}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {fotos.map((foto) => (
              <div key={foto.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                <FotoLote foto={foto} alt="Foto del lote" className="h-full" />
                <button type="button" onClick={() => setFotos((l) => l.filter((f) => f.id !== foto.id))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100" aria-label="Quitar foto">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {fotos.length < fotosMax && (
              <SubirArchivo tipo="foto" variante="casilla" etiqueta="Agregar" multiple maxArchivos={fotosMax - fotos.length} maxMb={p?.mb_max_foto}
                onSubido={(a) => setFotos((l) => (l.length < fotosMax ? [...l, { id: a.id, url: a.url }] : l))} />
            )}
          </div>
          {errores.fotos && <p className="text-xs text-destructive">{errores.fotos}</p>}
          <p className="text-xs text-muted-foreground">Mínimo {fotosMin} fotos tomadas en tu bodega. No se aceptan fotos de catálogo.</p>

          {videosMax > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Videos del lote (opcional, hasta {videosMax})</p>
              {videos.map((video, i) => (
                <div key={video.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>Video {i + 1}</span>
                  <button type="button" onClick={() => setVideos((l) => l.filter((v) => v.id !== video.id))} className="text-xs text-muted-foreground hover:text-foreground">Quitar</button>
                </div>
              ))}
              {videos.length < videosMax && (
                <SubirArchivo tipo="video" etiqueta="Subir video" ayuda={`MP4, WebM o MOV hasta ${p?.mb_max_video ?? 200} MB`} maxMb={p?.mb_max_video}
                  onSubido={(a) => setVideos((l) => [...l, { id: a.id, url: a.url }])} />
              )}
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Ficha técnica (opcional)</p>
            {ficha ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate"><FileText className="h-4 w-4 text-primary dark:text-accent" />{ficha.nombre || "Ficha técnica"}</span>
                <button type="button" onClick={() => setFicha(null)} className="text-xs text-muted-foreground hover:text-foreground">Quitar</button>
              </div>
            ) : (
              <SubirArchivo tipo="ficha_tecnica" etiqueta="Subir ficha técnica" ayuda="PDF con especificaciones del producto" maxMb={p?.mb_max_documento}
                onSubido={(a) => setFicha({ id: a.id, url: a.url, nombre: a.nombre })} />
            )}
          </div>
        </Seccion>

        <Seccion titulo="Precio, ubicación y entrega">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Precio del lote completo (COP)" inputMode="numeric" placeholder="10500000"
              value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))} error={errores.precio} />
            <Input label="Precio por unidad" value={precioUnidad ? cop(precioUnidad) : "—"} readOnly disabled />
            <Select label="Ciudad de la mercancía" value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
              <option value="">Selecciona</option>
              {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          {errores.ciudad && <p className="text-xs text-destructive">{errores.ciudad}</p>}
          <div>
            <p className="mb-1.5 text-sm font-medium">Forma de entrega</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(ENTREGAS) as Entrega[]).map((e) => (
                <button key={e} type="button" onClick={() => setEntrega(e)}
                  className={clsx("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                    entrega === e ? "border-accent bg-accent/10 font-medium" : "border-border hover:border-muted-foreground/40")}>
                  {e === "vendedor_despacha" ? <Truck className="h-4 w-4" /> : <Package className="h-4 w-4" />}{ENTREGAS[e]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">¿El producto exige registro sanitario?</p>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {[false, true].map((valor) => (
                <button key={String(valor)} type="button" onClick={() => setRequiereRegistro(valor)}
                  className={clsx("rounded-md px-4 py-1 text-sm", requiereRegistro === valor ? "bg-accent font-medium text-black" : "text-muted-foreground")}>
                  {valor ? "Sí" : "No"}
                </button>
              ))}
            </div>
            {requiereRegistro && (
              <div className="mt-2">
                <Input placeholder="Número de registro o notificación sanitaria INVIMA" maxLength={80} value={registro}
                  onChange={(e) => setRegistro(e.target.value)} error={errores.registro} />
              </div>
            )}
          </div>
        </Seccion>

        <Seccion titulo="Cierre y visibilidad">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">Fecha de cierre</span>
              <span className="text-muted-foreground">{fechaCorta(fechaCierre)} · {dias} {dias === 1 ? "día" : "días"}</span>
            </div>
            <input type="range" min={1} max={diasMax} value={Math.min(dias, diasMax)} onChange={(e) => setDias(Number(e.target.value))}
              className="w-full accent-[var(--primary)]" aria-label="Días hasta el cierre" />
            <p className="text-xs text-muted-foreground">Máximo {diasMax} días después de publicada.</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5">
            <input type="checkbox" checked={destacado} onChange={(e) => setDestacado(e.target.checked)} className="mt-1" />
            <span>
              <span className="block text-sm font-medium">Destacar esta liquidación</span>
              <span className="block text-xs text-muted-foreground">Aparece primero, con cuenta regresiva, hasta la fecha de cierre. Por ahora no se cobra.</span>
            </span>
          </label>
        </Seccion>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancelar}>Cancelar</Button>
          <Button variant="acento" loading={guardar.isPending} onClick={() => void enviar()}>
            {loteId ? "Guardar y reenviar a revisión" : "Enviar a revisión"}
          </Button>
        </div>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <ReglasZarpi compacto />
        <p className="px-1 text-xs text-muted-foreground">Tú facturas y acuerdas el pago y la entrega con el comprador. Zarpi no recibe el dinero del lote ni hace la logística.</p>
      </aside>
    </div>
  );
}
