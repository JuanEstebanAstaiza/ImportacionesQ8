import { ArrowRight, BadgeCheck, CheckCircle2, Circle, ClipboardList, Factory, Inbox, Loader2, Package } from "lucide-react";

import type { Screen } from "@/app/rutas";
import { Button, Card } from "@shared/ui/design-system";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { useMiMaquiladora, useParametrosMaquilas, usePedidos, useRecibidas } from "@apps/maquilas/features/useMaquilas";
import { EstadoMaquiladoraBadge } from "@apps/maquilas/features/componentes/EstadoMaquiladora";

function Atajo({ Icono, titulo, valor, texto, onClick }: { Icono: typeof Inbox; titulo: string; valor: number; texto: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/40 dark:hover:border-accent/50">
      <Icono className="h-8 w-8 flex-shrink-0 text-primary dark:text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className="text-2xl font-semibold">{valor}</p>
        <p className="text-xs text-muted-foreground">{texto}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

/** Inicio de la maquiladora: su verificación y, ya verificada, lo que tiene pendiente. */
export function PanelMaquiladora({ onIrAPerfil, onIr }: { onIrAPerfil: () => void; onIr: (screen: Screen) => void }) {
  const { data: m, isLoading, error } = useMiMaquiladora();
  const { data: parametros } = useParametrosMaquilas();
  const verificada = m?.estado === "verificada";
  const { data: recibidas } = useRecibidas();
  const { data: pedidos } = usePedidos();

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  }
  if (error || !m) {
    return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error, "No pudimos cargar tu maquiladora.")}</p></Card>;
  }

  const nombresCategorias = new Map((parametros?.categorias ?? []).map((c) => [c.clave, c.nombre]));
  const pasos = [
    { hecho: true, texto: "Crear la cuenta" },
    { hecho: (m.pendientes ?? []).length === 0, texto: "Completar el perfil y el expediente" },
    { hecho: ["en_revision", "verificada"].includes(m.estado), texto: "Enviarlo a verificación" },
    { hecho: m.estado === "verificada", texto: "Verificación de Zarpi" },
  ];

  return (
    <div className="space-y-6">
      <Card padding="lg" className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
            <Factory className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{m.nombre_comercial}</h2>
              <EstadoMaquiladoraBadge estado={m.estado} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.ciudad} · {m.categorias.map((c) => nombresCategorias.get(c) ?? c).join(", ") || "Sin categorías"}
              {m.pedido_minimo ? ` · pedido mínimo ${m.pedido_minimo.toLocaleString("es-CO")} und.` : ""}
            </p>
            {m.motivo && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                <span className="font-medium">Nota de Zarpi:</span> {m.motivo}
              </p>
            )}
          </div>
        </div>
        <Button variant={m.estado === "verificada" ? "secondary" : "primary"} iconRight={<ArrowRight className="h-4 w-4" />} onClick={onIrAPerfil}>
          {m.estado === "verificada" ? "Ver mi perfil" : m.estado === "en_revision" ? "Ver mi expediente" : "Completar mi expediente"}
        </Button>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <h3 className="font-semibold">Tu verificación</h3>
          <ol className="mt-4 space-y-3">
            {pasos.map(({ hecho, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-sm">
                {hecho ? <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" /> : <Circle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                <span className={hecho ? "" : "text-muted-foreground"}>{texto}</span>
              </li>
            ))}
          </ol>
          {m.estado === "verificada" && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Tu maquila tiene el sello «Verificada por Zarpi».
            </p>
          )}
        </Card>

        {verificada ? (
          <div className="grid gap-4">
            <Atajo Icono={Inbox} titulo="Solicitudes por responder" onClick={() => onIr("maq-recibidas")}
              valor={(recibidas ?? []).filter((s) => ["abierta", "con_propuestas"].includes(s.estado) && s.mi_destino?.estado === "pendiente").length}
              texto={`${recibidas?.length ?? 0} en total`} />
            <Atajo Icono={Package} titulo="Pedidos que esperan algo de ti" onClick={() => onIr("maq-produccion")}
              valor={(pedidos ?? []).filter((p) => p.pendiente_de_mi).length}
              texto={`${(pedidos ?? []).filter((p) => ["muestra", "produccion"].includes(p.estado)).length} activos`} />
          </div>
        ) : (
          <Card padding="lg">
            <ClipboardList className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold">Cuando te verifiquemos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Apareces en el directorio, te llegan solicitudes de clientes que buscan lo que fabricas y manejas tus pedidos
              (muestras, producción por etapas y pagos) desde aquí.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
