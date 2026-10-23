import { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle2, Plus, Search, X, RotateCcw, Edit2, Ban, MessageSquare } from "lucide-react";
import { clsx } from "clsx";

import { SidebarCtrl } from "@/types/portal";

import { Breadcrumb } from "@/components/navigation/Breadcrumb";

import type { LegalPage } from "@/features/legal/types";

import { authService } from "@/services/auth.service";

import { Avatar, Button, Card, Input, Select } from "@/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { type CreateAsesorPayload } from "@/services/business.service";

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

import { Modal } from "@/components/ui/Modal";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader, USER_IMPORTADORA } from "@/components/layout/AppHeader";
import type { CompanyAdvisor } from "@/types/portal";

export function ImporterAdvisorsScreen({sb,initialAdvisors,onCreateAdvisor,onSetAdvisorActive,onOpenInternalChat}:{sb:SidebarCtrl;initialAdvisors:CompanyAdvisor[];onCreateAdvisor:(payload:CreateAsesorPayload)=>Promise<CompanyAdvisor>;onSetAdvisorActive:(advisorId:string,activo:boolean)=>Promise<string>;onOpenInternalChat:(advisorId:string)=>Promise<void>}) {
  const [advisors,setAdvisors]=useState(initialAdvisors);
  const [search,setSearch]=useState("");
  const [showModal,setShowModal]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [editAdv,setEditAdv]=useState<CompanyAdvisor|null>(null);
  const [form,setForm]=useState({name:"",role:"",email:"",phone:"",password:"",status:"activo" as CompanyAdvisor["status"],availability:"alta" as CompanyAdvisor["availability"]});
  const [formError,setFormError]=useState("");
  const [statusMessage,setStatusMessage]=useState("");

  const filtered=advisors.filter(a=>!search||[a.name,a.role,a.email].some(v=>v.toLowerCase().includes(search.toLowerCase())));

  useEffect(()=>{
    setAdvisors(initialAdvisors);
  },[initialAdvisors]);

  function openCreate(){setEditAdv(null);setFormError("");setShowPassword(false);setForm({name:"",role:"",email:"",phone:"",password:"",status:"activo",availability:"alta"});setShowModal(true);}
  function openEdit(a:CompanyAdvisor){setEditAdv(a);setFormError("");setForm({name:a.name,role:a.role,email:a.email,phone:a.phone,password:"",status:a.status,availability:a.availability});setShowModal(true);}
  async function save(){
    if(editAdv){
      setAdvisors(prev=>prev.map(a=>a.id===editAdv.id?{...a,...form}:a));
      setShowModal(false);
      return;
    }

    const password = form.password.trim();
    if(password.length<9 || !/[A-Za-z]/.test(password) || !/\d/.test(password)){
      setFormError("La contraseña debe tener mínimo 9 caracteres, al menos una letra y al menos un dígito.");
      return;
    }

    const created=await onCreateAdvisor({
      email:form.email,
      password,
      nombre:form.name,
      telefono:form.phone,
    });
    setAdvisors(prev=>[created,...prev]);
    setShowModal(false);
  }
  async function abrirCanal(asesor:CompanyAdvisor){
    try{
      await onOpenInternalChat(asesor.id);
    }catch(err){
      setStatusMessage(err instanceof Error ? err.message : "No se pudo abrir el canal con el asesor.");
    }
  }

  async function reiniciarClave(asesor:CompanyAdvisor){
    try{
      await authService.forgotPassword({email:asesor.email});
      setStatusMessage(`Se envió a ${asesor.email} un enlace para que ${asesor.name} defina una contraseña nueva.`);
    }catch(err){
      setStatusMessage(err instanceof Error ? err.message : "No se pudo enviar el correo de restablecimiento.");
    }
  }

  async function toggle(id:string){
    const target = advisors.find((advisor) => advisor.id === id);
    if (!target) {
      return;
    }
    const nextActivo = target.status !== "activo";
    setStatusMessage(await onSetAdvisorActive(id, nextActivo));
    setAdvisors((prev) => prev.map((advisor) => (
      advisor.id === id
        ? {
            ...advisor,
            status: nextActivo ? "activo" : "inactivo",
          }
        : advisor
    )));
  }
  async function deactivate(id:string){
    // Se advierte del traspaso: el backend mueve sus cotizaciones y chats a la
    // cuenta dueña para que ninguna negociación quede sin responsable.
    if(!confirm("¿Desactivar asesor? Sus cotizaciones y conversaciones abiertas pasarán a tu cuenta."))return;
    setStatusMessage(await onSetAdvisorActive(id, false));
    setAdvisors((prev) => prev.map((advisor) => (
      advisor.id === id
        ? {
            ...advisor,
            status: "inactivo",
          }
        : advisor
    )));
  }

  const STATUS_CLS:Record<CompanyAdvisor["status"],string>={activo:"bg-emerald-50 text-emerald-700",inactivo:"bg-slate-100 text-slate-600",ausente:"bg-amber-50 text-amber-700"};
  const AVAIL_CLS:Record<CompanyAdvisor["availability"],string>={alta:"text-emerald-600",media:"text-amber-600",baja:"text-rose-600"};

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="imp-advisors"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_IMPORTADORA} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("imp-dashboard")},{label:"Asesores"}]}/>
              <h1 className="text-xl font-semibold mt-3">Gestión de asesores</h1>
              <p className="text-sm text-muted-foreground">{advisors.filter(a=>a.status==="activo").length} activos · {advisors.length} en total</p>
            </div>
            <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={openCreate}>Nuevo asesor</Button>
          </div>
          {statusMessage&&(
            <Card padding="sm" className="border-emerald-200 bg-emerald-50">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-emerald-800">{statusMessage}</p>
                <button type="button" onClick={()=>setStatusMessage("")} className="text-emerald-700 hover:text-emerald-900" aria-label="Cerrar aviso"><X className="w-3.5 h-3.5"/></button>
              </div>
            </Card>
          )}
          <div className="max-w-sm">
            <Input placeholder="Buscar por nombre, cargo o correo…" value={search} onChange={e=>setSearch(e.target.value)} prefix={<Search className="w-4 h-4"/>}/>
          </div>
          <Card padding="none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Asesor</th>
                  <th className="text-left px-3 py-3 font-medium hidden md:table-cell">Estado</th>
                  <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">Disponibilidad</th>
                  <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">Cotizaciones</th>
                  <th className="text-left px-3 py-3 font-medium hidden xl:table-cell">Resp. prom.</th>
                  <th className="text-right px-5 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(a=>(
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={a.initials} size="sm" color={a.color}/>
                        <div>
                          <p className="font-medium text-foreground">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.role} · {a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell"><span className={clsx("px-2 py-0.5 rounded-md text-xs font-medium capitalize",STATUS_CLS[a.status])}>{a.status}</span></td>
                    <td className={clsx("px-3 py-3 text-xs font-medium capitalize hidden lg:table-cell",AVAIL_CLS[a.availability])}>{a.availability}</td>
                    <td className="px-3 py-3 text-xs hidden lg:table-cell">{a.activeQuotes} activas</td>
                    <td className="px-3 py-3 text-xs hidden xl:table-cell">{a.avgResponse}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>} title="Abrir canal interno para coordinar sus operaciones" onClick={()=>{void abrirCanal(a);}}/>
                        <Button variant="ghost" size="sm" icon={<Edit2 className="w-3.5 h-3.5"/>} onClick={()=>openEdit(a)}/>
                        <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3.5 h-3.5"/>} title="Enviar enlace para restablecer la contraseña" onClick={()=>{void reiniciarClave(a);}}/>
                        <Button variant="ghost" size="sm" icon={a.status==="activo"?<Ban className="w-3.5 h-3.5"/>:<CheckCircle2 className="w-3.5 h-3.5"/>} onClick={()=>{void toggle(a.id);}}/>
                        <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5 text-destructive"/>} onClick={()=>{void deactivate(a.id);}}/>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </main>
      </div>
      <Modal open={showModal} onClose={()=>setShowModal(false)} title={editAdv?"Editar asesor":"Nuevo asesor"}>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Nombre completo" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
            <Input label="Cargo" value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}/>
            <Input label="Correo" type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/>
            <Input label="Teléfono" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/>
            {!editAdv&&<Input label="Contraseña temporal" type={showPassword?"text":"password"} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} hint="Mínimo 9 caracteres. Úsala para el primer login del asesor." suffix={<button type="button" onClick={()=>setShowPassword(v=>!v)} className="text-muted-foreground hover:text-foreground transition-colors">{showPassword?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>}/>}
            <Select label="Estado" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value as CompanyAdvisor["status"]}))}>
              <option value="activo">Activo</option><option value="inactivo">Inactivo</option><option value="ausente">Ausente</option>
            </Select>
            <Select label="Disponibilidad" value={form.availability} onChange={e=>setForm(p=>({...p,availability:e.target.value as CompanyAdvisor["availability"]}))}>
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </Select>
          </div>
          {formError&&<p className="text-xs text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={()=>setShowModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={save}>{editAdv?"Guardar cambios":"Crear asesor"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER PORTAL — QUOTES
// ─────────────────────────────────────────────────────────────────────────────

