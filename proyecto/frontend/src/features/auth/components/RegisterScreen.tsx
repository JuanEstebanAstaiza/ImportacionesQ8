import { Fragment, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowUpDown, Building2, Check, CheckCircle2, ChevronLeft, ChevDown, Globe, Eye, EyeOff, Lock, Mail, UserRound, Loader2, Phone } from "lucide-react";

import { Badge, Button, Card, Input, Select, Textarea } from "@/components/design-system";
import { PublicSicLogo } from "@/components/navigation/PublicSicLogo";
import { Modal } from "@/components/ui/Modal";
import type { LegalPage } from "@/features/legal/types";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";
import { authService } from "@/services/auth.service";
import { TarjetaReferidos, leerCodigoReferidoDeLaUrl } from "@/features/referidos/TarjetaReferidos";
import type { RegisterRequest } from "@/types/auth";

type RegUserType = "solicitante";
type RegPersonType = "natural" | "juridica";

export function RegisterScreen({onBack,onSuccess,onPolicy}:{onBack:()=>void;onSuccess:(email:string)=>void;onPolicy:(page:LegalPage)=>void}) {
  const [userType,setUserType]=useState<RegUserType>("solicitante");
  const [personType,setPersonType]=useState<RegPersonType>("natural");
  const [accepted,setAccepted]=useState(false);
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);
  const [registeredEmail,setRegisteredEmail]=useState("");
  // El correo con el código puede no salir (SMTP caído): se avisa y se deja reenviar.
  const [correoEnviado,setCorreoEnviado]=useState(true);
  const [reenviando,setReenviando]=useState(false);
  const [esperaReenvio,setEsperaReenvio]=useState(0);
  useEffect(()=>{
    if(esperaReenvio<=0)return;
    const t=window.setTimeout(()=>setEsperaReenvio(s=>s-1),1000);
    return ()=>window.clearTimeout(t);
  },[esperaReenvio]);
  const [otpCode,setOtpCode]=useState("");
  const [otpLoading,setOtpLoading]=useState(false);
  const [otpError,setOtpError]=useState("");
  const [otpSuccess,setOtpSuccess]=useState(false);
  const [submitError,setSubmitError]=useState("");
  const { dark, toggleTheme } = useBrandTheme();
  const [form,setForm]=useState({
    email:"",docType:"CC",docNum:"",name:"",lastName:"",phone:"",country:"+57",
    nit:"",razonSocial:"",repEmail:"",repPhone:"",repCountry:"+57",password:"",confirmPassword:"",
  });

  function f(k:string,v:string){setForm(p=>({...p,[k]:v}));}

  function getErrorMessage(error: unknown){
    if(error instanceof Error&&error.message){
      return error.message;
    }
    if(typeof error==="string"&&error){
      return error;
    }
    if(typeof error==="object"&&error!==null){
      const response="response" in error?error.response:undefined;
      if(typeof response==="object"&&response!==null&&"data" in response){
        const data=response.data;
        if(typeof data==="object"&&data!==null&&"detail" in data){
          const detail=data.detail;
          if(typeof detail==="string"&&detail){
            return detail;
          }
        }
      }
    }
    return "No se pudo completar el registro";
  }

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(!accepted||loading)return;

    setSubmitError("");

    const clave = String(form.password ?? "").trim();
    if(clave.length<9){
      setSubmitError("La contraseña debe tener minimo 9 caracteres.");
      return;
    }
    if(form.password!==form.confirmPassword){
      setSubmitError("Las contraseñas no coinciden.");
      return;
    }

    const email=(personType==="natural"?form.email:form.repEmail).trim();
    const telefono=(personType==="natural"?form.phone:form.repPhone).trim();
    const indicativo=(personType==="natural"?form.country:form.repCountry).trim();

    const codigoReferido = leerCodigoReferidoDeLaUrl();

    const payload: RegisterRequest = personType === "natural" ? {
        email,
        password: clave,
        rol: "solicitante",
        tipo_persona: "natural",
        tipo_documento: String(form.docType ?? "").trim(),
        numero_documento: String(form.docNum ?? "").trim(),
        nombre: String(form.name ?? "").trim(),
        apellido: String(form.lastName ?? "").trim(),
        indicativo_pais_telefono: indicativo,
        telefono,
        acepto_politica_datos: accepted,
        ...(codigoReferido ? { codigo_referido: codigoReferido } : {}),
      }
    : {
        email,
        password: clave,
        rol: "solicitante",
        tipo_persona: "juridica",
        nit: String(form.nit ?? "").trim(),
        razon_social: String(form.razonSocial ?? "").trim(),
        indicativo_pais_telefono: indicativo,
        telefono,
        acepto_politica_datos: accepted,
        ...(codigoReferido ? { codigo_referido: codigoReferido } : {}),
      };

    try{
      setLoading(true);
      const respuesta=await authService.register(payload);
      setRegisteredEmail(email);
      setCorreoEnviado(respuesta.correo_enviado!==false);
      setEsperaReenvio(respuesta.correo_enviado===false?0:60);
      setSuccess(true);
    }catch(error){
      setSubmitError(getErrorMessage(error));
    }finally{
      setLoading(false);
    }
  }

  async function reenviarCodigo(){
    if(!registeredEmail||reenviando||esperaReenvio>0)return;
    try{
      setReenviando(true);
      setOtpError("");
      await authService.resendOtp({ email: registeredEmail, proposito: "verificacion_email" });
      setCorreoEnviado(true);
      setEsperaReenvio(60);
      toast.success("Te enviamos un código nuevo. Revisa también la carpeta de spam.");
    }catch(error){
      setOtpError(getErrorMessage(error));
    }finally{
      setReenviando(false);
    }
  }

  async function verifyOtp(e:React.FormEvent){
    e.preventDefault();
    if(otpLoading)return;

    const normalizedOtp=String(otpCode ?? "").trim();
    if(normalizedOtp.length!==6){
      setOtpError("Ingresa un codigo OTP valido de 6 digitos.");
      return;
    }

    if(!registeredEmail){
      setOtpError("No se encontro el correo de registro para verificar la cuenta.");
      return;
    }

    try{
      setOtpLoading(true);
      setOtpError("");
      await authService.verifyEmail({ email: registeredEmail, otp: normalizedOtp });
      setOtpSuccess(true);
      setTimeout(()=>onSuccess(registeredEmail),1200);
    }catch(error){
      setOtpError(getErrorMessage(error));
    }finally{
      setOtpLoading(false);
    }
  }

  const countryPhones=["+57","+1","+52","+34","+44","+49","+55","+54","+56","+51"];
  const docTypes=["CC","CE","Pasaporte","NIT","DNI"];

  if(success)return(
    <div className="min-h-screen flex flex-col bg-background items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-border shadow-sm p-8 max-w-sm w-full text-center relative z-10">
        {!otpSuccess?(
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4"/>
            <h2 className="text-lg font-semibold mb-2">¡Registro exitoso!</h2>
            {correoEnviado?(
              <p className="text-sm text-muted-foreground mb-4">Te enviamos un código de 6 dígitos a <span className="font-medium text-foreground">{registeredEmail||"tu correo"}</span>. Si no llega en un par de minutos, revisa la carpeta de spam.</p>
            ):(
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">Creamos tu cuenta, pero no pudimos enviarte el código a <span className="font-medium">{registeredEmail||"tu correo"}</span>. Pide uno nuevo abajo.</p>
            )}

            <form onSubmit={verifyOtp} className="space-y-3 text-left">
              <Input
                label="Codigo OTP"
                value={otpCode}
                onChange={e=>setOtpCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                required
              />
              {otpError&&<p className="text-xs text-destructive text-left">{otpError}</p>}
              <Button type="submit" variant="primary" fullWidth loading={otpLoading}>
                {!otpLoading&&"Activar cuenta"}
              </Button>
            </form>

            <button
              type="button"
              onClick={()=>{void reenviarCodigo();}}
              disabled={reenviando||esperaReenvio>0}
              className="mt-3 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline dark:text-accent"
            >
              {reenviando?"Enviando...":esperaReenvio>0?`Reenviar código en ${esperaReenvio} s`:"Reenviar código"}
            </button>

            <button type="button" onClick={onBack} className="mt-4 text-xs text-muted-foreground hover:text-foreground">Volver al inicio</button>
          </>
        ):(
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4"/>
            <h2 className="text-lg font-semibold mb-2">¡Cuenta activada con Éxito!</h2>
            <p className="text-sm text-muted-foreground">Redirigiendo al inicio de sesion...</p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3.5 relative z-10">
        <Logo/>
        <div className="flex items-center gap-1.5 w-fit">
          <button
            onClick={toggleTheme}
            title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground transition-colors"
          >
            {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onBack}>Volver</Button>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10 overflow-hidden">
        {/* Fondo con z-0 */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={dark ? "/brand/fondo-1.png" : "/brand/fondo-4.png"}
            alt="Fondo de registro"
            className="auth-background w-full h-full object-cover object-center transition-all duration-300"
          />
        </div>

        {/* Card principal con z-10 por encima de la imagen */}
        <div className="relative z-10 w-full max-w-[480px]">
          <div className="bg-white rounded-2xl border border-border shadow-sm">
            <div className="px-8 pt-8 pb-2">
              <h1 className="text-xl font-semibold tracking-tight mb-1">
                Crear cuenta
              </h1>

              <p className="text-sm text-muted-foreground mb-6">
                Elige el tipo de cuenta que deseas registrar
              </p>

              {/* User type */}
              <div className="flex gap-2 mb-6">
                {(["solicitante", "importadora"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setUserType(t)}
                    className={clsx(
                      "flex-1 py-3 flex flex-col items-center gap-1.5 border rounded-xl text-xs font-semibold transition-all capitalize",
                      userType === t
                        ? "border-primary bg-primary/5 text-primary dark:border-accent dark:bg-accent/5 dark:text-accent"
                        : "border-border text-muted-foreground hover:border-primary/40 dark:hover:border-accent/40"
                    )}
                  >
                    {t === "solicitante" ? (
                      <UserRound className="w-5 h-5" />
                    ) : (
                      <Building2 className="w-5 h-5" />
                    )}

                    {t === "solicitante"
                      ? "Soy comprador"
                      : "Soy empresa importadora"}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-8 pb-8">
              {userType === "importadora" ? (
                <div className="flex flex-col items-center text-center gap-5 py-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 dark:bg-accent/20 flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-primary dark:text-accent" />
                  </div>

                  <div>
                    <h2 className="font-semibold mb-2">Registro de empresa importadora</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                      Actualmente las empresas importadoras son registradas directamente por el equipo administrativo. Contáctanos para iniciar el proceso.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    className="dark:bg-accent dark:hover:bg-accent/90 dark:text-accent-foreground"
                    size="md"
                    icon={<MailIcon className="w-4 h-4" />}
                    onClick={() => openSmartContact({ type: "email", email: CORREO_ADMINISTRACION })}
                  >
                    Contactar al equipo administrativo
                  </Button>

                  <button
                    onClick={onBack}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    â† Volver al inicio
                  </button>
                </div>
              ):(
                <form onSubmit={submit} noValidate>
                  {/* Person type */}
                  <div className="flex gap-2 mb-5">
                    {(["natural", "juridica"] as const).map(t => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setPersonType(t)}
                        className={clsx(
                          "flex-1 py-2 text-xs font-semibold border rounded-lg transition-all",
                          personType === t
                            ? "border-primary bg-primary/5 text-primary dark:border-accent dark:bg-accent/5 dark:text-accent"
                            : "border-border text-muted-foreground hover:border-primary/40 dark:hover:border-accent/40"
                        )}
                      >
                        {t === "natural" ? "Persona Natural" : "Persona Jurídica"}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-4">
                    {personType==="natural"?(
                      <>
                        <Input label="Correo electrónico" type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={e=>f("email",e.target.value)} prefix={<Mail className="w-4 h-4"/>} required/>
                        <Input label="Contrasena" type="password" placeholder="Minimo 9 caracteres" value={form.password} onChange={e=>f("password",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
                        <Input label="Confirmar contrasena" type="password" placeholder="Repite tu contraseña" value={form.confirmPassword} onChange={e=>f("confirmPassword",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
                        <div className="grid grid-cols-2 gap-3">
                          <Select label="Tipo de documento" value={form.docType} onChange={e=>f("docType",e.target.value)}>{docTypes.map(d=><option key={d}>{d}</option>)}</Select>
                          <Input label="Número de documento" placeholder="1234567890" value={form.docNum} onChange={e=>f("docNum",e.target.value)} required/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input label="Nombre(s)" placeholder="Ana" value={form.name} onChange={e=>f("name",e.target.value)} required/>
                          <Input label="Apellidos" placeholder="García" value={form.lastName} onChange={e=>f("lastName",e.target.value)} required/>
                        </div>
                        <div className="flex gap-2">
                          <Select label="País" value={form.country} onChange={e=>f("country",e.target.value)} className="w-24">{countryPhones.map(c=><option key={c}>{c}</option>)}</Select>
                          <div className="flex-1"><Input label="Teléfono" placeholder="310 123 4567" value={form.phone} onChange={e=>f("phone",e.target.value)} required/></div>
                        </div>
                      </>
                    ):(
                      <>
                        <Input label="Correo del representante" type="email" placeholder="representante@empresa.com" value={form.repEmail} onChange={e=>f("repEmail",e.target.value)} prefix={<Mail className="w-4 h-4"/>} required/>
                        <Input label="Contrasena" type="password" placeholder="Minimo 9 caracteres" value={form.password} onChange={e=>f("password",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
                        <Input label="Confirmar contrasena" type="password" placeholder="Repite tu contraseña" value={form.confirmPassword} onChange={e=>f("confirmPassword",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
                        <Input label="NIT" placeholder="900.123.456-7" value={form.nit} onChange={e=>f("nit",e.target.value)} required/>
                        <Input label="Razón social" placeholder="Mi Empresa S.A.S." value={form.razonSocial} onChange={e=>f("razonSocial",e.target.value)} required/>
                        <div className="flex gap-2">
                          <Select label="País" value={form.repCountry} onChange={e=>f("repCountry",e.target.value)} className="w-24">{countryPhones.map(c=><option key={c}>{c}</option>)}</Select>
                          <div className="flex-1"><Input label="Teléfono" placeholder="310 123 4567" value={form.repPhone} onChange={e=>f("repPhone",e.target.value)} required/></div>
                        </div>
                      </>
                    )}
                    {submitError&&<p className="text-xs text-destructive">{submitError}</p>}
                    <div className="flex items-start gap-2.5 mt-1">
                      <input 
                        type="checkbox" 
                        id="acepta" 
                        checked={accepted} 
                        onChange={e => setAccepted(e.target.checked)} 
                        className="
                          mt-0.5
                          h-4 w-4
                          flex-shrink-0
                          cursor-pointer
                          rounded
                          border
                          border-primary
                          bg-white
                          accent-primary
                          transition-colors
                          duration-150
                          dark:border-accent
                          dark:bg-accent
                          dark:accent-accent
                        "
                      />
                      <label htmlFor="acepta" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        Acepto la <button type="button" onClick={()=>onPolicy("data")} className="text-xs font-medium text-purple-600 dark:text-green-500 underline">Política de Tratamiento de Datos</button> y los <button type="button" onClick={()=>onPolicy("terms")} className="text-xs font-medium text-purple-600 dark:text-green-500 underline">Términos y Condiciones</button> de la plataforma.
                      </label>
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth loading={loading}
                      disabled={!accepted}
                      className="mt-1 h-10 uppercase tracking-wide text-[13px] dark:bg-accent dark:hover:bg-accent dark:text-black">
                        {!loading&&"Crear cuenta"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">¿Ya tienes cuenta <button type="button" onClick={onBack} className="text-purple-600 dark:text-green-500 hover:underline font-medium">Iniciar sesión</button></p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-4 border-t border-border bg-background py-4 text-center text-xs text-muted-foreground relative z-10">
        <span>? 2026 Zarpi</span>
        <button onClick={() => onPolicy("data")} className="transition-colors hover:text-foreground">
          Tratamiento de Datos
        </button>
        <button onClick={() => onPolicy("terms")} className="transition-colors hover:text-foreground">
          Términos
        </button>
        <button onClick={() => onPolicy("payments")} className="transition-colors hover:text-foreground">
          Pagos y Reembolsos
        </button>
        <PublicSicLogo />
      </footer>
    </div>
  );
}
