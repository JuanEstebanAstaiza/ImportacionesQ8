import {
  Bookmark, ClipboardCheck, ClipboardList, Factory, Inbox, LayoutGrid, MessagesSquare, Package, PackageSearch, CirclePlus,
  Search, Settings2, Store, Tag, UserCheck, ChartColumn, ShieldCheck,
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

export type Producto = "importaciones" | "liquidaciones" | "maquilas";

export interface ModuloSuite {
  clave: Producto;
  nombre: string;
  descripcion: string;
  /** Título de la pestaña del navegador en este producto; sin él queda el de index.html. */
  tituloPestana?: string;
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
const esPantallaMaquilas = (screen: Screen) => screen.startsWith("maq-");

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
  esPantalla: (screen) => !esPantallaLiquidaciones(screen) && !esPantallaMaquilas(screen),
  inicio: (rol) => (rol === "importadora" ? "imp-dashboard" : rol === "asesor" ? "adv-dashboard" : "dashboard"),
  nav: { solicitante: NAV_ITEMS, importadora: NAV_IMPORTADORA, asesor: NAV_ASESOR },
};

export const LIQUIDACIONES: ModuloSuite = {
  clave: "liquidaciones",
  nombre: "Liquidaciones",
  descripcion: "Lotes completos a precio fijo, por tiempo limitado",
  tituloPestana: "Zarpi Liquidaciones | Lotes completos a precio de oportunidad",
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

const MAQ_MAQUILADORA: NavItem[] = [
  { icon: LayoutGrid, label: "Panel", key: "maq-panel" },
  { icon: Inbox, label: "Solicitudes", key: "maq-recibidas" },
  { icon: Package, label: "Pedidos", key: "maq-produccion" },
  { icon: Factory, label: "Mi maquila", key: "maq-perfil" },
];

const MAQ_CLIENTE: NavItem[] = [
  { icon: Search, label: "Directorio", key: "maq-directorio" },
  { icon: CirclePlus, label: "Nueva solicitud", key: "maq-solicitar" },
  { icon: ClipboardList, label: "Mis solicitudes", key: "maq-solicitudes" },
  { icon: Package, label: "Mis pedidos", key: "maq-pedidos" },
];

/**
 * Zarpi Maquilas. Los clientes (cotizante y empresa) buscan maquilas verificadas,
 * piden propuestas y siguen sus pedidos; la maquiladora (rol propio) responde y
 * produce. El equipo verifica a las maquiladoras desde el panel admin.
 */
export const MAQUILAS: ModuloSuite = {
  clave: "maquilas",
  nombre: "Maquilas",
  descripcion: "Fabrica tu marca con maquilas verificadas",
  tituloPestana: "Zarpi Maquilas | Fabrica tu marca con maquilas verificadas",
  flag: "modulo_maquilas_habilitado",
  roles: ["solicitante", "importadora", "asesor", "maquiladora"],
  esPantalla: esPantallaMaquilas,
  inicio: (rol) => (rol === "maquiladora" ? "maq-panel" : "maq-directorio"),
  nav: { maquiladora: MAQ_MAQUILADORA, solicitante: MAQ_CLIENTE, importadora: MAQ_CLIENTE, asesor: MAQ_CLIENTE },
  admin: {
    grupo: { key: "maquilas", label: "Maquilas", icon: Factory },
    items: [{ icon: ShieldCheck, label: "Verificación", key: "maq-admin-verificacion" }],
    soporte: [{ icon: ShieldCheck, label: "Verificación de maquilas", key: "maq-admin-verificacion" }],
  },
};

export const MODULOS_SUITE: ModuloSuite[] = [IMPORTACIONES, LIQUIDACIONES, MAQUILAS];

/** Iconos disponibles para las apps del selector radial (mapa en SuiteWheelSwitcher). */
export type IconoApp = "package" | "tag" | "shopping-bag" | "factory";

/**
 * App de la suite tal como aparece en el selector radial (wheel). Es la vitrina:
 * incluye las apps reales (`active`, con `producto` y `screen`) y las previstas
 * ("Próximamente"), que se ven en la rueda pero no se pueden abrir. Para añadir
 * una app: una entrada aquí (y su icono en IconoApp si es nuevo).
 */
export interface AppSuite {
  id: string;
  name: string;
  shortName: string;
  icon: IconoApp;
  badge: string;
  /** Hex para el acento del nodo y el color de la onda de transición. */
  accentColor: string;
  active: boolean;
  /** Producto del registro MODULOS_SUITE al que entra; solo en apps activas. */
  producto?: Producto;
  /** Pantalla de aterrizaje (src/app/rutas.ts); solo en apps activas. */
  screen?: Screen;
}

export const APPS_SUITE: AppSuite[] = [
  {
    id: "importaciones", name: "Zarpi Importaciones", shortName: "Importaciones", icon: "package",
    badge: "Core", accentColor: "#4F06EB", active: true, producto: "importaciones", screen: "landing",
  },
  {
    id: "liquidaciones", name: "Zarpi Liquidaciones", shortName: "Liquidaciones", icon: "tag",
    badge: "Lotes a precio fijo", accentColor: "#EDF953", active: true, producto: "liquidaciones", screen: "liq-landing",
  },
  {
    id: "marketplace", name: "Zarpi Marketplace", shortName: "Marketplace", icon: "shopping-bag",
    badge: "Prototipo", accentColor: "#3A86FF", active: true, screen: "mkt-landing",
  },
  {
    id: "maquilas", name: "Zarpi Maquilas", shortName: "Maquilas", icon: "factory",
    badge: "Fabrica tu marca", accentColor: "#FF007A", active: true, producto: "maquilas", screen: "maq-landing",
  },
];

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
// `chats` es la bandeja de toda la suite (tickets de soporte de cualquier producto): abrirla no cambia de producto.
export const PANTALLAS_COMUNES: Screen[] = ["user-profile", "notifications", "help-support", "team-channel", "chats", "login", "register", "landing", "mkt-landing"];

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
