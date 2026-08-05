import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FileText, Package2 } from "lucide-react";

import { legalService } from "@/services/legal.service";
import type { LegalPage } from "@/features/legal/types";

type LegalPolicyScreenProps = {
  page: LegalPage;
  onBack: () => void;
};

const FALLBACK_MESSAGE = "Este documento se encuentra en construccion y sera publicado proximamente.";

export function LegalPolicyScreen({ page, onBack }: LegalPolicyScreenProps) {
  const [apiMessage, setApiMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPolicy() {
      setLoadError("");

      try {
        const response = await legalService.getPolicy(page);
        if (!cancelled) {
          setApiMessage(response.apiMessage || "");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "No se pudo cargar el documento legal.";
          setLoadError(message);
        }
      } finally {
        // No-op: kept for symmetry and future telemetry hooks.
      }
    }

    void loadPolicy();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const isData = page === "data";
  const heading = isData ? "Politica de Tratamiento de Datos" : "Terminos y Condiciones";

  const description = useMemo(() => {
    if (apiMessage.trim()) {
      return apiMessage.trim();
    }
    return FALLBACK_MESSAGE;
  }, [apiMessage]);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter,system-ui,sans-serif" }}>
      <header className="sticky top-0 flex items-center justify-between px-6 py-3.5 bg-white border-b border-border z-10">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Package2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-foreground tracking-tight text-[14px] whitespace-nowrap">ImportacionesQ8</span>
        </div>

        <button
          onClick={onBack}
          className="inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none text-muted-foreground hover:text-foreground hover:bg-muted h-8 px-3 text-xs"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Volver
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex flex-col items-center text-center gap-5 mb-12">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <FileText className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{heading}</h1>
            <p className="text-muted-foreground mt-2 text-sm">ImportacionesQ8 - Version 1.0</p>
          </div>

          <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <div className="p-6 bg-muted rounded-xl border border-border">
            <p className="font-semibold text-foreground mb-2">Aviso importante</p>
            <p>
              La {isData ? "Politica de Tratamiento de Datos Personales" : "politica de Terminos y Condiciones"} de ImportacionesQ8 esta siendo redactada por nuestro equipo legal y estara disponible antes del lanzamiento oficial de la plataforma.
            </p>
          </div>

          <p>
            En ella se detallara: {isData ? "el tratamiento, almacenamiento y proteccion de tus datos personales segun la legislacion colombiana vigente (Ley 1581 de 2012 y sus decretos reglamentarios)." : "las condiciones de uso de la plataforma, responsabilidades de las partes, propiedad intelectual y resolucion de controversias."}
          </p>

          {loadError && (
            <p className="text-xs text-red-700">
              No fue posible cargar temporalmente el texto legal desde el backend: {loadError}
            </p>
          )}

          <p>
            Si tienes preguntas, puedes contactarnos a <span className="text-primary font-medium">legal@importacionesq8.co</span>
          </p>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border">© 2025 ImportacionesQ8. Todos los derechos reservados.</footer>
    </div>
  );
}
