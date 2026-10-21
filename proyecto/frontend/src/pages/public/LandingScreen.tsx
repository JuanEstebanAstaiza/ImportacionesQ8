import React, { useEffect, useState } from "react";
import {
  BadgeCheck, Bell, Building2, Check, CheckCircle2, ChevronDown, ChevronLeft,
  ClipboardList, Clock, FileText, Loader2, MessageSquare, Moon, MoveRight,
  Receipt, Ship, ShoppingCart, Sun, TrendingUp, UserRound, Users,
} from "lucide-react";
import { clsx } from "clsx";
import { Button, Card, Input, Logo, Textarea } from "@/components/design-system";
import { PublicSicLogo } from "@/components/navigation/PublicSicLogo";
import { CarruselVideos } from "@/components/media/CarruselVideos";
import { EMPRESA } from "@/features/legal/empresa";
import type { LegalPage } from "@/features/legal/types";
import { SeccionPlanes } from "@/features/planes/SeccionPlanes";
import { landingService, leerVideosQuienesSomos, type LandingBlock, type LandingDynamicContent, type LandingSection } from "@/services/landing.service";
import { registroAbierto } from "@/app/registro";
import { resolveApiUrl } from "@/services/api-client";
import { safeHttpUrl } from "@/utils/safe-url";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";
import { BloqueLanding } from "@/features/landing/BloqueLanding";
/** Armazón de las pantallas públicas (Tendencias y el reto) para quien no tiene sesión. */
type FooterPublicoProps = {
  onLanding: () => void;
  onPlanes: () => void;
  onPolicy: (page: LegalPage) => void;
  onTendencias: () => void;
};

const enlacePie = "hover:text-accent transition-colors text-left";

function FooterPublico({ onLanding, onPlanes, onPolicy, onTendencias }: FooterPublicoProps) {
  return (
    <footer className="bg-[#0F0F0F] text-white py-10 px-6 relative overflow-hidden">
      <div className="zarpi-blob zarpi-blob-neutral absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-15 scale-125" />
      <div className="mx-auto max-w-7xl relative z-10 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onLanding} aria-label="Ir al inicio">
            <img src="/brand/zarpi-wordmark-acid.svg" alt="Zarpi" className="h-8 w-28 object-contain object-left" />
          </button>
          <p className="text-xs text-white/70"><span className="font-semibold text-white">{EMPRESA.razonSocial}</span> · NIT {EMPRESA.nit} · {EMPRESA.ciudad}, Colombia</p>
        </div>
        <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/70">
          <button onClick={onLanding} className={enlacePie}>Quiénes somos</button>
          <button onClick={onLanding} className={enlacePie}>Cómo funciona</button>
          <button onClick={onPlanes} className={enlacePie}>Planes</button>
          <button onClick={onTendencias} className={enlacePie}>Tendencias</button>
          <button onClick={onLanding} className={enlacePie}>Contacto</button>
          <button onClick={() => onPolicy("planes")} className={enlacePie}>Condiciones de los planes</button>
          <button onClick={() => onPolicy("terms")} className={enlacePie}>Términos y condiciones</button>
          <button onClick={() => onPolicy("data")} className={enlacePie}>Política de tratamiento de datos</button>
        </nav>
        <p className="max-w-5xl text-xs leading-relaxed text-white/55">
          <span className="font-semibold text-white/70">Aviso legal: </span>
          Zarpi S.A.S. es una plataforma de intermediación tecnológica. No importa, no transporta, no nacionaliza ni recibe el dinero de las operaciones. Cada operación se celebra directamente entre quien importa y la empresa importadora que elige.
        </p>
        <p className="border-t border-white/10 pt-5 text-center text-xs text-white/40">? 2026 Zarpi. Todos los derechos reservados.</p>
        <div className="flex justify-center border-t border-white/10 pt-5">
          <PublicSicLogo />
        </div>
      </div>
    </footer>
  );
}

export function PantallaPublica({activa,onLanding,onPlanes,onLogin,onRegister,onTendencias,onReto,onPolicy,children}:{activa:"tendencias"|"reto";onLanding:()=>void;onPlanes:()=>void;onLogin:()=>void;onRegister:()=>void;onTendencias:()=>void;onReto:()=>void;onPolicy:(page:LegalPage)=>void;children:React.ReactNode}) {
  const { dark, toggleTheme } = useBrandTheme();
  const claseMenuPublico=(activo:boolean)=>clsx(
    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
    activo
      ?"bg-primary text-white dark:bg-accent dark:text-accent-foreground"
      :"text-muted-foreground hover:bg-foreground/15 dark:hover:bg-white/15 dark:hover:text-white",
  );
  const irALanding=()=>onLanding();
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <LandingBackground />
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex w-full min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <button type="button" onClick={onLanding} aria-label="Ir al inicio" className="flex-shrink-0"><Logo/></button>
          <nav className="hidden xl:flex items-center gap-1">
            {LANDING_TABS.map(section=>{
              const action=section.key==="planes"
                ?onPlanes
                :section.key==="tendencias"
                  ?onTendencias
                  :section.key==="reto"
                    ?onReto
                    :irALanding;
              return <button key={section.key} type="button" onClick={action} className={claseMenuPublico(activa===section.key)}>{section.label}</button>;
            })}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={dark ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
            >
              {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            <Button variant="secondary" size="sm" onClick={onLogin}>Iniciar sesión</Button>
            <Button size="sm" className="hidden sm:inline-flex" onClick={onRegister}>{registroAbierto()?"Crear cuenta":"Solicitar acceso"}</Button>
          </div>
        </div>
        <nav className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2">
          {LANDING_TABS.map(section=>{
            const action=section.key==="planes"
              ?onPlanes
              :section.key==="tendencias"
                ?onTendencias
                :section.key==="reto"
                  ?onReto
                  :irALanding;
            return <button key={section.key} type="button" onClick={action} className={claseMenuPublico(activa===section.key)}>{section.label}</button>;
          })}
        </nav>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6">{children}</main>
      <div className="relative z-10">
        <FooterPublico onLanding={onLanding} onPlanes={onPlanes} onPolicy={onPolicy} onTendencias={onTendencias} />
      </div>
    </div>
  );
}

// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
// Textos: zarpi-home-copy-v1.md (raíz del repositorio). Los precios, lo que
// incluye cada plan y los cupos NO están aquí: salen de Admin â€º Planes.
type LandingTabKey=Exclude<LandingSection,"stats"|"dare">|"tendencias"|"reto";
const LANDING_TABS:{key:LandingTabKey;label:string}[]=[
  {key:"home",label:"Inicio"},
  {key:"about",label:"Quiénes somos"},
  {key:"how-it-works",label:"Cómo funciona"},
  {key:"planes",label:"Planes"},
  {key:"news",label:"Novedades y aliados"},
  {key:"contact",label:"Contacto"},
  {key:"tendencias",label:"Tendencias"},
  {key:"reto",label:"Reto"},
];

type PreguntaLanding={q:string;a:string};
const FAQ_ZARPI_IMPORTA:PreguntaLanding={q:"¿Zarpi importa mi producto?",a:"No. Las empresas importadoras importan a su nombre, nacionalizan y te facturan en Colombia como venta nacional. Zarpi conecta, ordena la información y registra el proceso."};
const FAQ_A_QUIEN_PAGO:PreguntaLanding={q:"¿A quién le pago?",a:"Directamente a la empresa importadora que elegiste, a la cuenta que ves en la plataforma. Zarpi no recibe el dinero de tu importación."};
const FAQ_CUANTO_CUESTA_IMPORTAR:PreguntaLanding={q:"¿Cómo sé cuánto me va a costar importar?",a:"Cada propuesta indica el precio final puesto en Colombia, qué incluye, qué no y los tiempos estimados. Antes de aceptar, revisa el punto de entrega y los supuestos que podrían mover el precio."};
// Lo que Zarpi no hace se dice aquí, solo como respuesta: la portada habla de lo que sí hace.
const FAQ_HOME:PreguntaLanding[]=[FAQ_ZARPI_IMPORTA,FAQ_A_QUIEN_PAGO,FAQ_CUANTO_CUESTA_IMPORTAR];
const FAQ_COMPLETA:PreguntaLanding[]=[
  FAQ_ZARPI_IMPORTA,
  {q:"¿Cuánto cuesta?",a:"Zarpi funciona con planes de acceso para quienes importan. Los ves en la sección de planes y conoces el precio y las condiciones antes de pagar."},
  FAQ_CUANTO_CUESTA_IMPORTAR,
  {q:"¿Qué significa “empresa verificada”?",a:"Que confirmamos su existencia legal, su actividad importadora real y sus referencias antes de que entre, y que su cumplimiento se publica con las mismas métricas que el de todas las demás."},
  {q:"¿Estoy obligado a aceptar una propuesta?",a:"No. Revisas las propuestas y eliges solo si alguna te sirve."},
  {q:"¿Y si algo sale distinto a lo acordado?",a:"La empresa importadora responde directamente por su servicio. Zarpi exige respuesta en plazos cortos, documenta todo y hace seguimiento hasta que haya una solución."},
  FAQ_A_QUIEN_PAGO,
];
const PARA_IMPORTADORAS=[
  "Solicitudes de compradores verificados y comprometidos, sin ruido.",
  "Cotizas solo lo que te interesa. Cotizar no tiene costo.",
  "Un perfil con tu trayectoria y tus métricas, iguales para todas.",
  "Programa Fundadoras: cupos limitados.",
];

function ListaChequeo({items}:{items:string[]}) {
  return (
    <ul className="space-y-2.5 text-sm text-muted-foreground">
      {items.map(item=>(
        <li key={item} className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary dark:text-accent"/><span>{item}</span></li>
      ))}
    </ul>
  );
}

function PreguntasLanding({items}:{items:PreguntaLanding[]}) {
  const [abierta,setAbierta]=useState<number|null>(null);
  return (
    <div className="space-y-3">
      {items.map((f,i)=>(
        <div key={f.q} className="border border-border rounded-xl overflow-hidden bg-card backdrop-blur-sm">
          <button onClick={()=>setAbierta(abierta===i?null:i)} aria-expanded={abierta===i}
            className="group w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/50 transition-colors">
            <span className="font-medium text-sm">{f.q}</span>
            <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center flex-shrink-0 transition-colors duration-200 group-hover:bg-primary group-hover:border-primary dark:group-hover:bg-accent dark:group-hover:border-accent">
              <ChevronDown className={clsx("w-4 h-4 text-muted-foreground transition-all duration-200 group-hover:text-white dark:group-hover:text-accent-foreground",abierta===i&&"rotate-180")}/>
            </div>
          </button>
          {abierta===i&&<div className="px-5 pb-4"><p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p></div>}
        </div>
      ))}
    </div>
  );
}

export function LandingScreen({onLogin,onRegister,onPolicy,onTendencias,onReto,onInscribirse,onListaEspera}:{onLogin:()=>void;onRegister:()=>void;onPolicy:(page:LegalPage)=>void;onTendencias:()=>void;onReto:()=>void;onInscribirse:(clave:string)=>void;onListaEspera:()=>void}) {
  const { dark, toggleTheme } = useBrandTheme();
  const [activeTab,setActiveTab]=useState<LandingTabKey>("home");
  // Sección a la que hay que bajar después de cambiar de pestaña (`planes`, `preguntas`).
  const [ancla,setAncla]=useState<string|null>(null);
  const irA=(pestana:LandingTabKey,destino?:string)=>{
    if (pestana === "tendencias") {
      onTendencias();
      return;
    }
    if (pestana === "reto") {
      onReto();
      return;
    }
    if (pestana === "planes") {
      setActiveTab("home");
      setAncla("planes");
      return;
    }
    setActiveTab(pestana);
    if(destino)setAncla(destino);
    else window.scrollTo({top:0});
  };
  // El tab Planes lleva a la sección de precios del inicio (/#planes).
  const irAPlanes=()=>irA("home","planes");
  // El CTA de acceso respeta el interruptor Admin â€º Módulos: registro público
  // o formulario de solicitud para la lista privada.
  const abrirAcceso=()=>onRegister();
  const textoAcceso=registroAbierto()?"Crear cuenta":"Solicitar acceso";
  // «Aplicar como empresa importadora» abre Contacto con ese perfil ya marcado.
  const [perfilContacto,setPerfilContacto]=useState<PerfilContacto>("comprador");
  const contactar=(perfil:PerfilContacto)=>{setPerfilContacto(perfil);irA("contact");};
  const [dynamicContent,setDynamicContent]=useState<LandingDynamicContent|null>(null);
  const [dynamicContentError,setDynamicContentError]=useState("");

  useEffect(()=>{
    if(!ancla)return;
    const t=window.setTimeout(()=>{
      document.getElementById(ancla)?.scrollIntoView({behavior:"smooth",block:"start"});
      setAncla(null);
    },60);
    return ()=>window.clearTimeout(t);
  },[ancla,activeTab]);

  // Un enlace a /#planes (correos, otras pantallas) abre directo la sección.
  useEffect(()=>{
    const revisar=()=>{if(window.location.hash==="#planes")irA("home","planes");};
    revisar();
    window.addEventListener("hashchange",revisar);
    return ()=>window.removeEventListener("hashchange",revisar);
  },[]);

  useEffect(()=>{
    // "Quiénes somos" también lo usa: su carrusel de videos vive en el CMS.
    if((activeTab!=="news"&&activeTab!=="about")||dynamicContent)return;
    landingService.getDynamicContent()
      .then(setDynamicContent)
      .catch(()=>setDynamicContentError("No se pudo cargar el contenido de novedades y aliados."));
  },[activeTab,dynamicContent]);

  const benefits=[
    {icon:<Receipt className="w-6 h-6 text-primary"/>,title:"Precio final en Colombia",desc:"Cada propuesta llega con el valor puesto en tu bodega y con lo que incluye y lo que no, por escrito."},
    {icon:<BadgeCheck className="w-6 h-6 text-primary"/>,title:"Empresas con trayectoria",desc:"Antes de elegir sabes quién es cada empresa importadora: años importando, operaciones realizadas y cumplimiento."},
    {icon:<ClipboardList className="w-6 h-6 text-primary"/>,title:"Todo queda registrado",desc:"Propuestas, acuerdos, documentos y avances de cada etapa, en un solo lugar."},
  ];
  const pasosCortos=[
    {title:"Publica.",desc:"Cuéntanos qué producto buscas, la cantidad, las especificaciones y, si tienes, el enlace o la referencia."},
    {title:"Recibe propuestas.",desc:"Empresas importadoras verificadas te envían precio final en Colombia, tiempos y condiciones."},
    {title:"Elige.",desc:"Resuelve tus dudas por la plataforma, conoce a cada empresa y decide con quién trabajar. La operación se hace directamente con la empresa que elijas."},
    {title:"Haz seguimiento.",desc:"Cada etapa, de la compra en origen a la entrega, queda documentada en un solo lugar."},
  ];
  const claseMenu=(activo:boolean)=>clsx(
    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
    activo
      ?"bg-primary text-white dark:bg-accent dark:text-accent-foreground"
      :"text-muted-foreground hover:bg-foreground/15 dark:hover:bg-white/15 dark:hover:text-white",
  );
  const menu=(
    <>
      {LANDING_TABS.map(section=>(
        <button key={section.key} onClick={()=>irA(section.key)} className={claseMenu(activeTab===section.key)}>{section.label}</button>
      ))}
    </>
  );
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-9xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo/>
          <div className="hidden xl:flex items-center gap-1">{menu}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={dark ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground active:bg-primary/90 dark:active:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            <Button variant="secondary" size="sm" className="hidden sm:inline-flex hover:bg-primary hover:text-white hover:border-primary dark:hover:bg-accent dark:hover:text-accent-foreground dark:hover:border-accent" onClick={onLogin}>
              Iniciar sesión
            </Button>
            <Button variant="primary" size="sm" className="hover:bg-primary/80 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" onClick={abrirAcceso}>
              {textoAcceso}
            </Button>
          </div>
        </div>
        {/* En pantallas angostas el menú va en una fila que se desliza. */}
        <div className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2 -mt-1">
          {menu}
          <button onClick={onLogin} className={clsx(claseMenu(false),"sm:hidden")}>Iniciar sesión</button>
        </div>
      </nav>

      {activeTab==="home" && (
      <>
      {/* HERO */}
      <section className="pt-40 xl:pt-32 pb-20 px-6 bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/25 pointer-events-none z-0"/>
        <div className="zarpi-blob zarpi-blob-violet absolute -top-24 -left-24 z-0 pointer-events-none"/>
        <div className="zarpi-blob zarpi-blob-acid absolute top-20 -right-20 z-0 pointer-events-none"/>
        <div className="zarpi-blob zarpi-blob-neutral absolute -bottom-36 left-1/3 z-0 pointer-events-none"/>
        <div className="landing-hero-content relative z-10 max-w-7xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent text-accent-foreground rounded-full text-xs font-semibold mb-6"><Ship className="w-3.5 h-3.5"/>Importaciones desde China</span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight mb-5">
            Tú dices qué importar.<br/>
            <span className="text-accent">Zarpi encuentra quién lo trae.</span>
          </h1>
          <p className="text-lg text-background/75 max-w-4xl mx-auto leading-relaxed mb-8">
            Publica lo que quieres importar y recibe propuestas de empresas importadoras verificadas, con precio final puesto en Colombia. Compara, elige y sigue todo el proceso en un solo lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="secondary" size="lg" icon={<UserRound className="w-4 h-4"/>} onClick={abrirAcceso} className="px-8 bg-accent text-accent-foreground border-accent hover:bg-accent/85">{textoAcceso}</Button>
            <Button variant="secondary" size="lg" icon={<MoveRight className="w-4 h-4"/>} onClick={()=>irA("how-it-works")} className="px-8 text-black bg-accent border-background/40 hover:bg-accent/85 ">Cómo funciona</Button>
          </div>
          <p className="mt-6 text-sm italic text-background/60 max-w-2xl mx-auto">
            Para comerciantes, emprendedores y empresas que quieren importar con más información y menos incertidumbre.
          </p>
        </div>
      </section>

      {/* TRES BLOQUES */}
      <section className="py-16 px-6 bg-muted relative overflow-hidden">
        <div className="zarpi-blob zarpi-blob-acid absolute -right-16 top-10 pointer-events-none opacity-30 scale-90" />
        <div className="zarpi-blob zarpi-blob-violet absolute -left-20 bottom-10 pointer-events-none opacity-25 scale-75" />
        <div className="max-w-7xl mx-auto relative z-10 grid gap-5 md:grid-cols-3">
          {benefits.map((b, i) => (
            <div key={b.title} className="landing-reveal bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 hover:shadow-md transition-shadow" style={{animationDelay:`${i*90}ms`}}>
              <div className="landing-icon w-12 h-12 rounded-xl flex items-center justify-center mb-4 border bg-primary/10 border-primary/20 text-primary dark:bg-[#EDF953]/15 dark:border-[#EDF953]/30 dark:text-[#EDF953]">
                {b.icon}
              </div>
              <h3 className="font-semibold mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CÓMO FUNCIONA (versión corta) */}
      <section className="py-20 px-6 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-12">De lo que quieres importar a una propuesta en firme.</h2>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pasosCortos.map((paso,i)=>(
              <li key={paso.title} className="rounded-2xl border border-border bg-card/80 p-5">
                <span className="w-9 h-9 rounded-xl bg-primary dark:bg-accent text-primary-foreground dark:text-accent-foreground text-sm font-bold flex items-center justify-center mb-4">{i+1}</span>
                <h3 className="font-semibold mb-1.5">{paso.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{paso.desc}</p>
              </li>
            ))}
          </ol>
          <div className="text-center mt-8">
            <button type="button" onClick={()=>irA("how-it-works")} className="text-sm font-semibold text-primary dark:text-accent hover:underline">Ver el proceso completo →</button>
          </div>
        </div>
      </section>

      {/* PLANES (id `planes`): valores y cupos desde Admin ó Planes */}
      <SeccionPlanes onInscribirme={plan=>onInscribirse(plan.clave)} onCondiciones={()=>onPolicy("planes")} onAvisame={onListaEspera}/>

      {/* PARA EMPRESAS IMPORTADORAS */}
      <section className="py-20 px-6 bg-background relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10 rounded-2xl border border-border bg-card/80 p-6 sm:p-10">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Para empresas importadoras</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">Tu experiencia merece llegar a más compradores.</h2>
          <ListaChequeo items={PARA_IMPORTADORAS}/>
          <Button variant="primary" className="mt-7 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" icon={<Building2 className="w-4 h-4"/>} onClick={()=>contactar("nacionalizadora")}>Aplicar como empresa importadora</Button>
          <p className="mt-3 text-xs text-muted-foreground">Cupos y beneficios sujetos a las condiciones vigentes del programa.</p>
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES (versión corta) */}
      <section className="py-20 px-6 bg-muted relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-10">Preguntas frecuentes</h2>
          <PreguntasLanding items={FAQ_HOME}/>
          <div className="text-center mt-6">
            <button type="button" onClick={()=>irA("how-it-works","preguntas")} className="text-sm font-semibold text-primary dark:text-accent hover:underline">Todas las preguntas →</button>
          </div>
        </div>
      </section>
      </>
      )}

      {activeTab==="about" && <LandingAboutSection content={dynamicContent} onSolicitarAcceso={abrirAcceso}/>}
      {activeTab==="how-it-works" && <LandingHowItWorksSection onVerPlanes={irAPlanes} onAplicarImportadora={()=>contactar("nacionalizadora")}/>}
      {activeTab==="news" && (
        <LandingNewsAlliesSection content={dynamicContent} error={dynamicContentError} onLogin={onLogin} onRegister={onRegister}/>
      )}
      {activeTab==="contact" && <LandingContactSection key={perfilContacto} perfilInicial={perfilContacto} onLogin={onLogin} onRegister={abrirAcceso}/>}

      {activeTab!=="contact" && (
      /* CIERRE */
      <section className="py-16 px-6 bg-primary/60 relative overflow-hidden">
        <div className="zarpi-blob zarpi-blob-violet absolute right-20 top-1/3 pointer-events-none opacity-25 scale-80" />
        <div className="max-w-5xl mx-auto text-center text-primary-foreground relative z-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Tu próxima importación empieza con una mejor decisión.</h2>
          <p className="text-primary-foreground/80 mb-7 leading-relaxed">Publica lo que necesitas y elige la empresa importadora que mejor se ajuste a tu operación.</p>
          <Button variant="secondary" size="lg" onClick={abrirAcceso} className="px-8 text-accent-foreground">{textoAcceso}</Button>
          <p className="mt-5 text-sm text-primary-foreground/80">
            ¿Eres una empresa importadora?{" "}
            <button type="button" onClick={()=>contactar("nacionalizadora")} className="font-semibold underline underline-offset-2 hover:text-white">Conoce cómo vincularte</button>
          </p>
        </div>
      </section>
      )}

      {/* PIE */}
      <footer className="bg-[#0F0F0F] text-white py-10 px-6 relative overflow-hidden">
        <div className="zarpi-blob zarpi-blob-neutral absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-15 scale-125" />
        <div className="mx-auto max-w-7xl relative z-10 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <img src="/brand/zarpi-wordmark-acid.svg" alt="Zarpi" className="h-8 w-28 object-contain object-left" />
            <p className="text-xs text-white/70"><span className="font-semibold text-white">{EMPRESA.razonSocial}</span> · NIT {EMPRESA.nit} · {EMPRESA.ciudad}, Colombia</p>
          </div>
          <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/70">
            <button onClick={()=>irA("about")} className={enlacePie}>Quiénes somos</button>
            <button onClick={()=>irA("how-it-works")} className={enlacePie}>Cómo funciona</button>
            <button onClick={irAPlanes} className={enlacePie}>Planes</button>
            <button onClick={onTendencias} className={enlacePie}>Tendencias</button>
            <button onClick={()=>irA("contact")} className={enlacePie}>Contacto</button>
            <button onClick={()=>onPolicy("planes")} className={enlacePie}>Condiciones de los planes</button>
            <button onClick={()=>onPolicy("terms")} className={enlacePie}>Términos y condiciones</button>
            <button onClick={()=>onPolicy("data")} className={enlacePie}>Política de tratamiento de datos</button>
          </nav>
          <p className="max-w-5xl text-xs leading-relaxed text-white/55">
            <span className="font-semibold text-white/70">Aviso legal: </span>
            Zarpi S.A.S. es una plataforma de intermediación tecnológica. No importa, no transporta, no nacionaliza ni recibe el dinero de las operaciones. Cada operación se celebra directamente entre quien importa y la empresa importadora que elige.
          </p>
          <p className="border-t border-white/10 pt-5 text-center text-xs text-white/40">? 2026 Zarpi. Todos los derechos reservados.</p>
          <div className="flex justify-center border-t border-white/10 pt-5">
            <PublicSicLogo />
          </div>
        </div>
      </footer>
    </div>
  );
}

// ----------------------------------------------------------------------------------------------------
// LANDING ? Perfil de empresa (QuickView) y subpáginas públicas
// ----------------------------------------------------------------------------------------------------
export function LandingBackground() {
  const particles = Array.from({ length: 15 }, (_, i) => {
    const random = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const colors = ["primary", "accent", "neutral"];

    return {
      id: i,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: random(12, 30),
      top: random(0, 100),
      left: random(0, 100),
      duration: random(80, 100),
      delay: random(-16, 0),
      originX: random(-25, 25),
      originY: random(-25, 25),
      shadowX: Math.random() > 0.5 ? 1 : -1,
      blur: random(5, 30),
    };
  });

  return (
    <div className="landing-anim-background" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className={`landing-orb-${particle.color}`}
          style={{
            width: `${particle.size}vmin`,
            height: `${particle.size}vmin`,
            borderRadius: `${particle.size}vmin`,
            top: `${particle.top}%`,
            left: `${particle.left}%`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
            transformOrigin: `${particle.originX}vw ${particle.originY}vh`,
            boxShadow: `${particle.size * 2 * particle.shadowX}px 0 ${
              particle.blur
            }vmin currentColor`,
          }}
        />
      ))}
    </div>
  );
}

/** "Quiénes somos": de dónde nace Zarpi, qué hace, en qué cree y quién está detrás. */
function LandingAboutSection({content,onSolicitarAcceso}:{content:LandingDynamicContent|null;onSolicitarAcceso:()=>void}) {
  const carrusel=leerVideosQuienesSomos(content?.blocks);
  const creencias=[
    {title:"Las mismas reglas para todas.",desc:"Cada empresa importadora se mide con las mismas métricas. Nadie compra una mejor reputación."},
    {title:"El proceso a la vista.",desc:"Cada etapa deja evidencia en la plataforma."},
    {title:"Tú decides.",desc:"Zarpi te muestra quién es quién; la elección es tuya."},
  ];
  return (
    <section className="pt-40 xl:pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />

      <div className="max-w-7xl mx-auto relative z-10 space-y-12">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Quiénes somos</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Importar no debería depender de tener los contactos correctos.</h1>
        </div>
        {carrusel.activo&&carrusel.videos.length>0&&(
          <CarruselVideos videos={carrusel.videos} intervaloSegundos={carrusel.intervalo_segundos}/>
        )}
        <div className="max-w-5xl mx-auto space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>Cuando empezamos a importar no sabíamos por dónde arrancar: si irnos a Buenaventura a buscar quién traía contenedores o irnos a China. Y estando en China, frente al producto, quedaban dos preguntas: cómo iba a llegar a la bodega y cuánto iba a costar realmente tenerlo en Colombia.</p>
          <p>Con los años encontramos la respuesta: empresas importadoras que traen el producto a su nombre, lo nacionalizan y te lo entregan facturado en Colombia. Así importan desde quien hace su primer pedido hasta empresas que traen millones de dólares al mes. Algunas llevan más de treinta años yendo a China.</p>
          <p>También entendimos que encontrar una buena empresa no debería depender de una recomendación, un contacto o una conversación por WhatsApp. <span className="font-semibold text-foreground">Zarpi existe para que esa respuesta esté a un clic de cualquier comerciante en Colombia.</span></p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-3">Qué hacemos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Conectamos a personas y empresas que quieren importar con empresas importadoras verificadas, ordenamos la información para que puedas decidir y guardamos la evidencia de cada etapa.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-4">En qué creemos</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {creencias.map((c,i)=>(
              <article key={c.title} className="landing-reveal bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6" style={{animationDelay:`${i*100}ms`}}>
                <h3 className="text-base font-bold mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-3">Quiénes estamos detrás</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Zarpi S.A.S. nació en Cali en 2026, fundada por Juan Pablo Orozco, comerciante que lleva años importando para su propia operación de comercio electrónico. Creamos Zarpi para convertir una experiencia llena de incertidumbre en un proceso claro y documentado.</p>
        </div>
        <div className="text-center">
          <Button variant="primary" size="lg" className="px-8 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" onClick={onSolicitarAcceso}>{registroAbierto()?"Crear cuenta":"Solicitar acceso"}</Button>
        </div>
      </div>
    </section>
  );
}

/** "Cómo funciona": los pasos de una importación, lo que obtiene cada lado y las preguntas completas. */
function LandingHowItWorksSection({onVerPlanes,onAplicarImportadora}:{onVerPlanes:()=>void;onAplicarImportadora:()=>void}) {
  const pasos:[string,string][]=[
    ["Publicas tu solicitud:"," producto, cantidad, referencia o enlace."],
    ["Tu solicitud llega a empresas importadoras verificadas.",""],
    ["Recibes propuestas"," con precio final en Colombia, tiempos y condiciones."],
    ["Resuelves dudas por el chat de la plataforma,"," conoces la trayectoria de cada empresa y eliges."],
    ["Al aceptar una propuesta, la operación queda registrada"," y se abre el contacto directo con la empresa importadora."],
    ["La empresa importadora actualiza cada etapa:"," producción, tránsito, aduana y entrega."],
    ["Cada etapa queda documentada"," en la plataforma."],
    ["Confirmas la entrega"," y calificas la experiencia."],
  ];
  const paraQuienImporta=[
    "Publicas una vez y recibes propuestas de varias empresas.",
    "Precio final puesto en Colombia, con lo que incluye y lo que no.",
    "Conoces a cada empresa antes de elegir: trayectoria, cumplimiento y calificaciones.",
    "Todo el proceso queda registrado.",
  ];
  return (
    <section className="pt-40 xl:pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Cómo funciona</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Así se importa con Zarpi</h1>
        </div>
        <ol className="grid sm:grid-cols-2 gap-4 mb-14">
          {pasos.map(([fuerte,resto],i)=>(
            <li key={i}>
              <Card padding="md" className="flex h-full items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                <p className="text-sm text-muted-foreground leading-relaxed"><strong className="font-semibold text-foreground">{fuerte}</strong>{resto}</p>
              </Card>
            </li>
          ))}
        </ol>
        <div className="grid md:grid-cols-2 gap-5 mb-16">
          <Card padding="lg" className="flex flex-col">
            <h2 className="text-base font-bold mb-3">Para quien importa</h2>
            <div className="flex-1"><ListaChequeo items={paraQuienImporta}/></div>
            <Button variant="primary" className="mt-5 self-start dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" onClick={onVerPlanes}>Ver planes</Button>
          </Card>
          <Card padding="lg" className="flex flex-col">
            <h2 className="text-base font-bold mb-3">Para empresas importadoras</h2>
            <div className="flex-1"><ListaChequeo items={PARA_IMPORTADORAS}/></div>
            <Button variant="primary" className="mt-7 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" icon={<Building2 className="w-4 h-4"/>} onClick={()=>contactar("nacionalizadora")}>Aplicar como empresa importadora</Button>
          </Card>
        </div>
        <div id="preguntas" className="scroll-mt-28 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-8">Preguntas frecuentes</h2>
          <PreguntasLanding items={FAQ_COMPLETA}/>
        </div>
      </div>
    </section>
  );
}

/** "Novedades y aliados": bloques dinámicos, miniblog y muro de aliados del CMS. */
const LANDING_IMAGE_FALLBACK = "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80";
/** Un bloque del CMS: mismas reglas que la vista previa del editor (features/landing/BloqueLanding). */
function LandingDynamicBlock({block,onLogin,onRegister}:{block:LandingBlock;onLogin:()=>void;onRegister:()=>void}) {
  const onBoton=block.accion_boton==="open_register"?onRegister
    :block.accion_boton==="external_link"&&block.accion_url?()=>window.open(block.accion_url as string,"_blank","noopener,noreferrer")
    :onLogin;
  return (
    <BloqueLanding
      block={block}
      onBoton={onBoton}
      imagen={(ruta,className)=>(
        <img
          src={safeHttpUrl(resolveApiUrl(ruta),LANDING_IMAGE_FALLBACK)}
          alt=""
          className={className}
          onError={(event)=>{event.currentTarget.src=LANDING_IMAGE_FALLBACK;}}
        />
      )}
      video={(ruta,className)=><video src={resolveApiUrl(ruta)} controls className={className}/>}
    />
  );
}

function LandingNewsAlliesSection({content,error,onLogin,onRegister}:{content:LandingDynamicContent|null;error:string;onLogin:()=>void;onRegister:()=>void}) {
  // El carrusel de videos es de "Quiénes somos", no de esta sección.
  const dynamicBlocks=(content?.blocks??[]).filter(b=>b.tipo!=="allies_grid"&&b.tipo!=="video_rotativo").sort((a,b)=>a.orden-b.orden);
  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />
      <div className="max-w-7xl mx-auto space-y-14 relative z-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Novedades y aliados</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Lo último de Zarpi</h1>
        </div>

        {error&&(
          <Card padding="md" className="border-destructive/30 bg-red-50 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {!content&&!error&&(
          <p className="text-center text-sm text-muted-foreground">Cargando contenido...</p>
        )}

        {content&&(
          <>
            {dynamicBlocks.length>0&&(
              <Card padding="lg" className="space-y-5 bg-white/30 !backdrop-blur-md">
                {dynamicBlocks.map(block=><LandingDynamicBlock key={block.id} block={block} onLogin={onLogin} onRegister={onRegister}/>)}
              </Card>
            )}

            <div>
              <h2 className="text-xl font-bold mb-5">Novedades</h2>
              {content.news.length===0?(
                <p className="text-sm text-muted-foreground">Todavía no hay novedades publicadas.</p>
              ):(
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {content.news.map(item=>(
                    <Card key={item.id} padding="md">
                      {item.imagen_url&&(
                        <img
                          src={safeHttpUrl(resolveApiUrl(item.imagen_url),LANDING_IMAGE_FALLBACK)}
                          alt=""
                          className="h-32 w-full rounded-lg object-cover mb-3"
                          onError={(event)=>{event.currentTarget.src=LANDING_IMAGE_FALLBACK;}}
                        />
                      )}
                      <h3 className="font-semibold text-sm mb-1.5">{item.titulo}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.resumen}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold mb-5">Aliados</h2>
              {content.allies.length===0?(
                <p className="text-sm text-muted-foreground">Todavía no hay aliados publicados.</p>
              ):(
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {content.allies.map(ally=>{
                    const card=(
                      <Card padding="md" className="flex flex-col items-center text-center gap-2">
                        {ally.logo_url?(
                          <img
                            src={safeHttpUrl(resolveApiUrl(ally.logo_url),LANDING_IMAGE_FALLBACK)}
                            alt={ally.nombre}
                            className="h-12 object-contain"
                            onError={(event)=>{event.currentTarget.src=LANDING_IMAGE_FALLBACK;}}
                          />
                        ):(
                          <Building2 className="w-8 h-8 text-muted-foreground/40"/>
                        )}
                        <p className="text-xs font-medium">{ally.nombre}</p>
                      </Card>
                    );
                    return ally.enlace?(
                      <a key={ally.id} href={ally.enlace} target="_blank" rel="noopener noreferrer">{card}</a>
                    ):(
                      <div key={ally.id}>{card}</div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** "Contacto": selector de perfil (comprador / nacionalizadora) + FAQ. */
type PerfilContacto="comprador"|"nacionalizadora";
function LandingContactSection({perfilInicial="comprador",onLogin,onRegister}:{perfilInicial?:PerfilContacto;onLogin:()=>void;onRegister:()=>void}) {
  const [perfil,setPerfil]=useState<PerfilContacto>(perfilInicial);
  const [nombre,setNombre]=useState("");
  const [email,setEmail]=useState("");
  const [telefono,setTelefono]=useState("");
  const [mensaje,setMensaje]=useState("");
  const [enviado,setEnviado]=useState(false);
  const [enviando,setEnviando]=useState(false);
  const [errorEnvio,setErrorEnvio]=useState("");

  const faqsContacto=[
    {q:"¿Cómo empiezo si quiero importar?",a:registroAbierto()
      ?"Crea tu cuenta gratis y publica tu primera solicitud de cotización sin costo."
      :"Por ahora el acceso es por lista privada: pídelo con «Solicitar acceso» y te escribimos con el valor."},
    {q:"¿Cómo empiezo si soy empresa importadora?",a:"Escríbenos desde este formulario: confirmamos tu existencia legal, tu actividad importadora real y tus referencias antes del alta. El Programa Fundadoras tiene cupos limitados."},
  ];

  async function enviarContacto(event:React.FormEvent){
    event.preventDefault();
    setErrorEnvio("");
    setEnviando(true);
    try{
      await landingService.sendContact({
        nombre:nombre.trim(),
        email:email.trim(),
        telefono:telefono.trim()||undefined,
        perfil,
        mensaje:mensaje.trim(),
      });
      setEnviado(true);
    }catch(error){
      setErrorEnvio(error instanceof Error&&error.message.trim()?error.message:"No se pudo enviar tu mensaje. Intenta nuevamente.");
    }finally{
      setEnviando(false);
    }
  }

  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />
      <div className="max-w-4xl mx-auto space-y-12 relative z-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Contacto</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Hablemos</h1>
        </div>

        <Card padding="lg">
          {enviado ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-3" />
              <p className="font-semibold">Gracias, recibimos tu mensaje.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Te responderemos pronto a {email || "tu correo"}.
              </p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => { void enviarContacto(event); }}
            >
              <div className="flex gap-2">
                {(["comprador", "nacionalizadora"] as const).map(opt => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => setPerfil(opt)}
                    className={clsx(
                      "flex-1 h-9 rounded-lg border text-sm font-medium transition-all",
                      perfil === opt
                        ? "bg-primary text-white border-primary dark:bg-accent dark:text-accent-foreground dark:border-accent"
                        : "bg-white text-muted-foreground border-border hover:border-primary/40 dark:bg-transparent dark:hover:border-accent/40"
                    )}
                  >
                    {opt === "comprador" ? "Quiero importar" : "Soy empresa importadora"}
                  </button>
                ))}
              </div>

              <Input
                label="Nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                required
                className="focus:border-primary dark:focus:border-accent"
              />

              <Input
                label="Correo"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="focus:border-primary dark:focus:border-accent"
              />

              <Input
                label="Teléfono (opcional)"
                type="tel"
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
                className="focus:border-primary dark:focus:border-accent"
              />

              <Textarea
                label="Mensaje"
                rows={4}
                value={mensaje}
                onChange={(event) => setMensaje(event.target.value)}
                required
                className="focus:border-primary dark:focus:border-accent"
              />

              {errorEnvio ? <p className="text-sm text-destructive">{errorEnvio}</p> : null}

              <Button type="submit" variant="primary" fullWidth loading={enviando} className="dark:bg-accent dark:hover:bg-accent/80 dark:text-accent-foreground">
                {enviando ? "Enviando..." : "Enviar mensaje"}
              </Button>
            </form>
          )}
        </Card>

        <div className="space-y-3">
          {faqsContacto.map((f,i)=>(
            <Card key={f.q} padding="md">
              <p className="text-sm font-semibold mb-1">{f.q}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.a}</p>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="secondary" size="lg" onClick={onRegister}>{registroAbierto()?"Crear cuenta gratis":"Solicitar acceso"}</Button>
          <Button variant="primary" size="lg" onClick={onLogin}>Iniciar sesión</Button>
        </div>
      </div>
    </section>
  );
}
// ----------------------------------------------------------------------------------------------------
