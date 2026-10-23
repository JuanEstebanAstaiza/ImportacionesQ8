import { PanelAprobacion } from "@/features/tendencias/PanelAprobacion";

export function AdminTendenciasAprobacionTab({ esAdmin }: { esAdmin: boolean }) {
  return <PanelAprobacion esAdmin={esAdmin} />;
}
