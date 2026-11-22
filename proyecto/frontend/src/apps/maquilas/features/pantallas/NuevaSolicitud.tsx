import { useMemo, useState } from "react";
import { FileText, Lock, Send, Users } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Input, Select, Textarea } from "@shared/ui/design-system";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { unidades } from "@apps/maquilas/features/formato";
import { useInvalidarMaquilas, useParametrosMaquilas, usePerfilPublico } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import { SubirArchivoMaquila } from "@apps/maquilas/features/componentes/SubirArchivoMaquila";
import type { ArchivoMaquila, FichaGuiada } from "@apps/maquilas/features/tipos";

const SECCIONES_FICHA: { clave: keyof FichaGuiada; etiqueta: string; ayuda: string }[] = [
  { clave: "medidas", etiqueta: "Medidas y tallas", ayuda: "Tabla de medidas por talla o dimensiones del producto" },
  { clave: "materiales", etiqueta: "Materiales", ayuda: "Tela, gramaje, composición, insumos" },
  { clave: "colores", etiqueta: "Colores", ayuda: "Nombre y código Pantone de cada color" },
  { clave: "acabados", etiqueta: "Acabados", ayuda: "Costuras, estampado, bordado, texturas" },
  { clave: "empaque", etiqueta: "Empaque", ayuda: "Bolsa, caja, unidades por paquete" },
  { clave: "etiquetado", etiqueta: "Etiquetado", ayuda: "Etiqueta de marca, de composición, código de barras" },
  { clave: "notas", etiqueta: "Notas para la maquila", ayuda: "Lo que no puede faltar" },
];
const FICHA_VACIA: FichaGuiada = { medidas: "", materiales: "", colores: "", acabados: "", empaque: "", etiquetado: "", notas: "" };

const manana = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Brief de fabricación. Con `maquiladoraId` va dirigido a esa maquila; sin él, el
 * cliente elige entre pedir a una (desde el directorio) o abrirla a las compatibles.
 */
export function NuevaSolicitud({ maquiladoraId, onCreada, onIrDirectorio }: {
  maquiladoraId?: string;
  onCreada: (solicitudId: string) => void;
  onIrDirectorio: () => void;
}) {
  const { data: parametros } = useParametrosMaquilas();
  const { data: elegida } = usePerfilPublico(maquiladoraId);
  const invalidar = useInvalidarMaquilas();
  const [categoria, setCategoria] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [fechaObjetivo, setFechaObjetivo] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [referencias, setReferencias] = useState<ArchivoMaquila[]>([]);
  const [ficha, setFicha] = useState<ArchivoMaquila | null>(null);
  const [confidencial, setConfidencial] = useState(false);
  const [conFicha, setConFicha] = useState(false);
  const [fichaGuiada, setFichaGuiada] = useState<FichaGuiada>(FICHA_VACIA);
  const [generando, setGenerando] = useState(false);
  const fichaLlena = conFicha && Object.values(fichaGuiada).some((v) => v.trim());
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const dirigida = Boolean(maquiladoraId);
  // Con una maquila elegida, solo sus categorías.
  const categorias = useMemo(() => {
    const todas = parametros?.categorias ?? [];
    return elegida ? todas.filter((c) => elegida.categorias.includes(c.clave)) : todas;
  }, [parametros, elegida]);
  const plantilla = categoria ? (parametros?.plantillas[categoria] ?? parametros?.plantillas.otros ?? []) : [];

  function validar() {
    const e: Record<string, string> = {};
    if (!categoria) e.categoria = "Elige qué vas a fabricar";
    if (titulo.trim().length < 3) e.titulo = "Ponle un nombre al producto";
    if (descripcion.trim().length < 10) e.descripcion = "Cuéntale a la maquila qué quieres (mínimo 10 caracteres)";
    const n = Number.parseInt(cantidad, 10);
    if (!n || n < 1) e.cantidad = "¿Cuántas unidades?";
    else if (elegida?.pedido_minimo && n < elegida.pedido_minimo) e.cantidad = `${elegida.nombre_comercial} fabrica desde ${unidades(elegida.pedido_minimo)}`;
    if (ciudad.trim().length < 2) e.ciudad = "¿A qué ciudad se entrega?";
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar() {
    if (!validar()) return;
    setEnviando(true);
    try {
      const solicitud = await maquilasService.crearSolicitud({
        modalidad: dirigida ? "dirigida" : "abierta",
        maquiladora_id: maquiladoraId,
        categoria,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        cantidad: Number.parseInt(cantidad, 10),
        presupuesto_unitario: presupuesto ? Number.parseInt(presupuesto, 10) : null,
        fecha_objetivo: fechaObjetivo || null,
        ciudad_entrega: ciudad.trim(),
        campos,
        referencias: referencias.map((r) => r.id),
        ficha_tecnica: ficha?.id ?? null,
        ficha_guiada: fichaLlena ? fichaGuiada : null,
        confidencial,
      });
      await invalidar();
      toast.success(dirigida ? "Enviamos tu solicitud a la maquila." : "Publicamos tu solicitud. Te avisamos cuando lleguen propuestas.");
      onCreada(solicitud.id);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  async function verFicha() {
    setGenerando(true);
    try {
      const pdf = await maquilasService.vistaPreviaFicha({
        titulo: titulo.trim() || "Mi producto", categoria: categoria || "otros",
        cantidad: Number.parseInt(cantidad, 10) || undefined, ficha: fichaGuiada,
      });
      // Se descarga: abrir un blob en otra pestaña depende del bloqueador de ventanas.
      const url = URL.createObjectURL(pdf);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `Ficha técnica - ${titulo.trim() || "mi producto"}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card padding="lg" className={clsx("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        dirigida ? "border-primary/30 dark:border-accent/40" : "")}>
        <div className="flex items-start gap-3">
          {dirigida ? <Send className="mt-0.5 h-5 w-5 text-primary dark:text-accent" aria-hidden="true" /> : <Users className="mt-0.5 h-5 w-5 text-primary dark:text-accent" aria-hidden="true" />}
          <div>
            <p className="font-semibold">{dirigida ? `Solicitud para ${elegida?.nombre_comercial ?? "la maquila elegida"}` : "Solicitud abierta"}</p>
            <p className="text-sm text-muted-foreground">
              {dirigida ? "Solo esta maquila la recibe y te responde con su propuesta."
                : "La enviamos a las maquilas verificadas que fabrican esa categoría y cantidad, para que compares propuestas."}
            </p>
          </div>
        </div>
        {!dirigida && <Button variant="secondary" onClick={onIrDirectorio}>Prefiero elegir una maquila</Button>}
      </Card>

      <Card padding="lg" className="space-y-4">
        <h3 className="font-semibold">El producto</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Select label="Qué vas a fabricar" value={categoria} onChange={(e) => { setCategoria(e.target.value); setCampos({}); }}>
              <option value="">Elige una categoría</option>
              {categorias.map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
            </Select>
            {errores.categoria && <p className="mt-1 text-xs text-destructive">{errores.categoria}</p>}
          </div>
          <Input label="Nombre del producto" value={titulo} onChange={(e) => setTitulo(e.target.value)} error={errores.titulo} placeholder="Ej.: Camiseta oversize con mi marca" maxLength={160} />
          <div className="md:col-span-2">
            <Textarea label="Descríbelo" rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} error={errores.descripcion} maxLength={4000}
              hint="Cómo es, para quién, qué lo hace tuyo. Mientras más claro, mejores propuestas." />
          </div>
          {plantilla.map((campo) => (
            <div key={campo.clave} className={campo.tipo === "texto_largo" ? "md:col-span-2" : ""}>
              {campo.tipo === "texto_largo" ? (
                <Textarea label={campo.etiqueta} rows={3} value={campos[campo.clave] ?? ""} hint={campo.ayuda} maxLength={1000}
                  onChange={(e) => setCampos((c) => ({ ...c, [campo.clave]: e.target.value }))} />
              ) : (
                <Input label={campo.etiqueta} value={campos[campo.clave] ?? ""} hint={campo.ayuda} maxLength={1000}
                  onChange={(e) => setCampos((c) => ({ ...c, [campo.clave]: e.target.value }))} />
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h3 className="font-semibold">Cantidad, presupuesto y entrega</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Input label="Cantidad" type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} error={errores.cantidad} suffix="und." />
          <Input label="Presupuesto por unidad (opcional)" type="number" min={0} value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} prefix="$" />
          <Input label="¿Para cuándo? (opcional)" type="date" min={manana()} value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} />
          <Input label="Ciudad de entrega" value={ciudad} onChange={(e) => setCiudad(e.target.value)} error={errores.ciudad} />
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h3 className="font-semibold">Referencias</h3>
        <div className="flex flex-wrap items-center gap-3">
          <SubirArchivoMaquila tipo="referencia" etiqueta="Subir fotos de referencia" multiple maxArchivos={10 - referencias.length}
            maxMb={parametros?.mb_max_foto} disabled={referencias.length >= 10} onSubido={(a) => setReferencias((r) => [...r, a])} />
          <SubirArchivoMaquila tipo="ficha_tecnica" etiqueta={ficha ? "Cambiar ficha técnica" : "Subir ficha técnica (PDF)"}
            maxMb={parametros?.mb_max_documento} onSubido={setFicha} />
        </div>
        <ArchivosVista archivos={[...referencias, ...(ficha ? [ficha] : [])]}
          onQuitar={(id) => (ficha?.id === id ? setFicha(null) : setReferencias((r) => r.filter((x) => x.id !== id)))} />
        <div className="rounded-xl border border-border p-3">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={conFicha} onChange={(e) => setConFicha(e.target.checked)} className="mt-1" />
            <span>
              <span className="flex items-center gap-1 font-medium"><FileText className="h-4 w-4" aria-hidden="true" />¿No tienes ficha técnica? Ármala aquí</span>
              <span className="block text-muted-foreground">Llena lo que sepas por secciones y generamos el PDF. Es la referencia para la muestra y la inspección de calidad.</span>
            </span>
          </label>
          {conFicha && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                {SECCIONES_FICHA.map((sec) => (
                  <Textarea key={sec.clave} label={sec.etiqueta} hint={sec.ayuda} rows={2} maxLength={1500} value={fichaGuiada[sec.clave]}
                    onChange={(e) => setFichaGuiada((f) => ({ ...f, [sec.clave]: e.target.value }))} />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{ficha ? "Como también subiste un PDF, la maquila recibe ese PDF y estas secciones." : "Al enviar la solicitud adjuntamos el PDF generado."}</p>
                <Button size="sm" variant="secondary" icon={<FileText className="h-3.5 w-3.5" />} loading={generando} disabled={!fichaLlena}
                  onClick={() => void verFicha()}>Descargar el PDF</Button>
              </div>
            </div>
          )}
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
          <input type="checkbox" checked={confidencial} onChange={(e) => setConfidencial(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1 font-medium"><Lock className="h-4 w-4" aria-hidden="true" />Pedir confidencialidad</span>
            <span className="block text-muted-foreground">La maquila ve solo el nombre, la categoría y la cantidad hasta que acepte el acuerdo de confidencialidad. Después ve la descripción, las referencias y la ficha.</span>
          </span>
        </label>
      </Card>

      <div className="flex justify-end">
        <Button icon={<Send className="h-4 w-4" />} loading={enviando} onClick={() => void enviar()}>
          {dirigida ? "Enviar a la maquila" : "Pedir propuestas"}
        </Button>
      </div>
    </div>
  );
}
