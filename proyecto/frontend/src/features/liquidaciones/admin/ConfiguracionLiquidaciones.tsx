import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { CirclePlus, Loader2, RotateCcw, Save, Settings, Trash2 } from "lucide-react";

import { Button, Input } from "@/components/design-system";
import { liquidacionesService } from "@/services/liquidaciones.service";
import { useInvalidarLiquidaciones } from "@/features/liquidaciones/useLiquidaciones";
import type { ParametrosLiquidaciones } from "@/features/liquidaciones/tipos";

type ClaveNumero = "dias_max_cierre" | "horas_para_confirmar" | "fotos_min" | "fotos_max" | "videos_max"
  | "mb_max_foto" | "mb_max_video" | "mb_max_documento";
type ClaveLista = "categorias" | "motivos_rechazo" | "checklist_revision";

/** Rangos espejo de `RANGOS` en el backend: aquí solo orientan, la validación real es la del servidor. */
const NUMEROS: { clave: ClaveNumero; etiqueta: string; ayuda: string; min: number; max: number; sufijo: string }[] = [
  { clave: "dias_max_cierre", etiqueta: "Días máximos de cierre", ayuda: "Plazo más largo que un vendedor puede dar a su lote desde que se publica.", min: 1, max: 60, sufijo: "días" },
  { clave: "horas_para_confirmar", etiqueta: "Horas para confirmar la venta", ayuda: "Tiempo que tiene una reserva para marcarse como vendida antes de vencer y liberar el lote.", min: 1, max: 336, sufijo: "h" },
  { clave: "fotos_min", etiqueta: "Fotos mínimas", ayuda: "Fotos reales que exige cada lote para enviarse a revisión.", min: 1, max: 20, sufijo: "fotos" },
  { clave: "fotos_max", etiqueta: "Fotos máximas", ayuda: "Tope de fotos por lote.", min: 1, max: 20, sufijo: "fotos" },
  { clave: "videos_max", etiqueta: "Videos máximos", ayuda: "Videos opcionales por lote (0 los desactiva).", min: 0, max: 5, sufijo: "videos" },
  { clave: "mb_max_foto", etiqueta: "Peso máximo por foto", ayuda: "Tamaño máximo de cada foto que se sube.", min: 1, max: 50, sufijo: "MB" },
  { clave: "mb_max_video", etiqueta: "Peso máximo por video", ayuda: "Tamaño máximo de cada video que se sube.", min: 10, max: 1024, sufijo: "MB" },
  { clave: "mb_max_documento", etiqueta: "Peso máximo por documento", ayuda: "Fichas técnicas, RUT, comprobantes y facturas.", min: 1, max: 100, sufijo: "MB" },
];

const LISTAS: { clave: ClaveLista; etiqueta: string; ayuda: string; placeholder: string }[] = [
  { clave: "categorias", etiqueta: "Categorías", ayuda: "Las que el vendedor puede elegir al publicar y que filtran el catálogo.", placeholder: "Nueva categoría" },
  { clave: "motivos_rechazo", etiqueta: "Motivos de rechazo", ayuda: "Opciones que el equipo marca al devolver una liquidación; el vendedor las ve tal cual.", placeholder: "Nuevo motivo" },
  { clave: "checklist_revision", etiqueta: "Lista de revisión", ayuda: "Puntos que el revisor debe marcar antes de poder aprobar.", placeholder: "Nuevo punto de revisión" },
];

/** Los números se editan como texto para poder vaciar el campo mientras se escribe. */
type Formulario = Record<ClaveNumero, string> & Record<ClaveLista, string[]>;

function aFormulario(p: ParametrosLiquidaciones): Formulario {
  const numeros = Object.fromEntries(NUMEROS.map(({ clave }) => [clave, String(p[clave] ?? "")])) as Record<ClaveNumero, string>;
  return { ...numeros, categorias: [...p.categorias], motivos_rechazo: [...p.motivos_rechazo], checklist_revision: [...p.checklist_revision] };
}

function limpiarLista(lista: string[]): string[] {
  return lista.map((item) => item.trim()).filter(Boolean);
}

/** Solo se mandan los campos que cambiaron, para no pisar lo que otro admin guardó a la vez. */
function cambiosDe(form: Formulario, original: ParametrosLiquidaciones): Partial<ParametrosLiquidaciones> {
  const cambios: Partial<ParametrosLiquidaciones> = {};
  NUMEROS.forEach(({ clave }) => {
    const valor = Number(form[clave]);
    if (form[clave].trim() !== "" && valor !== original[clave]) cambios[clave] = valor;
  });
  LISTAS.forEach(({ clave }) => {
    const lista = limpiarLista(form[clave]);
    if (JSON.stringify(lista) !== JSON.stringify(original[clave])) cambios[clave] = lista;
  });
  return cambios;
}

function EditorLista({ etiqueta, ayuda, placeholder, items, onCambiar }: {
  etiqueta: string; ayuda: string; placeholder: string; items: string[]; onCambiar: (items: string[]) => void;
}) {
  const [nuevo, setNuevo] = useState("");

  function agregar() {
    const texto = nuevo.trim();
    if (!texto) return;
    if (items.some((item) => item.trim().toLowerCase() === texto.toLowerCase())) {
      toast.error("Ese elemento ya está en la lista.");
      return;
    }
    onCambiar([...items, texto]);
    setNuevo("");
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold">{etiqueta}</p>
      <p className="mb-3 text-xs text-muted-foreground">{ayuda}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              value={item}
              onChange={(e) => onCambiar(items.map((actual, j) => (j === i ? e.target.value : actual)))}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label={`${etiqueta} ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => onCambiar(items.filter((_, j) => j !== i))}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
              aria-label="Quitar"
              title="Quitar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-muted-foreground">La lista no puede quedar vacía.</li>}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-dashed border-border bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button size="sm" variant="secondary" icon={<CirclePlus className="h-3.5 w-3.5" />} onClick={agregar} disabled={!nuevo.trim()}>
          Agregar
        </Button>
      </div>
    </div>
  );
}

export function ConfiguracionLiquidaciones() {
  const invalidar = useInvalidarLiquidaciones();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["liquidaciones", "admin", "configuracion"],
    queryFn: liquidacionesService.configuracion,
    refetchOnWindowFocus: false,
  });
  const [form, setForm] = useState<Formulario | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Solo se carga una vez: un refresco en segundo plano no debe borrar lo que se está editando.
  useEffect(() => {
    if (data && !form) setForm(aFormulario(data));
  }, [data, form]);

  const cambios = form && data ? cambiosDe(form, data) : {};
  const hayCambios = Object.keys(cambios).length > 0;

  async function guardar() {
    if (!hayCambios) return;
    setGuardando(true);
    try {
      const guardado = await liquidacionesService.guardarConfiguracion(cambios);
      setForm(aFormulario(guardado));
      toast.success("Configuración guardada");
      await invalidar();
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "No se pudo guardar la configuración.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <Settings className="h-4 w-4 text-primary dark:text-accent" />
            Configuración de Liquidaciones
          </p>
          <p className="text-sm text-muted-foreground">
            Estos parámetros aplican a las publicaciones y reservas nuevas; lo que ya está publicado o reservado conserva sus condiciones.
          </p>
        </div>
        {form && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} disabled={!hayCambios || guardando} onClick={() => data && setForm(aFormulario(data))}>
              Descartar
            </Button>
            <Button size="sm" icon={<Save className="h-3.5 w-3.5" />} loading={guardando} disabled={!hayCambios} onClick={() => void guardar()}>
              Guardar cambios
            </Button>
          </div>
        )}
      </div>

      {isLoading || (!form && !error) ? (
        <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando configuración…</p>
      ) : error ? (
        <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-muted-foreground shadow-sm">
          No pudimos cargar la configuración. {error instanceof Error ? error.message : ""}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Plazos y archivos</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {NUMEROS.map(({ clave, etiqueta, ayuda, min, max, sufijo }) => (
                <Input
                  key={clave}
                  id={`liq-${clave}`}
                  label={etiqueta}
                  type="number"
                  inputMode="numeric"
                  min={min}
                  max={max}
                  value={form[clave]}
                  onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
                  suffix={<span className="text-xs">{sufijo}</span>}
                  hint={`${ayuda} Entre ${min} y ${max}.`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {LISTAS.map(({ clave, etiqueta, ayuda, placeholder }) => (
              <EditorLista
                key={clave}
                etiqueta={etiqueta}
                ayuda={ayuda}
                placeholder={placeholder}
                items={form[clave]}
                onCambiar={(items) => setForm({ ...form, [clave]: items })}
              />
            ))}
          </div>

          <div className="flex justify-end">
            <Button icon={<Save className="h-4 w-4" />} loading={guardando} disabled={!hayCambios} onClick={() => void guardar()}>
              Guardar cambios
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
