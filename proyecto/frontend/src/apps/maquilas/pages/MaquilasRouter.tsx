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
import { ModeracionMaquilas } from "@apps/maquilas/features/admin/ModeracionMaquilas";
import { CatalogoMaquila } from "@apps/maquilas/features/pantallas/CatalogoMaquila";
import { MarcaBlanca } from "@apps/maquilas/features/pantallas/MarcaBlanca";
import { ResenasMaquila } from "@apps/maquilas/features/pantallas/ResenasMaquila";
import { CalculadoraMargen } from "@apps/maquilas/features/componentes/CalculadoraMargen";
import { Card } from "@shared/ui/design-system";
import { EstudioMarca } from "@apps/maquilas/features/pantallas/EstudioMarca";
import { ColaDiseno, DetalleEncargo } from "@apps/maquilas/features/pantallas/EncargosDiseno";
import { EquipoMaquila } from "@apps/maquilas/features/pantallas/EquipoMaquila";
import { ConfiguracionMaquilas, MonitoreoMaquilas, ResumenMaquilas } from "@apps/maquilas/features/admin/PanelAdminMaquilas";

const TITULOS: Partial<Record<Screen, string>> = {
  "maq-panel": "Panel de la maquila",
  "maq-perfil": "Mi maquila",
  "maq-recibidas": "Solicitudes",
  "maq-produccion": "Pedidos",
  "maq-catalogo": "Marca blanca",
  "maq-resenas": "Reseñas",
  "maq-marca-blanca": "Marca blanca",
  "maq-calculadora": "Calculadora de costo y margen",
  "maq-admin-moderacion": "Maquilas · Moderación",
  "maq-equipo": "Equipo de la maquila",
  "maq-marca": "Mi marca",
  "maq-encargo": "Encargo de diseño",
  "maq-encargos": "Encargos de marca",
  "maq-admin-resumen": "Maquilas · Resumen",
  "maq-admin-monitoreo": "Maquilas · Monitoreo",
  "maq-admin-config": "Maquilas · Configuración",
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
    "maq-catalogo": <CatalogoMaquila />,
    "maq-resenas": <ResenasMaquila />,
    "maq-equipo": <EquipoMaquila />,
    // Cliente
    "maq-directorio": <DirectorioMaquilas onAbrir={(x) => navegar("maq-maquiladora", x)} onSolicitarAbierta={() => navegar("maq-solicitar")} />,
    "maq-maquiladora": id ? <PerfilMaquilaPublico maquiladoraId={id} onSolicitar={(x) => navegar("maq-solicitar", x)}
      onVerProducto={(x) => navegar("maq-marca-blanca", x)} /> : null,
    "maq-marca-blanca": <MarcaBlanca productoId={id} onAbrir={(x) => navegar("maq-marca-blanca", x)}
      onCreada={(x) => navegar("maq-solicitudes", x)} onVerMaquila={(x) => navegar("maq-maquiladora", x)} />,
    "maq-calculadora": (
      <Card padding="lg" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">¿A cuánto vendo mi producto?</h2>
          <p className="text-sm text-muted-foreground">Suma lo que te cuesta cada unidad puesta en tu bodega y calcula el precio para ganar el margen que quieres. También la abres desde una propuesta o un pedido, con el precio ya puesto.</p>
        </div>
        <CalculadoraMargen />
      </Card>
    ),
    "maq-solicitar": <NuevaSolicitud key={id ?? "abierta"} maquiladoraId={id} onCreada={(x) => navegar("maq-solicitudes", x)}
      onIrDirectorio={() => navegar("maq-directorio")} />,
    "maq-solicitudes": <SolicitudesCliente solicitudId={id} onAbrir={(x) => navegar("maq-solicitudes", x)}
      onNueva={() => navegar("maq-solicitar")} onVerPedido={(x) => navegar("maq-pedidos", x)} />,
    "maq-pedidos": <PedidosMaquilas pedidoId={id} onAbrir={(x) => navegar("maq-pedidos", x)} onReportar={onSoporte}
      onRepetido={(x) => navegar("maq-solicitudes", x)} />,
    // Panel del equipo de Zarpi (grupo «Maquilas» del sidebar admin).
    "maq-admin-verificacion": (
      <VerificacionMaquiladoras maquiladoraId={id} esAdmin={rol === "admin"} onAbrir={(x) => navegar("maq-admin-verificacion", x)} />
    ),
    "maq-admin-moderacion": <ModeracionMaquilas />,
    "maq-admin-resumen": <ResumenMaquilas onIr={navegar} />,
    "maq-admin-monitoreo": <MonitoreoMaquilas pedidoId={id} onAbrir={(x) => navegar("maq-admin-monitoreo", x)} />,
    "maq-admin-config": <ConfiguracionMaquilas />,
    // Estudio de marca (cliente) y encargos de diseño (cliente y equipo de Diseño)
    "maq-marca": <EstudioMarca marcaId={id} onAbrir={(x) => navegar("maq-marca", x)} onAbrirEncargo={(x) => navegar("maq-encargo", x)} />,
    "maq-encargo": id ? (
      rol === "designer" || rol === "admin" || rol === "soporte"
        ? <DetalleEncargo id={id} textoVolver="Encargos" onVolver={() => navegar("maq-encargos")} />
        : <DetalleEncargo id={id} textoVolver="Mi marca" onVolver={() => navegar("maq-marca")} />
    ) : null,
    "maq-encargos": <ColaDiseno encargoId={id} onAbrir={(x) => navegar(x ? "maq-encargo" : "maq-encargos", x)} />,
  };
  const vista = vistas[screen];
  if (!vista) return null;
  // La ficha de una maquila cuelga del directorio; el menú marca esa sección.
  const activo = screen === "maq-maquiladora" ? "maq-directorio"
    : screen === "maq-encargo" ? (rol === "designer" || rol === "admin" || rol === "soporte" ? "maq-encargos" : "maq-marca") : screen;
  const padre = screen === "maq-maquiladora" ? { label: "Directorio", onClick: () => navegar("maq-directorio") }
    : screen === "maq-marca-blanca" && id ? { label: "Marca blanca", onClick: () => navegar("maq-marca-blanca") } : undefined;
  return (
    <PantallaPortal sb={sb} active={activo} titulo={screen === "maq-marca-blanca" && id ? "Producto" : TITULOS[screen] ?? "Maquilas"} padre={padre}>
      {vista}
    </PantallaPortal>
  );
}
