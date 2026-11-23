import { useState } from "react";
import { ArrowLeft, BadgeCheck, FileText, Loader2, PauseCircle, PlayCircle, Search, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Input, Textarea } from "@shared/ui/design-system";
import { Modal } from "@shared/ui/kit/Modal";
import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { useInvalidarMaquilas, useMaquiladoraAdmin, useMaquiladorasAdmin, useParametrosMaquilas } from "@apps/maquilas/features/useMaquilas";
import { EstadoMaquiladoraBadge } from "@apps/maquilas/features/componentes/EstadoMaquiladora";
import type { ArchivoMaquila, EstadoMaquiladora, Maquiladora } from "@apps/maquilas/features/tipos";

const FILTROS: { valor: "" | EstadoMaquiladora; etiqueta: string }[] = [
  { valor: "en_revision", etiqueta: "Por revisar" },
  { valor: "", etiqueta: "Todas" },
  { valor: "verificada", etiqueta: "Verificadas" },
  { valor: "registrada", etiqueta: "Por completar" },
  { valor: "rechazada", etiqueta: "Con cambios" },
  { valor: "suspendida", etiqueta: "Suspendidas" },
];

const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="text-sm">{valor === undefined || valor === null || valor === "" ? "—" : valor}</dd>
    </div>
  );
}

function Documento({ titulo, archivo }: { titulo: string; archivo: ArchivoMaquila | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="truncate text-xs text-muted-foreground">{archivo?.nombre ?? "No lo ha subido"}</p>
      </div>
      {archivo && (
        <Button variant="ghost" size="sm" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => void abrirArchivoEnPestana(archivo.url, `${titulo} · ${archivo.nombre}`)}>
          Abrir
        </Button>
      )}
    </div>
  );
}

function Expediente({ id, esAdmin, onVolver }: { id: string; esAdmin: boolean; onVolver: () => void }) {
  const { data: m, isLoading, error } = useMaquiladoraAdmin(id);
  const { data: parametros } = useParametrosMaquilas();
  const invalidar = useInvalidarMaquilas();
  const [accion, setAccion] = useState<"rechazar" | "suspender" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(fn: () => Promise<Maquiladora>, exito: string) {
    setOcupado(true);
    try {
      await fn();
      await invalidar();
      toast.success(exito);
      setAccion(null);
      setMotivo("");
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  if (isLoading) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  if (error || !m) return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error, "No encontramos esa maquiladora.")}</p></Card>;

  const categorias = new Map((parametros?.categorias ?? []).map((c) => [c.clave, c.nombre]));
  const r = m.representante ?? {};

  return (
    <div className="space-y-5">
      <button type="button" onClick={onVolver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a la lista
      </button>

      <Card padding="lg" className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{m.nombre_comercial}</h2>
            <EstadoMaquiladoraBadge estado={m.estado} />
            {m.creada_por_equipo && <span className="text-xs text-muted-foreground">· creada por el equipo</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{m.razon_social} · NIT {m.nit} · {m.ciudad}</p>
          {m.motivo && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Último motivo: {m.motivo}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {m.estado === "en_revision" && (
            <>
              <Button variant="secondary" icon={<XCircle className="h-4 w-4" />} onClick={() => setAccion("rechazar")}>Pedir cambios</Button>
              <Button icon={<BadgeCheck className="h-4 w-4" />} loading={ocupado} disabled={(m.pendientes ?? []).length > 0}
                onClick={() => void ejecutar(() => maquilasService.aprobar(m.id), "Maquiladora verificada")}>
                Verificar
              </Button>
            </>
          )}
          {esAdmin && m.estado !== "suspendida" && (
            <Button variant="ghost" icon={<PauseCircle className="h-4 w-4" />} onClick={() => setAccion("suspender")}>Suspender</Button>
          )}
          {esAdmin && m.estado === "suspendida" && (
            <Button variant="secondary" icon={<PlayCircle className="h-4 w-4" />} loading={ocupado}
              onClick={() => void ejecutar(() => maquilasService.reactivar(m.id), "Maquiladora reactivada")}>
              Reactivar
            </Button>
          )}
        </div>
      </Card>

      {m.estado === "en_revision" && (m.pendientes ?? []).length > 0 && (
        <Card padding="md">
          <p className="text-sm font-medium">Al expediente le falta:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{(m.pendientes ?? []).map((p) => <li key={p}>{p}</li>)}</ul>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="lg" className="space-y-4">
          <h3 className="font-semibold">Empresa</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Dato etiqueta="Razón social" valor={m.razon_social} />
            <Dato etiqueta="NIT" valor={m.nit} />
            <Dato etiqueta="Ciudad" valor={m.ciudad} />
            <Dato etiqueta="Dirección" valor={m.direccion} />
            <Dato etiqueta="Teléfono" valor={m.telefono} />
            <Dato etiqueta="Sitio web" valor={m.sitio_web} />
            <Dato etiqueta="Registrada" valor={fecha(m.creado_en)} />
            <Dato etiqueta="Enviada a revisión" valor={fecha(m.enviada_en)} />
          </dl>
          <div>
            <p className="text-xs text-muted-foreground">Descripción</p>
            <p className="text-sm whitespace-pre-line">{m.descripcion || "—"}</p>
          </div>
        </Card>

        <Card padding="lg" className="space-y-4">
          <h3 className="font-semibold">Representante</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Dato etiqueta="Nombre" valor={[r.nombre, r.apellido].filter(Boolean).join(" ")} />
            <Dato etiqueta="Documento" valor={r.numero_documento ? `${r.tipo_documento ?? ""} ${r.numero_documento}` : null} />
            <Dato etiqueta="Correo" valor={r.email} />
            <Dato etiqueta="Celular" valor={r.telefono} />
          </dl>
          <h3 className="pt-2 font-semibold">Fabricación</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Dato etiqueta="Categorías" valor={m.categorias.map((c) => categorias.get(c) ?? c).join(", ")} />
            <Dato etiqueta="Procesos" valor={m.procesos.join(", ")} />
            <Dato etiqueta="Pedido mínimo" valor={m.pedido_minimo ? `${m.pedido_minimo.toLocaleString("es-CO")} und.` : null} />
            <Dato etiqueta="Capacidad al mes" valor={m.capacidad_mensual ? `${m.capacidad_mensual.toLocaleString("es-CO")} und.` : null} />
            <Dato etiqueta="Días de muestra" valor={m.dias_muestra} />
            <Dato etiqueta="Días de producción" valor={m.dias_produccion} />
            <Dato etiqueta="Certificaciones declaradas" valor={m.certificaciones.join(", ")} />
          </dl>
        </Card>
      </div>

      <Card padding="lg" className="space-y-3">
        <h3 className="font-semibold">Documentos</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Documento titulo="RUT" archivo={m.documentos?.rut} />
          <Documento titulo="Cámara de comercio" archivo={m.documentos?.camara_comercio} />
          {(m.documentos?.certificados ?? []).map((c, i) => <Documento key={c.id} titulo={`Certificado ${i + 1}`} archivo={c} />)}
        </div>
      </Card>

      <Card padding="lg" className="space-y-3">
        <h3 className="font-semibold">Galería</h3>
        {m.galeria.length === 0 ? <p className="text-sm text-muted-foreground">Sin fotos.</p> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {m.galeria.map((g, i) => (
              <button key={g.id} type="button" onClick={() => void abrirArchivoEnPestana(g.url, g.nombre)}
                className="aspect-square overflow-hidden rounded-lg border border-border bg-muted" aria-label={`Abrir foto ${i + 1}`}>
                <ImagenArchivo src={g.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <Modal open={accion !== null} onClose={() => setAccion(null)} title={accion === "suspender" ? "Suspender maquiladora" : "Pedir cambios al expediente"}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {accion === "suspender"
              ? "Sale del directorio y no recibe solicitudes. Le avisamos por correo con este motivo."
              : "La maquiladora recibe este mensaje por correo, corrige y vuelve a enviar."}
          </p>
          <Textarea label="Motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500}
            placeholder={accion === "suspender" ? "Ej.: incumplimientos reiterados con clientes" : "Ej.: la cámara de comercio tiene más de 30 días"} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAccion(null)}>Cancelar</Button>
            <Button loading={ocupado} disabled={motivo.trim().length < 5}
              onClick={() => void ejecutar(
                () => (accion === "suspender" ? maquilasService.suspender(m.id, motivo.trim()) : maquilasService.rechazar(m.id, motivo.trim())),
                accion === "suspender" ? "Maquiladora suspendida" : "Le pedimos los cambios a la maquiladora",
              )}>
              {accion === "suspender" ? "Suspender" : "Enviar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Admin › Maquilas › Verificación: la cola de expedientes y el detalle de cada maquiladora. */
export function VerificacionMaquiladoras({ maquiladoraId, esAdmin, onAbrir }: {
  maquiladoraId?: string;
  esAdmin: boolean;
  onAbrir: (id?: string) => void;
}) {
  const [estado, setEstado] = useState<"" | EstadoMaquiladora>("en_revision");
  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useMaquiladorasAdmin(estado, q);
  const { data: parametros } = useParametrosMaquilas();

  if (maquiladoraId) return <Expediente id={maquiladoraId} esAdmin={esAdmin} onVolver={() => onAbrir(undefined)} />;

  const categorias = new Map((parametros?.categorias ?? []).map((c) => [c.clave, c.nombre]));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado">
          {FILTROS.map((f) => (
            <button key={f.etiqueta} type="button" role="tab" aria-selected={estado === f.valor} onClick={() => setEstado(f.valor)}
              className={clsx("rounded-full border px-3 py-1 text-xs font-medium",
                estado === f.valor ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent"
                  : "border-border text-muted-foreground hover:text-foreground")}>
              {f.etiqueta}{f.valor && data ? ` · ${data.contadores[f.valor] ?? 0}` : ""}
            </button>
          ))}
        </div>
        <form className="flex gap-2 lg:w-80" onSubmit={(e) => { e.preventDefault(); setQ(busqueda.trim()); }}>
          <Input aria-label="Buscar maquiladora" placeholder="Razón social, NIT o ciudad" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            prefix={<Search className="h-4 w-4" />} />
        </form>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
        ) : error ? (
          <p className="px-5 py-8 text-sm text-destructive">{mensajeDeError(error)}</p>
        ) : !data?.maquiladoras.length ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {estado === "en_revision" ? "No hay expedientes por revisar." : "No hay maquiladoras con ese filtro."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.maquiladoras.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onAbrir(m.id)}
                  className="flex w-full flex-col gap-1 px-5 py-3 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.nombre_comercial} <span className="font-normal text-muted-foreground">· {m.razon_social}</span></p>
                    <p className="truncate text-xs text-muted-foreground">
                      NIT {m.nit} · {m.ciudad} · {m.categorias.map((c) => categorias.get(c) ?? c).join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    {m.estado === "en_revision" && <span className="text-xs text-muted-foreground">Enviada {fecha(m.enviada_en)}</span>}
                    <EstadoMaquiladoraBadge estado={m.estado} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
