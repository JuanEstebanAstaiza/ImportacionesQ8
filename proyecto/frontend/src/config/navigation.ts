import {
  Award, BookOpen, Building2, ClipboardList, CreditCard, DatabaseBackup, Film,
  FileText, FolderOpen, Flame, GitCompare, GraduationCap, Layers, LayoutGrid,
  LibraryBig, LifeBuoy, Mail, MessageSquare, Palette, ShoppingCart, Sparkles,
  ToggleRight, Trophy, Type, Users, WalletCards, Zap,
} from "lucide-react";
import type { Screen } from "@/app/rutas";
import type { NavItem } from "@/types/navigation";

export const NAV_ITEMS: NavItem[] = [
  { icon: LayoutGrid, label: "Dashboard", key: "dashboard" }, { icon: FileText, label: "Cotizaciones", key: "quotes" },
  { icon: Sparkles, label: "Tendencias", key: "tendencias" }, { icon: Trophy, label: "Reto", key: "reto" },
  { icon: LibraryBig, label: "Catálogos", key: "catalogos" }, { icon: ClipboardList, label: "Respuestas", key: "responses" },
  { icon: MessageSquare, label: "Chats", key: "chats" }, { icon: ShoppingCart, label: "Operaciones", key: "orders" },
  { icon: BookOpen, label: "Cursos", key: "courses" }, { icon: FolderOpen, label: "Documentos", key: "documentos" },
  { icon: CreditCard, label: "Pagos", key: "pagos" },
];
export const NAV_IMPORTADORA: NavItem[] = [
  { icon: LayoutGrid, label: "Dashboard", key: "imp-dashboard" }, { icon: FileText, label: "Solicitudes", key: "imp-quotes" },
  { icon: Users, label: "Asesores", key: "imp-advisors" }, { icon: Building2, label: "Mi empresa", key: "imp-profile" },
  { icon: LibraryBig, label: "Catálogos", key: "imp-catalogos" }, { icon: Sparkles, label: "Tendencias", key: "tendencias" },
  { icon: ShoppingCart, label: "Operaciones", key: "orders" }, { icon: MessageSquare, label: "Chats", key: "chats" },
  { icon: BookOpen, label: "Cursos", key: "courses" }, { icon: FolderOpen, label: "Documentos", key: "documentos" },
];
export const NAV_ASESOR: NavItem[] = [
  { icon: LayoutGrid, label: "Dashboard", key: "adv-dashboard" }, { icon: Zap, label: "Disponibles", key: "adv-available" },
  { icon: ClipboardList, label: "Mis cotizaciones", key: "adv-my-quotes" }, { icon: LibraryBig, label: "Catálogos", key: "imp-catalogos" },
  { icon: Sparkles, label: "Tendencias", key: "tendencias" }, { icon: MessageSquare, label: "Chats", key: "chats" },
];
export const NAV_ADMIN: NavItem[] = [
  { icon: LayoutGrid, label: "Resumen", key: "admin-dashboard" }, { icon: Building2, label: "Empresas", key: "admin-empresas" },
  { icon: Film, label: "Presentaciones", key: "admin-presentaciones" }, { icon: GitCompare, label: "Asignación", key: "admin-asignacion" },
  { icon: Users, label: "Usuarios", key: "admin-usuarios" }, { icon: WalletCards, label: "Cotizantes", key: "admin-cotizantes" },
  { icon: Mail, label: "Correos", key: "admin-correos" }, { icon: LifeBuoy, label: "Soporte", key: "admin-soporte" },
  { icon: Award, label: "Certificaciones", key: "admin-certificaciones" }, { icon: DatabaseBackup, label: "Respaldos", key: "admin-respaldos" },
  { icon: Layers, label: "Landing", key: "admin-landing" }, { icon: Flame, label: "Tendencias", key: "admin-tendencias" },
  { icon: Sparkles, label: "Aprobación", key: "admin-tendencias-aprobacion" }, { icon: Palette, label: "Diseño", key: "diseno" },
  { icon: Trophy, label: "Reto", key: "admin-reto" }, { icon: CreditCard, label: "Pagos", key: "admin-pagos" },
  { icon: WalletCards, label: "Planes", key: "admin-planes" }, { icon: BookOpen, label: "Cursos de Zarpi", key: "admin-cursos" },
  { icon: GraduationCap, label: "Accesos a cursos", key: "admin-cursos-accesos" }, { icon: Type, label: "Tipografía", key: "admin-tipografia" },
  { icon: ToggleRight, label: "Módulos", key: "admin-modulos" }, { icon: MessageSquare, label: "Chats", key: "chats" },
  { icon: FolderOpen, label: "Documentos", key: "documentos" },
];
export const NAV_SOPORTE: NavItem[] = [
  { icon: LifeBuoy, label: "Bandeja", key: "admin-soporte" }, { icon: MessageSquare, label: "Tickets", key: "chats" },
  { icon: FolderOpen, label: "Documentos", key: "documentos" },
];
export const NAV_DISENO: NavItem[] = [
  { icon: Palette, label: "Diseño", key: "diseno" }, { icon: Sparkles, label: "Tendencias", key: "tendencias" },
  { icon: FolderOpen, label: "Documentos", key: "documentos" },
];
export const PANTALLAS_DESIGNER: Screen[] = ["diseno", "team-channel", "user-profile", "notifications", "documentos", "tendencias", "tendencia-detalle"];
