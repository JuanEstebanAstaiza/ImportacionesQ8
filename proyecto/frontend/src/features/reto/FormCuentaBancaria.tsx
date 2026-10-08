import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import { BANCOS_COLOMBIA, type CuentaPagoDatos } from "@/services/reto.service";
import { CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO, CLASE_INPUT, mensajeError } from "@/features/reto/comun";

const CUENTA_VACIA: CuentaPagoDatos = { banco: "Bancolombia", tipo_cuenta: "ahorros", numero_cuenta: "", titular: "", documento_titular: "" };

/**
 * Datos bancarios para recibir pagos. Lo usan el perfil y el reclamo de la
 * recompensa del reto; las dos vías guardan la misma cuenta. El número y el
 * documento se escriben siempre de nuevo: nunca vuelven completos al navegador.
 */
export function FormCuentaBancaria({
  titulo,
  inicial,
  textoBoton = "Guardar cuenta",
  onGuardar,
  onCancelar,
}: {
  titulo?: ReactNode;
  /** Banco, tipo y titular de la cuenta guardada, para no reescribirlos al cambiarla. */
  inicial?: Partial<Pick<CuentaPagoDatos, "banco" | "tipo_cuenta" | "titular">>;
  textoBoton?: string;
  onGuardar: (datos: CuentaPagoDatos) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [datos, setDatos] = useState<CuentaPagoDatos>({ ...CUENTA_VACIA, ...inicial });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CuentaPagoDatos>(campo: K, valor: CuentaPagoDatos[K]) => setDatos((d) => ({ ...d, [campo]: valor }));
  const bancos = BANCOS_COLOMBIA.includes(datos.banco) ? BANCOS_COLOMBIA : [datos.banco, ...BANCOS_COLOMBIA];

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const numero = datos.numero_cuenta.replace(/\D/g, "");
    if (numero.length < 6) return setError("El número de cuenta debe tener al menos 6 dígitos.");
    if (datos.titular.trim().length < 3) return setError("Escribe el nombre completo del titular.");
    if (datos.documento_titular.trim().length < 5) return setError("Escribe el documento del titular.");
    setEnviando(true);
    setError(null);
    try {
      await onGuardar({
        ...datos,
        numero_cuenta: numero,
        titular: datos.titular.trim(),
        documento_titular: datos.documento_titular.trim(),
      });
    } catch (err) {
      setError(mensajeError(err, "No pudimos guardar la cuenta. Intenta de nuevo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="space-y-3" noValidate>
      {titulo ? <div>{titulo}</div> : null}
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Guardamos el número y el documento cifrados. Solo los ve el equipo que hace la transferencia.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Banco o billetera</span>
          <select value={datos.banco} onChange={(e) => set("banco", e.target.value)} className={`${CLASE_INPUT} mt-1`}>
            {bancos.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="font-medium">Tipo de cuenta</legend>
          <div className="mt-1 flex gap-2">
            {(["ahorros", "corriente"] as const).map((tipo) => (
              <label key={tipo} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 ${datos.tipo_cuenta === tipo ? "border-primary bg-primary/5 font-medium text-primary dark:text-accent" : "border-border bg-white"}`}>
                <input type="radio" name="tipo_cuenta" value={tipo} checked={datos.tipo_cuenta === tipo} onChange={() => set("tipo_cuenta", tipo)} className="sr-only" />
                {tipo === "ahorros" ? "Ahorros" : "Corriente"}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Número de cuenta</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={datos.numero_cuenta}
            onChange={(e) => set("numero_cuenta", e.target.value.replace(/[^\d\s-]/g, ""))}
            placeholder="Solo números (en Nequi o Daviplata, tu celular)"
            className={`${CLASE_INPUT} mt-1`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Titular de la cuenta</span>
          <input autoComplete="name" value={datos.titular} onChange={(e) => set("titular", e.target.value)} placeholder="Nombre completo" className={`${CLASE_INPUT} mt-1`} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Documento del titular</span>
          <input autoComplete="off" value={datos.documento_titular} onChange={(e) => set("documento_titular", e.target.value)} placeholder="Cédula o NIT" className={`${CLASE_INPUT} mt-1`} />
        </label>
      </div>
      {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={enviando} className={`${CLASE_BOTON_PRIMARIO} w-full px-4 py-2.5 sm:w-auto`}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {textoBoton}
        </button>
        {onCancelar ? (
          <button type="button" onClick={onCancelar} disabled={enviando} className={`${CLASE_BOTON_SECUNDARIO} w-full px-4 py-2.5 sm:w-auto`}>Cancelar</button>
        ) : null}
      </div>
    </form>
  );
}
