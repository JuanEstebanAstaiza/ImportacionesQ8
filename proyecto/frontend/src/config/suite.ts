import {
  Bookmark, ClipboardCheck, LayoutGrid, MessagesSquare, PackageSearch, CirclePlus, Settings2, Store, Tag,
  UserCheck, ChartColumn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Screen } from "@/app/rutas";
import { NAV_ASESOR, NAV_IMPORTADORA, NAV_ITEMS } from "@/config/navigation";
import type { PlatformConfig } from "@/hooks/usePlatformConfig";
import type { NavItem } from "@/types/navigation";
import type { UserRole } from "@/types/roles";

/**
 * Registro de los productos de la suite Zarpi.
 *
 * Una sola cuenta Zarpi (cotizante o empresa) entra a todos los productos; el
 * selector del sidebar cambia entre ellos. Cada producto se declara aquí una
 * vez —menú por rol, pantalla de inicio, grupo en el panel admin— y el resto de
 * la app lo lee de este registro. Añadir un módulo nuevo es añadir una entrada,
 * no repartir condicionales por App.tsx, el Sidebar y la navegación.
 */

export type Producto = "importaciones" | "liquidaciones";

export interface ModuloSuite {
  clave: Producto;
  nombre: string;
  descripcion: string;
  /** Bandera de `/configuracion-publica` que lo enciende; null = siempre activo. */
  flag: keyof PlatformConfig | null;
  /** Roles que lo usan como producto (entran por el selector). */
  roles: UserRole[];
  esPantalla: (screen: Screen) => boolean;
  inicio: (rol: UserRole) => Screen;
  nav: Partial<Record<UserRole, NavItem[]>>;
  /** Su sitio en el panel de administración, que es uno solo para toda la suite. */
  admin?: {
    grupo: { key: string; label: string; icon: LucideIcon };
    /** Entradas del admin; el soporte ve solo las de `soporte`. */
    items: NavItem[];
    soporte: NavItem[];
  };
}

const esPantallaLiquidaciones = (screen: Screen) => screen.startsWith("liq-");

const LIQ_COMPRADOR: NavItem[] = [
  { icon: Tag, label: "Liquidaciones", key: "liq-catalogo" },
  { icon: Bookmark, label: "Mis reservas", key: "liq-reservas" },
];

const LIQ_EMPRESA: NavItem[] = [
  ...LIQ_COMPRADOR,
  { icon: LayoutGrid, label: "Mis liquidaciones", key: "liq-mis-lotes" },
  { icon: CirclePlus, label: "Publicar liquidación", key: "liq-publicar" },
  { icon: MessagesSquare, label: "Operaciones", key: "liq-operaciones" },
];

const LIQ_EQUIPO: NavItem[] = [
  { icon: ClipboardCheck, label: "Revisión", key: "liq-revision" },
  { icon: PackageSearch, label: "Lotes", key: "liq-admin-lotes" },
  { icon: MessagesSquare, label: "Operaciones y chats", key: "liq-admin-operaciones" },
];

export const IMPORTACIONES: ModuloSuite = {
  clave: "importaciones",
  nombre: "Importaciones",
  descripcion: "Cotiza y compra importado con empresas verificadas",
  flag: null,
  roles: ["solicitante", "importadora", "asesor"],
  esPantalla: (screen) => !esPantallaLiquidaciones(screen),
  inicio: (rol) => (rol === "importadora" ? "imp-dashboard" : rol === "asesor" ? "adv-dashboard" : "dashboard"),
  nav: { solicitante: NAV_ITEMS, importadora: NAV_IMPORTADORA, asesor: NAV_ASESOR },
};

export const LIQUIDACIONES: ModuloSuite = {
  clave: "liquidaciones",
  nombre: "Liquidaciones",
  descripcion: "Lotes completos a precio fijo, por tiempo limitado",
  flag: "modulo_liquidaciones_habilitado",
  roles: ["solicitante", "importadora", "asesor"],
  esPantalla: esPantallaLiquidaciones,
  inicio: () => "liq-catalogo",
  nav: { solicitante: LIQ_COMPRADOR, importadora: LIQ_EMPRESA, asesor: LIQ_EMPRESA },
  admin: {
    grupo: { key: "liquidaciones", label: "Liquidaciones", icon: Store },
    items: [
      { icon: ChartColumn, label: "Resumen", key: "liq-admin-resumen" },
      ...LIQ_EQUIPO,
      { icon: UserCheck, label: "Cuentas", key: "liq-admin-cuentas" },
      { icon: Settings2, label: "Configuración", key: "liq-admin-config" },
    ],
    soporte: LIQ_EQUIPO,
  },
};

export const MODULOS_SUITE: ModuloSuite[] = [IMPORTACIONES, LIQUIDACIONES];

export function moduloActivo(modulo: ModuloSuite, config: PlatformConfig): boolean {
  return modulo.flag === null || Boolean(config[modulo.flag]);
}

export function modulosActivos(config: PlatformConfig): ModuloSuite[] {
  return MODULOS_SUITE.filter((modulo) => moduloActivo(modulo, config));
}

/**
 * Pantallas de la cuenta, no de un producto: abrirlas no cambia el producto en
 * uso (el menú sigue siendo el de Liquidaciones si se venía de ahí).
 */
export const PANTALLAS_COMUNES: Screen[] = ["user-profile", "notifications", "help-support", "team-channel", "login", "register", "landing"];

/** Producto al que pertenece una pantalla. */
export function productoDe(screen: Screen): Producto {
  return MODULOS_SUITE.find((m) => m.clave !== "importaciones" && m.esPantalla(screen))?.clave ?? "importaciones";
}

export function moduloDe(clave: Producto): ModuloSuite {
  return MODULOS_SUITE.find((m) => m.clave === clave) ?? IMPORTACIONES;
}

/** Entradas del panel admin (o de la bandeja de soporte) que aportan los módulos activos. */
export function navAdminDeModulos(config: PlatformConfig, rol: "admin" | "soporte"): NavItem[] {
  return modulosActivos(config).flatMap((m) => (m.admin ? (rol === "admin" ? m.admin.items : m.admin.soporte) : []));
}

/** Grupos del sidebar admin que aportan los módulos (se ocultan si no tienen entradas). */
export function gruposAdminDeModulos(): { key: string; label: string; icon: LucideIcon; items: string[] }[] {
  return MODULOS_SUITE.filter((m) => m.admin).map((m) => ({
    ...m.admin!.grupo,
    items: m.admin!.items.map((item) => item.key),
  }));
}
