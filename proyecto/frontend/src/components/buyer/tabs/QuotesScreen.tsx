import { useState, useEffect, useRef } from "react";
import { Info, FileText, Plus, Search, ExternalLink, WalletCards } from "lucide-react";
import { clsx } from "clsx";

import { Quote } from "@/types/quote";

import { SidebarCtrl } from "@/types/portal";

import { Breadcrumb } from "@/app/components/navigation/Breadcrumb";

import { Badge, Button, Card, Input, Select } from "@/app/components/design-system";
import { Modal } from "@/app/App";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { businessService, type BackendPropuesta, type MotivoEleccion } from "@/services/business.service";

import { leerPropuesta, pesos as pesosCop } from "@/features/propuestas/calculo";

import { TierBadge } from "@/features/cotizante/TierBadge";

import { Sidebar, AppHeader, USER } from "@/app/App";
import type { QuoteResponse } from "@/types/response";
import { cantidadConUnidad } from "@/utils/formatos";

export function QuotesScreen({ onNewQuote, onViewDetail, onRefreshQuotes, creditos, sb, quotes, responses }: { onNewQuote: () => void; onViewDetail: (id: string) => void; onRefreshQuotes?: () => Promise<void>; creditos: number; sb: SidebarCtrl; quotes: Quote[]; responses: QuoteResponse[] }) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");
  const [modeF, setModeF] = useState("");
  const [respF, setRespF] = useState("");
  const [quoteToUnlock, setQuoteToUnlock] = useState<Quote | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  // Estado para controlar el popover de créditos al lado del título
  const [showCreditosPopover, setShowCreditosPopover] = useState(false);
  const creditosPopoverRef = useRef<HTMLDivElement>(null);

  const lastQ = quotes[0] ?? null;
  const responseCountByQuoteId = responses.reduce<Record<string, number>>((acc, response) => {
    acc[response.quoteId] = (acc[response.quoteId] || 0) + 1;
    return acc;
  }, {});

  // Cierre automático del popover al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (creditosPopoverRef.current && !creditosPopoverRef.current.contains(event.target as Node)) {
        setShowCreditosPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = quotes.filter(q => {
    const ms = !search || [q.code, q.product, q.importer].some(v => v.toLowerCase().includes(search.toLowerCase()));
    const mst = !statusF || q.status === statusF;
    const mm = !modeF || q.mode === modeF;
    const count = responseCountByQuoteId[q.id] || 0;
    const mr = !respF || (respF === "sin" ? count === 0 : count > 0);
    return ms && mst && mm && mr;
  });

  async function unlockQuote() {
    if (!quoteToUnlock) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      await businessService.unlockQuoteByPoint(quoteToUnlock.id);
      setQuoteToUnlock(null);
      await onRefreshQuotes?.();
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : "No se pudo desbloquear la cotización.");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="quotes" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb} />
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{ label: "Inicio", onClick: () => sb.onNav("dashboard") }, { label: "Cotizaciones" }]} />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight">Cotizaciones</h1>
                
                {/* POP OVER DE CRÉDITOS ANIMADO EN EL ENCABEZADO */}
                <div className="relative" ref={creditosPopoverRef}>
                  <button
                    type="button"
                    onClick={() => setShowCreditosPopover((prev) => !prev)}
                    onMouseEnter={() => setShowCreditosPopover(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-primary transition-all duration-200 hover:border-primary/40 hover:shadow-sm dark:border-accent/30 dark:text-accent dark:hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <WalletCards className="h-3.5 w-3.5 animate-pulse" />
                    <span>{creditos} créditos</span>
                  </button>

                  {showCreditosPopover && (
                    <div className="absolute left-0 top-full mt-2.5 w-72 z-50 rounded-2xl border border-border bg-card p-4 shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-accent/10 dark:text-accent">
                          <WalletCards className="h-4 w-4" />
                        </div>
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-foreground">Créditos disponibles</p>
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary dark:bg-accent/20 dark:text-accent">
                              {creditos}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            <strong>1 crédito</strong> te permite enviar una cotización a empresas de categorías superiores (Plata, Oro, etc.).
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Info className="h-3 w-3 text-primary dark:text-accent" /> Se descuentan por desbloqueo
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowCreditosPopover(false)}
                          className="font-medium text-primary hover:underline dark:text-accent"
                        >
                          Entendido
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button variant="primary" className="dark:bg-accent dark:text-black dark:hover:bg-accent/80" icon={<Plus className="w-4 h-4" />} onClick={onNewQuote}>Nueva cotización</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card padding="md">
              <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-semibold">Última cotización</h2>{lastQ && <Badge variant={lastQ.status} />}</div>
              {lastQ ? (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div><p className="text-xs text-muted-foreground mb-0.5">Código</p><p className="text-sm font-mono font-medium">{lastQ.code}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Fecha</p><p className="text-sm">{lastQ.date}</p></div>
                    <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Producto</p><p className="text-sm font-medium">{lastQ.product}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Modalidad</p><span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium rounded-full dark:!text-accent dark:!bg-accent/20", lastQ.mode === "Dirigida" ? "bg-blue-50 text-blue-700" : "bg-primary/20 text-primary")}>{lastQ.mode}</span></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Respuestas</p><p className="text-sm font-medium text-muted-foreground">{responseCountByQuoteId[lastQ.id] || 0}</p></div>
                  </div>
                  <div className="pt-3 mt-3 border-t border-border">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<ExternalLink className="w-3 h-3" />}
                      onClick={() => onViewDetail(lastQ.id)}
                      className="hover:!bg-primary hover:!border-primary hover:!text-primary-foreground dark:hover:!bg-accent dark:hover:!border-accent dark:hover:!text-accent-foreground transition-colors"
                    >
                      Ver detalle
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No hay cotizaciones registradas aún.</p>
                </div>
              )}
            </Card>
            <Card padding="md">
              <h2 className="text-sm font-semibold mb-4">Estado de respuestas</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Con propuestas</p>
                  <p className="text-xl font-semibold">{quotes.filter((quote) => (responseCountByQuoteId[quote.id] || 0) > 0).length}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Sin propuestas</p>
                  <p className="text-xl font-semibold">{quotes.filter((quote) => (responseCountByQuoteId[quote.id] || 0) === 0).length}</p>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-4">Historial de cotizaciones</h2>
            <Card padding="sm" className="mb-4 bg-card border-border text-card-foreground">
              <div className="flex flex-wrap gap-3 items-end">
                {/* Campo Búsqueda */}
                <div className="flex-1 min-w-[160px]">
                  <Input
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    prefix={<Search className="w-4 h-4 text-muted-foreground" />}
                    className="focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:border-accent dark:focus-within:ring-accent/20"
                  />
                </div>

                {/* Filtro Estado */}
                <div className="w-44">
                  <Select
                    value={statusF}
                    onChange={(e) => setStatusF(e.target.value)}
                    className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20"
                  >
                    <option value="">Estado</option>
                    <option value="created">Creada</option>
                    <option value="directed">Dirigida</option>
                    <option value="open">Abierta</option>
                    <option value="accepted">Aceptada</option>
                    <option value="active-order">Operación activa</option>
                    <option value="rejected-importer">Rechazada por importadora</option>
                  </Select>
                </div>

                {/* Filtro Modalidad */}
                <div className="w-32">
                  <Select
                    value={modeF}
                    onChange={(e) => setModeF(e.target.value)}
                    className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20"
                  >
                    <option value="">Modalidad</option>
                    <option value="Dirigida">Dirigida</option>
                    <option value="Abierta">Abierta</option>
                  </Select>
                </div>

                {/* Filtro Respuestas Recibidas */}
                <div className="w-44">
                  <Select
                    value={respF}
                    onChange={(e) => setRespF(e.target.value)}
                    className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20"
                  >
                    <option value="">Respuestas recibidas</option>
                    <option value="con">Con respuestas</option>
                    <option value="sin">Sin respuestas</option>
                  </Select>
                </div>

                {/* Botón Limpiar */}
                {(search || statusF || modeF || respF) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStatusF("");
                      setModeF("");
                      setRespF("");
                    }}
                    className="hover:text-primary dark:hover:text-accent"
                  >
                    Limpiar
                  </Button>
                )}
              </div>
            </Card>

            <Card padding="none">
              <div className="px-5 py-3.5 border-b border-border"><p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{filtered.length}</span> cotizaciones</p></div>
              {filtered.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="border-b border-border">{["Código", "Fecha", "Producto", "Importadora", "Modalidad", "Estado", "Resp.", "Últ. act.", ""].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody>{filtered.map((row, i) => (
                      <tr key={row.id} className={clsx("border-b border-border/60 hover:bg-muted/40 transition-colors", i % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                        <td className="px-4 py-3 font-mono text-xs font-medium">{row.code}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-3 font-medium max-w-[180px]"><span className="truncate block">{row.product}</span></td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.importer}</td>
                        <td className="px-4 py-3"><span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium rounded-full dark:!text-accent dark:!bg-accent/20", row.mode === "Dirigida" ? "bg-blue-50 text-blue-700" : "bg-primary/20 text-primary")}>{row.mode}</span></td>
                        <td className="px-4 py-3">
                          {row.bloqueada ? (
                            <div className="flex min-w-[150px] flex-col items-start gap-1">
                              <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">Cotización bloqueada</span>
                              <span className="text-[11px] text-muted-foreground">Requiere <TierBadge tier={row.tierMinimoRequerido} /></span>
                            </div>
                          ) : <Badge variant={row.status} />}
                        </td>
                        <td className="px-4 py-3 text-center"><span className="text-xs text-muted-foreground">{responseCountByQuoteId[row.id] || 0}</span></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{row.updatedAt}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<ExternalLink className="w-3 h-3" />}
                              onClick={() => onViewDetail(row.id)}
                              className="hover:!bg-primary hover:!border-primary hover:!text-primary-foreground dark:hover:!bg-accent dark:hover:!border-accent dark:hover:!text-accent-foreground transition-colors"
                            >
                              Ver detalle
                            </Button>
                            {row.bloqueada && <Button variant="primary" size="sm" onClick={() => { setUnlockError(""); setQuoteToUnlock(row); }}>Desbloquear por 1 crédito</Button>}
                          </div>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <div className="py-16 text-center"><FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No se encontraron cotizaciones</p></div>}
            </Card>
          </div>
        </main>
      </div>

      <Modal open={Boolean(quoteToUnlock)} onClose={() => { if (!unlocking) setQuoteToUnlock(null); }} title="Desbloquear cotización">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm font-semibold">{quoteToUnlock?.code} · {quoteToUnlock?.product}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Tu nivel:</span><TierBadge tier={quoteToUnlock?.solicitanteTier} />
              <span>Requerido:</span><TierBadge tier={quoteToUnlock?.tierMinimoRequerido} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Se descontará 1 crédito de tu saldo para habilitar esta oportunidad.</p>
          <p className="text-xs text-muted-foreground">Saldo disponible: <span className="font-semibold text-foreground">{quoteToUnlock?.solicitantePuntosCotizacion ?? creditos} créditos</span></p>
          {unlockError && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{unlockError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={unlocking} onClick={() => setQuoteToUnlock(null)}>Cancelar</Button>
            <Button variant="primary" loading={unlocking} onClick={() => { void unlockQuote(); }}>Desbloquear por 1 crédito</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Qué cubre el precio según el incoterm, en palabras del comprador.
const INCOTERM_INCLUYE: Record<string,string> = {
  EXW:"Mercancía en fábrica; tú pones el transporte",
  FCA:"Entregada al transportista en origen",
  FOB:"Puesta en el barco en origen; flete y seguro aparte",
  CFR:"Flete hasta el puerto de destino; seguro aparte",
  CIF:"Flete y seguro hasta el puerto de destino",
  CPT:"Transporte pagado hasta destino; seguro aparte",
  CIP:"Transporte y seguro pagados hasta destino",
  DAP:"Hasta tu puerta, sin impuestos de importación",
  DPU:"Descargada en destino, sin impuestos",
  DDP:"Puerta a puerta con impuestos y nacionalización",
};

/** Las observaciones de una propuesta: texto libre o el JSON del formulario de respuesta. */function leerCondicionesPropuesta(texto: string | null | undefined): { descripcion: string; ventajas: string; detalles: string[] } {
  const vacio = { descripcion: "", ventajas: "", detalles: [] as string[] };
  if (!texto) return vacio;
  // Propuesta rápida (precio cerrado en pesos): su detalle completo está en la
  // tarjeta del chat; aquí basta la nota y lo esencial.
  const nueva = leerPropuesta(texto);
  if (nueva) {
    const f = nueva.formulario;
    
    const detalles = [
      f.entrega_modo === "cliente"
        ? `Puesto en ${f.bodega_ciudad}; flete a ${f.ciudad_destino} a cargo del cliente`
        : `Entregado en ${f.ciudad_destino}`,

      f.requiere_permisos && f.permiso_cual
        ? `${f.permiso_cual} (${
            f.permiso_gestiona === "importadora"
              ? "incluido"
              : "lo gestiona el cliente"
          })`
        : "",

      `Válida hasta ${new Date(`${nueva.vigencia_hasta}T12:00:00`).toLocaleDateString(
        "es-CO",
        { day: "numeric", month: "short" }
      )}`,
    ].filter(Boolean);

    return {
      descripcion: f.nota || "",
      ventajas: "",
      detalles,
    };

  }
  try {
    const datos = JSON.parse(texto) as Record<string, unknown>;
    if (datos && typeof datos === "object" && datos.schema === "create-response-v1") {
      const campo = (clave: string) => (typeof datos[clave] === "string" ? String(datos[clave]).trim() : "");
      const detalles = [
        campo("moq") && `MOQ ${campo("moq")}`,
        campo("port") && `Puerto ${campo("port")}`,
        campo("productionTime") && `Producción ${campo("productionTime")}`,
        campo("shippingTime") && `Envío ${campo("shippingTime")}`,
      ].filter(Boolean) as string[];
      return { descripcion: campo("description"), ventajas: campo("advantages"), detalles };
    }
  } catch {
    // Texto libre.
  }
  return { ...vacio, descripcion: texto };
}

/**
 * Precio de una propuesta para comparar. Las del formato nuevo son un precio
 * cerrado en pesos con IVA; las anteriores, USD con el equivalente a la TRM.
 */
function PrecioPropuesta({ propuesta, trm, tamano = "sm" }: { propuesta: BackendPropuesta; trm?: number | null; tamano?: "sm" | "base" }) {
  const nueva = leerPropuesta(propuesta.condiciones_adicionales);
  const clase = clsx("font-semibold", tamano === "base" ? "text-base" : "text-sm");
  if (nueva) {
    return (
      <>
        <p className={clase}>{pesosCop(nueva.totales.total_cop)}</p>
        <p className="text-[11px] text-muted-foreground">con IVA · {pesosCop(nueva.totales.unitario_cop)} por unidad</p>
      </>
    );
  }
  return (
    <>
      <p className={clase}>US${propuesta.precio_ofrecido_usd.toLocaleString("es-CO")}</p>
      {trm ? <p className="text-[11px] text-muted-foreground">≈ {formatoPesos(propuesta.precio_ofrecido_usd * trm)}</p> : null}
    </>
  );
}

const MOTIVOS_ELECCION: { clave: MotivoEleccion; etiqueta: string; ayuda: string }[] = [
  { clave: "precio", etiqueta: "Precio", ayuda: "Me salió mejor en costo" },
  { clave: "tiempo", etiqueta: "Tiempo de entrega", ayuda: "Llega antes" },
  { clave: "condiciones", etiqueta: "Condiciones", ayuda: "Lo que incluye, pagos, garantías" },
  { clave: "otro", etiqueta: "Otro motivo", ayuda: "Confianza, atención, recomendación..." },
];

/** "500 u" o "2,5 m?". */
function formatoPesos(valor: number): string {
  return `$${Math.round(valor).toLocaleString("es-CO")} COP`;
}
