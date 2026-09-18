import { useEffect, useState } from "react";
import { Check, Copy, Gift, Share2 } from "lucide-react";

import { businessService } from "@/services/business.service";

/**
 * Enlace de referidos del solicitante.
 *
 * El backend ya generaba el código y lo aplicaba al registrarse
 * (`codigo_referido` en `POST /auth/register`), pero no había forma de verlo ni
 * de compartirlo: el código existía y nadie podía usarlo. Aquí se convierte en
 * un enlace que lleva al registro con el código puesto — ver `?ref=` en la
 * pantalla de registro.
 */

const CLAVE_REFERIDO_EN_URL = "ref";

function construirEnlace(codigo: string): string {
  const base = window.location.origin;
  return `${base}/?${CLAVE_REFERIDO_EN_URL}=${encodeURIComponent(codigo)}`;
}

export function TarjetaReferidos() {
  const [codigo, setCodigo] = useState("");
  const [totalReferidos, setTotalReferidos] = useState(0);
  const [creditos, setCreditos] = useState(0);
  const [copiado, setCopiado] = useState<"codigo" | "enlace" | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    void Promise.all([
      businessService.getMyReferralCode(),
      businessService.getReferralStats().catch(() => ({ total_referidos: 0, creditos_ganados: 0 })),
    ])
      .then(([datosCodigo, estadisticas]) => {
        if (cancelado) {
          return;
        }
        setCodigo(datosCodigo.codigo);
        setTotalReferidos(estadisticas.total_referidos ?? 0);
        setCreditos(estadisticas.creditos_ganados ?? 0);
      })
      .catch(() => {
        // Solo aplica al rol solicitante: para el resto no hay tarjeta que mostrar.
        if (!cancelado) setCodigo("");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => { cancelado = true; };
  }, []);

  async function copiar(texto: string, cual: "codigo" | "enlace") {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin permiso de portapapeles (o contexto no seguro): se selecciona el
      // texto para que el usuario pueda copiarlo a mano en vez de quedarse sin
      // ninguna salida.
      window.prompt("Copia el enlace:", texto);
      return;
    }
    setCopiado(cual);
    window.setTimeout(() => setCopiado(null), 2000);
  }

  async function compartir(enlace: string) {
    // `navigator.share` solo existe en móvil y en contexto seguro; si no está,
    // copiar es el equivalente razonable.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Zarpi",
          text: "Te invito a cotizar tus importaciones en Zarpi",
          url: enlace,
        });
        return;
      } catch {
        // Cancelado por el usuario: no es un error que haya que mostrar.
        return;
      }
    }
    await copiar(enlace, "enlace");
  }

  if (cargando || !codigo) {
    return null;
  }

  const enlace = construirEnlace(codigo);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        <Gift className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Invita y gana créditos</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Comparte tu enlace: quien se registre con él queda vinculado a ti y ambos reciben el bono.
      </p>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Tu código</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm px-3 py-2 rounded-lg border border-border bg-muted/40 tracking-wider">
              {codigo}
            </code>
            <button
              type="button"
              onClick={() => { void copiar(codigo, "codigo"); }}
              aria-label="Copiar código"
              className="h-9 w-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              {copiado === "codigo" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Tu enlace de invitación</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={enlace}
              onFocus={(evento) => evento.currentTarget.select()}
              className="flex-1 h-9 px-3 rounded-lg border border-border bg-muted/40 text-xs truncate"
            />
            <button
              type="button"
              onClick={() => { void copiar(enlace, "enlace"); }}
              aria-label="Copiar enlace"
              className="h-9 w-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              {copiado === "enlace" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => { void compartir(enlace); }}
              className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-medium flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              Compartir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Personas referidas</p>
            <p className="text-lg font-semibold tabular-nums">{totalReferidos}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Créditos ganados</p>
            <p className="text-lg font-semibold tabular-nums">{creditos}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lee el código de referido de la URL (`?ref=Q8ABC12345`), si viene. */
export function leerCodigoReferidoDeLaUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get(CLAVE_REFERIDO_EN_URL)?.trim() ?? "";
  } catch {
    return "";
  }
}
