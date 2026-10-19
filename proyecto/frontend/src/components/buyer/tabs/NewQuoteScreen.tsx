import { useState, useEffect, useRef, useCallback } from "react";
import { Lock, UserRound, Building2, Info, AlertCircle, CheckCircle2, ChevronRight, Search, ChevronDown, Globe, Check, Clock, X, Upload, ChevronLeft, Send, Users, MapPin, Tag, Layers, Building, RotateCcw, BadgeCheck, ClipboardList, Package, Shield, WalletCards, Sparkles, LibraryBig } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Breadcrumb } from "@/app/components/navigation/Breadcrumb";

import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";

import { LISTA_CERRADA } from "@/features/planes/SeccionPlanes";

import { Avatar, Button, Card, ContactBtn, Input, Select, Textarea } from "@/app/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { toApiPath } from "@/services/api-client";

import { abrirArchivoEnPestana } from "@/lib/abrir-archivo";

import { componerShippingMark, LONGITUD_MAX_SUFIJO_SHIPPING_MARK } from "@/lib/shipping-mark";

import type { SidebarCtrl } from "@/types/portal";
import type { Importer } from "@/types/importer";
import type { BackendArchivoItem, CreateCotizacionPayload } from "@/services/business.service";

import { Sidebar, AppHeader, USER } from "@/app/App";
import { cantidadConUnidad } from "@/utils/formatos";

const STEPS = ["Modalidad", "Información del producto", "Confirmación"];
const COUNTRIES = ["China", "Estados Unidos", "Alemania", "Japón", "India", "Italia", "Francia", "España", "Brasil", "Corea del Sur", "Turquía", "México", "Colombia"];
const LINES = ["Hogar", "Tecnología", "Moda", "Belleza", "Industria", "Alimentos", "Juguetes", "Deportes", "Otros"];
const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

export function Stepper({current}:{current:number}) {
  return (
    <div className="flex items-center">{STEPS.map((label,i)=>{
      const step=i+1;const done=step<current;const active=step===current;
      return (<div key={step} className="flex items-center flex-1 last:flex-none">
        <div className="flex flex-col items-center gap-1.5">
          <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",done?"bg-primary dark:bg-accent text-white dark:text-black":active?"bg-primary dark:bg-accent text-white dark:text-black ring-4 ring-primary/20 dark:ring-accent/20":"bg-muted text-muted-foreground border border-border")}>{done?<Check className="w-4 h-4"/>:step}</div>
          <span className={clsx("text-xs font-medium whitespace-nowrap hidden sm:block",active?"text-primary dark:text-accent":done?"text-foreground":"text-muted-foreground")}>{label}</span>
        </div>
        {i<STEPS.length-1&&<div className={clsx("flex-1 h-0.5 mx-2 mb-4 transition-all duration-300",step<current?"bg-primary dark:bg-accent":"bg-border")}/>}
      </div>);
    })}</div>
  );
}

export interface QuoteFormState {productName:string;description:string;referenceLink:string;productPhotoUrls:string[];country:string;productLine:string;quality:string;customization:string;purpose:"ecommerce"|"corporativo";minQuantity:string;unit:"unidades"|"m3";targetPrice:string;targetPriceCurrency:string;incoterm:string;notes:string;shippingMarkSufijo:string;deliveryCity:string;}
/** Igual que `MAX_FOTOS_PRODUCTO` en backend/schemas/cotizacion.py. */
const MAX_FOTOS_PRODUCTO=10;
const EMPTY_FORM:QuoteFormState={productName:"",description:"",referenceLink:"",productPhotoUrls:[],country:"",productLine:"",quality:"",customization:"",purpose:"ecommerce",minQuantity:"",unit:"unidades",targetPrice:"",targetPriceCurrency:"USD",incoterm:"DDP",notes:"",shippingMarkSufijo:"",deliveryCity:""};
const PRICE_CURRENCIES=["USD","EUR","COP","MXN","CLP","PEN","GBP"];
const TIER_ORDER:Record<string,number>={Bronze:0,Silver:1,Gold:2,"Élite":3};
const POSITIVE_DECIMAL_INPUT = /^\d*\.?\d*$/;
function normalizeTargetPriceInput(value: string): string {
  const normalized = value.replace(",", ".");
  return POSITIVE_DECIMAL_INPUT.test(normalized) ? normalized : "";
}
function parseTargetPriceCurrency(value:string|undefined|null):string { const clean=(value||"").trim().toUpperCase(); if(!clean) return "USD"; return PRICE_CURRENCIES.includes(clean)?clean:"USD"; }

function Step1({modalidad,setModalidad,selectedId,setSelectedId,preselectedId,importers,permiteAbierta=true}:{modalidad:"dirigida"|"abierta"|null;setModalidad:(m:"dirigida"|"abierta")=>void;selectedId:string|null;setSelectedId:(id:string|null)=>void;preselectedId?:string;importers:Importer[];permiteAbierta?:boolean}) {
  const [cs,setCs]=useState("");const[cc,setCc]=useState("");const[ccat,setCcat]=useState("");const[cr,setCr]=useState("");
  const fi=importers.filter(imp=>{const ms=!cs||imp.name.toLowerCase().includes(cs.toLowerCase());
    const mc=!cc||imp.country===cc;
    const mcat=!ccat||imp.categories.some(c=>c.toLowerCase().includes(ccat.toLowerCase()));
    const mr=!cr||(imp.certs??[]).length>0;return ms&&mc&&mcat&&mr;
  });
  const hasF=cs||cc||ccat||cr;

  return (
    <div className="space-y-6">
      {/* SELECCIÓN DE MODALIDAD (la abierta se apaga en Admin › Módulos) */}
      {!permiteAbierta && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Por ahora las cotizaciones se envían a una empresa importadora que elijas. Las abiertas no están disponibles.
        </p>
      )}
      <div className={clsx("grid grid-cols-1 gap-4", permiteAbierta && "sm:grid-cols-2")}>
        {[
          {
            m: "dirigida" as const,
            icon: Building2,
            title: "Cotización dirigida",
            desc: "Elige una empresa importadora específica para enviar directamente tu solicitud.",
          },
          {
            m: "abierta" as const,
            icon: Globe,
            title: "Cotización abierta",
            desc: "La solicitud se distribuirá automáticamente entre importadores compatibles.",
          },
        ].filter(({ m }) => permiteAbierta || m !== "abierta").map(({ m, icon: Icon, title, desc }) => {
          const seleccionada = modalidad === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                setModalidad(m);
                if (m === "abierta") setSelectedId(null);
              }}
              className={clsx(
                "p-4 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-md",
                seleccionada
                  ? "border-primary dark:border-accent bg-primary/5 dark:bg-accent/10 shadow-md text-foreground"
                  : "border-border bg-card hover:border-primary/40 dark:hover:border-accent/50 text-foreground"
              )}
            >
              <div
                className={clsx(
                  "w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 transition-colors",
                  seleccionada
                    ? "bg-primary dark:bg-accent"
                    : "bg-muted group-hover:bg-primary/10 dark:group-hover:bg-accent/10"
                )}
              >
                <Icon
                  className={clsx(
                    "w-5 h-5 transition-colors",
                    seleccionada
                      ? "text-primary-foreground dark:text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                />
              </div>

              <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>

              {seleccionada && (
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary dark:text-accent">
                  <Check className="w-3.5 h-3.5" />
                  Seleccionada
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* SECCIÓN DE IMPORTADORAS */}
      {modalidad === "dirigida" && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-foreground">Selecciona una importadora</h3>

          {/* FILTROS Y BÚSQUEDA */}
          <Card padding="sm" className="mb-4 bg-card border-border">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[140px]">
                <Input
                  placeholder="Buscar empresa..."
                  value={cs}
                  onChange={(e) => setCs(e.target.value)}
                  prefix={<Search className="w-4 h-4 text-muted-foreground" />}
                  className="focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:border-accent dark:focus-within:ring-accent/20"
                />
              </div>
              <div className="w-32">
                <Select
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20"
                >
                  <option value="">País</option>
                  {[...new Set(importers.map((i) => i.country))].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div className="w-36">
                <Select
                  value={ccat}
                  onChange={(e) => setCcat(e.target.value)}
                  className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20"
                >
                  <option value="">Categoría</option>
                  {[...new Set(importers.flatMap((i) => i.categories))].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div className="w-44">
                <Select
                  value={cr}
                  onChange={(e) => setCr(e.target.value)}
                  className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20"
                >
                  <option value="">Certificación</option>
                  <option value="certificadas">Con certificaciones</option>
                </Select>
              </div>
              {hasF && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setCs("");
                    setCc("");
                    setCcat("");
                    setCr("");
                  }}
                  className="hover:text-primary dark:hover:text-accent"
                >
                  Limpiar
                </Button>
              )}
            </div>
          </Card>

          {/* TARJETAS DE IMPORTADORAS */}
          {fi.length === 0 ? (
            <Card padding="lg" className="border-dashed border-border bg-card">
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No se encontraron empresas</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {fi.map((imp) => {
                const sel = selectedId === imp.id;
                return (
                  <div
                    key={imp.id}
                    onClick={() => setSelectedId(sel ? null : imp.id)}
                    className={clsx(
                      "relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 bg-card text-card-foreground",
                      sel
                        ? "border-primary dark:border-accent shadow-lg"
                        : "border-border hover:border-primary/40 dark:hover:border-accent/50 hover:shadow-md"
                    )}
                  >
                    {/* Checkbox badge de selección */}
                    {sel && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary dark:bg-accent flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground dark:text-accent-foreground" />
                      </div>
                    )}

                    {/* Info de la empresa */}
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar initials={imp.initials} size="lg" color={imp.color} />
                      <div className="min-w-0">
                        <div className="flex items-start gap-1">
                          <p className="font-semibold text-sm leading-tight text-foreground">{imp.name}</p>
                          {imp.verified && (
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{imp.specialty}</p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{imp.country}</p>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="flex items-center justify-between text-xs mb-3">
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        {(imp.certs || []).length > 0 && (
                          <>
                            <Shield className="w-3 h-3" />
                            <span className="font-medium">{(imp.certs || []).length} cert.</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{imp.responseTime}</span>
                      </div>
                    </div>

                    {/* Botón de Selección */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(sel ? null : imp.id);
                      }}
                      className={clsx(
                        "w-full h-8 rounded-lg text-xs font-medium transition-all",
                        sel
                          ? "bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground"
                          : "bg-muted text-foreground hover:bg-primary/10 dark:hover:bg-accent/10"
                      )}
                    >
                      {sel ? "Seleccionada" : "Seleccionar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RightPanel({
  step,
  modalidad,
  si,
  form,
}: {
  step: number;
  modalidad: "dirigida" | "abierta" | null;
  si: Importer | null;
  form: QuoteFormState;
}) {
  const Summary = () => (
    <Card padding="md" className="bg-card border-border text-card-foreground">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Resumen
      </h3>
      <div className="space-y-2">
        {[
          ["Producto", form.productName],
          ["País", form.country],
          ["Calidad", form.quality],
          [
            "Cantidad",
            form.minQuantity
              ? cantidadConUnidad(form.minQuantity, form.unit)
              : "",
          ],
          ["Incoterm", form.incoterm],
          ["Ciudad de entrega", form.deliveryCity],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between items-start gap-2">
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {k}
            </span>
            <span className="text-xs font-medium text-right text-foreground">
              {v || <span className="italic text-muted-foreground/50">—</span>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );

  if (modalidad === "dirigida" && si)
    return (
      <div className="space-y-4">
        {/* Empresa seleccionada */}
        <Card padding="md" className="bg-card border-border text-card-foreground">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Empresa seleccionada
          </h3>
          <div className="flex items-start gap-3 mb-3">
            <Avatar initials={si.initials} size="xl" color={si.color} />
            <div>
              <p className="font-semibold text-sm text-foreground">{si.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {si.specialty}
              </p>
            </div>
          </div>
          <div className="space-y-1.5 pt-3 border-t border-border">
            {[
              ["Miembro desde", si.memberSince],
              ["Proyectos", si.projects.toString()],
              ["Respuesta", si.responseTime],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-xs text-muted-foreground">{k}</span>
                <span className="text-xs font-medium text-foreground">{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Asesor */}
        <Card padding="md" className="bg-card border-border text-card-foreground">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Asesor
          </h3>
          <div className="flex items-start gap-2.5 mb-3">
            <Avatar
              initials={si.advisor.initials}
              size="lg"
              color={si.advisor.color}
            />
            <div>
              <p className="font-semibold text-sm text-foreground">
                {si.advisor.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {si.advisor.role}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ContactBtn
              type="chat"
              size="sm"
              className="flex-1 justify-center"
              onClick={() =>
                toast.info("El chat se habilita al enviar la cotización.")
              }
            />
          </div>
        </Card>

        {step >= 2 && <Summary />}

        {step === 3 && (
          <Card
            padding="md"
            className="border-primary/20 bg-primary/5 dark:border-accent/30 dark:bg-accent/10"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary dark:bg-accent animate-pulse" />
              <span className="text-xs font-semibold text-primary dark:text-accent">
                Lista para enviar
              </span>
            </div>
          </Card>
        )}
      </div>
    );

  if (modalidad === "abierta") {
    if (step === 1)
      return (
        <Card padding="md" className="bg-card border-border text-card-foreground">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-accent/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary dark:text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              ¿Cómo funciona?
            </h3>
          </div>
          <div className="space-y-3">
            {[
              {
                i: Send,
                t: "Tu solicitud llega a importadores activos compatibles.",
              },
              { i: Users, t: "Múltiples empresas enviarán propuestas." },
              {
                i: CheckCircle2,
                t: "Compara y decide con cuál continuar.",
              },
            ].map(({ i: Icon, t }, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/10 dark:bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-3 h-3 text-primary dark:text-accent" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t}
                </p>
              </div>
            ))}
          </div>
        </Card>
      );

    return (
      <div className="space-y-4">
        <Summary />
        {step === 3 && (
          <Card padding="md" className="bg-card border-border text-card-foreground">
            <div className="space-y-2">
              {[
                ["Empresas potenciales", "23 activas"],
                ["País", form.country || "—"],
                ["Categoría", form.productLine || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-xs font-semibold text-foreground">
                    {v}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400 dark:bg-amber-400 animate-pulse" />
                <span className="text-xs font-semibold text-orange-600 dark:text-amber-400">
                  Esperando propuestas
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card padding="md" className="border-dashed border-border bg-card">
      <div className="flex flex-col items-center text-center py-4 gap-2">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <Building className="w-5 h-5 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">
          Selecciona una modalidad.
        </p>
      </div>
    </Card>
  );
}

function Step2({
  form,
  setForm,
  onProductPhotoUploaded,
  importer,
}: {
  form: QuoteFormState;
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>;
  onProductPhotoUploaded: (fileItem: BackendArchivoItem) => void | Promise<void>;
  importer: Importer | null;
}) {
  const upd = (f: keyof QuoteFormState, v: string) =>
    setForm((p) => ({ ...p, [f]: v }));
  const fotos = form.productPhotoUrls;
  const quitarFoto = (url: string) =>
    setForm((p) => ({
      ...p,
      productPhotoUrls: p.productPhotoUrls.filter((f) => f !== url),
    }));

  return (
    <div className="space-y-5">
      {/* INFORMACIÓN DEL PRODUCTO */}
      <Card padding="md" className="bg-card border-border text-card-foreground">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary dark:text-accent" />
          Información del producto
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1.5 text-foreground">
              Fotos{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (opcional, hasta {MAX_FOTOS_PRODUCTO})
              </span>
            </p>
            <div
              className={clsx(
                "border-2 border-dashed rounded-xl p-5 transition-all bg-card",
                fotos.length
                  ? "border-border"
                  : "border-border hover:border-primary/40 dark:hover:border-accent/50 hover:bg-muted/30"
              )}
            >
              {fotos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {fotos.map((url, i) => (
                    <div
                      key={url}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          void abrirArchivoEnPestana(url);
                        }}
                        className="block w-full h-full"
                        title="Ver foto"
                      >
                        <ImagenArchivo
                          src={url}
                          alt={`Foto ${i + 1} del producto`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      {i === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Portada
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => quitarFoto(url)}
                        aria-label={`Quitar foto ${i + 1}`}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3">
                  <Upload className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Sube fotos reales del producto: el producto, la etiqueta, el
                    empaque, las medidas
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    PNG, JPG, JPEG o WebP · la primera será la portada
                  </p>
                </div>
              )}
              <div className="mt-3 flex items-center justify-center gap-3">
                <DocumentUploadButton
                  label={fotos.length ? "Agregar fotos" : "Subir fotos"}
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  origen="cotizacion"
                  multiple
                  maxArchivos={MAX_FOTOS_PRODUCTO - fotos.length}
                  disabled={fotos.length >= MAX_FOTOS_PRODUCTO}
                  onUploaded={onProductPhotoUploaded}
                  onError={(message) => toast.error(message)}
                />
                <span className="text-xs text-muted-foreground">
                  {fotos.length}/{MAX_FOTOS_PRODUCTO}
                </span>
              </div>
            </div>
          </div>
          <Input
            label="Nombre del producto"
            placeholder="Ej. Café Verde Colombiano Premium"
            value={form.productName}
            onChange={(e) => upd("productName", e.target.value)}
            className="focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:!border-accent dark:focus-within:!ring-accent/20"
          />
          <Textarea
            label="Descripción"
            placeholder="Describe el producto..."
            rows={3}
            value={form.description}
            onChange={(e) => upd("description", e.target.value)}
            className="focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:!border-accent dark:focus-within:!ring-accent/20"
          />
          <Input
            label="Link de referencia"
            placeholder="https://proveedor.com/producto"
            type="url"
            value={form.referenceLink}
            onChange={(e) => upd("referenceLink", e.target.value)}
            hint="URL del proveedor (opcional)"
            className="focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:!border-accent dark:focus-within:!ring-accent/20"
          />
        </div>
      </Card>

      {/* CLASIFICACIÓN */}
      <Card padding="md" className="bg-card border-border text-card-foreground">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary dark:text-accent" />
          Clasificación
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="País de importación"
            value={form.country}
            onChange={(e) => upd("country", e.target.value)}
            className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20 focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:border-accent dark:focus-within:ring-accent/20"
          >
            <option value="">Seleccionar</option>
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>

          <Select
            label="Línea de producto"
            value={form.productLine}
            onChange={(e) => upd("productLine", e.target.value)}
            className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20 focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:border-accent dark:focus-within:ring-accent/20"
          >
            <option value="">Seleccionar</option>
            {LINES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>

          <Select
            label="Calidad"
            value={form.quality}
            onChange={(e) => upd("quality", e.target.value)}
            className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20 focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:border-accent dark:focus-within:ring-accent/20"
          >
            <option value="">Seleccionar</option>
            {["Económica", "Estándar", "Premium", "Ultra premium"].map((q) => (
              <option key={q}>{q}</option>
            ))}
          </Select>

          <Select
            label="Personalización"
            value={form.customization}
            onChange={(e) => upd("customization", e.target.value)}
            className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20 focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:border-accent dark:focus-within:ring-accent/20"
          >
            <option value="">Seleccionar</option>
            <option>Estándar</option>
            <option>Personalización de marca</option>
            <option>Personalización de diseño completo</option>
          </Select>
        </div>
      </Card>

      {/* IMPORTACIÓN */}
      <Card padding="md" className="bg-card border-border text-card-foreground">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary dark:text-accent" />
          Importación
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2 text-foreground">Propósito</p>
            <div className="flex gap-2">
              {(["ecommerce", "corporativo"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => upd("purpose", opt)}
                  className={clsx(
                    "flex-1 h-9 rounded-lg border text-sm font-medium transition-all",
                    form.purpose === opt
                      ? "bg-primary text-primary-foreground border-primary dark:bg-accent dark:text-accent-foreground dark:border-accent shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40 dark:hover:border-accent/50"
                  )}
                >
                  {opt === "ecommerce" ? "Ecommerce" : "Corporativo"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CANTIDAD MÍNIMA CON SELECTOR DE UNIDADES */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cantidad-minima"
                className="text-sm font-medium text-foreground"
              >
                Cantidad mínima
              </label>
              <div className="relative flex items-center">
                <input
                  id="cantidad-minima"
                  type="number"
                  min={form.unit === "m3" ? 0.1 : 1}
                  step={form.unit === "m3" ? 0.1 : 1}
                  inputMode={form.unit === "m3" ? "decimal" : "numeric"}
                  placeholder={form.unit === "m3" ? "Ej. 2.5" : "Ej. 500"}
                  value={form.minQuantity}
                  onChange={(e) => {
                    const valor = e.target.value;
                    upd(
                      "minQuantity",
                      form.unit === "m3"
                        ? valor
                        : valor === ""
                        ? ""
                        : String(Math.max(1, Math.round(Number(valor))))
                    );
                  }}
                  className="w-full h-10 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-accent/20 focus:border-primary dark:focus:border-accent pl-3 pr-28 transition-colors"
                />
                <div
                  className="absolute right-1 flex rounded-md border border-border bg-muted/40 p-0.5"
                  role="radiogroup"
                  aria-label="Unidad de la cantidad"
                >
                  {(["unidades", "m3"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={form.unit === u}
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          unit: u,
                          minQuantity:
                            u === "unidades" && p.minQuantity
                              ? String(Math.max(1, Math.round(Number(p.minQuantity))))
                              : p.minQuantity,
                        }))
                      }
                      className={clsx(
                        "h-7 rounded px-2 text-xs font-medium transition-colors",
                        form.unit === u
                          ? "bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {u === "m3" ? "m³" : "Unidades"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {form.unit === "m3"
                  ? "Volumen en metros cúbicos; admite decimales"
                  : "Número de piezas o unidades"}
              </p>
            </div>

            {/* PRECIO OBJETIVO */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="precio-objetivo"
                  className="text-sm font-medium text-foreground"
                >
                  Precio objetivo
                </label>
              </div>
              <div className="relative flex items-center">
                <input
                  id="precio-objetivo"
                  type="text"
                  inputMode="decimal"
                  className="w-full h-10 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-accent/20 focus:border-primary dark:focus:border-accent pl-3 pr-20"
                  placeholder="Ej. 8.50"
                  value={form.targetPrice}
                  onChange={(e) =>
                    upd("targetPrice", normalizeTargetPriceInput(e.target.value))
                  }
                />
                <div className="absolute right-1">
                  <select
                    value={form.targetPriceCurrency}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        targetPriceCurrency: e.target.value,
                      }))
                    }
                    className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-accent/20 focus:border-primary dark:focus:border-accent appearance-none cursor-pointer pr-6"
                  >
                    {PRICE_CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <Select
              label="Incoterm"
              value={form.incoterm || "DDP"}
              onChange={(e) => upd("incoterm", e.target.value)}
              className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20 focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:border-accent dark:focus-within:ring-accent/20"
            >
              <option value="">Seleccionar</option>
              {INCOTERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 dark:border-accent/30 dark:bg-accent/10 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                Importación incluida:
              </span>{" "}
              El proveedor se encargará de la nacionalización de la mercancía antes de
              realizar la facturación electrónica correspondiente.
            </p>
          </div>
          {/* La empresa arma la entrega de su propuesta con esto: hasta dónde
              llega su precio y cuánto cuesta llevarlo. */}
          <Input
            label="Ciudad de entrega"
            placeholder="Medellín"
            maxLength={100}
            value={form.deliveryCity}
            onChange={(e) => upd("deliveryCity", e.target.value)}
            hint="Dónde quieres recibir el producto. Las empresas la usan para calcular la entrega."
            className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20 focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:border-accent dark:focus-within:ring-accent/20"
          />
          <Textarea
            label="Notas"
            placeholder="Información adicional..."
            rows={3}
            value={form.notes}
            onChange={(e) => upd("notes", e.target.value)}
            className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20 focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:border-accent dark:focus-within:ring-accent/20"
          />
        </div>
      </Card>

      {/* SHIPPING MARK */}
      <Card padding="md" className="bg-card border-border text-card-foreground">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary dark:text-accent" />
          Shipping mark
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Cómo quieres que se rotulen tus cajas dentro del contenedor de la empresa
          importadora.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <Input
            label="Tu identificador"
            placeholder="Prendas Control"
            maxLength={LONGITUD_MAX_SUFIJO_SHIPPING_MARK}
            value={form.shippingMarkSufijo}
            onChange={(e) => upd("shippingMarkSufijo", e.target.value)}
            hint="Opcional. El nombre con el que reconoces tu carga."
            className="focus:border-primary focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20 focus-within:border-primary focus-within:ring-primary/20 dark:focus-within:border-accent dark:focus-within:ring-accent/20"
          />
          <div className="pt-1">
            <p className="text-sm font-medium mb-1.5 text-foreground">
              Marca resultante
            </p>
            <p className="font-mono text-sm px-3 py-2 rounded-lg border border-border bg-muted/40 text-foreground truncate">
              {componerShippingMark(
                importer?.shippingMarkPrefix,
                form.shippingMarkSufijo
              ) || "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {importer
                ? importer.shippingMarkPrefix
                  ? `Prefijo de ${importer.name}: ${importer.shippingMarkPrefix}`
                  : `${importer.name} todavía no configuró su prefijo.`
                : "Se completará con el prefijo de la empresa que atienda tu solicitud."}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Step3Dirigida({form,importer,confirmed,setConfirmed}:{form:QuoteFormState;importer:Importer;confirmed:boolean;setConfirmed:(v:boolean)=>void}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-5 h-5 text-primary"/><h2 className="text-base font-semibold">Revisa tu solicitud</h2></div>
      {[{title:"Empresa",icon:Building2,rows:[["Importadora",importer.name],["Especialidad",importer.specialty]]},{title:"Asesor",icon:UserRound,rows:[["Nombre",importer.advisor.name],["Cargo",importer.advisor.role]]},{title:"Producto",icon:Tag,rows:[["Nombre",form.productName||"—"],["País",form.country||"—"],["Calidad",form.quality||"—"]]},{title:"Importación",icon:MapPin,rows:[["Propósito",form.purpose==="ecommerce"?"Ecommerce":"Corporativo"],["Cantidad",form.minQuantity?cantidadConUnidad(form.minQuantity,form.unit):"—"],["Precio objetivo",form.targetPrice ? `${form.targetPrice} ${form.targetPriceCurrency || "USD"}` : "—"],["Incoterm",form.incoterm || "DDP"]]}].map(({title,icon:Icon,rows})=>(
        <Card key={title} padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5"/>{title}</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">{rows.map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium mt-0.5">{v}</p></div>)}</div></Card>
      ))}
      <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"/><span className="text-sm leading-relaxed">Confirmo que la información es correcta y autorizo el envío de esta solicitud.</span></label>
    </div>
  );
}

function Step3Abierta() {
  return (
    <div className="space-y-4">
      <div><h2 className="text-base font-semibold">Solicitudes abiertas</h2><p className="text-sm text-muted-foreground mt-1">Una vez envíes, los importadores comenzarán a responder.</p></div>
      <Card padding="none"><div className="py-16 flex flex-col items-center text-center gap-3"><div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><ClipboardList className="w-6 h-6 text-muted-foreground/40"/></div><p className="font-medium text-sm">Todavía no hay propuestas</p><p className="text-xs text-muted-foreground">Aparecerán aquí cuando los importadores respondan.</p></div></Card>
      <Card padding="md" className="border-primary dark:border-accent bg-primary/50 dark:bg-accent/50"><div className="flex gap-3"><Info className="w-4 h-4 text-primary dark:text-accent flex-shrink-0 mt-0.5"/><div><p className="text-xs font-semibold text-primary dark:text-accent mb-1.5">Información importante</p>{["La cotización se convierte en operación al aceptar una propuesta.","La solicitud deja de estar disponible para los demás importadores."].map((t,i)=><div key={i} className="flex items-start gap-1.5"><span className="text-primary dark:text-accent text-xs mt-0.5">•</span><p className="text-xs text-primary dark:text-accent leading-relaxed">{t}</p></div>)}</div></div></Card>
    </div>
  );
}

/** Producto de Tendencias o de un catálogo del que sale una solicitud. */
export interface OrigenSolicitud {
  origen:"tendencias"|"catalogo";
  nombre:string;
  revisarRequisitos:boolean;
  tendenciaItemId?:string;
  /** Si la ficha la recomienda una importadora, la solicitud va solo a ella. */
  importadorId?:string;
  nombreEmpresa?:string;
  catalogoProductoId?:string;
}

export function NewQuoteScreen({onBack,sb,preselectedImporterId,importers,onSubmitQuote,creditos,cotizanteTier="Bronze",prefill,origen=null,cobroTokens=false,cotizacionesGratis=0,solicitudesPlan=0,sinPlan=false,permiteAbierta=true,onIrAPagos,onVerPlanes}:{onBack:()=>void;sb:SidebarCtrl;preselectedImporterId?:string;importers:Importer[];onSubmitQuote:(payload:CreateCotizacionPayload,desbloquear?:boolean)=>Promise<void>;creditos:number;cotizanteTier?:string;prefill?:Partial<QuoteFormState>;origen?:OrigenSolicitud|null;cobroTokens?:boolean;cotizacionesGratis?:number;solicitudesPlan?:number;sinPlan?:boolean;permiteAbierta?:boolean;onIrAPagos?:()=>void;onVerPlanes?:()=>void}) {
  const [step,setStep]=useState(1);
  // Sin cotizaciones abiertas (Admin › Módulos) la única modalidad es la dirigida.
  const [modalidad,setModalidad]=useState<"dirigida"|"abierta"|null>(preselectedImporterId||!permiteAbierta?"dirigida":null);
  const [selectedId,setSelectedId]=useState<string|null>(preselectedImporterId||null);
  // Producto recomendado por una importadora: la solicitud solo puede ir a ella.
  const dirigidaFija=origen?.origen==="tendencias"&&!!origen.importadorId&&selectedId===origen.importadorId;
  // `prefill` llega al duplicar una cotización existente: se copian sus datos
  // y el usuario solo ajusta lo que cambie.
  const [form,setForm]=useState<QuoteFormState>({...EMPTY_FORM,...prefill});
  const [confirmed,setConfirmed]=useState(false);const[stepError,setStepError]=useState("");
  // El error se pinta al final de la columna con scroll, y quien lo provoca
  // está abajo, junto al botón de enviar: sin desplazarlo a la vista, un
  // rechazo del servidor (p. ej. la empresa agotó su cupo diario) parecía un
  // clic que no hacía nada.
  const stepErrorRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{if(stepError)stepErrorRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"});},[stepError]);
  const [desbloquearPorCredito,setDesbloquearPorCredito]=useState(false);
  const [submitted,setSubmitted]=useState(false);const[submitting,setSubmitting]=useState(false);
  const [visible,setVisible]=useState(true);const[pendingStep,setPendingStep]=useState<number|null>(null);const[direction,setDirection]=useState<"fwd"|"back">("fwd");
  const si=importers.find(i=>i.id===selectedId)??null;
  const tierCotizante = cotizanteTier;
  const tierRequerido = si?.tierMinimoRequerido || "Bronze";
  // Con el cobro por tokens, el token de la cotización también desbloquea la empresa de nivel superior.
  const tierBloqueado = !cobroTokens && Boolean(modalidad === "dirigida" && si && (TIER_ORDER[tierCotizante] ?? 0) < (TIER_ORDER[tierRequerido] ?? 0));
  const saldoTokens = creditos + cotizacionesGratis + solicitudesPlan;
  // Se gastan en este orden: gratis del reto, solicitudes del plan y tokens sueltos.
  const partesSaldo = [
    cotizacionesGratis > 0 ? `${cotizacionesGratis} ${cotizacionesGratis===1?"cotización gratis":"cotizaciones gratis"}` : "",
    solicitudesPlan > 0 ? `${solicitudesPlan} ${solicitudesPlan===1?"solicitud":"solicitudes"} del plan` : "",
    `${creditos} ${creditos===1?"token":"tokens"}`,
  ].filter(Boolean);
  const sinTokens = cobroTokens && saldoTokens < 1;
  const navigate=useCallback((ns:number,dir:"fwd"|"back")=>{setDirection(dir);setVisible(false);setPendingStep(ns);},[]);
  useEffect(()=>{if(!visible&&pendingStep!==null){const t=setTimeout(()=>{setStep(pendingStep);setPendingStep(null);setVisible(true);setStepError("");},180);return()=>clearTimeout(t);}},[visible,pendingStep]);
  // El backend exige una descripcion de al menos 10 caracteres. Se comprueba
  // aqui, en el paso donde se escribe, y no al enviar: llegar al final del
  // formulario para que la peticion muera en un 422 no ayuda a nadie.
  const DESCRIPCION_MINIMA=10;

  function goNext(){
    if(step===1){
      if(!modalidad){setStepError("Selecciona una modalidad.");return;}
      if(modalidad==="dirigida"&&!selectedId){setStepError("Selecciona una empresa importadora.");return;}
    }
    if(step===2){
      if(!form.productName.trim()){setStepError("El nombre del producto es requerido.");return;}
      const descripcion=form.description.trim();
      if(descripcion.length<DESCRIPCION_MINIMA){
        setStepError(`Describe el producto con al menos ${DESCRIPCION_MINIMA} caracteres (llevas ${descripcion.length}).`);
        return;
      }
      if(!form.country){setStepError("Selecciona el pais de importacion.");return;}
      if(!form.productLine){setStepError("Selecciona la linea de producto.");return;}
      if(!form.incoterm){setStepError("Selecciona el incoterm.");return;}
      if(form.deliveryCity.trim().length<2){setStepError("Escribe la ciudad de entrega.");return;}
    }
    setStepError("");
    navigate(step+1,"fwd");
  }
  async function handleSubmit(forceUnlock = desbloquearPorCredito){
    if(sinPlan){setStepError(`${LISTA_CERRADA.titulo} Por ahora solo publican solicitudes quienes tienen un plan activo.`);return;}
    if(modalidad==="dirigida"&&!confirmed){setStepError("Debes confirmar la información.");return;}
    if(!modalidad){setStepError("Selecciona una modalidad.");return;}
    if(modalidad==="abierta"&&!permiteAbierta){setStepError("Por ahora las cotizaciones abiertas están desactivadas: elige una empresa importadora.");return;}
    if(tierBloqueado && !forceUnlock){
      setStepError(`Esta empresa requiere nivel ${tierRequerido} o superior. Tu nivel actual es ${tierCotizante}.`);
      return;
    }
    if(tierBloqueado && creditos < 1){
      setStepError("No tienes créditos suficientes para desbloquear esta cotización.");
      return;
    }
    if(sinTokens){
      setStepError("No tienes tokens de cotización. Cárgalos en Pagos y te los acreditamos al revisar el comprobante.");
      return;
    }

    if(form.description.trim().length<DESCRIPCION_MINIMA){
      setStepError(`Describe el producto con al menos ${DESCRIPCION_MINIMA} caracteres.`);
      setStep(2);
      return;
    }

    const parsedMinQuantity=form.unit==="m3"
      ?Number.parseFloat(String(form.minQuantity).replace(",","."))
      :Number.parseInt(form.minQuantity,10);
    if(!Number.isFinite(parsedMinQuantity)||parsedMinQuantity<=0||(form.unit==="unidades"&&parsedMinQuantity<1)){setStepError("La cantidad mínima debe ser mayor a 0.");return;}

    const quality=String(form.quality||"").toLowerCase();
    const tipoCalidad:CreateCotizacionPayload["tipo_calidad"]=quality.includes("econ")
      ?"economica"
      :quality.includes("est")
        ?"estandar"
        :"premium";

    const parsedTarget=form.targetPrice
      ?Number.parseFloat(String(form.targetPrice).replace(/[^0-9.,]/g,"").replace(",","."))
      :undefined;

    const payload:CreateCotizacionPayload={
      modalidad,
      ...(modalidad==="dirigida"&&selectedId?{importador_id:selectedId}:{}),
      ...(form.productPhotoUrls.length?{fotos_producto:form.productPhotoUrls}:{}),
      pais_importacion:form.country,
      nombre_producto:form.productName,
      descripcion_cliente:form.description.trim(),
      link_referencia:form.referenceLink||undefined,
      linea_producto:form.productLine,
      tipo_calidad:tipoCalidad,
      nivel_personalizacion:form.customization||undefined,
      modalidad_importacion:form.purpose,
      cantidad_minima:parsedMinQuantity,
      unidad_cantidad:form.unit,
      precio_objetivo_usd:Number.isFinite(parsedTarget as number)?parsedTarget:undefined,
      precio_objetivo_moneda:form.targetPriceCurrency || "USD",
      incoterm:form.incoterm || "DDP",
      notas_adicionales:form.notes||undefined,
      shipping_mark_sufijo:form.shippingMarkSufijo.trim()||undefined,
      ciudad_entrega:form.deliveryCity.trim()||undefined,
      tier_minimo_requerido: modalidad === "dirigida" ? tierRequerido : "Bronze",
      ...(origen?.origen==="tendencias"?{
        origen:"tendencias" as const,
        tendencia_item_id:origen.tendenciaItemId,
      }:{}),
      // Desde un catálogo solo vale si va dirigida a la empresa dueña; si el
      // comprador cambió de empresa, la solicitud pasa a ser directa.
      ...(origen?.origen==="catalogo"&&modalidad==="dirigida"&&selectedId===preselectedImporterId?{
        origen:"catalogo" as const,
        catalogo_producto_id:origen.catalogoProductoId,
      }:{}),
    };

    try{
      setSubmitting(true);
      setStepError("");
      await onSubmitQuote(payload, tierBloqueado && forceUnlock);
      setSubmitted(true);
    }catch(error){
      setStepError(error instanceof Error?error.message:"No se pudo crear la cotización.");
    }finally{
      setSubmitting(false);
    }
  }
  const slideStyle:React.CSSProperties={opacity:visible?1:0,transform:visible?"translateX(0)":direction==="fwd"?"translateX(12px)":"translateX(-12px)",transition:"opacity 180ms ease,transform 180ms ease"};
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="quotes"/>
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        {submitted ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex flex-col items-center text-center gap-4 max-w-sm">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500"/>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Solicitud enviada</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Tu cotización ha sido registrada exitosamente.</p>
              </div>
              <Button variant="primary" onClick={onBack}>Ver mis cotizaciones</Button>
            </div>
          </div>
        ) : (
          <main className="flex-1 overflow-hidden px-6 pt-6 pb-4 flex flex-col min-h-0">
            {/* Header del Formulario / Stepper (Fijos arriba) */}
            <div className="flex-shrink-0">
              <Breadcrumb items={[{label:"Inicio",onClick:onBack},{label:"Cotizaciones",onClick:onBack},{label:"Nueva cotización"}]}/>
              <h1 className="text-xl font-semibold mt-3">Nueva cotización</h1>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Solicita una nueva cotización para importar productos desde proveedores internacionales.</p>
              <div className="mb-4"><Stepper current={step}/></div>
            </div>

            {/* Área Central Scrolleable (Formulario + Panel Lateral) */}
            <div className="flex gap-6 items-start flex-1 min-h-0 overflow-hidden">
              
              {/* Columna Izquierda: Formulario (Con scroll independiente) */}
              <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                  {origen&&(
                    <div className="mb-4 rounded-xl border border-primary/20 dark:border-accent/20 bg-primary/5 dark:bg-accent/5 px-4 py-3 text-sm">
                      <p className="font-medium flex items-center gap-2">
                        {origen.origen==="tendencias"?<Sparkles className="w-4 h-4 text-primary dark:text-accent"/>:<LibraryBig className="w-4 h-4 text-primary"/>}
                        {origen.origen==="tendencias"?"Desde Tendencias":"Desde el catálogo de la empresa"}: {origen.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Ya cargamos el producto. Completa la cantidad, la calidad y lo que haga falta.</p>
                      {origen.origen==="tendencias"&&origen.importadorId&&(
                        <p className="mt-1 text-xs text-muted-foreground">Lo recomienda {origen.nombreEmpresa||"una importadora"}: la solicitud va dirigida solo a ella.</p>
                      )}
                      {origen.revisarRequisitos&&(
                        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"/>Este producto puede requerir permisos o registros (INVIMA, ICA, etiquetado). Pídele a la empresa importadora que lo revise en su propuesta.</p>
                      )}
                    </div>
                  )}
                  <div style={slideStyle}>
                    {step===1 && dirigidaFija && (
                      <Card padding="md"><div className="flex items-start gap-3"><Lock className="w-4 h-4 text-primary dark:text-accent flex-shrink-0 mt-0.5"/><div><p className="text-sm font-semibold">Cotización dirigida a {origen?.nombreEmpresa||"la importadora que lo recomienda"}</p><p className="text-xs text-muted-foreground mt-1">Este producto lo recomendó esa importadora, así que la solicitud va solo a ella. Para pedir propuestas a otras empresas, crea una cotización nueva desde Cotizaciones.</p></div></div></Card>
                    )}
                    {step===1 && !dirigidaFija && <Step1 modalidad={modalidad} setModalidad={m=>{setModalidad(m);setDesbloquearPorCredito(false);setStepError("");}} selectedId={selectedId} setSelectedId={(id)=>{setSelectedId(id);setDesbloquearPorCredito(false);setStepError("");}} preselectedId={preselectedImporterId} importers={importers} permiteAbierta={permiteAbierta}/>}
                    {step===2 && <Step2 form={form} setForm={setForm} importer={si} onProductPhotoUploaded={(fileItem)=>setForm(prev=>{
                      const url=toApiPath(fileItem.storage_url||`/documentos/archivos/${fileItem.id}/descargar`);
                      if(prev.productPhotoUrls.length>=MAX_FOTOS_PRODUCTO||prev.productPhotoUrls.includes(url))return prev;
                      return {...prev,productPhotoUrls:[...prev.productPhotoUrls,url]};
                    })}/>}
                    {step===3 && modalidad==="dirigida" && si && <Step3Dirigida form={form} importer={si} confirmed={confirmed} setConfirmed={setConfirmed}/>}
                    {step===3 && modalidad==="abierta" && <Step3Abierta/>}
                  </div>
                  {stepError && (
                    <div ref={stepErrorRef} role="alert" className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0"/>
                      <p className="text-sm text-destructive">{stepError}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Panel Lateral (Con scroll independiente para importadoras/filtros) */}
              <div className="w-64 xl:w-72 flex-shrink-0 hidden lg:block h-full overflow-y-auto pr-1">
                <RightPanel step={step} modalidad={modalidad} si={si} form={form}/>
              </div>
            </div>

            {sinPlan && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-accent/30 dark:bg-accent/10">
                <p className="text-xs text-amber-900 dark:text-accent">
                  <span className="font-semibold">{LISTA_CERRADA.titulo}</span> Por ahora solo publican solicitudes quienes tienen un plan activo. Apertura al público: próximamente.
                </p>
                {onVerPlanes && (
                  <Button variant="secondary" size="sm" onClick={onVerPlanes}>Ver planes</Button>
                )}
              </div>
            )}

            {cobroTokens && !sinPlan && (
              <div className={clsx("mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5",
                sinTokens ? "border-amber-200 bg-amber-50 dark:border-accent/30 dark:bg-accent/10" : "border-border bg-muted/40")}>
                <p className={clsx("text-xs", sinTokens ? "font-semibold text-amber-900 dark:text-accent" : "text-muted-foreground")}>
                  {sinTokens
                    ? "No tienes tokens de cotización. Cada cotización usa 1."
                    : `Esta cotización usa 1. Tienes ${partesSaldo.join(", ")}${partesSaldo.length>1?" (se usan en ese orden)":""}.`}
                </p>
                {sinTokens && onIrAPagos && (
                  <Button variant="secondary" size="sm" icon={<WalletCards className="w-3.5 h-3.5"/>} onClick={onIrAPagos}>Cargar tokens</Button>
                )}
              </div>
            )}

            {tierBloqueado && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-accent/30 dark:bg-accent/10">
                <p className="text-xs font-semibold text-amber-900 dark:text-accent">Esta empresa requiere nivel {tierRequerido} o superior. Tu nivel actual es {tierCotizante}.</p>
                <p className="mt-1 text-xs text-amber-800 dark:text-accent/80">Saldo disponible: {creditos} créditos. 1 crédito desbloquea 1 cotización.</p>
              </div>
            )}

            {/* Barra Inferior de Navegación (SIEMPRE FIJA EN EL BOTTOM) */}
            <div className="pt-3 mt-3 border-t border-border flex-shrink-0 bg-background z-10">
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={onBack}>
                    Cancelar
                  </Button>
                  {step > 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<ChevronLeft className="w-3.5 h-3.5" />}
                      onClick={() => navigate(step - 1, "back")}
                      className="hover:border-primary hover:bg-primary/10 hover:text-primary dark:hover:border-accent dark:hover:bg-accent/10 dark:hover:text-accent transition-colors"
                    >
                      Anterior
                    </Button>
                  )}
                </div>

                <div className="w-full sm:w-auto">
                  {step < 3 ? (
                    <Button
                      variant="primary"
                      size="md"
                      iconRight={<ChevronRight className="w-4 h-4" />}
                      onClick={goNext}
                      className="w-full sm:w-auto justify-center dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
                    >
                      Continuar
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      icon={<Send className="w-4 h-4" />}
                      loading={submitting}
                      disabled={tierBloqueado || sinTokens || sinPlan}
                      onClick={() => {
                        void handleSubmit(false);
                      }}
                      className="w-full sm:w-auto justify-center dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
                    >
                      {tierBloqueado ? "Solicitar cotización" : "Solicitar cotización"}
                    </Button>
                  )}
                </div>
              </div>

              {step === 3 && tierBloqueado && creditos >= 1 && (
                <Button
                  variant="primary"
                  size="md"
                  icon={<WalletCards className="w-4 h-4" />}
                  loading={submitting}
                  onClick={() => {
                    setDesbloquearPorCredito(true);
                    void handleSubmit(true);
                  }}
                  className="mt-2 w-full justify-center dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
                >
                  Desbloquear y enviar cotización por 1 crédito
                </Button>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL HELPER
// ─────────────────────────────────────────────────────────────────────────────