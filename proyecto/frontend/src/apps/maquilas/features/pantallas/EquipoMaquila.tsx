import { useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Button, Card, Input } from "@shared/ui/design-system";
import { Modal } from "@shared/ui/kit/Modal";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { useEquipo, useInvalidarMaquilas, useMiMaquiladora } from "@apps/maquilas/features/useMaquilas";

function NuevoColaborador({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const invalidar = useInvalidarMaquilas();
  const [datos, setDatos] = useState({ nombre: "", apellido: "", email: "", telefono: "", password: "" });
  const [enviando, setEnviando] = useState(false);
  const valido = datos.nombre.trim().length >= 2 && /\S+@\S+\.\S+/.test(datos.email) && datos.password.length >= 9
    && /[A-Za-z]/.test(datos.password) && /\d/.test(datos.password);

  async function crear() {
    setEnviando(true);
    try {
      await maquilasService.crearColaborador({ ...datos, nombre: datos.nombre.trim(), apellido: datos.apellido.trim(), telefono: datos.telefono.trim() || undefined });
      await invalidar();
      toast.success("Creamos la cuenta. Compártele el correo y la contraseña por un canal seguro.");
      setDatos({ nombre: "", apellido: "", email: "", telefono: "", password: "" });
      onCerrar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={abierto} onClose={onCerrar} title="Agregar a alguien de tu equipo">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Podrá responder solicitudes, manejar pedidos, el catálogo y las reseñas. El perfil legal, el expediente y el equipo siguen siendo tuyos.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nombre" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
          <Input label="Apellido" value={datos.apellido} onChange={(e) => setDatos({ ...datos, apellido: e.target.value })} />
          <Input label="Correo" type="email" value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} />
          <Input label="Teléfono (opcional)" value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} />
          <div className="sm:col-span-2">
            <Input label="Contraseña inicial" type="password" autoComplete="new-password" value={datos.password}
              onChange={(e) => setDatos({ ...datos, password: e.target.value })} hint="Mínimo 9 caracteres, con letras y números. La puede cambiar después." />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button icon={<UserPlus className="h-4 w-4" />} loading={enviando} disabled={!valido} onClick={() => void crear()}>Crear cuenta</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Equipo de la maquila: la cuenta dueña agrega colaboradores y los activa o desactiva. */
export function EquipoMaquila() {
  const { data: mia } = useMiMaquiladora();
  const esDueno = mia?.mi_rol === "dueno";
  const { data, isLoading, error } = useEquipo(esDueno);
  const invalidar = useInvalidarMaquilas();
  const [agregando, setAgregando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function cambiar(id: string, activo: boolean) {
    setOcupado(id);
    try {
      await maquilasService.cambiarColaborador(id, activo);
      await invalidar();
      toast.success(activo ? "Cuenta activada" : "Cuenta desactivada: ya no puede entrar ni recibe avisos");
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  }

  if (mia && !esDueno) {
    return <Card padding="lg"><p className="text-sm text-muted-foreground">Solo la cuenta dueña de la maquila administra el equipo.</p></Card>;
  }

  return (
    <div className="space-y-5">
      <Card padding="lg" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-6 w-6 text-primary dark:text-accent" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Tu equipo</h2>
            <p className="text-sm text-muted-foreground">Cuentas para la gente que atiende clientes y pedidos contigo. Todas reciben los avisos de la maquila.</p>
          </div>
        </div>
        <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setAgregando(true)}>Agregar persona</Button>
      </Card>
      {isLoading ? <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
        : error ? <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>
        : (
          <Card padding="none">
            <ul className="divide-y divide-border">
              {(data ?? []).map((c) => (
                <li key={c.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{c.nombre} {c.rol === "dueno" && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal">Dueña de la cuenta</span>}</p>
                    <p className="text-xs text-muted-foreground">{c.email}{c.telefono ? ` · ${c.telefono}` : ""}</p>
                  </div>
                  {c.rol === "colaborador" && (
                    <div className="flex items-center gap-3">
                      <span className={c.activo ? "text-xs text-emerald-600" : "text-xs text-muted-foreground"}>{c.activo ? "Activa" : "Desactivada"}</span>
                      <Button size="sm" variant={c.activo ? "ghost" : "secondary"} loading={ocupado === c.id} onClick={() => void cambiar(c.id, !c.activo)}>
                        {c.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      <NuevoColaborador abierto={agregando} onCerrar={() => setAgregando(false)} />
    </div>
  );
}
