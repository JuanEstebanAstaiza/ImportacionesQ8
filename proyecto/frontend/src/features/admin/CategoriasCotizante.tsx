import { useState, type FormEvent } from "react";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus, Save, Tags, X } from "lucide-react";

import { TierBadge } from "@/features/cotizante/TierBadge";
import { adminService, type CategoriaCotizante } from "@/services/admin.service";

/**
 * Categorías de cotizante para la lista privada: cada una trae un tier (queda
 * fijo) y, si se quiere, días de acceso a Tendencias. Se eligen al crear un
 * cotizante o se le aplican después desde la tabla de cotizantes.
 */

const TIERS = ["Bronze", "Silver", "Gold", "Élite"] as const;

type Formulario = { nombre: string; descripcion: string; tier: string; dias: string };
const VACIO: Formulario = { nombre: "", descripcion: "", tier: "", dias: "" };

export function textoCategoria(c: Pick<CategoriaCotizante, "tier" | "dias_tendencias">): string {
  const partes = [];
  if (c.tier) partes.push(`tier ${c.tier}`);
  if (c.dias_tendencias) partes.push(`Tendencias por ${c.dias_tendencias} ${c.dias_tendencias === 1 ? "día" : "días"}`);
  return partes.length ? partes.join(" + ") : "Sin tier ni Tendencias";
}

export function CategoriasCotizante({ categorias, onCambio }: {
  categorias: CategoriaCotizante[];
  onCambio: (categoria: CategoriaCotizante) => void;
}) {
  const [editando, setEditando] = useState<string | "nueva" | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const abrir = (c: CategoriaCotizante | null) => {
    setError("");
    setEditando(c ? c.id : "nueva");
    setForm(c ? { nombre: c.nombre, descripcion: c.descripcion ?? "", tier: c.tier ?? "", dias: c.dias_tendencias ? String(c.dias_tendencias) : "" } : VACIO);
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const dias = form.dias.trim() ? Math.floor(Number(form.dias)) : null;
    if (form.nombre.trim().length < 2) { setError("Escribe el nombre de la categoría."); return; }
    if (dias !== null && (!Number.isFinite(dias) || dias < 1)) { setError("Los días de Tendencias deben ser 1 o más."); return; }
    setGuardando(true);
    setError("");
    const datos = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      tier: (form.tier || null) as CategoriaCotizante["tier"],
      dias_tendencias: dias,
    };
    try {
      const guardada = editando === "nueva"
        ? await adminService.crearCategoriaCotizante(datos)
        : await adminService.actualizarCategoriaCotizante(editando as string, datos);
      onCambio(guardada);
      setEditando(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la categoría.");
    } finally {
      setGuardando(false);
    }
  };

  const archivar = async (c: CategoriaCotizante) => {
    try {
      onCambio(await adminService.actualizarCategoriaCotizante(c.id, { activa: !c.activa }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la categoría.");
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <Tags className="h-4 w-4 text-primary dark:text-accent" /> Categorías de cotizante
          </p>
          <p className="text-sm text-muted-foreground">
            Para la lista privada: el tier con el que entra (queda fijo) y, si quieres, días de acceso a Tendencias.
            Se eligen al crear el cotizante o se aplican después desde la tabla.
          </p>
        </div>
        {editando === null && (
          <button type="button" onClick={() => abrir(null)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 dark:bg-accent dark:text-accent-foreground">
            <Plus className="h-4 w-4" /> Nueva categoría
          </button>
        )}
      </div>

      {editando !== null && (
        <form onSubmit={(e) => void guardar(e)} noValidate className="mb-4 grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">Nombre
            <input value={form.nombre} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej. Lista privada con Tendencias" className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">Tier
            <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground">
              <option value="">No cambia el tier (automático)</option>
              {TIERS.map((t) => <option key={t} value={t}>{t} (fijo)</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">Días de acceso a Tendencias
            <input inputMode="numeric" value={form.dias} onChange={(e) => setForm((f) => ({ ...f, dias: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
              placeholder="Vacío: sin Tendencias" className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground" />
            <span className="mt-0.5 block font-normal">Empiezan a contar el día en que se le asigna la categoría.</span>
          </label>
          <label className="text-xs font-medium text-muted-foreground">Descripción (opcional)
            <input value={form.descripcion} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground" />
          </label>
          {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setEditando(null)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm">
              <X className="h-4 w-4" /> Cancelar
            </button>
            <button type="submit" disabled={guardando} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-accent dark:text-accent-foreground">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
          </div>
        </form>
      )}

      {categorias.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          Todavía no hay categorías. Crea la primera, por ejemplo una que abra Tendencias por 30 días.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {categorias.map((c) => (
            <li key={c.id} className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center ${c.activa ? "" : "opacity-60"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{c.nombre}</p>
                  {c.tier && <TierBadge tier={c.tier} />}
                  {!c.activa && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Archivada</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {textoCategoria(c)} · {c.cotizantes} {c.cotizantes === 1 ? "cotizante" : "cotizantes"}
                  {c.descripcion ? ` · ${c.descripcion}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => abrir(c)} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button type="button" onClick={() => void archivar(c)} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground">
                  {c.activa ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                  {c.activa ? "Archivar" : "Reactivar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editando === null && error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        Editar una categoría no cambia a quienes ya la tienen: aplica a los que se les asigne desde ahora.
      </p>
    </section>
  );
}
