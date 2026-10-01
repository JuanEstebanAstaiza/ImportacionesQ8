import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { AlertTriangle, CheckCircle2, Download, History, Loader2, RotateCcw, Upload, X } from "lucide-react";

import {
  adminService,
  type BackupPrevio,
  type BackupSubido,
  type ResultadoRestauracion,
} from "@/services/admin.service";

/**
 * Restaurar una copia de seguridad desde el panel.
 *
 * Flujo en dos pasos, igual que el backend: se arrastra el ZIP (o se elige),
 * se sube y el servidor devuelve una vista previa sin tocar nada; solo después
 * de revisarla y escribir RESTAURAR se reemplazan los datos. El servidor guarda
 * antes una copia del estado actual, que aparece abajo para poder deshacer.
 */

type Fase =
  | { tipo: "inicio" }
  | { tipo: "subiendo"; nombre: string; progreso: number }
  | { tipo: "vista-previa"; subida: BackupSubido }
  | { tipo: "restaurando"; subida: BackupSubido }
  | { tipo: "hecho"; resultado: ResultadoRestauracion };

function formatoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatoFecha(iso: string | null): string {
  if (!iso) return "fecha desconocida";
  const fecha = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(fecha.getTime())
    ? iso
    : fecha.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

/** "importacionesq8-backup-20261001-153000.zip" → fecha legible (UTC en el nombre). */
function fechaDeNombre(nombre: string): string {
  const m = /(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(nombre);
  return m ? formatoFecha(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) : nombre;
}

export function RestaurarBackup({
  onDescargarActual,
  descargandoActual,
  onRestaurado,
  onSesionCaducada,
}: {
  /** Descarga una copia del estado actual (el botón de arriba del panel). */
  onDescargarActual: () => void;
  descargandoActual: boolean;
  /** Recargar los datos del panel tras restaurar. */
  onRestaurado: () => void;
  /** La cuenta actual no existe en la copia restaurada: hay que volver a entrar. */
  onSesionCaducada: () => void;
}) {
  const [fase, setFase] = useState<Fase>({ tipo: "inicio" });
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [incluirArchivos, setIncluirArchivos] = useState(true);
  const [verTodas, setVerTodas] = useState(false);
  const [previos, setPrevios] = useState<BackupPrevio[]>([]);
  const [trabajandoPrevio, setTrabajandoPrevio] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargarPrevios = useCallback(async () => {
    try {
      setPrevios(await adminService.listPreviousBackups());
    } catch {
      setPrevios([]);
    }
  }, []);

  useEffect(() => {
    void cargarPrevios();
  }, [cargarPrevios]);

  function mostrarVistaPrevia(subida: BackupSubido) {
    setConfirmacion("");
    setVerTodas(false);
    setIncluirArchivos(subida.incluye_archivos);
    setFase({ tipo: "vista-previa", subida });
  }

  async function subir(archivo: File) {
    setError("");
    if (!archivo.name.toLowerCase().endsWith(".zip")) {
      setError("El archivo debe ser el .zip descargado con «Descargar copia de seguridad».");
      return;
    }
    setFase({ tipo: "subiendo", nombre: archivo.name, progreso: 0 });
    try {
      const subida = await adminService.validateBackupUpload(archivo, (progreso) =>
        setFase({ tipo: "subiendo", nombre: archivo.name, progreso }),
      );
      mostrarVistaPrevia(subida);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la copia.");
      setFase({ tipo: "inicio" });
    }
  }

  function alSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastrando(false);
    const archivo = evento.dataTransfer.files?.[0];
    if (archivo) void subir(archivo);
  }

  async function cancelar(subida: BackupSubido) {
    setFase({ tipo: "inicio" });
    setError("");
    await adminService.discardBackupUpload(subida.subida_id).catch(() => undefined);
  }

  async function restaurar(subida: BackupSubido) {
    setError("");
    setFase({ tipo: "restaurando", subida });
    try {
      const resultado = await adminService.applyBackupRestore(subida.subida_id, incluirArchivos);
      setFase({ tipo: "hecho", resultado });
      void cargarPrevios();
      if (resultado.sesion_vigente) onRestaurado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "La restauración falló.");
      setFase({ tipo: "vista-previa", subida });
    }
  }

  async function prepararPrevio(nombre: string) {
    setError("");
    setTrabajandoPrevio(nombre);
    try {
      mostrarVistaPrevia(await adminService.preparePreviousBackup(nombre));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo preparar la copia previa.");
    } finally {
      setTrabajandoPrevio(null);
    }
  }

  async function descargarPrevio(nombre: string) {
    setError("");
    setTrabajandoPrevio(nombre);
    try {
      await adminService.downloadPreviousBackup(nombre);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar la copia previa.");
    } finally {
      setTrabajandoPrevio(null);
    }
  }

  const ocupado = fase.tipo === "subiendo" || fase.tipo === "restaurando";

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Upload className="h-4 w-4 text-primary" />
        Restaurar una copia
      </p>
      <p className="text-sm text-muted-foreground">
        Arrastra aquí un ZIP descargado con el botón de arriba. Antes de cambiar nada verás qué contiene y en qué se
        diferencia de los datos actuales.
      </p>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-red-50 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {fase.tipo === "inicio" || fase.tipo === "subiendo" ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Zona para soltar la copia de seguridad"
          onClick={() => !ocupado && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !ocupado) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!ocupado) setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => (ocupado ? e.preventDefault() : alSoltar(e))}
          className={`mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            arrastrando ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:bg-muted/40"
          } ${ocupado ? "cursor-wait" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              e.target.value = "";
              if (archivo) void subir(archivo);
            }}
          />
          {fase.tipo === "subiendo" ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {fase.progreso < 100 ? `Subiendo ${fase.nombre}… ${fase.progreso}%` : "Verificando la copia…"}
              </p>
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${fase.progreso}%` }} />
              </div>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Suelta aquí el .zip o haz clic para elegirlo</p>
              <p className="text-xs text-muted-foreground">Nada se modifica hasta que confirmes en el paso siguiente.</p>
            </>
          )}
        </div>
      ) : null}

      {fase.tipo === "vista-previa" || fase.tipo === "restaurando" ? (
        <VistaPrevia
          subida={fase.subida}
          restaurando={fase.tipo === "restaurando"}
          confirmacion={confirmacion}
          setConfirmacion={setConfirmacion}
          incluirArchivos={incluirArchivos}
          setIncluirArchivos={setIncluirArchivos}
          verTodas={verTodas}
          setVerTodas={setVerTodas}
          onCancelar={() => void cancelar(fase.subida)}
          onRestaurar={() => void restaurar(fase.subida)}
          onDescargarActual={onDescargarActual}
          descargandoActual={descargandoActual}
        />
      ) : null}

      {fase.tipo === "hecho" ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Copia restaurada
          </p>
          <p className="mt-1">
            {fase.resultado.filas_restauradas.toLocaleString("es-CO")} filas en {fase.resultado.tablas_restauradas} tablas
            {fase.resultado.archivos_restaurados > 0
              ? ` y ${fase.resultado.archivos_restaurados.toLocaleString("es-CO")} archivos`
              : ""}
            . Se verificó que cada tabla tiene las mismas filas que la copia.
          </p>
          {fase.resultado.cotizaciones_abiertas_reindexadas > 0 ? (
            <p className="mt-1">
              {fase.resultado.cotizaciones_abiertas_reindexadas} cotización(es) abierta(s) volvieron al pool de sus empresas.
            </p>
          ) : null}
          {fase.resultado.backup_previo ? (
            <p className="mt-1">
              El estado anterior quedó guardado como <code className="rounded bg-white/70 px-1">{fase.resultado.backup_previo}</code>;
              puedes volver a él desde la lista de abajo.
            </p>
          ) : null}
          {fase.resultado.sesion_vigente ? (
            <button
              type="button"
              onClick={() => setFase({ tipo: "inicio" })}
              className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium"
            >
              Listo
            </button>
          ) : (
            <div className="mt-3">
              <p className="font-medium">Tu cuenta no existe en la copia restaurada: vuelve a iniciar sesión con un admin que sí esté en ella.</p>
              <button
                type="button"
                onClick={onSesionCaducada}
                className="mt-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
              >
                Ir a iniciar sesión
              </button>
            </div>
          )}
        </div>
      ) : null}

      {previos.length > 0 ? (
        <div className="mt-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-primary" />
            Estados anteriores a cada restauración
          </p>
          <p className="text-xs text-muted-foreground">
            Antes de restaurar, la plataforma guarda sola cómo estaban los datos. Desde aquí puedes descargarlos o volver a ellos.
          </p>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {previos.slice(0, 10).map((previo) => (
              <li key={previo.nombre} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {fechaDeNombre(previo.nombre)}{" "}
                  <span className="text-xs text-muted-foreground">· {formatoBytes(previo.tamano_bytes)}</span>
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={ocupado || trabajandoPrevio !== null}
                    onClick={() => void descargarPrevio(previo.nombre)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" /> Descargar
                  </button>
                  <button
                    type="button"
                    disabled={ocupado || trabajandoPrevio !== null}
                    onClick={() => void prepararPrevio(previo.nombre)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {trabajandoPrevio === previo.nombre ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Volver a este estado
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function VistaPrevia({
  subida,
  restaurando,
  confirmacion,
  setConfirmacion,
  incluirArchivos,
  setIncluirArchivos,
  verTodas,
  setVerTodas,
  onCancelar,
  onRestaurar,
  onDescargarActual,
  descargandoActual,
}: {
  subida: BackupSubido;
  restaurando: boolean;
  confirmacion: string;
  setConfirmacion: (v: string) => void;
  incluirArchivos: boolean;
  setIncluirArchivos: (v: boolean) => void;
  verTodas: boolean;
  setVerTodas: (v: boolean) => void;
  onCancelar: () => void;
  onRestaurar: () => void;
  onDescargarActual: () => void;
  descargandoActual: boolean;
}) {
  const conCambios = subida.tablas.filter((t) => t.actual !== t.en_backup);
  const visibles = verTodas ? subida.tablas : conCambios;
  const listo = confirmacion.trim() === "RESTAURAR" && !restaurando;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{subida.nombre_original}</p>
          <p className="text-xs text-muted-foreground">
            Copia del {formatoFecha(subida.generado_en)} · {formatoBytes(subida.tamano_bytes)} · íntegra (verificada)
          </p>
        </div>
        {!restaurando ? (
          <button type="button" onClick={onCancelar} className="rounded-md p-1 text-muted-foreground hover:bg-muted" title="Descartar esta copia">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { etiqueta: "Filas en la copia", valor: subida.total_filas_backup.toLocaleString("es-CO") },
          { etiqueta: "Filas actuales", valor: subida.total_filas_actual.toLocaleString("es-CO") },
          { etiqueta: "Archivos en la copia", valor: subida.archivos.toLocaleString("es-CO") },
        ].map((dato) => (
          <div key={dato.etiqueta} className="rounded-lg border border-border bg-muted/30 p-2.5">
            <p className="text-base font-semibold tabular-nums">{dato.valor}</p>
            <p className="text-xs text-muted-foreground">{dato.etiqueta}</p>
          </div>
        ))}
      </div>

      {subida.advertencias.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {subida.advertencias.map((aviso) => (
            <li key={aviso} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{aviso}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {conCambios.length === 0 ? "Ninguna tabla cambia de tamaño" : `Tablas que cambian (${conCambios.length})`}
          </p>
          <button type="button" onClick={() => setVerTodas(!verTodas)} className="text-xs font-medium text-primary">
            {verTodas ? "Ver solo las que cambian" : `Ver todas (${subida.tablas.length})`}
          </button>
        </div>
        {visibles.length > 0 ? (
          <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 font-medium">Tabla</th>
                  <th className="px-2 py-1 text-right font-medium">Ahora</th>
                  <th className="px-2 py-1 text-right font-medium">Quedará</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((t) => {
                  const diferencia = t.actual === null ? null : t.en_backup - t.actual;
                  return (
                    <tr key={t.tabla} className="border-t border-border">
                      <td className="px-2 py-1 font-mono">{t.tabla}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{t.actual === null ? "—" : t.actual.toLocaleString("es-CO")}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {t.actual === null ? "no se restaura" : t.en_backup.toLocaleString("es-CO")}
                        {diferencia ? (
                          <span className={diferencia > 0 ? "ml-1 text-emerald-700" : "ml-1 text-destructive"}>
                            ({diferencia > 0 ? "+" : ""}{diferencia.toLocaleString("es-CO")})
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={incluirArchivos}
          disabled={!subida.incluye_archivos || restaurando}
          onChange={(e) => setIncluirArchivos(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Restaurar también los archivos subidos
        {!subida.incluye_archivos ? <span className="text-xs text-muted-foreground">(la copia no los trae)</span> : null}
      </label>

      <div className="rounded-lg border border-destructive/30 bg-red-50 p-3 text-sm text-red-900">
        <p className="font-semibold">Esto reemplaza TODOS los datos de la plataforma por los de la copia.</p>
        <p className="mt-1 text-xs">
          Lo que se haya creado después de la fecha de la copia se pierde. Mientras dura, la plataforma queda en
          mantenimiento para todos los usuarios. La plataforma guarda sola el estado actual antes de empezar; si además
          quieres tenerlo en tu equipo:{" "}
          <button
            type="button"
            disabled={descargandoActual || restaurando}
            onClick={onDescargarActual}
            className="font-medium underline disabled:opacity-60"
          >
            {descargandoActual ? "descargando…" : "descargar el estado actual"}
          </button>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Escribe RESTAURAR para confirmar
          <input
            value={confirmacion}
            disabled={restaurando}
            onChange={(e) => setConfirmacion(e.target.value)}
            autoComplete="off"
            className="h-9 w-48 rounded-lg border border-border px-2.5 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={!listo}
          onClick={onRestaurar}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-destructive px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {restaurando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          {restaurando ? "Restaurando… no cierres esta pestaña" : "Restaurar ahora"}
        </button>
        {!restaurando ? (
          <button type="button" onClick={onCancelar} className="h-9 rounded-lg border border-border px-3 text-sm">
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
