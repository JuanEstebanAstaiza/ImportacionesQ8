import { useState, useEffect, useRef, useCallback } from "react";
import { Film, Building2, Phone, Globe, X, Upload, Save, MapPin, Tag, BadgeCheck, Mail as MailIcon, Package, Image as ImageIcon, Shield, Gauge } from "lucide-react";
import { clsx } from "clsx";

import { SidebarCtrl } from "@/types/portal";

import { Breadcrumb } from "@/components/navigation/Breadcrumb";

import type { LegalPage } from "@/features/legal/types";

import { Button, Card, Input, Logo } from "@/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { businessService, type BackendCupoDiario, type BackendImporter, type UnidadCantidad } from "@/services/business.service";

import { CondicionesEmpresa } from "@/features/propuestas/CondicionesEmpresa";

import { resolveApiUrl, toApiPath } from "@/services/api-client";

import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";

import { EditorPresentacion } from "@/features/importador/PresentacionEmpresa";

import { componerShippingMark, LONGITUD_MAX_PREFIJO_SHIPPING_MARK } from "@/utils/shipping-mark";
import { CATEGORIAS_PRODUCTO } from "@/utils/categorias";

import { RUTA_RESTABLECER, type Screen } from "@/app/rutas";

const RESET_PASSWORD_PATH = RUTA_RESTABLECER;
/** Producto de Tendencias que un visitante quiso cotizar antes de registrarse. */
const CLAVE_PREFILL_PENDIENTE = "zarpi:prefill-pendiente";
/** Pantalla (y por tanto URL) de cada documento legal. */
const PANTALLA_LEGAL: Record<LegalPage, Screen> = {
  data: "policy-data",
  terms: "policy-terms",
  payments: "policy-payments",
  planes: "policy-planes",
};

import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader, USER_IMPORTADORA } from "@/components/layout/AppHeader";
import { IndicadorAutoguardado } from "@/features/importador/components/IndicadorAutoguardado";

const COUNTRIES = ["China", "Estados Unidos", "Alemania", "Japón", "India", "Italia", "Francia", "España", "Brasil", "Corea del Sur", "Turquía", "México", "Colombia"];
const BANNER_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const BANNER_FORMATS_LABEL = "PNG, JPG o WebP";
const BANNER_UPLOAD_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
const BANNER_MAX_BYTES = 5 * 1024 * 1024;
const RETARDO_AUTOGUARDADO_MS = 1200;

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "IM";
}

function importerColorFromId(id: string): string {
  const palette = ["bg-blue-600", "bg-emerald-600", "bg-cyan-600", "bg-orange-600", "bg-slate-600", "bg-rose-600", "bg-indigo-600"];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) % 997;
  }
  return palette[hash % palette.length];
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export type FormularioEmpresa = {
  razonSocial:string;description:string;year:string;website:string;email:string;logoUrl:string;
  phone:string;address:string;
  categories:string[];countries:string[];industries:string[];
  avgResponse:string;soloCotizacionesDirectas:boolean;
  shippingMarkPrefijo:string;certs:string[];banner:string;
  tierMinimoRequerido:"Bronze"|"Silver"|"Gold"|"Élite";
  /** Vacío = sin límite. Texto para poder dejar el campo en blanco al editar. */
  limiteCotizacionesDiarias:string;
  /** Pedido mínimo que acepta la empresa; vacío = sin mínimo. */
  pedidoMinimo:string;
  pedidoMinimoUnidad:UnidadCantidad;
};

/** Pedido mínimo para el PUT: null si está vacío, undefined si no es un número válido. */
function leerPedidoMinimo(texto:string):number|null|undefined{
  const limpio=texto.trim().replace(",",".");
  if(!limpio)return null;
  const valor=Number.parseFloat(limpio);
  return Number.isFinite(valor)&&valor>0?valor:undefined;
}

/**
 * Convierte lo escrito en el campo de límite diario al valor del PUT: null
 * (sin límite) si está vacío, el entero si es válido y undefined si no lo es,
 * para no pisar el límite guardado con un valor a medio escribir.
 */
function leerLimiteDiario(texto:string):number|null|undefined{
  const limpio=texto.trim();
  if(!limpio)return null;
  if(!/^\d+$/.test(limpio))return undefined;
  const valor=Number.parseInt(limpio,10);
  return valor>=1&&valor<=10000?valor:undefined;
}

// Formulario vacío de verdad. Antes venía sembrado con una dirección de Bogotá,
// un teléfono y las certificaciones "ISO 9001"/"CE" de ejemplo: cualquier
// empresa que guardara su perfil publicaba esos datos inventados como propios.
const FORMULARIO_EMPRESA_VACIO:FormularioEmpresa={
  razonSocial:"",description:"",year:"",website:"",email:"",logoUrl:"",
  phone:"",address:"",
  categories:[],countries:[],industries:[],
  avgResponse:"~24h",soloCotizacionesDirectas:false,
  shippingMarkPrefijo:"",certs:[],banner:"",
  tierMinimoRequerido:"Bronze",
  limiteCotizacionesDiarias:"",
  pedidoMinimo:"",
  pedidoMinimoUnidad:"unidades",
};

export function ImporterCompanyProfileScreen({sb,company,onSave}:{sb:SidebarCtrl;company:BackendImporter|null;onSave:(payload:{nombre_empresa:string;logo_url?:string;especialidad_producto:string[];paises_origen:string[];tiempo_respuesta_promedio:string;perfil_publico?:Record<string, unknown>;solo_cotizaciones_directas?:boolean;shipping_mark_prefijo?:string;limite_cotizaciones_diarias?:number|null;pedido_minimo?:number|null;pedido_minimo_unidad?:UnidadCantidad;})=>Promise<void>}) {
  const [form,setForm]=useState<FormularioEmpresa>(FORMULARIO_EMPRESA_VACIO);
  const [estadoGuardado,setEstadoGuardado]=useState<"sin-cambios"|"pendiente"|"guardando"|"guardado">("sin-cambios");
  const [saveError,setSaveError]=useState("");
  const [bannerUploading,setBannerUploading]=useState(false);
  const [bannerError,setBannerError]=useState("");
  const [logoUploading,setLogoUploading]=useState(false);
  const [logoUploadError,setLogoUploadError]=useState("");
  const bannerInputRef=useRef<HTMLInputElement>(null);
  const logoInputRef=useRef<HTMLInputElement>(null);

  /**
   * Vistas previas del archivo que acaba de elegir el usuario, como `blob:`.
   *
   * Hacen falta porque el backend solo sirve una imagen sin sesión cuando ya
   * figura como imagen pública de la empresa, y eso no ocurre hasta que el
   * perfil se guarda. Entre la subida y el autoguardado, el `<img>` apuntando al
   * servidor recibía un 401 y el navegador NO reintenta una imagen fallida: se
   * quedaba rota hasta recargar la página, justo lo que hacía pensar que la
   * subida no había funcionado.
   */
  const [previaLocal,setPreviaLocal]=useState<{logo:string;banner:string}>({logo:"",banner:""});
  const previaLocalRef=useRef(previaLocal);
  useEffect(()=>{previaLocalRef.current=previaLocal;},[previaLocal]);
  // Un `blob:` retiene el archivo en memoria hasta que se revoca.
  useEffect(()=>()=>{
    Object.values(previaLocalRef.current).forEach((url)=>{if(url)URL.revokeObjectURL(url);});
  },[]);

  function fijarPreviaLocal(clave:"logo"|"banner",archivo:File|null){
    setPreviaLocal((prev)=>{
      if(prev[clave])URL.revokeObjectURL(prev[clave]);
      return {...prev,[clave]:archivo?URL.createObjectURL(archivo):""};
    });
  }

  // `revision` sube en cada edición del usuario (nunca al hidratar desde el
  // servidor) y es lo que dispara el autoguardado con retardo.
  const [revision,setRevision]=useState(0);
  const formRef=useRef(form);
  const [cupo,setCupo]=useState<BackendCupoDiario|null>(null);
  const empresaHidratadaRef=useRef<string|null>(null);
  const guardadoEnCursoRef=useRef(false);
  const cambiosSinGuardarRef=useRef(false);

  useEffect(()=>{formRef.current=form;},[form]);

  // Uso del cupo diario. Es informativo: si falla, el campo sigue funcionando.
  const cargarCupo=useCallback(async()=>{
    try{setCupo(await businessService.getDailyQuoteQuota());}catch{setCupo(null);}
  },[]);
  useEffect(()=>{if(company?.id)void cargarCupo();},[company?.id,cargarCupo]);

  useEffect(()=>{
    if(!company)return;
    // Se hidrata una sola vez por empresa. Volver a copiar la respuesta del
    // servidor en cada recarga pisaba lo que el usuario estuviera escribiendo,
    // y con autoguardado esa recarga ocurre cada pocos segundos.
    if(empresaHidratadaRef.current===company.id)return;
    empresaHidratadaRef.current=company.id;

    const perfilPublico = company.perfil_publico && typeof company.perfil_publico === "object" ? company.perfil_publico : {};
    const getString = (key: string) => {
      const value = perfilPublico[key];
      return typeof value === "string" ? value : "";
    };
    const getStringArray = (key: string) => {
      const value = perfilPublico[key];
      if (!Array.isArray(value)) {
        return [] as string[];
      }
      return value.filter((entry): entry is string => typeof entry === "string");
    };

    setForm({
      razonSocial:company.nombre_empresa,
      logoUrl:company.logo_url || "",
      description:getString("description"),
      year:getString("year"),
      website:getString("website"),
      email:getString("email"),
      phone:getString("phone"),
      address:getString("address"),
      categories:company.especialidad_producto ?? [],
      countries:company.paises_origen ?? [],
      industries:getStringArray("industries"),
      avgResponse:company.tiempo_respuesta_promedio || "~24h",
      certs:getStringArray("certs"),
      banner:getString("banner"),
      soloCotizacionesDirectas:Boolean(company.solo_cotizaciones_directas),
      shippingMarkPrefijo:company.shipping_mark_prefijo || "",
      tierMinimoRequerido: (["Bronze", "Silver", "Gold", "Élite"].includes(getString("tier_minimo_requerido")) ? getString("tier_minimo_requerido") : "Bronze") as FormularioEmpresa["tierMinimoRequerido"],
      limiteCotizacionesDiarias:typeof company.limite_cotizaciones_diarias==="number"?String(company.limite_cotizaciones_diarias):"",
      pedidoMinimo:typeof company.pedido_minimo==="number"?String(company.pedido_minimo):"",
      pedidoMinimoUnidad:company.pedido_minimo_unidad==="m3"?"m3":"unidades",
    });
    cambiosSinGuardarRef.current=false;
    setRevision(0);
    setEstadoGuardado("sin-cambios");
  },[company]);

  /** Aplica un cambio del usuario y programa el autoguardado. */
  const editar=useCallback((cambios:Partial<FormularioEmpresa>)=>{
    setForm(p=>({...p,...cambios}));
    cambiosSinGuardarRef.current=true;
    setEstadoGuardado("pendiente");
    setRevision(r=>r+1);
  },[]);

  function f(k:keyof FormularioEmpresa,v:string){editar({[k]:v} as Partial<FormularioEmpresa>);}

  /** Alterna un valor dentro de una lista de etiquetas (categorías, países...). */
  function alternar(clave:"categories"|"countries"|"certs",valor:string){
    const actual=form[clave];
    editar({[clave]:actual.includes(valor)?actual.filter(x=>x!==valor):[...actual,valor]} as Partial<FormularioEmpresa>);
  }

  const persistir=useCallback(async()=>{
    if(guardadoEnCursoRef.current){
      // Hay un envío en vuelo: se reintenta en el siguiente ciclo del retardo,
      // en vez de solapar dos PUT sobre la misma empresa.
      setRevision(r=>r+1);
      return;
    }

    const actual=formRef.current;
    guardadoEnCursoRef.current=true;
    cambiosSinGuardarRef.current=false;
    setEstadoGuardado("guardando");
    setSaveError("");
    try{
      await onSave({
        nombre_empresa:actual.razonSocial,
        // Se manda siempre, también vacío: con `|| undefined` no había manera de
        // quitar un logo ya puesto, porque el backend no veía el campo.
        logo_url:actual.logoUrl.trim(),
        especialidad_producto:actual.categories,
        paises_origen:actual.countries,
        shipping_mark_prefijo:actual.shippingMarkPrefijo.trim(),
        tiempo_respuesta_promedio:actual.avgResponse,
        perfil_publico: {
          description: actual.description.trim(),
          year: actual.year.trim(),
          website: actual.website.trim(),
          email: actual.email.trim(),
          phone: actual.phone.trim(),
          address: actual.address.trim(),
          industries: actual.industries,
          certs: actual.certs,
          banner: actual.banner.trim(),
          tier_minimo_requerido: actual.tierMinimoRequerido,
        },
        solo_cotizaciones_directas:actual.soloCotizacionesDirectas,
        limite_cotizaciones_diarias:leerLimiteDiario(actual.limiteCotizacionesDiarias),
        pedido_minimo:leerPedidoMinimo(actual.pedidoMinimo),
        pedido_minimo_unidad:actual.pedidoMinimoUnidad,
      });
      setEstadoGuardado(prev=>prev==="guardando"?"guardado":prev);
      void cargarCupo();
    }catch(err){
      // Lo escrito sigue en pantalla y vuelve a marcarse como pendiente: el
      // siguiente intento (automático o manual) lo reenvía entero.
      cambiosSinGuardarRef.current=true;
      setEstadoGuardado("pendiente");
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar el perfil de empresa.");
    }finally{
      guardadoEnCursoRef.current=false;
    }
  },[onSave,cargarCupo]);

  // El envío se invoca siempre por referencia. `onSave` se redefine en cada
  // render de la aplicación, así que depender de `persistir` en el efecto
  // reiniciaba el temporizador con cada repintado ajeno (sondeos, chat...) y el
  // autoguardado podía no llegar a dispararse nunca.
  const persistirRef=useRef(persistir);
  useEffect(()=>{persistirRef.current=persistir;},[persistir]);

  // Autoguardado: cada edición reinicia el reloj, así que solo se envía cuando
  // el usuario deja de escribir.
  useEffect(()=>{
    if(revision===0)return;
    const temporizador=window.setTimeout(()=>{void persistirRef.current();},RETARDO_AUTOGUARDADO_MS);
    return ()=>window.clearTimeout(temporizador);
  },[revision]);

  // Si se sale de la pantalla dentro de la ventana del retardo, lo último
  // escrito se envía igualmente en lugar de perderse.
  useEffect(()=>()=>{
    if(cambiosSinGuardarRef.current){
      void persistirRef.current();
    }
  },[]);

  /**
   * Sube una imagen del perfil (logo o banner) a gestión documental y devuelve
   * su ruta canónica.
   *
   * La imagen tiene que vivir en la plataforma (no una URL pegada a mano) para
   * que el backend la reconozca como imagen pública de la empresa y la sirva
   * sin sesión al solicitante que abre la ficha.
   */
  async function subirImagenDePerfil(archivo:File):Promise<string>{
    const extension=(archivo.name.split(".").pop()||"").toLowerCase();
    if(!BANNER_EXTENSIONS.includes(extension)){
      throw new Error(`Formato no soportado (.${extension}). Usa ${BANNER_FORMATS_LABEL}.`);
    }
    if(archivo.size>BANNER_MAX_BYTES){
      throw new Error("La imagen supera 5 MB. Comprímela antes de subirla.");
    }
    const subido=await businessService.uploadDocumentFile(archivo,null,"perfil-empresa");
    return toApiPath(subido.storage_url||`/documentos/archivos/${subido.id}/descargar`);
  }

  async function handleUploadBanner(archivo:File){
    setBannerError("");
    setBannerUploading(true);
    try{
      const ruta=await subirImagenDePerfil(archivo);
      fijarPreviaLocal("banner",archivo);
      editar({banner:ruta});
    }catch(err){
      setBannerError(err instanceof Error&&err.message.trim()?err.message:"No se pudo subir la imagen del banner.");
    }finally{
      setBannerUploading(false);
    }
  }

  async function handleUploadLogo(archivo:File){
    setLogoUploadError("");
    setLogoUploading(true);
    try{
      const ruta=await subirImagenDePerfil(archivo);
      fijarPreviaLocal("logo",archivo);
      editar({logoUrl:ruta});
    }catch(err){
      setLogoUploadError(err instanceof Error&&err.message.trim()?err.message:"No se pudo subir el logo.");
    }finally{
      setLogoUploading(false);
    }
  }

  const guardando=estadoGuardado==="guardando";
  const logoPreview=previaLocal.logo||(form.logoUrl?resolveApiUrl(form.logoUrl):"");
  const bannerPreview=previaLocal.banner||(form.banner?resolveApiUrl(form.banner):"");

  if(!company){
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar {...sb} active="imp-profile"/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader user={USER_IMPORTADORA} sb={sb}/>
          <main className="flex-1 overflow-y-auto px-6 py-6">
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("imp-dashboard")},{label:"Mi empresa"}]}/>
            <Card padding="lg" className="border-dashed mt-4 max-w-xl"><div className="text-center py-8"><p className="font-semibold">No hay datos de empresa disponibles</p><p className="text-sm text-muted-foreground mt-1">Verifica que tu usuario tenga importador asociado en /usuarios/me.</p></div></Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="imp-profile"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_IMPORTADORA} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("imp-dashboard")},{label:"Mi empresa"}]}/>
              <h1 className="text-xl font-semibold mt-3">Perfil de la empresa</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Esta información es visible para los compradores.</p>
            </div>
            <div className="flex items-center gap-3">
              {/* El formulario se guarda solo; el indicador es lo que le dice al
                  usuario que no tiene que pulsar nada para no perder lo escrito. */}
              <IndicadorAutoguardado estado={estadoGuardado}/>
              <Button variant="primary" loading={guardando} icon={<Save className="w-4 h-4"/>} onClick={()=>{void persistir();}}>Guardar ahora</Button>
            </div>
          </div>
          {saveError&&<Card padding="sm" className="border-destructive/30 bg-red-50"><p className="text-xs text-destructive">{saveError}</p></Card>}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <Card padding="md">
                <p className="font-semibold text-sm mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary dark:text-accent"/>Información general</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Razón social */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Razón social</label>
                    <input
                      type="text"
                      value={form.razonSocial}
                      onChange={e => f("razonSocial", e.target.value)}
                      className="w-full h-10 border rounded-lg text-sm px-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/20"
                    />
                  </div>

                  {/* Año de fundación */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Año de fundación</label>
                    <input
                      type="number"
                      value={form.year}
                      onChange={e => f("year", e.target.value)}
                      className="w-full h-10 border rounded-lg text-sm px-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/20"
                    />
                  </div>

                  {/* Sitio web */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Sitio web</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-muted-foreground"><Globe className="w-4 h-4"/></span>
                      <input
                        type="text"
                        value={form.website}
                        onChange={e => f("website", e.target.value)}
                        className="w-full h-10 border rounded-lg text-sm pl-9 pr-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/20"
                      />
                    </div>
                  </div>

                  {/* URL de logo/foto */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">URL de logo/foto</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-muted-foreground"><ImageIcon className="w-4 h-4"/></span>
                      <input
                        type="text"
                        value={form.logoUrl}
                        onChange={e => { fijarPreviaLocal("logo", null); f("logoUrl", e.target.value); }}
                        className="w-full h-10 border rounded-lg text-sm pl-9 pr-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/20"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Súbelo desde aquí o pega la URL de tu logo.</p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" size="sm" loading={logoUploading} icon={<Upload className="w-3.5 h-3.5"/>} onClick={()=>logoInputRef.current?.click()}>{form.logoUrl?"Reemplazar logo":"Subir logo"}</Button>
                      {form.logoUrl&&<Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5"/>} onClick={()=>{fijarPreviaLocal("logo",null);editar({logoUrl:""});}}>Quitar</Button>}
                    </div>
                    {logoUploadError&&<p className="text-xs text-destructive mt-2">{logoUploadError}</p>}
                  </div>

                  {/* Correo de contacto */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Correo de contacto</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-muted-foreground"><MailIcon className="w-4 h-4"/></span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => f("email", e.target.value)}
                        className="w-full h-10 border rounded-lg text-sm pl-9 pr-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/20"
                      />
                    </div>
                  </div>

                  {/* Teléfono */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Teléfono</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-muted-foreground"><Phone className="w-4 h-4"/></span>
                      <input
                        type="text"
                        value={form.phone}
                        onChange={e => f("phone", e.target.value)}
                        className="w-full h-10 border rounded-lg text-sm pl-9 pr-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/20"
                      />
                    </div>
                  </div>

                  {/* Dirección */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Dirección</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-muted-foreground"><MapPin className="w-4 h-4"/></span>
                      <input
                        type="text"
                        value={form.address}
                        onChange={e => f("address", e.target.value)}
                        className="w-full h-10 border rounded-lg text-sm pl-9 pr-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/20"
                      />
                    </div>
                  </div>

                  {/* Pedido mínimo */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="pedido-minimo" className="text-sm font-medium text-foreground">Pedido mínimo</label>
                    <div className="flex gap-2">
                      <input 
                        id="pedido-minimo" 
                        inputMode="decimal" 
                        placeholder="Sin mínimo" 
                        value={form.pedidoMinimo} 
                        onChange={e => f("pedidoMinimo", e.target.value)} 
                        className="w-full h-10 border rounded-lg text-sm px-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/20"
                      />
                      <select 
                        aria-label="Unidad del pedido mínimo" 
                        value={form.pedidoMinimoUnidad} 
                        onChange={e => editar({pedidoMinimoUnidad: e.target.value === "m3" ? "m3" : "unidades"})} 
                        className="h-10 rounded-lg border border-border bg-white px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent [&>option]:bg-white [&>option]:text-black dark:[&>option]:bg-card dark:[&>option]:text-white"
                      >
                        <option value="unidades">Unidades</option>
                        <option value="m3">m³</option>
                      </select>
                    </div>
                    <p className="text-xs text-muted-foreground">Zarpi lo usa para asignarte solicitudes que encajen contigo</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Descripción</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={e => f("description", e.target.value)}
                    className="w-full border rounded-lg text-sm p-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/25 resize-y"
                  />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input id="solo-cotizaciones-directas" type="checkbox" checked={form.soloCotizacionesDirectas} onChange={e=>editar({soloCotizacionesDirectas:e.target.checked})} className="h-4 w-4 rounded border-border"/>
                  <label htmlFor="solo-cotizaciones-directas" className="text-sm text-foreground">Solo cotizaciones dirigidas</label>
                </div>
              </Card>
              <Card padding="md">
                <p className="font-semibold text-sm mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-primary dark:text-accent"/>Información comercial</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Tiempo promedio de respuesta</label>
                    <select
                      value={form.avgResponse}
                      onChange={e => f("avgResponse", e.target.value)}
                      className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent [&>option]:bg-white [&>option]:text-black dark:[&>option]:bg-card dark:[&>option]:text-white"
                    >
                      {["~12h","~24h","~36h","~48h","~72h"].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Tier mínimo requerido para cotizar</label>
                    <select
                      value={form.tierMinimoRequerido}
                      onChange={e => f("tierMinimoRequerido", e.target.value)}
                      className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent [&>option]:bg-white [&>option]:text-black dark:[&>option]:bg-card dark:[&>option]:text-white"
                    >
                      {["Bronze", "Silver", "Gold", "Élite"].map((tier) => (
                        <option key={tier} value={tier}>{tier}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Categorías</p>
                    <div className="flex flex-wrap gap-1.5">{CATEGORIAS_PRODUCTO.map(c=><button key={c} onClick={()=>alternar("categories",c)} className={clsx("px-2 py-1 text-xs rounded-md border transition-colors",form.categories.includes(c)?"bg-primary text-white border-primary":"border-border hover:border-primary/40 hover:bg-primary/20")}>{c}</button>)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Países atendidos</p>
                    <div className="flex flex-wrap gap-1.5">{COUNTRIES.slice(0,8).map(c=><button key={c} onClick={()=>alternar("countries",c)} className={clsx("px-2 py-1 text-xs rounded-md border transition-colors",form.countries.includes(c)?"bg-primary text-white border-primary":"border-border hover:border-primary/40")}>{c}</button>)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Certificaciones</p>
                    <div className="flex flex-wrap gap-1.5">{["ISO 9001","CE","FDA","HACCP","OEKO-TEX","ISO 14001","DIN","JIS"].map(c=><button key={c} onClick={()=>alternar("certs",c)} className={clsx("px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1",form.certs.includes(c)?"bg-emerald-600 text-white border-emerald-600":"border-border hover:border-emerald-300")}><Shield className="w-2.5 h-2.5"/>{c}</button>)}</div>
                  </div>
                </div>
              </Card>
              <Card padding="md">
                {/* Cupo diario: tarjeta propia con interruptor. Como campo suelto
                    dentro de "Información comercial" pasaba desapercibido. */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-primary dark:text-accent"/>Límite de cotizaciones por día</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cuántas cotizaciones (dirigidas y abiertas) quiere recibir tu equipo cada día. Al llegar al tope,
                      los clientes no pueden enviarte más dirigidas y las abiertas se reparten a otras empresas hasta la medianoche.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.limiteCotizacionesDiarias.trim()!==""}
                    aria-label="Limitar cotizaciones por día"
                    onClick={()=>editar({limiteCotizacionesDiarias:form.limiteCotizacionesDiarias.trim()?"":String(cupo?.limite_cotizaciones_diarias||20)})}
                    className={clsx("relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors",form.limiteCotizacionesDiarias.trim()?"bg-primary dark:bg-accent":"bg-muted-foreground/30")}
                  >
                    <span className={clsx("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",form.limiteCotizacionesDiarias.trim()?"translate-x-5":"translate-x-0.5")}/>
                  </button>
                </div>
                {form.limiteCotizacionesDiarias.trim()!==""?(
                  <div className="mt-4 grid sm:grid-cols-2 gap-4 items-start">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">Máximo por día</label>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={form.limiteCotizacionesDiarias}
                        onChange={e => f("limiteCotizacionesDiarias", e.target.value)}
                        className="w-full h-10 border rounded-lg text-sm px-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/20"
                      />
                      {leerLimiteDiario(form.limiteCotizacionesDiarias) === undefined && (
                        <p className="text-xs text-destructive">Escribe un número entero entre 1 y 10000.</p>
                      )}
                    </div>

                    {cupo && cupo.limite_cotizaciones_diarias != null ? (
                      <div>
                        <p className="text-sm font-medium mb-1.5 text-foreground">Uso de hoy</p>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={clsx("h-full transition-all", cupo.cupo_agotado ? "bg-destructive" : "bg-primary dark:bg-accent")}
                            style={{ width: `${Math.min(100, Math.round((cupo.recibidas_hoy / Math.max(1, cupo.limite_cotizaciones_diarias)) * 100))}%` }}
                          />
                        </div>
                        <p className={clsx("text-xs mt-1.5", cupo.cupo_agotado ? "text-destructive font-medium" : "text-muted-foreground")}>
                          {cupo.recibidas_hoy} de {cupo.limite_cotizaciones_diarias} recibidas hoy.
                          {cupo.cupo_agotado ? " Cupo agotado: no recibirás más hasta mañana." : ` Te quedan ${cupo.disponibles_hoy}.`}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground sm:mt-7">El uso de hoy aparece en cuanto se guarde el límite.</p>
                    )}
                  </div>
                ):(
                  <p className="mt-3 text-xs text-muted-foreground">
                    Sin límite{cupo?`: hoy llevas ${cupo.recibidas_hoy} cotización(es) recibida(s).`:"."}
                  </p>
                )}
              </Card>
              <Card padding="md">
                <p className="font-semibold text-sm mb-1 flex items-center gap-2"><Package className="w-4 h-4 text-primary dark:text-accent"/>Shipping mark</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Prefijo con el que se rotula la carga de tu empresa. Cada cliente añade su propio sufijo
                  al pedir la cotización, y así se distinguen sus cajas dentro del contenedor.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 items-start">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Prefijo de la empresa</label>
                    <input
                      type="text"
                      placeholder="ctl"
                      maxLength={LONGITUD_MAX_PREFIJO_SHIPPING_MARK}
                      value={form.shippingMarkPrefijo}
                      onChange={e => f("shippingMarkPrefijo", e.target.value)}
                      className="w-full h-10 border rounded-lg text-sm px-3 bg-white border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent/20"
                    />
                    <p className="text-xs text-muted-foreground">Solo letras y números; se guarda en minúsculas.</p>
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-medium mb-1.5">Así quedará</p>
                    <p className="font-mono text-sm px-3 py-2 rounded-lg border border-border bg-muted/40 truncate">
                      {componerShippingMark(form.shippingMarkPrefijo,"prendas control")||"—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Ejemplo con un cliente llamado «Prendas Control».</p>
                  </div>
                </div>
              </Card>
              <Card padding="md">
                <p className="font-semibold text-sm mb-1 flex items-center gap-2"><Film className="w-4 h-4 text-primary dark:text-accent"/>Presentación de la empresa</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Un video corto de tu taller y algunas fotos de producto. Es lo primero que mira un cliente
                  al abrir tu ficha; nuestro equipo lo revisa antes de publicarlo.
                </p>
                <EditorPresentacion/>
              </Card>
              <Card padding="md">
                <p className="font-semibold text-sm mb-1 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary dark:text-accent"/>Banner de portada</p>
                <p className="text-xs text-muted-foreground mb-4">Imagen ancha que encabeza tu perfil público. Se recomienda 1600×400 px.</p>

                <input
                  ref={bannerInputRef}
                  type="file"
                  accept={BANNER_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={e=>{
                    const archivo=e.target.files?.[0];
                    e.target.value="";
                    if(archivo)void handleUploadBanner(archivo);
                  }}
                />

                {form.banner?(
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden border border-border bg-muted/40">
                      <img src={bannerPreview} alt="Banner de la empresa" className="w-full h-32 object-cover"/>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" loading={bannerUploading} icon={<Upload className="w-3.5 h-3.5"/>} onClick={()=>bannerInputRef.current?.click()}>Reemplazar</Button>
                      <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5"/>} onClick={()=>{fijarPreviaLocal("banner",null);editar({banner:""});}}>Quitar</Button>
                    </div>
                  </div>
                ):(
                  <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-2 text-center">
                    <Upload className="w-8 h-8 text-muted-foreground/40"/>
                    <p className="text-sm text-muted-foreground">Sube la imagen de portada de tu empresa</p>
                    <p className="text-xs text-muted-foreground/60">PNG, JPG o WebP hasta 5 MB</p>
                    <Button variant="secondary" size="sm" loading={bannerUploading} onClick={()=>bannerInputRef.current?.click()}>Seleccionar imagen</Button>
                  </div>
                )}

                {bannerError&&<p className="text-xs text-destructive mt-3">{bannerError}</p>}
              </Card>
            </div>
            <div>
              <Card padding="md">
                <p className="font-semibold text-sm mb-4">Vista previa del logo</p>
                {/* Input oculto compartido por los dos botones de "subir logo". */}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={BANNER_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={e=>{
                    const archivo=e.target.files?.[0];
                    e.target.value="";
                    if(archivo)void handleUploadLogo(archivo);
                  }}
                />
                <div className="flex flex-col items-center gap-3">
                  {/* Antes esta vista previa pintaba siempre las iniciales, así
                      que tras subir el logo no cambiaba nada en pantalla y la
                      subida parecía no haber funcionado. */}
                  {logoPreview?(
                    <img src={logoPreview} alt="Logo de la empresa" className="w-32 h-32 rounded-2xl border border-border bg-white object-contain p-2"/>
                  ):(
                    <div className={clsx("w-32 h-32 rounded-2xl flex items-center justify-center text-white text-3xl font-bold",importerColorFromId(company.id))}>{initialsFromName(company.nombre_empresa)}</div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" loading={logoUploading} icon={<Upload className="w-3.5 h-3.5"/>} onClick={()=>logoInputRef.current?.click()}>{form.logoUrl?"Cambiar logo":"Subir logo"}</Button>
                    {form.logoUrl&&<Button variant="ghost" size="sm" onClick={()=>{void abrirArchivoEnPestana(form.logoUrl);}}>Ver</Button>}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">PNG, JPG o WebP hasta 5 MB. Se recomienda un cuadrado de 512×512 px.</p>
                </div>
                <div className="mt-5 pt-5 border-t border-border space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Certificaciones</span><span className="font-semibold flex items-center gap-1 text-emerald-700"><Shield className="w-3 h-3"/>{form.certs.length}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Proyectos completados</span><span className="font-semibold">{company.proyectos_completados ?? 0}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Miembro desde</span><span className="font-semibold">{formatShortDate(company.fecha_registro)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Verificada</span><span className="font-semibold flex items-center gap-1 text-emerald-600"><BadgeCheck className="w-3 h-3"/>{company.verificado?"Sí":"No"}</span></div>
                </div>
              </Card>
            </div>
          </div>
          {/* Lo que cada propuesta trae listo: bodega, entrega, tiempos, pago,
              cancelación (features/propuestas). No se autoguarda como el perfil:
              tiene su propio botón. */}
          <section id="condiciones-propuesta" className="scroll-mt-6 border-t border-border pt-6">
            <CondicionesEmpresa puedeEditar/>
          </section>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER PORTAL — ADVISORS
// ─────────────────────────────────────────────────────────────────────────────

