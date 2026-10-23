import { Award, BadgeCheck, Building2, Clock, FileText, MapPin, MessageSquare, Package2, Plus, Shield, Star, UserRound } from "lucide-react";
import { clsx } from "clsx";

import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { Avatar, Button, Card, ContactBtn, openSmartContact } from "@/components/design-system";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { PresentacionPublica } from "@/features/importador/PresentacionEmpresa";
import { DatosDeContactoEmpresa } from "@/features/importador/components/DatosDeContactoEmpresa";
import { RecomendadosEmpresa } from "@/features/tendencias/Recomendados";
import { ResenasImportador } from "@/features/resenas/ResenasImportador";
import type { Importer } from "@/types/importer";
import type { SidebarCtrl } from "@/types/portal";
import type { Quote } from "@/types/quote";
import { resolveApiUrl } from "@/services/api-client";
import type { ChatConv } from "@/types/chat";
import type { Order } from "@/types/order";

const DEFAULT_HEADER_USER = { name: "Ana García", company: "Importaciones del Norte S.A.", initials: "AG" };

export function ImporterProfileScreen({importerId,onBack,onCreateQuote,onOpenChat,sb,importers,chats,orders,quotes,onAbrirTendencia}:{
  importerId:string;onBack:()=>void;onCreateQuote:(id:string)=>void;onOpenChat:(convId:string)=>void;sb:SidebarCtrl;importers:Importer[];chats:ChatConv[];orders:Order[];quotes:Quote[];onAbrirTendencia:(id:string)=>void;
}) {
  const imp=importers.find(i=>i.id===importerId)||importers[0];
  if (!imp) return null;
  const desc=imp.description||"Esta empresa aún no ha publicado su descripción.";
  const certs=imp.certs ?? [];
  const platformCerts=imp.platformCerts ?? [];
  const bannerUrl=imp.bannerUrl?resolveApiUrl(imp.bannerUrl):"";
  const logoUrl=imp.logoUrl?resolveApiUrl(imp.logoUrl):"";
  const relQuotes=quotes.filter(q=>q.importer===imp.name);
  const relOrders=orders.filter(o=>o.importerId===imp.id);
  const relChats=chats.filter(c=>c.importerId===imp.id);

  // Las personas reales que atienden en la empresa. Antes se añadía un
  // «Suplente / Asesor Jr.» inventado con un correo que no existía. El correo
  // es el de contacto de la empresa: el de cada asesor no se publica.
  const correoEmpresa=imp.email||imp.advisor.email||"";
  const ADVISORS=(imp.advisors&&imp.advisors.length>0?imp.advisors:[imp.advisor]).map(adv=>({...adv,email:correoEmpresa}));

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={DEFAULT_HEADER_USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Breadcrumb items={[{label:"Inicio",onClick:onBack},{label:"Dashboard",onClick:onBack},{label:imp.name}]}/>

          {/* Banner de portada: primera impresión de la empresa para el solicitante */}
          {bannerUrl&&(
            <div className="mt-4 rounded-2xl overflow-hidden border border-border bg-muted/40">
              <img
                src={bannerUrl}
                alt={`Portada de ${imp.name}`}
                className="w-full h-40 sm:h-56 object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Hero card */}
          <Card padding="md" className={clsx("mb-5",bannerUrl?"mt-3":"mt-4")}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="flex items-start gap-4">
                <Avatar initials={imp.initials} size="2xl" color={imp.color} src={logoUrl||undefined} variant="logo"/>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-semibold">{imp.name}</h1>
                    {imp.verified&&<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium"><BadgeCheck className="w-3 h-3"/>Verificada</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{imp.specialty}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    {platformCerts.length>0&&<div className="flex items-center gap-1 text-primary"><BadgeCheck className="w-3.5 h-3.5"/><span className="text-xs font-medium">{platformCerts.length} {platformCerts.length===1?"sello":"sellos"} de Zarpi</span></div>}
                    {certs.length>0&&<div className="flex items-center gap-1 text-muted-foreground"><Award className="w-3.5 h-3.5"/><span className="text-xs">{certs.length} {certs.length===1?"certificación":"certificaciones"}</span></div>}
                    <div className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5"/><span className="text-xs">{imp.responseTime} respuesta</span></div>
                    <div className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3.5 h-3.5"/><span className="text-xs">{imp.country}</span></div>
                    <div className="flex items-center gap-1 text-muted-foreground"><Package2 className="w-3.5 h-3.5"/><span className="text-xs">{imp.projects} proyectos</span></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ContactBtn type="chat" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
                <ContactBtn type="email" onClick={()=>openSmartContact({type:"email",email:imp.advisor.email,onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
                <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>} onClick={()=>onCreateQuote(imp.id)}>Crear cotización</Button>
              </div>
            </div>
          </Card>

          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              {/* About */}
              <Card padding="md">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary"/>Acerca de la empresa</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {imp.categories.map(c=>(
                    <span key={c} className="px-2.5 py-1 bg-primary/5 text-primary rounded-lg text-xs font-medium">{c}</span>
                  ))}
                </div>
                {imp.industries&&imp.industries.length>0&&(
                  <div className="mt-3 flex flex-wrap gap-2">
                    {imp.industries.map(i=>(
                      <span key={i} className="px-2.5 py-1 bg-muted text-muted-foreground rounded-lg text-xs font-medium">{i}</span>
                    ))}
                  </div>
                )}
              </Card>

              {/* Ficha de contacto que la empresa rellena en su propio perfil.
                  Estaba guardándose en `perfil_publico` sin que ninguna pantalla
                  la leyera, así que rellenarla no cambiaba nada para el cliente. */}
              <DatosDeContactoEmpresa imp={imp}/>

              {/* Presentacion en video y fotos que sube la propia empresa. El
                  componente no pinta nada si todavia no hay material aprobado. */}
              <PresentacionPublica importadorId={imp.id}/>
              {/* Productos de Tendencias que recomienda la empresa: cotizarlos
                  le llega solo a ella. No pinta nada si no tiene. */}
              <RecomendadosEmpresa importadorId={imp.id} onAbrir={onAbrirTendencia}/>

              <Card padding="md">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Star className="w-4 h-4 text-primary"/>Reseñas de clientes</h3>
                <p className="text-xs text-muted-foreground mb-4">Solo las escriben clientes que ya recibieron una importación con esta empresa.</p>
                <ResenasImportador importadorId={imp.id}/>
              </Card>

              {/* Respaldo de la plataforma: distinto de las certificaciones que
                  la propia empresa declara, porque este lo otorga Zarpi. */}
              {platformCerts.length>0&&(
                <Card padding="md" className="border-primary/20 bg-primary/5">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-primary"/>Respaldada por Zarpi</h3>
                  <p className="text-xs text-muted-foreground mb-3">Sellos que nuestro equipo otorgó tras verificar a esta empresa.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {platformCerts.map(c=>(
                      <div key={c.id} className="flex items-start gap-3 p-3 bg-white border border-primary/15 rounded-xl">
                        <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
                          {c.logoUrl
                            ? <img src={resolveApiUrl(c.logoUrl)} alt="" className="w-8 h-8 object-contain"/>
                            : <BadgeCheck className="w-5 h-5 text-primary"/>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">{c.nombre}</p>
                          {c.descripcion&&<p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{c.descripcion}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Certifications */}
              <Card padding="md">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-primary"/>Certificaciones declaradas por la empresa</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {certs.map(c=>(
                    <div key={c} className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0"><Award className="w-4 h-4 text-emerald-600"/></div>
                      <div><p className="text-xs font-semibold text-emerald-800">{c}</p><p className="text-[10px] text-emerald-600 mt-0.5">Certificado activo</p></div>
                    </div>
                  ))}
                  {certs.length===0&&<p className="text-sm text-muted-foreground col-span-3">Sin certificaciones registradas.</p>}
                </div>
              </Card>

              {/* Advisors */}
              <Card padding="md">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><UserRound className="w-4 h-4 text-primary"/>{ADVISORS.length===1?"Quién te atiende":"Asesores disponibles"}</h3>
                <div className="space-y-3">
                  {ADVISORS.map((adv,i)=>(
                    <div key={i} className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                      <Avatar initials={adv.initials} size="lg" color={adv.color}/>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{adv.name}</p>
                        <p className="text-xs text-muted-foreground">{adv.role}</p>
                        {adv.email&&<p className="text-xs text-primary mt-0.5">{adv.email}</p>}
                      </div>
                      <div className="flex gap-1.5">
                        <ContactBtn type="chat" size="sm" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
                        {adv.email&&<ContactBtn type="email" label="Email" size="sm" onClick={()=>openSmartContact({type:"email",email:adv.email,onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Related activity */}
              {(relQuotes.length>0||relOrders.length>0)&&(
                <Card padding="md">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary"/>Historial contigo</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    {[["Cotizaciones",relQuotes.length,"text-blue-600"],["Operaciones",relOrders.length,"text-purple-600"],["Chats activos",relChats.filter(c=>c.status==="activa").length,"text-emerald-600"]].map(([l,v,c])=>(
                      <div key={l as string} className="p-3 bg-muted/30 rounded-xl">
                        <p className={clsx("text-2xl font-semibold",c as string)}>{v as number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{l as string}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Right sidebar */}
            <div className="w-60 flex-shrink-0 hidden lg:block space-y-4">
              <Card padding="md">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Estadísticas</h3>
                <div className="space-y-2.5">
                  {[["Miembro desde",imp.memberSince],["Proyectos totales",imp.projects.toString()],["Tiempo de respuesta",imp.responseTime],["País principal",imp.country]].map(([k,v])=>(
                    <div key={k} className="flex justify-between items-start gap-2"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-medium text-right">{v}</span></div>
                  ))}
                </div>
              </Card>

              <Card padding="md" className="bg-primary/5 border-primary/20">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Acciones rápidas</h3>
                <div className="flex flex-col gap-2">
                  <Button variant="primary" size="sm" fullWidth icon={<Plus className="w-3.5 h-3.5"/>} onClick={()=>onCreateQuote(imp.id)}>Crear cotización</Button>
                  <ContactBtn type="chat" size="sm" label="Contactar por chat" className="w-full justify-center" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
                  {relChats.length>0&&<Button variant="secondary" size="sm" fullWidth icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChats[0].id)}>Abrir chat</Button>}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}