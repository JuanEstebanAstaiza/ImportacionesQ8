import type { ReactNode } from "react";

import type { Screen } from "@/app/rutas";
import { PantallaPortal } from "@shared/layout/PantallaPortal";
import type { SidebarCtrl } from "@/types/portal";
import type { UserRole } from "@/types/roles";
import { PanelMaquiladora } from "@apps/maquilas/features/pantallas/PanelMaquiladora";
import { PerfilMaquiladora } from "@apps/maquilas/features/pantallas/PerfilMaquiladora";
import { VerificacionMaquiladoras } from "@apps/maquilas/features/admin/VerificacionMaquiladoras";

const TITULOS: Partial<Record<Screen, string>> = {
  "maq-panel": "Panel de la maquila",
  "maq-perfil": "Mi maquila",
  "maq-admin-verificacion": "Maquilas · Verificación",
};

export interface MaquilasRouterProps {
  screen: Screen;
  sb: SidebarCtrl;
  /** Identificador que viaja en la URL (p. ej. la maquiladora abierta en el admin). */
  idRuta: string;
  navegar: (screen: Screen, id?: string) => void;
  rol: UserRole | "admin";
}

/**
 * Pantallas privadas de Zarpi Maquilas: las de la maquiladora y las de su
 * administración en el panel admin. App.tsx solo delega aquí; el estado vive en
 * react-query (features/useMaquilas.ts).
 */
export function MaquilasRouter({ screen, sb, idRuta, navegar, rol }: MaquilasRouterProps) {
  const vistas: Partial<Record<Screen, ReactNode>> = {
    "maq-panel": <PanelMaquiladora onIrAPerfil={() => navegar("maq-perfil")} />,
    "maq-perfil": <PerfilMaquiladora />,
    // Panel del equipo de Zarpi (grupo «Maquilas» del sidebar admin).
    "maq-admin-verificacion": (
      <VerificacionMaquiladoras maquiladoraId={idRuta || undefined} esAdmin={rol === "admin"}
        onAbrir={(id) => navegar("maq-admin-verificacion", id)} />
    ),
  };
  const vista = vistas[screen];
  if (!vista) return null;
  return (
    <PantallaPortal sb={sb} active={screen} titulo={TITULOS[screen] ?? "Maquilas"}>
      {vista}
    </PantallaPortal>
  );
}
