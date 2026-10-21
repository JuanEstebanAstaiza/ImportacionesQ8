import { useState } from "react";
import { Award, BadgeCheck, Building2, Plus, RotateCcw, Search, Shield, Zap } from "lucide-react";
import { clsx } from "clsx";
import { Sidebar, AppHeader, ImporterCard, USER } from "@/app/App";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { Button, Card, Input, Select } from "@/components/design-system";
import type { SidebarCtrl } from "@/types/portal";
import type { Importer } from "@/types/importer";

export function BuyerDashboardScreen({sb,onViewProfile,onCreateQuote,importers}:{sb:SidebarCtrl;onViewProfile:(id:string)=>void;onCreateQuote:(id:string)=>void;importers:Importer[]}) {
  const [search,setSearch]=useState("");
  const [catFilter,setCatFilter]=useState<string>("Todas");
  // Sustituye al viejo filtro por calificación: se filtra por empresas con
  // certificaciones registradas, que es un dato real y no una nota inventada.
  const [certFilter,setCertFilter]=useState("");
  const [countryFilter,setCountryFilter]=useState("");

  const filtered=importers.filter(imp=>{
    const ms=!search||[imp.name,imp.specialty,...imp.categories].some(v=>v.toLowerCase().includes(search.toLowerCase()));
    const mc=catFilter==="Todas"||imp.categories.some(c=>c.toLowerCase()===catFilter.toLowerCase());
    const certs=imp.certs??[];
    const sellos=(imp.platformCerts??[]).map(c=>c.nombre);
    const todas=[...sellos,...certs];
    const mr=!certFilter||(certFilter==="certificadas"?todas.length>0:todas.some(c=>c===certFilter));
    const mco=!countryFilter||imp.country===countryFilter;
    return ms&&mc&&mr&&mco;
  });

  const certOptions=[...new Set(importers.flatMap(i=>[...(i.platformCerts??[]).map(c=>c.nombre),...(i.certs??[])]))].sort();
  // El backend ya devuelve el catálogo ordenado por peso publicitario, así que
  // basta con tomar las primeras: son las que más respaldo tienen.
  const featured=importers.filter(i=>(i.platformCerts??[]).length>0||i.verified).slice(0,3);
  const quickCats=["Todas","Tecnología","Textil","Alimentos","Maquinaria","Agroindustria","Industrial","Seguridad"];
  const responseHours=importers
    .map((imp)=>{
      const match=imp.responseTime.match(/(\d+(?:[\.,]\d+)?)/);
      return match?Number(match[1].replace(",",".")):null;
    })
    .filter((value):value is number=>value!==null&&!Number.isNaN(value));
  const avgResponseHours=responseHours.length>0?Math.round(responseHours.reduce((acc,value)=>acc+value,0)/responseHours.length):null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Page header */}
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("dashboard")},{label:"Dashboard"}]}/>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Marketplace de importadores</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Encuentra y contacta empresas importadoras verificadas para tu negocio.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{importers.filter(i=>i.verified).length} verificadas · {importers.length} en total</span>
              </div>
            </div>
          </div>

         {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {label:"Importadoras activas",value:importers.length.toString(),icon:<Building2 className="w-4 h-4"/>,color:"text-primary dark:text-[#EDF953]"},
              {label:"Verificadas",value:importers.filter(i=>i.verified).length.toString(),icon:<BadgeCheck className="w-4 h-4"/>,color:"text-emerald-600 dark:text-emerald-400"},
              {label:"Respaldadas por Q8",value:importers.filter(i=>(i.platformCerts??[]).length>0).length.toString(),icon:<Shield className="w-4 h-4"/>,color:"text-emerald-600 dark:text-emerald-400"},
              {label:"Tiempo prom. respuesta",value:avgResponseHours!==null?`~${avgResponseHours}h`:"N/D",icon:<Zap className="w-4 h-4"/>,color:"text-violet-600 dark:text-[#EDF953]"},
            ].map(s=>(
              <Card 
                key={s.label} 
                padding="md" 
                className="metric-card flex flex-col gap-2 transition-all duration-300 dark:bg-[#EDF953]/10 dark:border-[#EDF953]/25 dark:shadow-[0_0_15px_rgba(237,249,83,0.15)]"
              >
                <div className={clsx("metric-icon w-7 h-7 rounded-lg flex items-center justify-center dark:bg-[#EDF953]/20", s.color)}>
                  {s.icon}
                </div>
                <p className="text-xl font-semibold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Featured */}
          {!search&&catFilter==="Todas"&&!certFilter&&!countryFilter&&(
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-amber-500 dark:text-accent"/>
                <h2 className="text-sm font-semibold">Empresas destacadas</h2>
                <span className="text-xs text-muted-foreground">· Con mayor respaldo de Zarpi</span>
              </div>
              <div className="grid grid-flow-col auto-cols-[85%] gap-4 overflow-x-auto pb-2 md:grid-flow-row md:auto-cols-auto md:grid-cols-2 lg:grid-cols-3 md:overflow-visible">
                {featured.map(imp=>(
                  <ImporterCard key={imp.id} imp={imp} featured onViewProfile={onViewProfile} onCreateQuote={onCreateQuote}/>
                ))}
              </div>
            </div>
          )}

          {/* Search + filters */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Input 
                  placeholder="Buscar por nombre, especialidad o categoría..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  prefix={<Search className="w-4 h-4"/>}
                  className="dark:focus:border-accent dark:hover:border-accent/60"
                />
              </div>
              <div className="w-44">
                <Select 
                  value={certFilter} 
                  onChange={e => setCertFilter(e.target.value)}
                  className={clsx(
                    "dark:bg-background dark:border-border transition-colors",
                    "focus:border-accent dark:focus:border-accent",
                    "hover:border-accent dark:hover:border-accent",
                    certFilter && "dark:border-accent border-accent"
                  )}
                >
                  <option value="">Certificación</option>
                  <option value="certificadas">Con certificaciones</option>
                  {certOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="w-40">
                <Select 
                  value={countryFilter} 
                  onChange={e => setCountryFilter(e.target.value)}
                  className={clsx(
                    "dark:bg-background dark:border-border transition-colors",
                    "focus:border-accent dark:focus:border-accent",
                    "hover:border-accent dark:hover:border-accent",
                    countryFilter && "dark:border-accent border-accent"
                  )}
                >
                  <option value="">País</option>
                  {[...new Set(importers.map(i => i.country))].map(c => <option key={c}>{c}</option>)}
                </Select>
              </div>
              {(search || certFilter || countryFilter || catFilter !== "Todas") && (
                <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3.5 h-3.5"/>} onClick={()=>{setSearch("");setCertFilter("");setCountryFilter("");setCatFilter("Todas");}}>Limpiar</Button>
              )}
            </div>

            {/* Category tabs */}
            <div className="flex gap-1.5 flex-wrap">
              {quickCats.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setCatFilter(cat)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border",
                    catFilter === cat ? (
                      "bg-primary text-white border-primary dark:bg-accent dark:text-black dark:border-accent shadow-sm"
                    ) : (
                      "bg-white dark:bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary dark:hover:border-accent"
                    )
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div>
            <p className="text-sm text-muted-foreground mb-4"><span className="font-medium text-foreground">{filtered.length}</span> importadoras {catFilter!=="Todas"&&`en ${catFilter}`}</p>
            {filtered.length===0?(
              <Card padding="lg" className="border-dashed">
                <div className="flex flex-col items-center text-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><Search className="w-6 h-6 text-muted-foreground/40"/></div>
                  <div><p className="font-semibold">Sin resultados</p><p className="text-sm text-muted-foreground mt-1">Intenta con otros filtros o términos de búsqueda.</p></div>
                </div>
              </Card>
            ):(
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(imp=>(
                  <ImporterCard key={imp.id} imp={imp} onViewProfile={onViewProfile} onCreateQuote={onCreateQuote}/>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Sitio web, correo, teléfono, dirección y año de fundación de la empresa. */