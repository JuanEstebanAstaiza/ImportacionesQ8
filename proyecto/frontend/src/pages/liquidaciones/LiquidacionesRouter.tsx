import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import type { Screen } from "@/app/rutas";
import { PantallaPortal } from "@/components/layout/PantallaPortal";
import type { SidebarCtrl } from "@/types/portal";
import type { UserRole } from "@/types/roles";
import { useActivacion } from "@/features/liquidaciones/useLiquidaciones";
import { ActivarLiquidaciones } from "@/features/liquidaciones/pantallas/ActivarLiquidaciones";
import { CatalogoLotes } from "@/features/liquidaciones/pantallas/CatalogoLotes";
import { FichaLote } from "@/features/liquidaciones/pantallas/FichaLote";
import { MisLiquidaciones } from "@/features/liquidaciones/pantallas/MisLiquidaciones";
import { OperacionesLotes } from "@/features/liquidaciones/pantallas/OperacionesLotes";
import { PublicarLiquidacion } from "@/features/liquidaciones/pantallas/PublicarLiquidacion";
import { ConfiguracionLiquidaciones } from "@/features/liquidaciones/admin/ConfiguracionLiquidaciones";
import { CuentasAdmin } from "@/features/liquidaciones/admin/CuentasAdmin";
import { LotesAdmin } from "@/features/liquidaciones/admin/LotesAdmin";
import { OperacionesAdmin } from "@/features/liquidaciones/admin/OperacionesAdmin";
import { ResumenLiquidaciones } from "@/features/liquidaciones/admin/ResumenLiquidaciones";
import { RevisionLiquidaciones } from "@/features/liquidaciones/admin/RevisionLiquidaciones";

const TITULOS: Partial<Record<Screen, string>> = {
  "liq-catalogo": "Liquidaciones",
  "liq-lote": "Detalle del lote",
  "liq-activar": "Activar cuenta",
  "liq-reservas": "Mis reservas",
  "liq-mis-lotes": "Mis liquidaciones",
  "liq-publicar": "Publicar liquidación",
  "liq-operaciones": "Operaciones",
  "liq-revision": "Liquidaciones · Revisión",
  "liq-admin-resumen": "Liquidaciones · Resumen",
  "liq-admin-lotes": "Liquidaciones · Lotes",
  "liq-admin-operaciones": "Liquidaciones · Operaciones y chats",
  "liq-admin-cuentas": "Liquidaciones · Cuentas",
  "liq-admin-config": "Liquidaciones · Configuración",
};

export interface LiquidacionesRouterProps {
  screen: Screen;
  sb: SidebarCtrl;
  /** Identificador que viaja en la URL (lote u operación), si la pantalla lo usa. */
  idRuta: string;
  navegar: (screen: Screen, id?: string) => void;
  rol: UserRole;
  empresa: string;
  /** Abre la mesa de ayuda (compartida por la suite) con el ticket marcado como de Liquidaciones. */
  onSoporte: (referencia?: string) => void;
}

/** Publicar exige tener la cuenta activada en el módulo; si no, se activa ahí mismo. */
function ConActivacion({ children, onCancelar }: { children: ReactNode; onCancelar: () => void }) {
  const { data, isLoading } = useActivacion();
  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  }
  if (!data?.activa) return <ActivarLiquidaciones onActivada={() => undefined} onCancelar={onCancelar} />;
  return <>{children}</>;
}

/**
 * Pantallas de Zarpi Liquidaciones, tanto las del producto como las de su
 * administración dentro del panel admin. App.tsx solo delega aquí: el estado
 * del módulo vive en react-query (features/liquidaciones/useLiquidaciones.ts).
 */
export function LiquidacionesRouter({ screen, sb, idRuta, navegar, rol, empresa, onSoporte }: LiquidacionesRouterProps) {
  const esEquipo = rol === "admin" || rol === "soporte";
  const abrirLote = (id: string) => navegar("liq-lote", id);

  const vistas: Partial<Record<Screen, ReactNode>> = {
    "liq-catalogo": <CatalogoLotes onAbrir={abrirLote} />,
    "liq-lote": (
      <FichaLote
        loteId={idRuta}
        puedeComprar={!esEquipo}
        onReservado={(id) => navegar("liq-reservas", id)}
        onVerOperacion={(id) => navegar("liq-reservas", id)}
        onActivar={() => navegar("liq-activar")}
        onReportar={esEquipo ? undefined : onSoporte}
      />
    ),
    "liq-activar": <ActivarLiquidaciones onActivada={() => navegar("liq-catalogo")} onCancelar={() => navegar("liq-catalogo")} />,
    "liq-reservas": (
      <OperacionesLotes lado="comprador" operacionId={idRuta || undefined} onElegir={(id) => navegar("liq-reservas", id)}
        onReportar={onSoporte} onIrCatalogo={() => navegar("liq-catalogo")} />
    ),
    "liq-operaciones": (
      <OperacionesLotes lado="vendedor" operacionId={idRuta || undefined} onElegir={(id) => navegar("liq-operaciones", id)} onReportar={onSoporte} />
    ),
    "liq-mis-lotes": (
      <ConActivacion onCancelar={() => navegar("liq-catalogo")}>
        <MisLiquidaciones
          empresa={empresa}
          onPublicar={() => navegar("liq-publicar")}
          onEditar={(id) => navegar("liq-publicar", id)}
          onVerLote={abrirLote}
          onVerOperacion={(id) => navegar("liq-operaciones", id)}
        />
      </ConActivacion>
    ),
    "liq-publicar": (
      <ConActivacion onCancelar={() => navegar("liq-mis-lotes")}>
        <PublicarLiquidacion key={idRuta || "nueva"} loteId={idRuta || undefined} onListo={() => navegar("liq-mis-lotes")} onCancelar={() => navegar("liq-mis-lotes")} />
      </ConActivacion>
    ),
    // Panel del equipo de Zarpi (grupo «Liquidaciones» del sidebar admin).
    "liq-admin-resumen": <ResumenLiquidaciones onIr={(destino) => navegar(destino)} />,
    "liq-revision": <RevisionLiquidaciones />,
    "liq-admin-lotes": <LotesAdmin onVerLote={abrirLote} />,
    "liq-admin-operaciones": (
      <OperacionesAdmin operacionId={idRuta || undefined} onAbrir={(id) => navegar("liq-admin-operaciones", id ?? undefined)} />
    ),
    "liq-admin-cuentas": <CuentasAdmin />,
    "liq-admin-config": <ConfiguracionLiquidaciones />,
  };

  const vista = vistas[screen];
  if (!vista) return null;
  // El menú marca la sección; la ficha de un lote cuelga del catálogo (o de «Lotes» en el panel).
  const activo = screen === "liq-lote" ? (esEquipo ? "liq-admin-lotes" : "liq-catalogo") : screen;
  return (
    <PantallaPortal sb={sb} active={activo} titulo={TITULOS[screen] ?? "Liquidaciones"}>
      {vista}
    </PantallaPortal>
  );
}
