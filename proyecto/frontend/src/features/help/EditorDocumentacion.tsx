import { useCallback, useEffect, useState } from "react";
import { BookOpen, Eye, EyeOff, Pencil, Plus, X } from "lucide-react";

import { ayudaService, type ArticuloAyuda, type ArticuloAyudaPayload } from "@/services/ayuda.service";

const PERFILES: Array<{ valor: string; etiqueta: string }> = [
  { valor: "solicitante", etiqueta: "Solicitante" },
  { valor: "importadora", etiqueta: "Empresa" },
  { valor: "asesor", etiqueta: "Asesor" },
];

const VACIO: ArticuloAyudaPayload = {
  titulo: "",
  resumen: "",
  contenido: "",
  categoria: "Problemas frecuentes",
  roles: [],
  orden: 100,
  publicado: true,
};

/**
 * Mantenimiento de la documentación de la plataforma.
 *
 * La escribe quien atiende los tickets, que es quien ve a diario qué no se
 * entiende. Antes vivía en un archivo de código y cambiarla exigía desplegar,
 * así que en la práctica no crecía.
 */
export function EditorDocumentacion() {
  const [articulos, setArticulos] = useState<ArticuloAyuda[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState<ArticuloAyuda | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState<ArticuloAyudaPayload>(VACIO);
  const [guardando, setGuardando] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [datos, cats] = await Promise.all([
        ayudaService.listArticles(),
        ayudaService.listCategories().catch(() => [] as string[]),
      ]);
      setArticulos(datos.articulos);
      setCategorias(cats.length ? cats : datos.categorias);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la documentación.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  function abrirNuevo() {
    setEditando(null);
    setCreando(true);
    setForm(VACIO);
    setError("");
  }

  function abrirEdicion(articulo: ArticuloAyuda) {
    setCreando(false);
    setEditando(articulo);
    setForm({
      titulo: articulo.titulo,
      resumen: articulo.resumen,
      contenido: articulo.contenido || "",
      categoria: articulo.categoria,
      roles: articulo.roles || [],
      orden: articulo.orden,
      publicado: articulo.publicado,
    });
    setError("");
  }

  function cerrar() {
    setEditando(null);
    setCreando(false);
  }

  function alternarPerfil(valor: string) {
    setForm((prev) => {
      const actuales = prev.roles || [];
      return {
        ...prev,
        roles: actuales.includes(valor) ? actuales.filter((r) => r !== valor) : [...actuales, valor],
      };
    });
  }

  async function guardar() {
    if (form.titulo.trim().length < 5 || form.resumen.trim().length < 10) {
      setError("El título necesita al menos 5 caracteres y el resumen 10.");
      return;
    }
    setError("");
    setGuardando(true);
    try {
      if (editando) {
        await ayudaService.updateArticle(editando.id, form);
        setAviso("Artículo actualizado. Ya lo ven los usuarios.");
      } else {
        await ayudaService.createArticle(form);
        setAviso("Artículo publicado. Ya lo ven los usuarios.");
      }
      cerrar();
      await recargar();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar el artículo.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarPublicado(articulo: ArticuloAyuda) {
    setError("");
    try {
      if (articulo.publicado) {
        await ayudaService.unpublishArticle(articulo.id);
        setAviso(`«${articulo.titulo}» ya no se muestra. No se borró: sigue consultable desde aquí.`);
      } else {
        await ayudaService.updateArticle(articulo.id, { publicado: true });
        setAviso(`«${articulo.titulo}» vuelve a estar visible.`);
      }
      await recargar();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cambiar la visibilidad.");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-primary" />
            Documentación de ayuda
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Lo que escribas aquí lo ven los usuarios al instante. Cuando una duda se repita en los tickets,
            conviértela en artículo.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNuevo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nuevo artículo
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{error}</div>
      ) : null}
      {aviso ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-700">
          {aviso}
        </div>
      ) : null}

      {cargando ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : articulos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Todavía no hay artículos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">Artículo</th>
                <th className="py-2 pr-3">Categoría</th>
                <th className="py-2 pr-3">Perfiles</th>
                <th className="py-2 pr-3 text-right">Lecturas</th>
                <th className="py-2 pr-3 text-right">Útil</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {articulos.map((articulo) => {
                const votos = articulo.votos_util + articulo.votos_inutil;
                // Un artículo muy leído y votado como inútil es exactamente
                // donde se están generando los tickets.
                const falla = articulo.votos_inutil > articulo.votos_util && votos >= 3;
                return (
                  <tr key={articulo.id} className="border-b border-border/60 align-top">
                    <td className="py-2.5 pr-3">
                      <p className={`font-medium ${articulo.publicado ? "text-foreground" : "text-muted-foreground line-through"}`}>
                        {articulo.titulo}
                      </p>
                      <p className="line-clamp-2 max-w-md text-xs text-muted-foreground">{articulo.resumen}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{articulo.categoria}</td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {articulo.roles && articulo.roles.length ? articulo.roles.join(", ") : "Todos"}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{articulo.vistas}</td>
                    <td className="py-2.5 pr-3 text-right">
                      {votos === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className={falla ? "font-medium text-red-600" : ""}>
                          {articulo.votos_util}/{votos}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(articulo)}
                          title="Editar"
                          className="rounded-md border border-border p-1.5 hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void alternarPublicado(articulo);
                          }}
                          title={articulo.publicado ? "Retirar de la vista pública" : "Volver a publicar"}
                          className="rounded-md border border-border p-1.5 hover:bg-muted"
                        >
                          {articulo.publicado ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creando || editando ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <h2 className="text-base font-semibold">{editando ? "Editar artículo" : "Nuevo artículo"}</h2>
              <button type="button" onClick={cerrar} className="rounded-md border border-border p-1.5 hover:bg-muted" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Título — la pregunta tal como la haría el usuario
                </label>
                <input
                  value={form.titulo}
                  onChange={(event) => setForm((prev) => ({ ...prev, titulo: event.target.value }))}
                  placeholder="Ej. No recibo propuestas a mi cotización"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Respuesta corta — se lee sin abrir el artículo
                </label>
                <textarea
                  value={form.resumen}
                  onChange={(event) => setForm((prev) => ({ ...prev, resumen: event.target.value }))}
                  rows={2}
                  maxLength={400}
                  placeholder="Una o dos frases que resuelvan la duda a la mayoría."
                  className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Paso a paso (opcional) — para quien necesite el detalle
                </label>
                <textarea
                  value={form.contenido || ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, contenido: event.target.value }))}
                  rows={9}
                  placeholder={"Los saltos de línea se respetan.\n\n1. Primer paso\n2. Segundo paso"}
                  className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Categoría</label>
                  <input
                    list="categorias-ayuda"
                    value={form.categoria}
                    onChange={(event) => setForm((prev) => ({ ...prev, categoria: event.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  />
                  <datalist id="categorias-ayuda">
                    {categorias.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Orden dentro de la categoría
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={form.orden ?? 100}
                    onChange={(event) => setForm((prev) => ({ ...prev, orden: Number(event.target.value) }))}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  ¿A quién le sirve? Sin marcar ninguno, se muestra a todos.
                </label>
                <div className="flex flex-wrap gap-2">
                  {PERFILES.map((perfil) => {
                    const activo = (form.roles || []).includes(perfil.valor);
                    return (
                      <button
                        key={perfil.valor}
                        type="button"
                        onClick={() => alternarPerfil(perfil.valor)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          activo ? "border-primary bg-primary text-white" : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {perfil.etiqueta}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Acotar evita ruido: un artículo sobre el pool de cotizaciones no le dice nada a un solicitante
                  cuando busca otra cosa.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.publicado ?? true}
                  onChange={(event) => setForm((prev) => ({ ...prev, publicado: event.target.checked }))}
                />
                Visible para los usuarios
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-3">
              <button type="button" onClick={cerrar} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={() => {
                  void guardar();
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Publicar artículo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
