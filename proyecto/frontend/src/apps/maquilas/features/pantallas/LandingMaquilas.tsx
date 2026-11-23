import { useState, type CSSProperties, type ReactNode } from "react";
import { clsx } from "clsx";
import {
  Armchair, ArrowRight, BadgeCheck, Briefcase, Calculator, Camera, Check, ChevronDown, CircleCheck, ClipboardCheck,
  Container, Factory, FileText, FlaskConical, Footprints, Lock, MapPin, MessagesSquare, Package, Palette, PenTool,
  Pill, Scale, Send, Shapes, Shirt, SprayCan, Star, Store, Tag, Target, Users, UtensilsCrossed, WalletCards, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@shared/ui/design-system";
import { BotonAcento, Eyebrow, LandingShell } from "@shared/landing/LandingShell";
import type { PropsLandingApp } from "@shared/landing/LandingApp";
import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { pesos, unidades } from "@apps/maquilas/features/formato";
import type { VitrinaMaquilas } from "@apps/maquilas/features/tipos";
import { useVitrinaMaquilas } from "@apps/maquilas/features/useMaquilas";

/**
 * Portada pública de Zarpi Maquilas. Lo que muestra de la plataforma (cifras,
 * categorías, maquilas y productos) sale de `GET /maquilas/vitrina`: no hay
 * cifras inventadas. Si el módulo no responde, la portada se ve igual sin esa parte.
 */

const ACENTO = "#FF007A";
const texto: CSSProperties = { color: ACENTO };
const fondo: CSSProperties = { backgroundColor: ACENTO };
const suave: CSSProperties = { backgroundColor: `${ACENTO}1A`, color: ACENTO };

const SECCIONES = [
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "marca", label: "Crea tu marca" },
  { id: "confianza", label: "Confianza" },
  { id: "para-maquilas", label: "Para maquilas" },
  { id: "preguntas", label: "Preguntas" },
] as const;

const ICONO_CATEGORIA: Record<string, LucideIcon> = {
  textil: Shirt, calzado: Footprints, marroquineria: Briefcase, cosmetica: FlaskConical, alimentos: UtensilsCrossed,
  suplementos: Pill, aseo: SprayCan, empaques: Package, muebles: Armchair, plasticos: Container, metalmecanica: Wrench,
};

// Si la vitrina no carga, el ejemplo del pedido usa las etapas por defecto del módulo.
const ETAPAS_POR_DEFECTO = ["Compra de insumos", "Corte o preparación", "Fabricación", "Acabado", "Control de calidad", "Empaque", "Despacho"];
const RUTA_POR_DEFECTO = ["RUT con la actividad económica", "Registro de marca ante la SIC", "Facturación electrónica", "Etiquetado", "Código de barras GS1"];

const PASOS = [
  { icono: FileText, titulo: "Describe tu producto", texto: "Un brief guiado según la categoría: referencias, cantidades, materiales y fecha. Si quieres, arma la ficha técnica y descárgala en PDF." },
  { icono: Send, titulo: "Recibe propuestas", texto: "Precio por unidad según la cantidad, costo y días de la muestra, tiempo de producción y forma de pago. Las comparas lado a lado." },
  { icono: Camera, titulo: "Aprueba la muestra", texto: "La maquila te muestra fotos o video. Apruebas o pides ajustes: sin muestra aprobada no arranca la producción." },
  { icono: Factory, titulo: "Sigue la producción", texto: "Cada etapa queda con fotos, nota y fecha, y te avisamos si se atrasa frente a lo prometido." },
  { icono: ClipboardCheck, titulo: "Revisa la calidad", texto: "Antes de despachar, la maquila envía el reporte de inspección contra el checklist que acordaron. Tú lo apruebas." },
  { icono: Star, titulo: "Recibe y califica", texto: "Confirmas la entrega, calificas puntualidad, calidad y comunicación, y repites el pedido cuando lo necesites." },
];

const MODALIDADES = [
  { icono: Target, titulo: "A una maquila", texto: "Eliges en el directorio la que te gusta y le envías tu solicitud." },
  { icono: Users, titulo: "Abierta", texto: "Zarpi la envía a las maquilas verificadas que fabrican tu categoría y aceptan tu cantidad." },
  { icono: Tag, titulo: "Marca blanca", texto: "Escoges un producto listo del catálogo y lo pides con tu logo, etiqueta o empaque." },
];

const CONFIANZA = [
  { icono: BadgeCheck, titulo: "Maquilas verificadas", texto: "Revisamos el RUT, la cámara de comercio y el perfil antes de que una maquila reciba solicitudes." },
  { icono: Lock, titulo: "Tu idea, protegida", texto: "Si marcas la solicitud como confidencial, la maquila ve solo un resumen hasta aceptar el acuerdo. Queda registrado con fecha y usuario." },
  { icono: WalletCards, titulo: "Pagos por hitos", texto: "Pagas directo a la maquila: anticipo, contra muestra o contra entrega. Subes el comprobante y ella lo confirma." },
  { icono: ClipboardCheck, titulo: "Calidad acordada", texto: "El checklist y sus tolerancias quedan en la propuesta. No se despacha sin tu aprobación del reporte de calidad." },
  { icono: Star, titulo: "Reseñas reales", texto: "Solo califica quien recibió un pedido. Las métricas de cada maquila salen de sus entregas." },
  { icono: MessagesSquare, titulo: "Todo por escrito", texto: "Chat del pedido con adjuntos e historial, y la mesa de ayuda de Zarpi si algo sale mal." },
];

const PARA_MAQUILAS = [
  "Solicitudes de marcas que ya saben qué quieren fabricar, con cantidades y fechas",
  "Tu catálogo de marca blanca: productos listos que los clientes piden con su logo",
  "Un perfil con galería, certificaciones y la calificación de tus entregas",
  "Cuentas para tu equipo y cobro por hitos, con todo el pedido por escrito",
];

const REGISTRO_MAQUILA = [
  { titulo: "Registra tu empresa", texto: "Razón social, NIT, representante y qué fabricas." },
  { titulo: "Sube tus documentos", texto: "RUT, cámara de comercio, certificaciones y fotos de tus trabajos." },
  { titulo: "Zarpi te verifica", texto: "Con la verificación apareces en el directorio y empiezas a recibir solicitudes." },
];

const PREGUNTAS = [
  {
    p: "¿Zarpi recibe el dinero del pedido?",
    r: "No. Pagas directamente a la maquila según los hitos de la propuesta (por ejemplo, 50 % de anticipo y 50 % contra entrega). Subes el comprobante en el pedido y la maquila lo confirma. Zarpi deja el registro, pero no recibe ni retiene el dinero.",
  },
  {
    p: "¿Qué pasa si la muestra no me convence?",
    r: "Pides ajustes con tus comentarios y la maquila envía una nueva ronda. Mientras el pedido está en la muestra también puedes cancelarlo.",
  },
  {
    p: "¿Cuántas unidades tengo que pedir?",
    r: "Cada maquila define su pedido mínimo. En el directorio filtras por cantidad y solo ves las que aceptan la tuya; en marca blanca el mínimo está en cada producto.",
  },
  {
    p: "¿Cómo protejo mi diseño?",
    r: "Marca la solicitud como confidencial. La maquila verá solo el título y la categoría hasta aceptar el acuerdo de confidencialidad; ahí se abren las fotos, la ficha y el detalle.",
  },
  {
    p: "¿Necesito tener mi marca registrada?",
    r: "No para empezar. En el estudio de marca, la ruta legal te muestra los trámites que aplican a lo que vendes (RUT, registro ante la SIC, etiquetado, GS1 o INVIMA si aplica), con la guía y el enlace oficial de cada uno.",
  },
  {
    p: "¿Qué significa «Verificada por Zarpi»?",
    r: "Que revisamos los documentos de la empresa y su perfil antes de publicarla. No es una garantía sobre cada pedido: para eso están la muestra, el checklist de calidad y el registro de todo el pedido.",
  },
];

/** Pedido de muestra para el hero: ilustra cómo se sigue un pedido, sin cifras de la plataforma. */
function PedidoEjemplo({ etapas }: { etapas: string[] }) {
  const lista = etapas.length ? etapas : ETAPAS_POR_DEFECTO;
  const enCurso = Math.min(2, lista.length - 1);
  return (
    <div className="relative" aria-label="Ejemplo de cómo se ve un pedido en Zarpi Maquilas">
      <div className="pointer-events-none absolute -inset-4 rounded-[2rem] opacity-25 blur-2xl" style={fondo} aria-hidden="true" />
      <div className="relative rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Así se ve tu pedido</p>
            <p className="mt-1 text-lg font-semibold leading-tight">Camisetas con tu logo</p>
          </div>
          <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground">Ejemplo</span>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CircleCheck className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Muestra aprobada en la segunda ronda
        </div>

        <ol className="mt-5 space-y-0">
          {lista.map((etapa, i) => {
            const hecha = i < enCurso;
            const actual = i === enCurso;
            return (
              <li key={etapa} className="relative flex gap-3 pb-3 last:pb-0">
                {i < lista.length - 1 && (
                  <span className={clsx("absolute left-[9px] top-5 h-full w-px", hecha ? "" : "bg-border")} style={hecha ? fondo : undefined} aria-hidden="true" />
                )}
                <span
                  className={clsx("relative z-10 mt-0.5 flex h-[19px] w-[19px] flex-shrink-0 items-center justify-center rounded-full border-2",
                    !hecha && !actual && "border-border bg-card")}
                  style={hecha ? { ...fondo, borderColor: ACENTO } : actual ? { borderColor: ACENTO, backgroundColor: "transparent" } : undefined}
                  aria-hidden="true"
                >
                  {hecha && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  {actual && <span className="h-2 w-2 animate-pulse rounded-full" style={fondo} />}
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className={clsx("text-sm", hecha || actual ? "font-medium text-foreground" : "text-muted-foreground")}>{etapa}</span>
                  {actual && <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={suave}>En curso</span>}
                  {hecha && <Camera className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-label="Con fotos" />}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4 text-xs">
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-muted-foreground">Anticipo</p>
            <p className="mt-0.5 font-semibold text-emerald-700 dark:text-emerald-400">Confirmado</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-muted-foreground">Contra entrega</p>
            <p className="mt-0.5 font-semibold">Pendiente</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const numero = (n: number) => n.toLocaleString("es-CO");

function Cifras({ cifras }: { cifras: VitrinaMaquilas["cifras"] }) {
  // Con pocas maquilas las cifras no dicen nada: se muestran desde que la red tiene algo de tamaño.
  if (cifras.maquilas < 3) return null;
  const items = [
    { valor: numero(cifras.maquilas), etiqueta: "Maquilas verificadas" },
    cifras.ciudades > 1 && { valor: numero(cifras.ciudades), etiqueta: "Ciudades" },
    cifras.productos > 0 && { valor: numero(cifras.productos), etiqueta: "Productos de marca blanca" },
    cifras.pedidos_entregados > 0 && { valor: numero(cifras.pedidos_entregados), etiqueta: "Pedidos entregados" },
    cifras.calificacion && cifras.resenas >= 5 && { valor: `${cifras.calificacion.toFixed(1)} ★`, etiqueta: `Calificación (${numero(cifras.resenas)} reseñas)` },
  ].filter(Boolean) as { valor: string; etiqueta: string }[];
  return (
    <section aria-label="Zarpi Maquilas en cifras" className="border-t border-border px-4 py-10 sm:px-6">
      <dl className="mx-auto grid max-w-[1100px] grid-cols-2 gap-6 sm:grid-cols-3 lg:flex lg:justify-between">
        {items.map((c) => (
          <div key={c.etiqueta}>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.etiqueta}</dt>
            <dd className="mt-1 text-3xl font-bold tracking-tight" style={texto}>{c.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Categorias({ categorias }: { categorias: VitrinaMaquilas["categorias"] }) {
  if (!categorias.length) return null;
  return (
    <section aria-labelledby="titulo-categorias" className="border-t border-border px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <h2 id="titulo-categorias" className="text-center text-sm font-semibold text-muted-foreground">Qué puedes fabricar</h2>
        <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
          {categorias.map((c) => {
            const Icono = ICONO_CATEGORIA[c.clave] ?? Shapes;
            return (
              <li key={c.clave} className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm">
                <Icono className="h-4 w-4" style={texto} aria-hidden="true" />
                <span>{c.nombre}</span>
                {c.maquilas > 0 && <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{c.maquilas}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Calificacion({ valor, resenas }: { valor: number | null; resenas: number }) {
  if (!valor) return <span className="text-xs text-muted-foreground">Nueva en Zarpi</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
      {valor.toFixed(1)} <span className="font-normal text-muted-foreground">({resenas})</span>
    </span>
  );
}

function Iniciales({ nombre }: { nombre: string }) {
  const letras = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return (
    <div className="flex h-full w-full items-center justify-center text-2xl font-bold" style={suave} aria-hidden="true">{letras || "M"}</div>
  );
}

/** Maquilas y productos reales; solo aparece cuando ya hay algo publicado. */
function Vitrina({ vitrina, onVer }: { vitrina: VitrinaMaquilas; onVer: () => void }) {
  const { maquilas, productos } = vitrina;
  if (!maquilas.length && !productos.length) return null;
  return (
    <section id="vitrina" aria-labelledby="titulo-vitrina" className="scroll-mt-16 border-t border-border px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow acento={ACENTO}>Ya están en Zarpi</Eyebrow>
            <h2 id="titulo-vitrina" className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">Maquilas verificadas, listas para tu próxima producción.</h2>
          </div>
          <Button variant="secondary" iconRight={<ArrowRight className="h-4 w-4" />} onClick={onVer}>Ver el directorio</Button>
        </div>

        {maquilas.length > 0 && (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {maquilas.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={onVer} className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-foreground/20 hover:shadow-md">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                    {m.foto ? <ImagenArchivo src={m.foto} alt="" className="h-full w-full" /> : <Iniciales nombre={m.nombre_comercial} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {m.nombre_comercial}
                      <BadgeCheck className="h-4 w-4 flex-shrink-0" style={texto} aria-label="Verificada por Zarpi" />
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />{m.ciudad}{m.categorias.length ? ` · ${m.categorias.slice(0, 2).join(", ")}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 whitespace-nowrap">
                      <Calificacion valor={m.calificacion} resenas={m.resenas} />
                      {m.pedido_minimo ? <span className="text-xs text-muted-foreground">Pedido mínimo {unidades(m.pedido_minimo)}</span> : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {productos.length > 0 && (
          <>
            <h3 className="mt-14 flex items-center gap-2 font-semibold"><Tag className="h-4 w-4" style={texto} aria-hidden="true" />Marca blanca: listos para tu logo</h3>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {productos.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={onVer} className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-foreground/20 hover:shadow-md">
                    <div className="aspect-square w-full overflow-hidden bg-muted">
                      {p.foto ? <ImagenArchivo src={p.foto} alt={p.nombre} className="h-full w-full" /> : <Iniciales nombre={p.nombre} />}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{p.categoria}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{p.nombre}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{[p.maquila, p.ciudad].filter(Boolean).join(" · ")}</p>
                      <div className="mt-auto pt-3">
                        {p.precio_desde != null && <p className="text-sm font-bold">Desde {pesos(p.precio_desde)} <span className="text-xs font-normal text-muted-foreground">c/u</span></p>}
                        <p className="text-xs text-muted-foreground">Mínimo {unidades(p.pedido_minimo)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function Tarjeta({ icono: Icono, titulo, children, className }: { icono: LucideIcon; titulo: string; children: ReactNode; className?: string }) {
  return (
    <article className={clsx("flex flex-col rounded-2xl border border-border bg-card p-6", className)}>
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={suave}>
        <Icono className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="font-semibold">{titulo}</h3>
      <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </article>
  );
}

function Pregunta({ p, r }: { p: string; r: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="border-b border-border">
      <h3>
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          className="flex w-full items-center justify-between gap-4 py-5 text-left font-medium transition-colors hover:text-foreground/80"
        >
          {p}
          <ChevronDown className={clsx("h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform", abierta && "rotate-180")} aria-hidden="true" />
        </button>
      </h3>
      {abierta && <p className="-mt-1 pb-5 pr-8 text-sm leading-relaxed text-muted-foreground">{r}</p>}
    </div>
  );
}

type Props = Omit<PropsLandingApp, "contenido" | "onCtaSecundario"> & { onRegistrarMaquila: () => void };

/** Landing pública de Zarpi Maquilas. «Registra tu maquila» lleva al registro propio de las maquiladoras. */
export function LandingMaquilas({ autenticado, destinos, onIniciarSesion, onCrearCuenta, onEntrar, onPolicy, onRegistrarMaquila }: Props) {
  const { data: vitrina } = useVitrinaMaquilas();
  const fabricar = () => (autenticado ? onEntrar() : onCrearCuenta());
  const ruta = vitrina?.ruta_legal.length ? vitrina.ruta_legal : RUTA_POR_DEFECTO;

  return (
    <LandingShell
      appId="maquilas"
      nombre="Zarpi Maquilas"
      destinos={destinos}
      secciones={SECCIONES}
      acento={ACENTO}
      autenticado={autenticado}
      onIniciarSesion={onIniciarSesion}
      onCrearCuenta={onCrearCuenta}
      onEntrar={onEntrar}
      textoEntrar="Entrar a Maquilas"
      onPolicy={onPolicy}
      notaPie="Zarpi conecta marcas y maquilas, verifica a las maquilas y deja registro de cada pedido. No fabrica ni recibe el dinero del pedido."
    >
      {/* HERO */}
      <section className="relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 lg:pt-20">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl" style={fondo} aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1100px] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Eyebrow acento={ACENTO}>Zarpi Maquilas</Eyebrow>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              Fabrica tus productos con maquilas verificadas <span style={texto}>y lanza tu propia marca.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Cuenta qué quieres producir y recibe propuestas de talleres y plantas. Compara precios por cantidad, aprueba la muestra y sigue la producción etapa por etapa hasta que el lote llega a tus manos.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <BotonAcento grande acento={ACENTO} onClick={fabricar}>Fabrica tu marca <ArrowRight className="h-4 w-4" /></BotonAcento>
              <Button variant="secondary" size="lg" className="h-11 px-6" icon={<Store className="h-4 w-4" aria-hidden="true" />} onClick={onRegistrarMaquila}>
                Registra tu maquila
              </Button>
            </div>
            <ul className="mt-8 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2.5"><BadgeCheck className="h-4 w-4 flex-shrink-0" style={texto} aria-hidden="true" />Cada maquila pasa por verificación: RUT y cámara de comercio</li>
              <li className="flex items-center gap-2.5"><Lock className="h-4 w-4 flex-shrink-0" style={texto} aria-hidden="true" />Tu idea protegida con acuerdo de confidencialidad</li>
              <li className="flex items-center gap-2.5"><WalletCards className="h-4 w-4 flex-shrink-0" style={texto} aria-hidden="true" />Pagas por hitos, directo a la maquila</li>
            </ul>
          </div>
          <PedidoEjemplo etapas={vitrina?.etapas ?? []} />
        </div>
      </section>

      {vitrina && <Cifras cifras={vitrina.cifras} />}
      {vitrina && <Categorias categorias={vitrina.categorias} />}

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="scroll-mt-16 border-t border-border bg-muted/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-[1100px]">
          <Eyebrow acento={ACENTO}>Cómo funciona</Eyebrow>
          <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">De la idea al lote terminado, sin perderle el rastro.</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PASOS.map(({ icono: Icono, titulo, texto: t }, i) => (
              <li key={titulo} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white" style={fondo}>{i + 1}</span>
                  <Icono className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="mb-1.5 font-semibold">{titulo}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h3 className="font-semibold">Tres formas de pedir</h3>
            <div className="mt-5 grid gap-6 md:grid-cols-3">
              {MODALIDADES.map(({ icono: Icono, titulo, texto: t }) => (
                <div key={titulo} className="flex gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={suave}><Icono className="h-4 w-4" aria-hidden="true" /></span>
                  <div>
                    <p className="font-medium">{titulo}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{t}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {vitrina && <Vitrina vitrina={vitrina} onVer={fabricar} />}

      {/* CREA TU MARCA */}
      <section id="marca" className="scroll-mt-16 border-t border-border px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-[1100px]">
          <Eyebrow acento={ACENTO}>Crea tu marca</Eyebrow>
          <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">No solo fabricas: sales con tu nombre.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Las herramientas para pasar de «tengo una idea» a «tengo una marca», en el mismo lugar donde haces tus pedidos.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Tarjeta icono={Palette} titulo="Estudio de marca">
              Logo, paleta, tipografías y archivos de etiqueta y empaque en un kit. Lo adjuntas a tu solicitud y la maquila recibe todo junto.
            </Tarjeta>
            <Tarjeta icono={PenTool} titulo="Diseño por encargo">
              ¿Aún no tienes logo o etiqueta? Pídelo al equipo de diseño de Zarpi desde tu marca: te entrega versiones, pides cambios y lo aprobado queda en tu kit.
            </Tarjeta>
            <Tarjeta icono={Scale} titulo="Ruta legal">
              <p>Los trámites para vender con tu marca, con guía y enlace oficial. Marcas tu avance paso a paso:</p>
              <ul className="mt-3 space-y-1.5">
                {ruta.map((paso) => (
                  <li key={paso} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={texto} aria-hidden="true" />{paso}</li>
                ))}
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={texto} aria-hidden="true" />INVIMA, si vendes cosmética, alimentos, suplementos o aseo</li>
              </ul>
            </Tarjeta>
            <Tarjeta icono={Calculator} titulo="Calculadora de costo y margen">
              <p>Desde cualquier propuesta: suma empaque, etiquetas, envío e impuestos al precio por unidad y te dice a cuánto vender y cuántas unidades necesitas para recuperar la inversión.</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                {["Costo total", "Precio sugerido", "Punto de equilibrio"].map((e) => (
                  <span key={e} className="rounded-lg bg-muted/70 px-2 py-2 font-medium text-foreground">{e}</span>
                ))}
              </div>
            </Tarjeta>
          </div>
        </div>
      </section>

      {/* CONFIANZA */}
      <section id="confianza" className="scroll-mt-16 border-t border-border bg-muted/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-[1100px]">
          <Eyebrow acento={ACENTO}>Confianza</Eyebrow>
          <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">Reglas claras para las dos partes.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONFIANZA.map(({ icono, titulo, texto: t }) => <Tarjeta key={titulo} icono={icono} titulo={titulo}>{t}</Tarjeta>)}
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            «Verificada por Zarpi» significa que revisamos los documentos y el perfil de la empresa, no que garantizamos cada pedido.
          </p>
        </div>
      </section>

      {/* PARA MAQUILAS */}
      <section id="para-maquilas" className="scroll-mt-16 border-t border-border px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow acento={ACENTO}>Para maquilas</Eyebrow>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">¿Tienes un taller o una planta? Llena tu capacidad.</h2>
            <ul className="mt-6 space-y-3">
              {PARA_MAQUILAS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={texto} aria-hidden="true" />{item}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <BotonAcento grande acento={ACENTO} onClick={onRegistrarMaquila}>Registra tu maquila <ArrowRight className="h-4 w-4" /></BotonAcento>
            </div>
          </div>
          <ol className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            {REGISTRO_MAQUILA.map((paso, i) => (
              <li key={paso.titulo} className="relative flex gap-4 pb-7 last:pb-0">
                {i < REGISTRO_MAQUILA.length - 1 && <span className="absolute left-[17px] top-10 h-[calc(100%-2.5rem)] w-px bg-border" aria-hidden="true" />}
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold" style={suave}>{i + 1}</span>
                <div>
                  <p className="font-semibold">{paso.titulo}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{paso.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PREGUNTAS */}
      <section id="preguntas" className="scroll-mt-16 border-t border-border bg-muted/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-[760px]">
          <Eyebrow acento={ACENTO}>Preguntas frecuentes</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Lo que nos preguntan antes de arrancar.</h2>
          <div className="mt-8 border-t border-border">
            {PREGUNTAS.map((q) => <Pregunta key={q.p} {...q} />)}
          </div>
        </div>
      </section>

      {/* CIERRE */}
      <section className="px-4 py-16 sm:px-6">
        <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-3xl px-6 py-12 text-white sm:px-12" style={fondo}>
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">¿Tienes un producto en mente?</h2>
              <p className="mt-2 leading-relaxed text-white/90">Crea tu cuenta, describe lo que quieres fabricar y empieza a recibir propuestas. Es la misma cuenta para toda la suite Zarpi.</p>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row">
              <button type="button" onClick={fabricar} style={{ backgroundColor: "#ffffff", color: "#0a0a0a" }} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-6 text-sm font-semibold transition hover:opacity-90">
                Fabrica tu marca <ArrowRight className="h-4 w-4" />
              </button>
              {!autenticado && (
                <button type="button" onClick={onIniciarSesion} className="inline-flex h-11 items-center justify-center rounded-lg border border-white/50 px-6 text-sm font-semibold text-white transition hover:bg-white/10">
                  Iniciar sesión
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </LandingShell>
  );
}
