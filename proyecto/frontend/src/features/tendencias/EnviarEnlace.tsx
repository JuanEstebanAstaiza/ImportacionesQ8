import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  Trophy,
  X,
} from "lucide-react";

import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { CATEGORIAS_PRODUCTO } from "@/lib/categorias";
import { toApiPath } from "@/services/api-client";
import {
  ETIQUETA_PLATAFORMA,
  tendenciasService,
  type EstadoTendencia,
  type MiEnvio,
  type RespuestaEnvio,
} from "@/services/tendencias.service";

import { fechaCorta } from "./piezas";

/**
 * Enviar un enlace de TikTok, Instagram o YouTube a Tendencias. Un solo campo
 * obligatorio (la URL); el resto es opcional. Debajo, el historial de envíos.
 */

type Props = { rol: "solicitante" | "importadora" | "asesor" | "admin" | "soporte" | "designer" };

type Resultado =
  | { tipo: "recibido"; datos: Extract<RespuestaEnvio, { estado: "recibido" }> }
  | { tipo: "duplicado"; mensaje: string }
  | { tipo: "error"; mensaje: string };

const CLASE_INPUT =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const ESTADOS: Record<EstadoTendencia, { texto: string; clase: string }> = {
  pendiente: { texto: "En revisión", clase: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/30" },
  en_diseno: { texto: "Aprobado · en diseño", clase: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/30" },
  publicado: { texto: "Publicado", clase: "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-violet-200 dark:border-primary/40" },
  rechazado: { texto: "No aprobado", clase: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-400/30" },
  caido: { texto: "Video no disponible", clase: "bg-muted text-muted-foreground border-border" },
  duplicado: { texto: "Repetido", clase: "bg-muted text-muted-foreground border-border" },
  archivado: { texto: "Archivado", clase: "bg-muted text-muted-foreground border-border" },
};

function EstadoEnvio({ envio }: { envio: MiEnvio }) {
  const estado = ESTADOS[envio.estado] ?? { texto: envio.estado, clase: "bg-muted text-muted-foreground border-border" };
  const texto = envio.estado === "rechazado" && envio.motivo_rechazo ? `No aprobado: ${envio.motivo_rechazo}` : estado.texto;
  return <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estado.clase}`}>{texto}</span>;
}

function MisEnvios({ version }: { version: number }) {
  const [envios, setEnvios] = useState<MiEnvio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setError(null);
    tendenciasService
      .misEnvios()
      .then((r) => { if (vigente) setEnvios(r); })
      .catch((e: unknown) => { if (vigente) setError(e instanceof Error && e.message ? e.message : "No pudimos cargar tus envíos."); });
    return () => { vigente = false; };
  }, [version, intento]);

  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Mis envíos</h2>
        {envios ? <span className="text-xs text-muted-foreground">{envios.length} {envios.length === 1 ? "enlace" : "enlaces"}</span> : null}
      </div>
      {error ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">
          <span>{error}</span>
          <button type="button" onClick={() => setIntento((n) => n + 1)} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline">
            <RefreshCw className="h-3 w-3" /> Reintentar
          </button>
        </div>
      ) : envios === null ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : envios.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Todavía no has enviado enlaces. El primero que pegues aparece aquí con su estado.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {envios.map((e) => (
            <li key={e.id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.nombre || e.url}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{ETIQUETA_PLATAFORMA[e.plataforma] ?? e.plataforma}</span>
                  <span aria-hidden>·</span>
                  <span>{fechaCorta(e.fecha_envio)}</span>
                  <span aria-hidden>·</span>
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline">
                    Ver video <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              <div className="shrink-0 sm:max-w-[50%] sm:text-right"><EstadoEnvio envio={e} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EnviarEnlace({ rol }: Props) {
  const conFoto = rol === "importadora" || rol === "asesor";
  const [url, setUrl] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [nota, setNota] = useState("");
  const [portada, setPortada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [version, setVersion] = useState(0);
  const campoUrl = useRef<HTMLInputElement | null>(null);

  async function pegar() {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto) setUrl(texto.trim());
    } catch {
      campoUrl.current?.focus();
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpia = url.trim();
    if (!limpia || enviando) return;
    setEnviando(true);
    setResultado(null);
    try {
      const r = await tendenciasService.enviar({
        url: limpia,
        ...(nombre.trim() ? { nombre: nombre.trim() } : {}),
        ...(categoria ? { categoria } : {}),
        ...(nota.trim() ? { nota: nota.trim() } : {}),
        ...(conFoto && portada ? { portada_url: portada } : {}),
      });
      if (r.estado === "recibido") {
        setResultado({ tipo: "recibido", datos: r });
        toast.success("Recibimos tu enlace");
        // Se limpia todo para enviar el siguiente enseguida.
        setUrl("");
        setNombre("");
        setCategoria("");
        setNota("");
        setPortada("");
        campoUrl.current?.focus();
      } else {
        setResultado({ tipo: "duplicado", mensaje: r.mensaje });
      }
      setVersion((n) => n + 1);
    } catch (err) {
      const mensaje = err instanceof Error && err.message ? err.message : "No pudimos enviar el enlace.";
      setResultado({ tipo: "error", mensaje });
      toast.error(mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-xl font-bold sm:text-2xl">¿Encontraste un producto viral? Súbelo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pega el enlace del video de TikTok, Instagram o YouTube. Lo revisamos y, si lo aprobamos, aparece en Tendencias.
        </p>

        <form onSubmit={enviar} className="mt-5 space-y-4">
          <div>
            <label htmlFor="enlace-tendencia" className="text-sm font-medium">Enlace del video</label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="enlace-tendencia"
                  ref={campoUrl}
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  required
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); if (resultado?.tipo !== "recibido") setResultado(null); }}
                  placeholder="https://www.tiktok.com/@autor/video/…"
                  className={`${CLASE_INPUT} h-12 pl-10 pr-10 text-base`}
                />
                {url ? (
                  <button type="button" onClick={() => { setUrl(""); campoUrl.current?.focus(); }} aria-label="Borrar enlace" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {typeof navigator !== "undefined" && navigator.clipboard?.readText && !url ? (
                <button type="button" onClick={() => { void pegar(); }} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
                  <Copy className="h-4 w-4" /> Pegar
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium">
              <span>Agregar detalles <span className="font-normal text-muted-foreground">(opcional)</span></span>
              <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`} />
            </button>
            {abierto ? (
              <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium">Nombre del producto</span>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder="Ej.: Lámpara de luna 3D" className={`${CLASE_INPUT} mt-1`} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Categoría</span>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`${CLASE_INPUT} mt-1`}>
                    <option value="">Sin elegir</option>
                    {CATEGORIAS_PRODUCTO.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium">Nota para el equipo</span>
                  <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={500} placeholder="Por qué crees que se puede vender en Colombia" className={`${CLASE_INPUT} mt-1 resize-y`} />
                </label>
                {conFoto ? (
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium">Foto del producto (portada propuesta)</p>
                    <p className="text-xs text-muted-foreground">Foto propia, sin marcas de terceros. Si la aprobamos, puede quedar como portada.</p>
                    <div className="mt-2 flex items-center gap-3">
                      {portada ? (
                        <>
                          <ImagenArchivo src={portada} alt="Portada propuesta" className="h-20 w-16 shrink-0 rounded-lg border border-border object-cover" />
                          <button type="button" onClick={() => setPortada("")} className="text-sm font-medium text-muted-foreground hover:text-foreground">Quitar</button>
                        </>
                      ) : (
                        <DocumentUploadButton
                          label="Subir foto"
                          accept="image/*"
                          origen="tendencias"
                          onUploaded={(archivo) => setPortada(toApiPath(archivo.storage_url || `/documentos/archivos/${archivo.id}/descargar`))}
                          onError={(m) => toast.error(m)}
                        />
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!url.trim() || enviando}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar enlace
          </button>
        </form>

        {resultado?.tipo === "recibido" ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100" role="status">
            <p className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="h-4 w-4" /> Recibido</p>
            <p className="mt-0.5">
              Lo revisamos en menos de 48 horas.
              {resultado.datos.autor_plataforma ? ` Video de ${resultado.datos.autor_plataforma} en ${ETIQUETA_PLATAFORMA[resultado.datos.plataforma]}.` : ""}
              {" "}Puedes pegar el siguiente.
            </p>
            {resultado.datos.reto ? (
              <p className="mt-2 flex items-center gap-1.5 font-medium">
                <Trophy className="h-4 w-4" /> Llevás {resultado.datos.reto.aprobados} de {resultado.datos.reto.umbral} aprobados en el reto
              </p>
            ) : null}
          </div>
        ) : resultado?.tipo === "duplicado" ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100" role="status">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Ya lo tenemos</p>
              <p className="mt-0.5">{resultado.mensaje}</p>
            </div>
          </div>
        ) : resultado?.tipo === "error" ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{resultado.mensaje}</p>
          </div>
        ) : null}

        <div className="mt-5 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Qué cuenta</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Productos genéricos que se puedan importar y vender en Colombia.</li>
            <li>No cuentan marcas de terceros ni réplicas.</li>
            <li>No cuentan productos que necesiten registro sanitario (INVIMA, ICA).</li>
            <li>No cuentan los repetidos: si alguien ya lo subió, gana quien lo envió primero.</li>
          </ul>
        </div>
      </section>

      <MisEnvios version={version} />
    </div>
  );
}
