import { PanelAprobacion } from "@apps/importaciones/features/tendencias/PanelAprobacion";

export function AdminTendenciasAprobacionTab({ esAdmin }: { esAdmin: boolean }) {
  return <PanelAprobacion esAdmin={esAdmin} />;
}
