import type { ReactNode } from "react";

import type { Screen } from "@/app/rutas";
import { PantallaPortal } from "@shared/layout/PantallaPortal";
import type { SidebarCtrl } from "@/types/portal";
import type { UserRole } from "@/types/roles";
import { PanelMaquiladora } from "@apps/maquilas/features/pantallas/PanelMaquiladora";
import { PerfilMaquiladora } from "@apps/maquilas/features/pantallas/PerfilMaquiladora";
import { DirectorioMaquilas } from "@apps/maquilas/features/pantallas/DirectorioMaquilas";
import { PerfilMaquilaPublico } from "@apps/maquilas/features/pantallas/PerfilMaquilaPublico";
import { NuevaSolicitud } from "@apps/maquilas/features/pantallas/NuevaSolicitud";
import { SolicitudesCliente } from "@apps/maquilas/features/pantallas/SolicitudesCliente";
import { SolicitudesMaquila } from "@apps/maquilas/features/pantallas/SolicitudesMaquila";
import { PedidosMaquilas } from "@apps/maquilas/features/pantallas/PedidosMaquilas";
import { VerificacionMaquiladoras } from "@apps/maquilas/features/admin/VerificacionMaquiladoras";

const TITULOS: Partial<Record<Screen, string>> = {
  "maq-panel": "Panel de la maquila",
  "maq-perfil": "Mi maquila",
  "maq-recibidas": "Solicitudes",
  "maq-produccion": "Pedidos",
  "maq-directorio": "Directorio de maquilas",
  "maq-maquiladora": "Perfil de la maquila",
  "maq-solicitar": "Nueva solicitud",
  "maq-solicitudes": "Mis solicitudes",
  "maq-pedidos": "Mis pedidos",
  "maq-admin-verificacion": "Maquilas · Verificación",
};

export interface MaquilasRouterProps {
  screen: Screen;
  sb: SidebarCtrl;
  /** Identificador que viaja en la URL (maquila, solicitud o pedido). */
  idRuta: string;
  navegar: (screen: Screen, id?: string) => void;
  rol: UserRole | "admin";
  /** Abre la mesa de ayuda (compartida por la suite) con el ticket marcado como de Maquilas. */
  onSoporte?: (referencia?: string) => void;
}

/**
 * Pantallas privadas de Zarpi Maquilas: las del cliente, las de la maquila y las de
 * su administración. App.tsx solo delega aquí; el estado vive en react-query.
 */
export function MaquilasRouter({ screen, sb, idRuta, navegar, rol, onSoporte }: MaquilasRouterProps) {
  const id = idRuta || undefined;
  const vistas: Partial<Record<Screen, ReactNode>> = {
    // Maquiladora
    "maq-panel": <PanelMaquiladora onIrAPerfil={() => navegar("maq-perfil")} onIr={(s) => navegar(s)} />,
    "maq-perfil": <PerfilMaquiladora />,
    "maq-recibidas": <SolicitudesMaquila solicitudId={id} onAbrir={(x) => navegar("maq-recibidas", x)} onVerPedido={(x) => navegar("maq-produccion", x)} />,
    "maq-produccion": <PedidosMaquilas pedidoId={id} onAbrir={(x) => navegar("maq-produccion", x)} onReportar={onSoporte} />,
    // Cliente
    "maq-directorio": <DirectorioMaquilas onAbrir={(x) => navegar("maq-maquiladora", x)} onSolicitarAbierta={() => navegar("maq-solicitar")} />,
    "maq-maquiladora": id ? <PerfilMaquilaPublico maquiladoraId={id} onSolicitar={(x) => navegar("maq-solicitar", x)} /> : null,
    "maq-solicitar": <NuevaSolicitud key={id ?? "abierta"} maquiladoraId={id} onCreada={(x) => navegar("maq-solicitudes", x)}
      onIrDirectorio={() => navegar("maq-directorio")} />,
    "maq-solicitudes": <SolicitudesCliente solicitudId={id} onAbrir={(x) => navegar("maq-solicitudes", x)}
      onNueva={() => navegar("maq-solicitar")} onVerPedido={(x) => navegar("maq-pedidos", x)} />,
    "maq-pedidos": <PedidosMaquilas pedidoId={id} onAbrir={(x) => navegar("maq-pedidos", x)} onReportar={onSoporte} />,
    // Panel del equipo de Zarpi (grupo «Maquilas» del sidebar admin).
    "maq-admin-verificacion": (
      <VerificacionMaquiladoras maquiladoraId={id} esAdmin={rol === "admin"} onAbrir={(x) => navegar("maq-admin-verificacion", x)} />
    ),
  };
  const vista = vistas[screen];
  if (!vista) return null;
  // La ficha de una maquila cuelga del directorio; el menú marca esa sección.
  const activo = screen === "maq-maquiladora" ? "maq-directorio" : screen;
  const padre = screen === "maq-maquiladora" ? { label: "Directorio", onClick: () => navegar("maq-directorio") } : undefined;
  return (
    <PantallaPortal sb={sb} active={activo} titulo={TITULOS[screen] ?? "Maquilas"} padre={padre}>
      {vista}
    </PantallaPortal>
  );
}
