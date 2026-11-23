import { useEffect, useState } from "react";
import { Check, FileText, Loader2, Lock, Send, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Input, Textarea } from "@shared/ui/design-system";
import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { useInvalidarMaquilas, useMiMaquiladora, useParametrosMaquilas } from "@apps/maquilas/features/useMaquilas";
import { EstadoMaquiladoraBadge } from "@apps/maquilas/features/componentes/EstadoMaquiladora";
import { SubirArchivoMaquila } from "@apps/maquilas/features/componentes/SubirArchivoMaquila";
import type { ArchivoMaquila, DocumentosEntrada, Maquiladora, PerfilEntrada } from "@apps/maquilas/features/tipos";

type Borrador = {
  razon_social: string; nit: string; nombre_comercial: string; ciudad: string; direccion: string; telefono: string; sitio_web: string;
  descripcion: string; categorias: string[]; procesos: string[]; certificaciones: string[];
  pedido_minimo: string; capacidad_mensual: string; dias_muestra: string; dias_produccion: string;
};

const texto = (v: number | null | undefined) => (v ? String(v) : "");
const entero = (v: string) => (v.trim() ? Number.parseInt(v, 10) : undefined);

function borradorDe(m: Maquiladora): Borrador {
  return {
    razon_social: m.razon_social ?? "", nit: m.nit ?? "", nombre_comercial: m.nombre_comercial ?? "", ciudad: m.ciudad ?? "",
    direccion: m.direccion ?? "", telefono: m.telefono ?? "", sitio_web: m.sitio_web ?? "", descripcion: m.descripcion ?? "",
    categorias: m.categorias, procesos: m.procesos, certificaciones: m.certificaciones,
    pedido_minimo: texto(m.pedido_minimo), capacidad_mensual: texto(m.capacidad_mensual),
    dias_muestra: texto(m.dias_muestra), dias_produccion: texto(m.dias_produccion),
  };
}

function Chips({ opciones, elegidas, onCambiar, disabled }: {
  opciones: { valor: string; etiqueta: string }[]; elegidas: string[]; onCambiar: (v: string[]) => void; disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map(({ valor, etiqueta }) => {
        const activa = elegidas.includes(valor);
        return (
          <button key={valor} type="button" aria-pressed={activa} disabled={disabled}
            onClick={() => onCambiar(activa ? elegidas.filter((x) => x !== valor) : [...elegidas, valor])}
            className={clsx("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60",
              activa ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground")}>
            {activa && <Check className="h-3 w-3" aria-hidden="true" />}
            {etiqueta}
          </button>
        );
      })}
    </div>
  );
}

function FilaDocumento({ titulo, ayuda, archivo, tipo, maxMb, editable, onCambiar }: {
  titulo: string; ayuda: string; archivo: ArchivoMaquila | null | undefined; tipo: "rut" | "camara_comercio";
  maxMb?: number; editable: boolean; onCambiar: (archivo: ArchivoMaquila) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-muted-foreground">{archivo ? archivo.nombre : ayuda}</p>
      </div>
      <div className="flex flex-shrink-0 gap-2">
        {archivo && (
          <Button variant="ghost" size="sm" icon={<FileText className="h-3.5 w-3.5" />}
            onClick={() => void abrirArchivoEnPestana(archivo.url, archivo.nombre)}>Ver</Button>
        )}
        {editable && <SubirArchivoMaquila tipo={tipo} etiqueta={archivo ? "Reemplazar" : "Subir"} maxMb={maxMb} onSubido={onCambiar} />}
      </div>
    </div>
  );
}

/**
 * Perfil y expediente de la maquiladora: lo que verán los clientes y los
 * documentos que Zarpi revisa antes de verificarla. Solo la cuenta dueña edita.
 */
export function PerfilMaquiladora() {
  const { data: maquiladora, isLoading, error } = useMiMaquiladora();
  const { data: parametros } = useParametrosMaquilas();
  const invalidar = useInvalidarMaquilas();
  const [b, setB] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (maquiladora) setB(borradorDe(maquiladora));
  }, [maquiladora]);

  if (isLoading || (!b && !error)) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  }
  if (error || !maquiladora || !b) {
    return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error, "No pudimos cargar tu maquiladora.")}</p></Card>;
  }

  const esDueno = maquiladora.mi_rol !== "colaborador";
  const legalesBloqueados = !["registrada", "rechazada"].includes(maquiladora.estado);
  const editable = esDueno && maquiladora.estado !== "suspendida";
  const poner = <K extends keyof Borrador>(campo: K, valor: Borrador[K]) => setB((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  const sucio = JSON.stringify(b) !== JSON.stringify(borradorDe(maquiladora));

  async function guardarPerfil() {
    if (!b) return;
    const datos: PerfilEntrada = {
      nombre_comercial: b.nombre_comercial.trim(), ciudad: b.ciudad.trim(), direccion: b.direccion.trim(), telefono: b.telefono.trim(),
      sitio_web: b.sitio_web.trim(), descripcion: b.descripcion.trim(), categorias: b.categorias, procesos: b.procesos,
      certificaciones: b.certificaciones, pedido_minimo: entero(b.pedido_minimo), capacidad_mensual: entero(b.capacidad_mensual),
      dias_muestra: entero(b.dias_muestra), dias_produccion: entero(b.dias_produccion),
    };
    if (!legalesBloqueados) Object.assign(datos, { razon_social: b.razon_social.trim(), nit: b.nit.trim() });
    setGuardando(true);
    try {
      await maquilasService.actualizarPerfil(datos);
      await invalidar();
      toast.success("Perfil guardado");
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarDocumentos(cambios: DocumentosEntrada) {
    try {
      await maquilasService.actualizarDocumentos(cambios);
      await invalidar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  async function enviar() {
    if (sucio) await guardarPerfil();
    setEnviando(true);
    try {
      await maquilasService.enviarAVerificacion();
      await invalidar();
      toast.success("Enviamos tu expediente. Te avisamos cuando lo revisemos.");
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const documentos = maquiladora.documentos ?? { rut: null, camara_comercio: null, certificados: [] };
  const galeria = maquiladora.galeria;
  const puedeEnviar = esDueno && ["registrada", "rechazada"].includes(maquiladora.estado);
  const pendientes = maquiladora.pendientes ?? [];

  return (
    <div className="space-y-6">
      <Card padding="lg" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{maquiladora.nombre_comercial}</h2>
            <EstadoMaquiladoraBadge estado={maquiladora.estado} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {maquiladora.estado === "verificada" ? "Los clientes ven este perfil en el directorio de Zarpi Maquilas."
              : maquiladora.estado === "en_revision" ? "Estamos revisando tu expediente. Te avisamos por correo."
              : maquiladora.estado === "suspendida" ? "Tu maquiladora está suspendida. Escríbenos por soporte si tienes dudas."
              : "Completa tu perfil y tu expediente y envíalo a verificación."}
          </p>
          {maquiladora.motivo && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <span className="font-medium">Nota de Zarpi:</span> {maquiladora.motivo}
            </p>
          )}
          {!esDueno && <p className="mt-2 text-xs text-muted-foreground">Solo la cuenta dueña puede editar el perfil.</p>}
        </div>
        {puedeEnviar && (
          <Button icon={<Send className="h-4 w-4" />} loading={enviando} disabled={pendientes.length > 0} onClick={() => void enviar()}>
            Enviar a verificación
          </Button>
        )}
      </Card>

      {puedeEnviar && pendientes.length > 0 && (
        <Card padding="md">
          <p className="text-sm font-medium">Para enviar tu expediente falta:</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {pendientes.map((p) => <li key={p} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{p}</li>)}
          </ul>
        </Card>
      )}

      <Card padding="lg" className="space-y-4">
        <h3 className="font-semibold">Empresa</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Razón social" value={b.razon_social} disabled={!editable || legalesBloqueados} onChange={(e) => poner("razon_social", e.target.value)}
            rightLabel={legalesBloqueados ? <Lock className="h-3.5 w-3.5" aria-label="Verificado" /> : undefined} />
          <Input label="NIT" value={b.nit} disabled={!editable || legalesBloqueados} onChange={(e) => poner("nit", e.target.value)}
            rightLabel={legalesBloqueados ? <Lock className="h-3.5 w-3.5" aria-label="Verificado" /> : undefined} />
          <Input label="Nombre comercial" value={b.nombre_comercial} disabled={!editable} onChange={(e) => poner("nombre_comercial", e.target.value)} />
          <Input label="Ciudad" value={b.ciudad} disabled={!editable} onChange={(e) => poner("ciudad", e.target.value)} />
          <Input label="Dirección" value={b.direccion} disabled={!editable} onChange={(e) => poner("direccion", e.target.value)} />
          <Input label="Teléfono" value={b.telefono} disabled={!editable} onChange={(e) => poner("telefono", e.target.value)} />
          <div className="sm:col-span-2">
            <Input label="Sitio web o red social" value={b.sitio_web} disabled={!editable} onChange={(e) => poner("sitio_web", e.target.value)} placeholder="https://" />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Cuéntale a los clientes qué haces" rows={4} value={b.descripcion} disabled={!editable} maxLength={2000}
              onChange={(e) => poner("descripcion", e.target.value)}
              hint="Qué fabricas, con qué equipos, para qué tipo de marcas y qué te diferencia (mínimo 30 caracteres)." />
          </div>
        </div>
      </Card>

      <Card padding="lg" className="space-y-5">
        <h3 className="font-semibold">Qué fabricas</h3>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Categorías</legend>
          <Chips disabled={!editable} opciones={(parametros?.categorias ?? []).map((c) => ({ valor: c.clave, etiqueta: c.nombre }))}
            elegidas={b.categorias} onCambiar={(v) => poner("categorias", v)} />
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Procesos</legend>
          <Chips disabled={!editable} opciones={(parametros?.procesos ?? []).map((p) => ({ valor: p, etiqueta: p }))}
            elegidas={b.procesos} onCambiar={(v) => poner("procesos", v)} />
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Certificaciones</legend>
          <Chips disabled={!editable} opciones={(parametros?.certificaciones ?? []).map((c) => ({ valor: c, etiqueta: c }))}
            elegidas={b.certificaciones} onCambiar={(v) => poner("certificaciones", v)} />
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-4">
          <Input label="Pedido mínimo" type="number" min={1} value={b.pedido_minimo} disabled={!editable} onChange={(e) => poner("pedido_minimo", e.target.value)} suffix="und." />
          <Input label="Capacidad al mes" type="number" min={1} value={b.capacidad_mensual} disabled={!editable} onChange={(e) => poner("capacidad_mensual", e.target.value)} suffix="und." />
          <Input label="Muestra" type="number" min={1} value={b.dias_muestra} disabled={!editable} onChange={(e) => poner("dias_muestra", e.target.value)} suffix="días" />
          <Input label="Producción" type="number" min={1} value={b.dias_produccion} disabled={!editable} onChange={(e) => poner("dias_produccion", e.target.value)} suffix="días" />
        </div>
        {editable && (
          <div className="flex justify-end">
            <Button onClick={() => void guardarPerfil()} loading={guardando} disabled={!sucio}>Guardar cambios</Button>
          </div>
        )}
      </Card>

      <Card padding="lg" className="space-y-4">
        <div>
          <h3 className="font-semibold">Documentos legales</h3>
          <p className="text-sm text-muted-foreground">Solo los ve el equipo de Zarpi para verificar tu empresa.</p>
        </div>
        <FilaDocumento titulo="RUT" ayuda="PDF o foto legible del RUT actualizado" archivo={documentos.rut} tipo="rut"
          maxMb={parametros?.mb_max_documento} editable={editable} onCambiar={(a) => void guardarDocumentos({ rut: a.id })} />
        <FilaDocumento titulo="Cámara de comercio" ayuda="Certificado de existencia y representación legal (no mayor a 30 días)"
          archivo={documentos.camara_comercio} tipo="camara_comercio" maxMb={parametros?.mb_max_documento} editable={editable}
          onCambiar={(a) => void guardarDocumentos({ camara_comercio: a.id })} />
        <div className="rounded-xl border border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Certificados (opcional)</p>
              <p className="text-xs text-muted-foreground">BPM, INVIMA, ISO u otros que respalden tus procesos.</p>
            </div>
            {editable && (
              <SubirArchivoMaquila tipo="certificado" etiqueta="Subir certificado" maxMb={parametros?.mb_max_documento}
                disabled={documentos.certificados.length >= (parametros?.certificados_max ?? 10)}
                onSubido={(a) => void guardarDocumentos({ certificados: [...documentos.certificados.map((c) => c.id), a.id] })} />
            )}
          </div>
          {documentos.certificados.length > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {documentos.certificados.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <button type="button" className="truncate text-left hover:underline" onClick={() => void abrirArchivoEnPestana(c.url, c.nombre)}>{c.nombre}</button>
                  {editable && (
                    <button type="button" aria-label={`Quitar ${c.nombre}`} className="text-muted-foreground hover:text-destructive"
                      onClick={() => void guardarDocumentos({ certificados: documentos.certificados.filter((x) => x.id !== c.id).map((x) => x.id) })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Galería de trabajos</h3>
            <p className="text-sm text-muted-foreground">Fotos de tu planta, tus máquinas y productos que has fabricado. Son tu vitrina.</p>
          </div>
          {editable && (
            <SubirArchivoMaquila tipo="foto" etiqueta="Subir fotos" multiple maxMb={parametros?.mb_max_foto}
              maxArchivos={Math.max((parametros?.fotos_galeria_max ?? 12) - galeria.length, 0)}
              disabled={galeria.length >= (parametros?.fotos_galeria_max ?? 12)}
              onSubido={(a) => void guardarDocumentos({ galeria: [...(maquiladora.galeria.map((g) => g.id)), a.id] })} />
          )}
        </div>
        {galeria.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Aún no hay fotos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {galeria.map((g, i) => (
              <div key={g.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                <ImagenArchivo src={g.url} alt={`Trabajo ${i + 1}`} className="h-full w-full object-cover" />
                {editable && (
                  <button type="button" aria-label={`Quitar foto ${i + 1}`}
                    onClick={() => void guardarDocumentos({ galeria: galeria.filter((x) => x.id !== g.id).map((x) => x.id) })}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
