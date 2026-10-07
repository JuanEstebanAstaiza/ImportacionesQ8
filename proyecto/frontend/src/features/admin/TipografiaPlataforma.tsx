import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, RotateCcw, Search, ShieldCheck, Type } from "lucide-react";
import { toast } from "sonner";

import {
  CATEGORIAS_FUENTE,
  cargarHojaTipografia,
  cargarVistaPrevia,
  tipografiaService,
  type CategoriaFuente,
  type FuenteActiva,
  type FuenteCatalogo,
  type TipografiaActiva,
} from "@/services/tipografia.service";

/**
 * Tipografía de toda la plataforma. El admin busca entre ~2.100 fuentes libres
 * (catálogo de Fontsource), las previsualiza y, al aplicarlas, el servidor las
 * descarga una vez y las sirve él mismo: los visitantes no se conectan a
 * ningún servicio externo.
 */

const ESPERA_BUSQUEDA_MS = 300;
const ETIQUETA_CATEGORIA = Object.fromEntries(CATEGORIAS_FUENTE.map((c) => [c.valor, c.etiqueta])) as Record<string, string>;

type Elegida = Pick<FuenteCatalogo, "id" | "familia" | "categoria">;

function mensaje(error: unknown, defecto: string): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

/** Carga las fuentes de vista previa y devuelve el alias con que pintarlas. */
function useVistaPrevia(fuente: Elegida | null, peso: number): { familia: string | null; cargando: boolean } {
  const [familia, setFamilia] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    let vigente = true;
    setFamilia(null);
    if (!fuente) return;
    setCargando(true);
    cargarVistaPrevia(fuente.id, peso)
      .then((alias) => { if (vigente) setFamilia(alias); })
      .catch((e) => { if (vigente) toast.error(mensaje(e, "No se pudo previsualizar la fuente.")); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [fuente?.id, peso]);
  return { familia, cargando };
}

function pila(alias: string | null): string | undefined {
  return alias ? `"${alias}", system-ui, sans-serif` : undefined;
}

export function TipografiaPlataforma() {
  const [activa, setActiva] = useState<TipografiaActiva | null>(null);
  const [texto, setTexto] = useState<Elegida | null>(null);
  const [titulos, setTitulos] = useState<Elegida | null>(null);
  const [mismaParaTitulos, setMismaParaTitulos] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false);

  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<CategoriaFuente | "">("");
  const [fuentes, setFuentes] = useState<FuenteCatalogo[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [errorCatalogo, setErrorCatalogo] = useState("");

  useEffect(() => {
    tipografiaService.activa()
      .then((a) => {
        setActiva(a);
        if (a.texto) setTexto(a.texto);
        if (a.titulos) { setTitulos(a.titulos); setMismaParaTitulos(false); }
      })
      .catch((e) => toast.error(mensaje(e, "No se pudo leer la tipografía actual.")));
  }, []);

  useEffect(() => {
    let vigente = true;
    const espera = window.setTimeout(() => {
      setCargandoCatalogo(true);
      setErrorCatalogo("");
      tipografiaService.catalogo(q, categoria, 1)
        .then((r) => { if (vigente) { setFuentes(r.fuentes); setTotal(r.total); setPagina(1); } })
        .catch((e) => { if (vigente) setErrorCatalogo(mensaje(e, "No se pudo cargar el catálogo de fuentes.")); })
        .finally(() => { if (vigente) setCargandoCatalogo(false); });
    }, ESPERA_BUSQUEDA_MS);
    return () => { vigente = false; window.clearTimeout(espera); };
  }, [q, categoria]);

  async function cargarMas() {
    setCargandoCatalogo(true);
    try {
      const r = await tipografiaService.catalogo(q, categoria, pagina + 1);
      setFuentes((actuales) => [...actuales, ...r.fuentes]);
      setPagina(r.pagina);
    } catch (e) {
      toast.error(mensaje(e, "No se pudieron cargar más fuentes."));
    } finally {
      setCargandoCatalogo(false);
    }
  }

  const fuenteTitulos = mismaParaTitulos ? texto : titulos;
  const previaTexto = useVistaPrevia(texto, 400);
  const previaTextoFuerte = useVistaPrevia(texto, 600);
  const previaTitulos = useVistaPrevia(fuenteTitulos, 700);

  const sinCambios = useMemo(() => {
    const actualTexto = activa?.texto?.id ?? null;
    const actualTitulos = activa?.titulos?.id ?? null;
    const nuevoTitulos = mismaParaTitulos ? null : (titulos?.id ?? null);
    return actualTexto === (texto?.id ?? null) && actualTitulos === (nuevoTitulos === texto?.id ? null : nuevoTitulos);
  }, [activa, texto, titulos, mismaParaTitulos]);

  async function aplicar(restaurar = false) {
    setAplicando(true);
    try {
      const resultado = await tipografiaService.aplicar(
        restaurar ? null : (texto?.id ?? null),
        restaurar || mismaParaTitulos ? null : (titulos?.id ?? null),
      );
      setActiva(resultado);
      if (restaurar) { setTexto(null); setTitulos(null); setMismaParaTitulos(true); }
      cargarHojaTipografia(true);
      toast.success(restaurar
        ? "Se restauró la tipografía de marca."
        : "Tipografía aplicada a toda la plataforma. Las fuentes quedaron alojadas en el servidor.");
    } catch (e) {
      toast.error(mensaje(e, "No se pudo aplicar la tipografía."));
    } finally {
      setAplicando(false);
      setConfirmarRestaurar(false);
    }
  }

  const descripcionActiva = (f: FuenteActiva | null | undefined, marca: string) => (f ? f.familia : marca);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold"><Type className="h-4 w-4 text-primary" />Tipografía de la plataforma</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Elige la fuente de todo el texto y, si quieres, una distinta para los títulos. Al aplicarla, el servidor la
              descarga una sola vez y desde entonces la sirve él mismo: los visitantes no se conectan a ningún servicio
              externo.
            </p>
          </div>
          <div className="text-right text-sm">
            <p><span className="text-muted-foreground">Texto:</span> <strong>{descripcionActiva(activa?.texto, "AT Avenor (marca)")}</strong></p>
            <p><span className="text-muted-foreground">Títulos:</span> <strong>{activa?.texto ? descripcionActiva(activa?.titulos ?? activa?.texto, "") : "Elvellon (marca)"}</strong></p>
            {activa?.texto ? (
              confirmarRestaurar ? (
                <span className="mt-2 inline-flex items-center gap-2 text-xs">
                  ¿Volver a Elvellon y AT Avenor?
                  <button type="button" onClick={() => void aplicar(true)} disabled={aplicando} className="rounded-md bg-red-600 px-2 py-1 font-medium text-white">Restaurar</button>
                  <button type="button" onClick={() => setConfirmarRestaurar(false)} className="rounded-md border border-border px-2 py-1">Cancelar</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmarRestaurar(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-accent">
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar tipografía de marca
                </button>
              )
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Catálogo */}
        <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar fuente (Inter, Montserrat, Lora…)"
              className="w-full rounded-lg border border-border bg-white py-1.5 pl-8 pr-3 text-sm"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[{ valor: "" as const, etiqueta: "Todas" }, ...CATEGORIAS_FUENTE].map((c) => (
              <button
                key={c.valor || "todas"}
                type="button"
                onClick={() => setCategoria(c.valor)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${categoria === c.valor ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                {c.etiqueta}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {cargandoCatalogo && fuentes.length === 0 ? "Cargando catálogo…" : `${total.toLocaleString("es-CO")} fuentes`}
          </p>

          {errorCatalogo ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorCatalogo}</p>
          ) : (
            <ul className="mt-2 max-h-[520px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {fuentes.map((f) => {
                const enTexto = texto?.id === f.id;
                const enTitulos = !mismaParaTitulos && titulos?.id === f.id;
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.familia}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ETIQUETA_CATEGORIA[f.categoria] ?? f.categoria} · {f.pesos.length} {f.pesos.length === 1 ? "grosor" : "grosores"} · {f.licencia}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTexto(f)}
                      className={`rounded-lg border px-2 py-1 text-xs font-medium ${enTexto ? "border-primary bg-primary text-white dark:border-accent dark:bg-accent dark:text-accent-foreground" : "border-border hover:bg-muted"}`}
                    >
                      {enTexto ? <Check className="inline h-3 w-3" /> : null} Texto
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTitulos(f); setMismaParaTitulos(false); }}
                      className={`rounded-lg border px-2 py-1 text-xs font-medium ${enTitulos ? "border-primary bg-primary text-white dark:border-accent dark:bg-accent dark:text-accent-foreground" : "border-border hover:bg-muted"}`}
                    >
                      {enTitulos ? <Check className="inline h-3 w-3" /> : null} Títulos
                    </button>
                  </li>
                );
              })}
              {!cargandoCatalogo && fuentes.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">Ninguna fuente coincide con la búsqueda.</li>
              ) : null}
            </ul>
          )}
          {fuentes.length < total ? (
            <button type="button" onClick={() => void cargarMas()} disabled={cargandoCatalogo} className="mt-3 w-full rounded-lg border border-border py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60">
              {cargandoCatalogo ? "Cargando…" : "Cargar más fuentes"}
            </button>
          ) : null}
        </section>

        {/* Vista previa */}
        <section className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Vista previa</h3>
            {(previaTexto.cargando || previaTitulos.cargando) ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Texto:</span> <strong>{texto?.familia ?? "Tipografía de marca"}</strong></p>
            <p>
              <span className="text-muted-foreground">Títulos:</span>{" "}
              <strong>{mismaParaTitulos ? (texto ? "la misma del texto" : "Tipografía de marca") : (titulos?.familia ?? "—")}</strong>
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mismaParaTitulos} onChange={(e) => setMismaParaTitulos(e.target.checked)} className="h-4 w-4 accent-primary" />
            Usar la misma fuente para los títulos
          </label>

          <div className="rounded-xl border border-border bg-background p-5">
            {texto ? (
              <div style={{ fontFamily: pila(previaTexto.familia) }}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-accent">Quiénes somos</p>
                <h1 className="mt-2 text-3xl leading-tight" style={{ fontFamily: pila(previaTitulos.familia), fontWeight: 700 }}>
                  Un mundo de productos, más cerca
                </h1>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                  Cotiza con empresas importadoras verificadas, compara propuestas y sigue tu pedido hasta la bodega.
                  Áéíóú ñ ¿? ¡! — 0123456789 · COP 40.000
                </p>
                <div className="mt-4 rounded-lg border border-border p-3">
                  <p style={{ fontFamily: pila(previaTextoFuerte.familia), fontWeight: 600 }}>Bandas de resistencia</p>
                  <p className="text-sm text-muted-foreground">Pídelo antes del 12 de octubre (estimado con 75 días por mar).</p>
                  <span className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-white dark:bg-accent dark:text-accent-foreground" style={{ fontFamily: pila(previaTextoFuerte.familia), fontWeight: 600 }}>
                    Pedir propuestas
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Elige una fuente del catálogo con el botón «Texto» para verla aquí.</p>
            )}
          </div>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
            Solo se ofrecen fuentes con licencia libre (OFL, Apache, UFL, CC0, MIT). Se instalan los grosores 300 a 800 y
            las cursivas, para alfabeto latino.
          </p>

          <button
            type="button"
            onClick={() => void aplicar()}
            disabled={!texto || aplicando || sinCambios || (!mismaParaTitulos && !titulos)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 dark:bg-accent dark:text-accent-foreground"
          >
            {aplicando ? <><Loader2 className="h-4 w-4 animate-spin" /> Descargando fuentes al servidor…</> : "Aplicar a toda la plataforma"}
          </button>
        </section>
      </div>
    </div>
  );
}
