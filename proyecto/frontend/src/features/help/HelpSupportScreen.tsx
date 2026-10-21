import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { BookOpen, HelpCircle, LifeBuoy, Search } from "lucide-react";
import { Button, Card, Input } from "@/components/design-system";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { AppHeader, Sidebar, USER, USER_IMPORTADORA, USER_ASESOR } from "@/app/App";
import type { SidebarCtrl } from "@/types/portal";
import type { UserRole } from "@/app/App";
import { HELP_SUPPORT_CONTENT, normalizeHelpRole } from "@/features/help/help-support-content";
import { ayudaService, type ArticuloAyuda } from "@/services/ayuda.service";
export function HelpSupportScreen({sb,role,onPedirSoporte}:{sb:SidebarCtrl;role:UserRole;onPedirSoporte:()=>void}) {
  const helpRole = normalizeHelpRole(role);
  const roleContent = HELP_SUPPORT_CONTENT[helpRole];
  const [faqSearch, setFaqSearch] = useState("");
  const [categoria, setCategoria] = useState("");
  const [articulos, setArticulos] = useState<ArticuloAyuda[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [cargandoAyuda, setCargandoAyuda] = useState(true);
  const [expandido, setExpandido] = useState<string|null>(null);
  const [votados, setVotados] = useState<Record<string, boolean>>({});

  useEffect(()=>{
    let vigente = true;
    setCargandoAyuda(true);
    const t = setTimeout(()=>{
      void ayudaService.listArticles({ buscar: faqSearch, categoria: categoria || undefined })
        .then((datos)=>{
          if(!vigente) return;
          setArticulos(datos.articulos);
          if(!categoria) setCategorias(datos.categorias);
        })
        .catch(()=>{ if(vigente) setArticulos([]); })
        .finally(()=>{ if(vigente) setCargandoAyuda(false); });
    }, faqSearch ? 250 : 0);
    return ()=>{ vigente = false; clearTimeout(t); };
  },[faqSearch, categoria]);

  function abrirArticulo(articulo: ArticuloAyuda){
    const abriendo = expandido !== articulo.id;
    setExpandido(abriendo ? articulo.id : null);
    if(abriendo){
      void ayudaService.markRead(articulo.id).catch(()=>undefined);
    }
  }

  async function votar(articuloId: string, util: boolean){
    setVotados((prev)=>({ ...prev, [articuloId]: true }));
    await ayudaService.vote(articuloId, util).catch(()=>undefined);
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="help-support"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={role === "importadora" ? USER_IMPORTADORA : role === "asesor" ? USER_ASESOR : USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav(role === "importadora" ? "imp-dashboard" : role === "asesor" ? "adv-dashboard" : "dashboard")},{label:"Ayuda y soporte"}]}/>
            <h1 className="text-xl font-semibold tracking-tight mt-3">Ayuda y soporte</h1>
            <p className="text-sm text-muted-foreground mt-1">Guia de uso y preguntas frecuentes para rol {roleContent.roleLabel}.</p>
          </div>

          {/* Card con borde y fondo accent en modo oscuro */}
          <Card padding="md" className="border-primary/30 dark:border-accent/30 bg-primary/[0.03] dark:bg-accent/[0.05]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-accent/20 text-primary dark:text-accent flex items-center justify-center flex-shrink-0">
                  <LifeBuoy className="w-4 h-4"/>
                </div>
                <div>
                  <p className="text-sm font-semibold">¿No encuentras la respuesta aquí?</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Abre un ticket y te atiende una persona del equipo de Zarpi. Se prioriza por urgencia.
                  </p>
                </div>
              </div>
              <Button 
                variant="primary" 
                icon={<LifeBuoy className="w-4 h-4"/>} 
                onClick={onPedirSoporte}
                className="dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
              >
                Pedir soporte técnico
              </Button>
            </div>
          </Card>

          <Card padding="md">
            <div className="space-y-3">
              <Input
                value={faqSearch}
                onChange={(event)=>setFaqSearch(event.target.value)}
                placeholder="Describe tu problema: «no me llegan propuestas», «rol insuficiente»..."
                prefix={<Search className="w-4 h-4"/>}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={()=>setCategoria("")}
                  className={clsx("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    categoria==="" ? "bg-primary dark:bg-accent text-white dark:text-accent-foreground border-primary dark:border-accent" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}
                >
                  Todo
                </button>
                {categorias.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={()=>setCategoria(c===categoria?"":c)}
                    className={clsx("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      categoria===c ? "bg-primary dark:bg-accent text-white dark:text-accent-foreground border-primary dark:border-accent" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card padding="md" className="md:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-primary dark:text-accent"/>
                  <h2 className="text-sm font-semibold">Documentación</h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  {cargandoAyuda?"Cargando...":`${articulos.length} artículos`}
                </span>
              </div>
              <div className="space-y-2.5">
                {!cargandoAyuda&&articulos.length===0&&(
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    No encontramos nada para esa búsqueda. Prueba con otras palabras o abre un ticket de soporte:
                    el equipo escribe un artículo nuevo cuando una duda se repite.
                  </div>
                )}
                {articulos.map((articulo)=>{
                  const abierto = expandido===articulo.id;
                  return (
                    <div key={articulo.id} className="rounded-lg border border-border bg-card overflow-hidden">
                      <button
                        type="button"
                        onClick={()=>abrirArticulo(articulo)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{articulo.titulo}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{articulo.resumen}</p>
                          </div>
                          <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {articulo.categoria}
                          </span>
                        </div>
                        {articulo.contenido&&(
                          <span className="mt-1.5 inline-block text-xs font-medium text-primary dark:text-accent">
                            {abierto?"Ocultar detalle":"Ver paso a paso"}
                          </span>
                        )}
                      </button>
                      {abierto&&articulo.contenido&&(
                        <div className="border-t border-border px-3 py-3 bg-muted/20">
                          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{articulo.contenido}</p>
                          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
                            {votados[articulo.id]?(
                              <p className="text-xs text-muted-foreground">Gracias, lo tendremos en cuenta.</p>
                            ):(
                              <>
                                <span className="text-xs text-muted-foreground">¿Te resolvió la duda?</span>
                                <Button variant="secondary" size="sm" onClick={()=>{void votar(articulo.id,true);}}>Sí</Button>
                                <Button variant="secondary" size="sm" onClick={()=>{void votar(articulo.id,false);}}>No</Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-primary dark:text-accent"/>
                <h2 className="text-sm font-semibold">Buenas practicas</h2>
              </div>
              <div className="space-y-3">
                {roleContent.tips.map((tip) => (
                  <div key={tip} className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{tip}</div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-border p-3 text-xs text-muted-foreground">
                Al abrir un ticket, incluye el código de cotización (COT-…) o de operación (ORD-…) y el mensaje de error
                completo. Con eso el equipo reproduce el caso sin tener que preguntarte.
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

