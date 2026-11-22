import { ArrowRight, BadgeCheck, CheckCircle2, Circle, ClipboardList, Factory, Loader2, MessageSquare, Package } from "lucide-react";

import { Button, Card } from "@shared/ui/design-system";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { useMiMaquiladora, useParametrosMaquilas } from "@apps/maquilas/features/useMaquilas";
import { EstadoMaquiladoraBadge } from "@apps/maquilas/features/componentes/EstadoMaquiladora";

const PROXIMAMENTE = [
  { Icono: ClipboardList, titulo: "Solicitudes de fabricación", texto: "Briefs de clientes que buscan exactamente lo que tú fabricas." },
  { Icono: Package, titulo: "Pedidos por etapas", texto: "Muestras, producción, control de calidad y pagos por hitos." },
  { Icono: MessageSquare, titulo: "Chat con el cliente", texto: "Cada pedido con su conversación y sus archivos." },
];

/** Inicio de la maquiladora: en qué va su verificación y qué hacer ahora. */
export function PanelMaquiladora({ onIrAPerfil }: { onIrAPerfil: () => void }) {
  const { data: m, isLoading, error } = useMiMaquiladora();
  const { data: parametros } = useParametrosMaquilas();

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

        <Card padding="lg">
          <h3 className="font-semibold">Muy pronto en tu panel</h3>
          <ul className="mt-4 space-y-4">
            {PROXIMAMENTE.map(({ Icono, titulo, texto }) => (
              <li key={titulo} className="flex items-start gap-3">
                <Icono className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">{titulo}</p>
                  <p className="text-xs text-muted-foreground">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
