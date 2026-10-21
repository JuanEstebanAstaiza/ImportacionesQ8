import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, ChevronLeft, Layers, LifeBuoy, LogIn, MessageSquare, ToggleRight, Users, WalletCards } from "lucide-react";
import { clsx } from "clsx";

import type { SidebarCtrl } from "@/types/portal";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";

export function Sidebar({active,onNav,pinned,onToggle,navItems,onLogout,onSoporte,showSoporte,onCanalEquipo,showCanalEquipo}:SidebarCtrl) {
  const { dark } = useBrandTheme();
  const [hovered,setHovered]=useState(false);
  const [openAdminGroup,setOpenAdminGroup]=useState<string|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>>(null);
  const floating=!pinned&&hovered;
  const isExpanded=pinned||hovered;
  const isAdminNavigation=navItems.some(item=>item.key==="admin-dashboard");
  const adminGroups=[
    {key:"gestion",label:"Gestión",icon:Building2,items:["admin-empresas","admin-presentaciones","admin-asignacion","admin-usuarios","admin-cotizantes"]},
    {key:"comunicacion",label:"Comunicación",icon:MessageSquare,items:["admin-correos","admin-soporte","chats","documentos"]},
    {key:"contenido",label:"Contenido",icon:Layers,items:["admin-landing","admin-tendencias","admin-tendencias-aprobacion","diseno","admin-reto"]},
    {key:"finanzas",label:"Suscripciones",icon:WalletCards,items:["admin-pagos","admin-planes","admin-cursos","admin-cursos-accesos"]},
    {key:"configuracion",label:"Configuración",icon:ToggleRight,items:["admin-certificaciones","admin-respaldos","admin-tipografia","admin-modulos"]},
  ] as const;

  useEffect(()=>{
    if(!isAdminNavigation)return;
    const activeGroup=adminGroups.find(group=>group.items.includes(active));
    if(activeGroup)setOpenAdminGroup(activeGroup.key);
  },[active,isAdminNavigation]);

  function onEnter(){timer.current=setTimeout(()=>setHovered(true),60);}
  function onLeave(){if(timer.current)clearTimeout(timer.current);setHovered(false);}

  return (
    <div
      className={clsx("relative flex-shrink-0 transition-all duration-250 ease-in-out h-screen",pinned?"w-52":"w-14")}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className={clsx(
        "flex flex-col bg-white border-r border-border h-full",
        "transition-all duration-250 ease-in-out overflow-hidden",
        floating
          ? "absolute top-0 left-0 z-50 shadow-2xl shadow-black/10 w-52"
          : pinned ? "w-full" : "w-14"
      )}>
        <div className={clsx("flex items-center h-[57px] border-b border-sidebar-border",isExpanded?"px-4":"justify-center px-0")}>
          <img src={dark ? (isExpanded ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-isotipo-acid.svg") : (isExpanded ? "/brand/zarpi-wordmark.svg" : "/brand/zarpi-isotipo.svg")} alt="Zarpi" className={clsx("object-contain object-left transition-all duration-200",isExpanded?"h-8 w-28":"h-8 w-8")} />
        </div>

        <nav className="flex flex-col gap-0.5 p-2 mt-1 flex-1 overflow-y-auto">
          {isAdminNavigation ? (
            <>
              {navItems.filter(item=>item.key==="admin-dashboard").map(({icon:Icon,label,key})=>{
                const isActive=active===key;
                return (
                  <button
                    key={key}
                    onClick={()=>onNav(key)}
                    className={clsx(
                      "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full",
                      isActive
                        ? "bg-primary/8 text-primary dark:bg-accent/15 dark:text-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      isExpanded ? "gap-2.5" : "justify-center gap-0"
                    )}
                    title={!isExpanded ? label : undefined}
                  >
                    <Icon className={clsx("w-4 h-4 flex-shrink-0",isActive&&"text-primary dark:text-accent")}/>
                    <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
                      <span className="whitespace-nowrap">{label}</span>
                    </div>
                    {isExpanded&&isActive&&<span className="ml-auto w-1 h-4 rounded-full bg-primary dark:bg-accent flex-shrink-0"/>}
                  </button>
                );
              })}
              {adminGroups.map(group=>{
                const GroupIcon=group.icon;
                const groupItems=navItems.filter(item=>group.items.includes(item.key));
                if(groupItems.length===0)return null;
                const isOpen=openAdminGroup===group.key;
                const hasActiveItem=groupItems.some(item=>item.key===active);
                return (
                  <div key={group.key} className="mt-1">
                    <button
                      type="button"
                      onClick={()=>isExpanded&&setOpenAdminGroup(current=>current===group.key?null:group.key)}
                      className={clsx(
                        "flex items-center rounded-lg px-2.5 py-2 text-sm font-semibold transition-all duration-150 w-full",
                        hasActiveItem
                          ? "text-primary dark:text-accent"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                        isExpanded?"gap-2.5":"justify-center gap-0"
                      )}
                      title={!isExpanded?group.label:undefined}
                      aria-expanded={isExpanded?isOpen:undefined}
                    >
                      <GroupIcon className="w-4 h-4 flex-shrink-0"/>
                      <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
                        <span className="whitespace-nowrap">{group.label}</span>
                      </div>
                      {isExpanded&&<ChevronDown className={clsx("ml-auto w-4 h-4 transition-transform duration-200",isOpen&&"rotate-180")}/>}
                    </button>
                    {isExpanded&&isOpen&&(
                      <div className="grid grid-rows-[1fr]">
                        <div className="min-h-0 overflow-hidden">
                          <div className="ml-2 border-l border-border pl-2 pt-0.5">
                            {groupItems.map(({icon:Icon,label,key})=>{
                              const isActive=active===key;
                              return (
                                <button
                                  key={key}
                                  onClick={()=>onNav(key)}
                                  className={clsx(
                                    "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full gap-2.5",
                                    isActive
                                      ? "bg-primary/8 text-primary dark:bg-accent/15 dark:text-accent"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                  )}
                                >
                                  <Icon className={clsx("w-4 h-4 flex-shrink-0",isActive&&"text-primary dark:text-accent")}/>
                                  <span className="whitespace-nowrap">{label}</span>
                                  {isActive&&<span className="ml-auto w-1 h-4 rounded-full bg-primary dark:bg-accent flex-shrink-0"/>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : navItems.map(({ icon: Icon, label, key }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => onNav(key)}
                className={clsx(
                  "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full",
                  isActive
                    ? "bg-primary/8 text-primary dark:bg-accent/15 dark:text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  isExpanded ? "gap-2.5" : "justify-center gap-0"
                )}
                title={!isExpanded ? label : undefined}
              >
                <Icon className={clsx("w-4 h-4 flex-shrink-0", isActive && "text-primary dark:text-accent")} />
                <div className={clsx("overflow-hidden transition-all duration-200", isExpanded ? "w-auto opacity-100" : "w-0 opacity-0")}>
                  <span className="whitespace-nowrap">{label}</span>
                </div>
                {isExpanded && isActive && (
                  <span className="ml-auto w-1 h-4 rounded-full bg-primary dark:bg-accent flex-shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
          {/* Vía directa con el equipo de la plataforma. Va en el pie y no en el
              menú porque no es una sección de la aplicación, sino una acción. */}
          {showSoporte&&(
            <button
              onClick={onSoporte}
              className={clsx(
                "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full mb-1",
                "text-muted-foreground hover:text-foreground hover:bg-muted",
                isExpanded ? "gap-2.5" : "justify-center gap-0",
              )}
              title={!isExpanded ? "Soporte técnico" : undefined}
            >
              <LifeBuoy className="w-4 h-4 flex-shrink-0"/>
              <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
                <span className="whitespace-nowrap">Soporte técnico</span>
              </div>
            </button>
          )}
          {/* El equipo de la plataforma no se abre tickets a sí mismo: su vía
              es el canal interno con administración y con sus compañeros. */}
          {showCanalEquipo&&(
            <button
              onClick={onCanalEquipo}
              className={clsx(
                "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full mb-1",
                "text-muted-foreground hover:text-foreground hover:bg-muted",
                isExpanded ? "gap-2.5" : "justify-center gap-0",
              )}
              title={!isExpanded ? "Canal del equipo" : undefined}
            >
              <Users className="w-4 h-4 flex-shrink-0"/>
              <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
                <span className="whitespace-nowrap">Canal del equipo</span>
              </div>
            </button>
          )}
          <button
            onClick={onLogout}
            className={clsx(
              "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              isExpanded ? "gap-2.5" : "justify-center gap-0",
            )}
            title={!isExpanded ? "Cerrar sesión" : undefined}
          >
            <LogIn className="w-4 h-4 flex-shrink-0 rotate-180"/>
            <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
              <span className="whitespace-nowrap">Cerrar sesion</span>
            </div>
          </button>
        </div>
      </div>

      <button
        onClick={onToggle}
        className={clsx(
          "absolute top-1/2 -translate-y-1/2 right-0 translate-x-full z-[60]",
          "w-4 h-10 bg-white border border-l-0 border-border",
          "rounded-r-md flex items-center justify-center",
          "shadow-sm hover:bg-slate-50 transition-all duration-150",
          "focus-visible:outline-none",
          (!pinned && hovered) ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        title={pinned?"Contraer menú":"Fijar expandido"}
      >
        <div className={clsx("transition-transform duration-250",pinned?"":"rotate-180")}>
          <ChevronLeft className="w-2.5 h-2.5 text-muted-foreground"/>
        </div>
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------------------------------
// SOPORTE TÉCNICO ? formulario de apertura de ticket
