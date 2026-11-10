import { useEffect, useState } from "react";
import { toast } from "sonner";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Search, Users } from "lucide-react";

import { Badge, Button, Textarea } from "@shared/ui/design-system";
import { Modal } from "@shared/ui/kit/Modal";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";
import { liquidacionesService } from "@/services/liquidaciones.service";
import { useInvalidarLiquidaciones } from "@apps/liquidaciones/features/useLiquidaciones";
import type { CuentaAdmin } from "@apps/liquidaciones/features/tipos";

const POR_PAGINA = 25;

function mensajeError(error: unknown, defecto: string): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

/** La búsqueda espera a que se deje de teclear para no lanzar una consulta por letra. */
function useRetrasado<T>(valor: T, ms = 300): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const id = window.setTimeout(() => setRetrasado(valor), ms);
    return () => window.clearTimeout(id);
  }, [valor, ms]);
  return retrasado;
}

/** Cuentas que activaron Zarpi Liquidaciones (RUT validado) y su actividad en el módulo. */
export function CuentasAdmin() {
  const invalidar = useInvalidarLiquidaciones();
  const [busqueda, setBusqueda] = useState("");
  const q = useRetrasado(busqueda.trim());
  const [pagina, setPagina] = useState(0);
  const [suspendiendo, setSuspendiendo] = useState<CuentaAdmin | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);

  useEffect(() => { setPagina(0); }, [q]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["liquidaciones", "admin", "cuentas", { q, pagina }],
    queryFn: () => liquidacionesService.cuentas({ q: q || undefined, limite: POR_PAGINA, desde: pagina * POR_PAGINA }),
    placeholderData: keepPreviousData,
  });
  const cuentas = data?.cuentas ?? [];
  const total = data?.total ?? 0;

  async function cambiarSuspension(cuenta: CuentaAdmin, suspendida: boolean, motivoTexto?: string) {
    setEnviando(cuenta.cuenta);
    try {
      await liquidacionesService.suspender(cuenta.cuenta, suspendida, motivoTexto);
      toast.success(suspendida ? `${cuenta.razon_social} quedó suspendida` : `${cuenta.razon_social} se reactivó`);
      setSuspendiendo(null);
      setMotivo("");
      await invalidar();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo cambiar el estado de la cuenta."));
    } finally {
      setEnviando(null);
    }
  }

  async function abrirRut(cuenta: CuentaAdmin) {
    if (!cuenta.rut) return;
    const resultado = await abrirArchivoEnPestana(cuenta.rut.url, cuenta.rut.nombre || `RUT ${cuenta.nit}`);
    if (!resultado.ok) toast.error(resultado.motivo || "No se pudo abrir el RUT.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4 text-primary dark:text-accent" />
            Cuentas de Liquidaciones
          </p>
          <p className="text-sm text-muted-foreground">
            Empresas y comerciantes que activaron el módulo. Una cuenta suspendida no puede publicar ni reservar lotes.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{total} cuentas</span>
      </div>

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por razón social, NIT, contacto o correo..."
              className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm"
            />
          </div>
          {busqueda && (
            <button type="button" onClick={() => setBusqueda("")} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              Limpiar
            </button>
          )}
          {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando cuentas…</p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No pudimos cargar las cuentas. {mensajeError(error, "")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Razón social</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Contacto</th>
                  <th className="py-2 pr-3">Ciudad</th>
                  <th className="py-2 pr-3 text-right">Lotes</th>
                  <th className="py-2 pr-3 text-right">Compras</th>
                  <th className="py-2 pr-3">RUT</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {cuentas.map((cuenta) => (
                  <tr key={cuenta.cuenta} className="border-b border-border/60 align-top hover:!bg-muted dark:hover:!bg-muted">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-foreground">{cuenta.razon_social}</p>
                      <p className="text-xs text-muted-foreground">NIT {cuenta.nit}</p>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{cuenta.es_empresa ? "Empresa" : "Comerciante"}</td>
                    <td className="py-3 pr-3">
                      <p className="text-foreground">{cuenta.contacto}</p>
                      {cuenta.email && <p className="text-xs text-muted-foreground break-all">{cuenta.email}</p>}
                      {cuenta.telefono && <p className="text-xs text-muted-foreground">{cuenta.telefono}</p>}
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{cuenta.ciudad}</td>
                    <td className="py-3 pr-3 text-right font-medium">{cuenta.lotes}</td>
                    <td className="py-3 pr-3 text-right font-medium">{cuenta.compras}</td>
                    <td className="py-3 pr-3">
                      {cuenta.rut ? (
                        <button type="button" onClick={() => void abrirRut(cuenta)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted">
                          <FileText className="h-3.5 w-3.5 text-primary dark:text-accent" /> Ver RUT
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {cuenta.suspendida ? (
                        <div>
                          <Badge variant="warning" label="Suspendida" />
                          {cuenta.motivo_suspension && <p className="mt-1 max-w-[180px] text-[11px] text-muted-foreground">{cuenta.motivo_suspension}</p>}
                        </div>
                      ) : (
                        <Badge variant="success" label="Activa" />
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {cuenta.suspendida ? (
                        <Button size="sm" variant="secondary" loading={enviando === cuenta.cuenta} onClick={() => void cambiarSuspension(cuenta, false)}>
                          Reactivar
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => { setMotivo(""); setSuspendiendo(cuenta); }}>
                          Suspender
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {cuentas.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">No hay cuentas que coincidan con la búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > POR_PAGINA && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              {pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, total)} de {total}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
                Anterior
              </button>
              <button type="button" disabled={(pagina + 1) * POR_PAGINA >= total} onClick={() => setPagina((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={Boolean(suspendiendo)} onClose={() => !enviando && setSuspendiendo(null)} title="Suspender cuenta">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {suspendiendo?.razon_social} no podrá publicar ni reservar lotes mientras esté suspendida. Le avisaremos con este motivo.
          </p>
          <Textarea label="Motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: RUT no coincide con la razón social" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSuspendiendo(null)} disabled={Boolean(enviando)}>Cancelar</Button>
            <Button
              variant="danger"
              loading={Boolean(enviando)}
              disabled={!motivo.trim()}
              onClick={() => suspendiendo && void cambiarSuspension(suspendiendo, true, motivo.trim())}
            >
              Suspender
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
