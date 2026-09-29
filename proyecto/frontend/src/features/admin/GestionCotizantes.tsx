import { useEffect, useMemo, useState } from "react";
import { History, Save, Search, WalletCards } from "lucide-react";

import { TierBadge } from "@/features/cotizante/TierBadge";
import {
  adminService,
  type AdminCotizante,
  type AdminPointMovement,
  type AdminTierThreshold,
} from "@/services/admin.service";

const TIERS = ["Bronze", "Silver", "Gold", "Élite"];

const TIER_ORDER: Record<string, number> = {
  Bronze: 0,
  Silver: 1,
  Gold: 2,
  Élite: 3,
};

function sortThresholds(list: AdminTierThreshold[]): AdminTierThreshold[] {
  return [...list].sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));
}

const EMPTY_THRESHOLDS: AdminTierThreshold[] = TIERS.map((tier) => ({
  tier,
  minimo_cotizaciones: 0,
  minimo_ordenes: 0,
  minimo_valor_operaciones_usd: 0,
}));

function updateThreshold(rows: AdminTierThreshold[], tier: string, key: keyof AdminTierThreshold, value: number) {
  return rows.map((row) => (row.tier === tier ? { ...row, [key]: value } : row));
}

export function GestionCotizantes() {
  const [cotizantes, setCotizantes] = useState<AdminCotizante[]>([]);
  const [thresholds, setThresholds] = useState<AdminTierThreshold[]>(EMPTY_THRESHOLDS);
  const [selected, setSelected] = useState<AdminCotizante | null>(null);
  const [movements, setMovements] = useState<AdminPointMovement[]>([]);
  const [search, setSearch] = useState("");
  const [delta, setDelta] = useState("1");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const [users, config] = await Promise.all([
        adminService.listCotizantes(search),
        adminService.getTierThresholds(),
      ]);
      setCotizantes(users);
      setThresholds(config.length ? sortThresholds(config) : EMPTY_THRESHOLDS);
      if (selected) setSelected(users.find((user) => user.id === selected.id) || null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la gestión de cotizantes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const visibleCotizantes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cotizantes;
    return cotizantes.filter((user) =>
      [user.nombre || "", user.email, user.tier].some((value) => value.toLowerCase().includes(query))
    );
  }, [cotizantes, search]);

  async function cambiarTier(usuario: AdminCotizante, tier: string) {
    setSaving(true);
    setError("");
    try {
      const updated = await adminService.updateCotizanteTier(usuario.id, tier);
      setCotizantes((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setSelected(updated);
      setMessage("Tier manual actualizado.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo actualizar el tier.");
    } finally {
      setSaving(false);
    }
  }

  async function guardarUmbrales() {
    setSaving(true);
    setError("");
    try {
      const updated = await adminService.updateTierThresholds(thresholds);
      setThresholds(sortThresholds(updated));
      // Al guardar, el backend recalcula el tier de los cotizantes automáticos.
      setCotizantes(await adminService.listCotizantes(search));
      setMessage("Umbrales guardados y tiers recalculados.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron guardar los umbrales.");
    } finally {
      setSaving(false);
    }
  }

  async function cargarHistorial(usuario: AdminCotizante) {
    setSelected(usuario);
    setError("");
    try {
      setMovements(await adminService.listCotizantePointMovements(usuario.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el historial.");
    }
  }

  async function ajustarPuntos() {
    if (!selected) return;
    const amount = Number.parseInt(delta, 10);
    if (!Number.isInteger(amount) || amount === 0) {
      setError("Ingresa una cantidad entera distinta de cero.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await adminService.adjustCotizantePoints(selected.id, amount, "ajuste", description);
      setCotizantes((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setSelected(updated);
      setMovements(await adminService.listCotizantePointMovements(updated.id));
      setDescription("");
      setMessage("Saldo de puntos actualizado.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo ajustar el saldo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-accent/30 dark:bg-accent/10 dark:text-accent">{message}</div>}

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Cotizantes y tiers</h2>
            <p className="text-sm text-muted-foreground">El cambio manual prevalece sobre el cálculo automático.</p>
          </div>
          <div className="w-full max-w-xs">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cotizante..."
                className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary dark:focus:border-accent"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">Cotizante</th>
                <th className="px-3 py-3">Tier</th>
                <th className="px-3 py-3">Puntos</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleCotizantes.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3">
                    <p className="font-medium">{user.nombre || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <TierBadge tier={user.tier} />
                      {user.tier_manual && <span className="text-[11px] text-muted-foreground">Manual</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold">{user.puntos_cotizacion}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={user.tier}
                        disabled={saving}
                        onChange={(event) => {
                          void cambiarTier(user, event.target.value);
                        }}
                        className="h-8 rounded-md border border-border bg-card px-2 text-xs focus:border-primary dark:focus:border-accent"
                      >
                        {TIERS.map((tier) => (
                          <option key={tier}>{tier}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          void cargarHistorial(user);
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:border-primary hover:text-primary dark:hover:border-accent dark:hover:text-accent"
                      >
                        <History className="h-3.5 w-3.5" />
                        Historial
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && visibleCotizantes.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay cotizantes para mostrar.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Umbrales automáticos</h2>
            <p className="text-sm text-muted-foreground">Base estadística para la progresión futura de tiers.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void guardarUmbrales();
            }}
            disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 dark:bg-accent dark:text-accent-foreground"
          >
            <Save className="h-4 w-4" />
            Guardar
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {thresholds.map((row) => (
            <div key={row.tier} className="rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center justify-between">
                <TierBadge tier={row.tier} />
              </div>
              <label className="mb-2 block text-xs text-muted-foreground">
                Cotizaciones mínimas
                <input
                  type="number"
                  min="0"
                  value={row.minimo_cotizaciones}
                  onChange={(event) =>
                    setThresholds((rows) => updateThreshold(rows, row.tier, "minimo_cotizaciones", Number(event.target.value)))
                  }
                  className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-sm focus:border-primary dark:focus:border-accent"
                />
              </label>
              <label className="mb-2 block text-xs text-muted-foreground">
                Órdenes mínimas
                <input
                  type="number"
                  min="0"
                  value={row.minimo_ordenes}
                  onChange={(event) =>
                    setThresholds((rows) => updateThreshold(rows, row.tier, "minimo_ordenes", Number(event.target.value)))
                  }
                  className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-sm focus:border-primary dark:focus:border-accent"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Valor mínimo USD
                <input
                  type="number"
                  min="0"
                  value={row.minimo_valor_operaciones_usd}
                  onChange={(event) =>
                    setThresholds((rows) =>
                      updateThreshold(rows, row.tier, "minimo_valor_operaciones_usd", Number(event.target.value))
                    )
                  }
                  className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-sm focus:border-primary dark:focus:border-accent"
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      {selected && (
        <section className="grid gap-5 rounded-xl border border-border bg-card p-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-primary dark:text-accent" />
              <div>
                <h2 className="text-base font-semibold">Ajustar puntos</h2>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
              </div>
            </div>
            <p className="mb-3 text-sm">
              Saldo actual: <strong>{selected.puntos_cotizacion} puntos</strong>
            </p>
            <input
              type="number"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              placeholder="Ej. 10 o -2"
              className="mb-2 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary dark:focus:border-accent"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Motivo del ajuste"
              rows={3}
              className="mb-3 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary dark:focus:border-accent"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void ajustarPuntos();
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 dark:bg-accent dark:text-accent-foreground"
            >
              <WalletCards className="h-4 w-4" />
              Aplicar ajuste
            </button>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Historial de movimientos</h3>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(movement.fecha).toLocaleString("es-CO")}</td>
                      <td className="px-3 py-2 font-medium">{movement.tipo}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${movement.delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {movement.delta >= 0 ? "+" : ""}
                        {movement.delta}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">Saldo {movement.saldo_resultante}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movements.length === 0 && <p className="p-5 text-center text-sm text-muted-foreground">Sin movimientos registrados.</p>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}