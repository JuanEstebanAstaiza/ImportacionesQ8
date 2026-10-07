import { useEffect } from "react";
import { Moon, Sun, ChevronLeft } from "lucide-react";

import { DOCUMENTOS_LEGALES, ORDEN_DOCUMENTOS } from "@/features/legal/documentos";
import { EMPRESA } from "@/features/legal/empresa";
import type { LegalPage } from "@/features/legal/types";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";

type LegalPolicyScreenProps = {
  page: LegalPage;
  onBack: () => void;
  onOpen: (page: LegalPage) => void;
};

/** Nombre corto de cada documento para las pestañas. */
const ETIQUETA: Record<LegalPage, string> = {
  terms: "Términos y Condiciones",
  data: "Tratamiento de Datos",
  payments: "Pagos y Reembolsos",
};

function idSeccion(indice: number) {
  return `seccion-${indice + 1}`;
}

export function LegalPolicyScreen({ page, onBack, onOpen }: LegalPolicyScreenProps) {
  const { dark, toggleTheme } = useBrandTheme();
  const documento = DOCUMENTOS_LEGALES[page];

  // Al cambiar de documento desde las pestañas, empezar a leerlo desde arriba.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  function irASeccion(indice: number) {
    document.getElementById(idSeccion(indice))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 flex items-center justify-between px-6 py-3.5 bg-white border-b border-border z-10">
        <img src={dark ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-wordmark.svg"} alt="Zarpi" className="h-8 w-28 object-contain object-left" />
        <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={dark ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground active:bg-primary/90 dark:active:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none text-muted-foreground hover:text-foreground hover:bg-muted h-8 px-3 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Volver
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <nav aria-label="Documentos legales" className="flex flex-wrap gap-2 mb-10">
          {ORDEN_DOCUMENTOS.map(otro => (
            <button
              key={otro}
              onClick={() => onOpen(otro)}
              aria-current={otro === page ? "page" : undefined}
              className={
                otro === page
                  ? "h-8 px-3 rounded-full text-xs font-semibold bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground"
                  : "h-8 px-3 rounded-full text-xs font-medium border border-border text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              }
            >
              {ETIQUETA[otro]}
            </button>
          ))}
        </nav>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{documento.titulo}</h1>
        {documento.resumen && <p className="text-muted-foreground mt-3">{documento.resumen}</p>}
        <p className="text-xs text-muted-foreground mt-3">
          Versión {documento.version} · Vigente desde el {documento.vigenteDesde}
        </p>

        <div className="mt-8 p-5 bg-muted rounded-xl border border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground mb-3">Contenido</p>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {documento.secciones.map((seccion, i) => (
              <li key={seccion.titulo}>
                <button
                  onClick={() => irASeccion(i)}
                  className="text-left text-muted-foreground transition-colors hover:text-primary dark:hover:text-accent"
                >
                  {i + 1}. {seccion.titulo}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
          {documento.secciones.map((seccion, i) => (
            <section key={seccion.titulo} id={idSeccion(i)} className="scroll-mt-20">
              <h2 className="text-base font-semibold text-foreground mb-3">
                {i + 1}. {seccion.titulo}
              </h2>
              <div className="space-y-3">
                {seccion.bloques.map((bloque, j) =>
                  Array.isArray(bloque) ? (
                    <ul key={j} className="list-disc pl-5 space-y-2 marker:text-primary dark:marker:text-accent">
                      {bloque.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p key={j}>{bloque}</p>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-14 p-6 rounded-xl border border-border text-sm">
          <p className="font-semibold text-foreground mb-3">{documento.tituloDatos}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-muted-foreground">
            <dt>Razón social</dt><dd className="text-foreground">{EMPRESA.razonSocial}</dd>
            <dt>NIT</dt><dd className="text-foreground">{EMPRESA.nit}</dd>
            {documento.mostrarMatricula && (
              <><dt>Matrícula mercantil</dt><dd className="text-foreground">{EMPRESA.matricula}, {EMPRESA.camaraComercio}</dd></>
            )}
            <dt>Domicilio</dt><dd className="text-foreground">{EMPRESA.domicilio}</dd>
            <dt>Teléfono</dt><dd className="text-foreground">{EMPRESA.telefono}</dd>
            <dt>Correo</dt>
            <dd>
              <a href={`mailto:${EMPRESA.correo}`} className="text-primary dark:text-accent font-medium hover:underline">{EMPRESA.correo}</a>
            </dd>
          </dl>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border">© 2026 Zarpi. Todos los derechos reservados.</footer>
    </div>
  );
}
