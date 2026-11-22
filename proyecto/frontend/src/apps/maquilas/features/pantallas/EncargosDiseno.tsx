import { useState } from "react";
import { ArrowLeft, CheckCircle2, Hand, Inbox, Loader2, PenTool, Send, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Textarea } from "@shared/ui/design-system";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { fecha, fechaHora } from "@apps/maquilas/features/formato";
import { useColaDiseno, useEncargo, useInvalidarMaquilas } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import { KitMarca } from "@apps/maquilas/features/componentes/KitMarca";
import { MotivoModal } from "@apps/maquilas/features/componentes/MotivoModal";
import { SubirArchivoMaquila } from "@apps/maquilas/features/componentes/SubirArchivoMaquila";
import { EstadoEncargoChip } from "@apps/maquilas/features/pantallas/EstudioMarca";
import type { ArchivoMaquila } from "@apps/maquilas/features/tipos";

/** Un encargo de diseño: el cliente revisa versiones; Diseño lo toma y entrega. */
export function DetalleEncargo({ id, onVolver, textoVolver }: { id: string; onVolver: () => void; textoVolver: string }) {
  const { data: e, isLoading, error } = useEncargo(id);
  const invalidar = useInvalidarMaquilas();
  const [archivos, setArchivos] = useState<ArchivoMaquila[]>([]);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pidiendoCambios, setPidiendoCambios] = useState(false);

  async function ejecutar(clave: string, fn: () => Promise<unknown>, exito: string) {
    setOcupado(clave);
    try {
      await fn();
      await invalidar();
      toast.success(exito);
      return true;
    } catch (err) {
      toast.error(mensajeDeError(err));
      return false;
    } finally {
      setOcupado(null);
    }
  }

  if (isLoading) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  if (error || !e) return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onVolver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {textoVolver}</button>
      <Card padding="lg" className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{e.tipo_nombre} · {e.marca.nombre}</h2>
            <EstadoEncargoChip estado={e.estado} etiqueta={e.estado_etiqueta} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {e.codigo} · pedido el {fecha(e.creado_en)} · {e.cliente.empresa || e.cliente.nombre}
            {e.disenador?.nombre ? ` · diseña ${e.disenador.nombre}` : ""}
          </p>
          <p className="mt-3 max-w-3xl whitespace-pre-line text-sm">{e.brief}</p>
          {e.referencias.length > 0 && <div className="mt-3"><ArchivosVista archivos={e.referencias} tamano="sm" /></div>}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {e.acciones.tomar && (
            <Button icon={<Hand className="h-4 w-4" />} loading={ocupado === "tomar"}
              onClick={() => void ejecutar("tomar", () => maquilasService.tomarEncargo(e.id), "Tomaste el encargo")}>Tomar encargo</Button>
          )}
          {e.acciones.cancelar && (
            <Button variant="ghost" icon={<XCircle className="h-4 w-4" />} loading={ocupado === "cancelar"}
              onClick={() => void ejecutar("cancelar", () => maquilasService.cancelarEncargo(e.id), "Cancelaste el encargo")}>Cancelar</Button>
          )}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card padding="lg" className="space-y-4">
          <h3 className="font-semibold">Versiones</h3>
          {!e.versiones.length && (
            <p className="text-sm text-muted-foreground">
              {e.estado === "nuevo" ? "Esperando que un diseñador tome el encargo." : e.estado === "cancelado" ? "El encargo se canceló." : "El diseñador está trabajando en la primera versión."}
            </p>
          )}
          <ol className="space-y-3">
            {[...e.versiones].reverse().map((v) => (
              <li key={v.numero} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Versión {v.numero} · {fechaHora(v.entregada_en)}</p>
                  <span className={clsx("text-xs font-medium", v.estado === "aprobada" ? "text-emerald-600" : v.estado === "cambios" ? "text-amber-600" : "text-sky-600")}>
                    {v.estado === "aprobada" ? "Aprobada" : v.estado === "cambios" ? "Pidieron cambios" : "Esperando al cliente"}
                  </span>
                </div>
                {v.nota && <p className="text-sm">{v.nota}</p>}
                <ArchivosVista archivos={v.archivos} />
                {v.comentario && <p className="rounded-lg bg-muted px-3 py-2 text-sm"><span className="font-medium">Cliente:</span> {v.comentario}</p>}
              </li>
            ))}
          </ol>
          {e.acciones.responder && (
            <div className="flex flex-wrap gap-2">
              <Button icon={<CheckCircle2 className="h-4 w-4" />} loading={ocupado === "aprobar"}
                onClick={() => void ejecutar("aprobar", () => maquilasService.responderEncargo(e.id, true, ""), "¡Aprobado! Lo guardamos en tu kit de marca")}>
                Aprobar esta versión
              </Button>
              <Button variant="secondary" onClick={() => setPidiendoCambios(true)}>Pedir cambios</Button>
            </div>
          )}
          {e.estado === "aprobado" && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">Aprobado el {fecha(e.aprobado_en)}. Los archivos quedaron en el kit de la marca.</p>}
          {e.acciones.entregar && (
            <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
              <p className="text-sm font-medium">{e.versiones.length ? "Subir una nueva versión" : "Subir la primera versión"}</p>
              <SubirArchivoMaquila tipo="diseno" etiqueta="Subir archivos (PNG, JPG o PDF)" multiple maxArchivos={10 - archivos.length}
                onSubido={(a) => setArchivos((x) => [...x, a])} />
              <ArchivosVista archivos={archivos} onQuitar={(aid) => setArchivos((x) => x.filter((a) => a.id !== aid))} />
              <Textarea label="Nota para el cliente (opcional)" rows={2} value={nota} maxLength={1000} onChange={(ev) => setNota(ev.target.value)} />
              <Button icon={<Send className="h-4 w-4" />} disabled={!archivos.length} loading={ocupado === "entregar"}
                onClick={() => void ejecutar("entregar", () => maquilasService.entregarVersion(e.id, archivos.map((a) => a.id), nota.trim()), "Enviamos la versión al cliente")
                  .then((ok) => { if (ok) { setArchivos([]); setNota(""); } })}>
                Enviar versión
              </Button>
            </div>
          )}
        </Card>
        <div className="space-y-2 xl:sticky xl:top-4 xl:self-start">
          <h3 className="text-sm font-semibold">Kit de la marca</h3>
          <KitMarca marca={e.marca} />
        </div>
      </div>

      <MotivoModal abierto={pidiendoCambios} titulo="Pedir cambios" etiqueta="Qué cambiar" textoBoton="Enviar al diseñador" ocupado={ocupado === "cambios"}
        onCerrar={() => setPidiendoCambios(false)}
        onConfirmar={(t) => void ejecutar("cambios", () => maquilasService.responderEncargo(e.id, false, t), "Le enviamos tus comentarios al diseñador")
          .then(() => setPidiendoCambios(false))} />
    </div>
  );
}

const FILTROS = [
  { clave: "abiertos", texto: "Abiertos", params: { estado: "abiertos" } },
  { clave: "nuevo", texto: "Sin tomar", params: { estado: "nuevo" } },
  { clave: "mios", texto: "Míos", params: { estado: "abiertos", mios: true } },
  { clave: "aprobado", texto: "Aprobados", params: { estado: "aprobado" } },
] as const;

/** Cola del equipo de Diseño: encargos de marca de los clientes de Maquilas. */
export function ColaDiseno({ encargoId, onAbrir }: { encargoId?: string; onAbrir: (id?: string) => void }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["clave"]>("abiertos");
  const { data, isLoading, error } = useColaDiseno(FILTROS.find((f) => f.clave === filtro)!.params);
  if (encargoId) return <DetalleEncargo id={encargoId} onVolver={() => onAbrir(undefined)} textoVolver="Encargos" />;

  return (
    <div className="space-y-5">
      <Card padding="lg" className="flex items-start gap-3">
        <PenTool className="mt-0.5 h-6 w-6 text-primary dark:text-accent" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">Encargos de marca</h2>
          <p className="text-sm text-muted-foreground">Logos, etiquetas y empaques que piden los clientes de Zarpi Maquilas. Toma uno, entrega versiones y el cliente aprueba.</p>
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button key={f.clave} type="button" aria-pressed={filtro === f.clave} onClick={() => setFiltro(f.clave)}
            className={clsx("rounded-full border px-3 py-1 text-xs font-medium", filtro === f.clave ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent" : "border-border text-muted-foreground")}>
            {f.texto}
          </button>
        ))}
      </div>
      {isLoading ? <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
        : error ? <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>
        : !data?.length ? (
          <Card padding="lg" className="text-center">
            <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">No hay encargos aquí</p>
          </Card>
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-border">
              {data.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onAbrir(e.id)} className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className={clsx("block truncate", e.pendiente_de_mi ? "font-semibold" : "font-medium")}>
                        {e.pendiente_de_mi && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary dark:bg-accent" aria-label="Te toca" />}
                        {e.tipo_nombre} · {e.marca.nombre}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {e.codigo} · {e.cliente.empresa || e.cliente.nombre} · {fecha(e.creado_en)}{e.disenador?.nombre ? ` · ${e.disenador.nombre}` : " · sin asignar"}
                      </span>
                    </span>
                    <EstadoEncargoChip estado={e.estado} etiqueta={e.estado_etiqueta} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
    </div>
  );
}
