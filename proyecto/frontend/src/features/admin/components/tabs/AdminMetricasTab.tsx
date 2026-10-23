import { useEffect, useState } from "react";
import { Building2, Shield, Users } from "lucide-react";
import { adminService, type AdminCotizacionAbierta, type AdminMetricas } from "@/services/admin.service";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export function AdminMetricasTab() {
  const [metrics, setMetrics] = useState<AdminMetricas | null>(null);
  const [openQuotes, setOpenQuotes] = useState<AdminCotizacionAbierta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([adminService.getMetricas(), adminService.listOpenQuotes()])
      .then(([nextMetrics, nextQuotes]) => {
        if (!active) return;
        setMetrics(nextMetrics);
        setOpenQuotes(nextQuotes);
      })
      .catch(() => {
        if (active) {
          setMetrics(null);
          setOpenQuotes([]);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="space-y-4 scroll-mt-6">
      <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="text-base font-semibold">Resumen / General</p>
          <p className="text-sm text-muted-foreground">
            Vista ejecutiva con métricas y actividad reciente del sistema.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" /> Empresas activas
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {metrics?.importadores_activos ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">
            Verificadas: {metrics?.importadores_verificados ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> Cotizaciones
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {metrics?.total_cotizaciones ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">
            Abiertas: {metrics?.cotizaciones_abiertas ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" /> Salud operativa
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {metrics?.ordenes_en_disputa ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">
            Operaciones en disputa
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold">
          Cotizaciones abiertas recientes
        </h3>
        <p className="text-sm text-muted-foreground">
          Resumen de actividad para seguimiento administrativo.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">País</th>
                <th className="px-3 py-2">Línea</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Fecha</th>
              </tr>
            </thead>

            <tbody>
              {openQuotes.slice(0, 12).map((quote) => (
                <tr
                  key={quote.id}
                  className="border-t border-border transition-colors hover:bg-primary/12 dark:hover:!bg-accent/12"
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    {quote.nombre_producto}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {quote.pais_importacion}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {quote.linea_producto}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {quote.estado}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(quote.fecha_creacion)}
                  </td>
                </tr>
              ))}

              {!openQuotes.length && !isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    No hay cotizaciones abiertas registradas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}