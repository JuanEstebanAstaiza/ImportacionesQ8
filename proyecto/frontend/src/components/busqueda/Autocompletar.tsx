import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";

/**
 * Campo de búsqueda con sugerencias, para elegir algo que existe (un usuario,
 * un cliente) cuando uno solo recuerda parte de su nombre o de su correo.
 *
 * Teclado: ↑/↓ recorren las sugerencias, Enter elige, Escape las cierra.
 * Sigue el patrón combobox de WAI-ARIA para lectores de pantalla.
 */

type AutocompletarProps<T> = {
  buscar: (consulta: string) => Promise<T[]>;
  onSeleccionar: (opcion: T) => void;
  obtenerClave: (opcion: T) => string;
  /** Contenido de cada sugerencia; recibe la consulta para resaltar lo que coincide. */
  renderOpcion: (opcion: T, consulta: string) => ReactNode;
  placeholder?: string;
  /** Letras mínimas antes de buscar. Con 0, al enfocar muestra sugerencias sin escribir. */
  minimo?: number;
  /** Claves que no se ofrecen (por ejemplo, quienes ya están en la lista). */
  excluir?: Set<string>;
  disabled?: boolean;
  /** Tras elegir, el campo queda vacío para buscar a otra persona. */
  limpiarAlElegir?: boolean;
  textoSinResultados?: string;
  className?: string;
  ariaLabel?: string;
};

const ESPERA_MS = 250;

export function Autocompletar<T>({
  buscar,
  onSeleccionar,
  obtenerClave,
  renderOpcion,
  placeholder = "Buscar…",
  minimo = 2,
  excluir,
  disabled = false,
  limpiarAlElegir = true,
  textoSinResultados = "Nadie coincide con la búsqueda.",
  className = "",
  ariaLabel,
}: AutocompletarProps<T>) {
  const id = useId();
  const [consulta, setConsulta] = useState("");
  const [opciones, setOpciones] = useState<T[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [activa, setActiva] = useState(-1);
  const contenedor = useRef<HTMLDivElement | null>(null);
  // Descarta respuestas que llegan tarde: si se escribió algo más mientras
  // tanto, la lista tiene que ser la de la última búsqueda.
  const ultima = useRef(0);

  const visibles = excluir ? opciones.filter((o) => !excluir.has(obtenerClave(o))) : opciones;
  const suficiente = consulta.trim().length >= minimo;

  useEffect(() => {
    if (!abierto || !suficiente) {
      setOpciones([]);
      return;
    }
    const numero = ++ultima.current;
    setCargando(true);
    setError("");
    const espera = window.setTimeout(() => {
      buscar(consulta.trim())
        .then((filas) => {
          if (numero !== ultima.current) return;
          setOpciones(filas);
          setActiva(filas.length ? 0 : -1);
        })
        .catch((e: unknown) => {
          if (numero !== ultima.current) return;
          setOpciones([]);
          setError(e instanceof Error ? e.message : "No se pudo buscar.");
        })
        .finally(() => {
          if (numero === ultima.current) setCargando(false);
        });
    }, ESPERA_MS);
    return () => window.clearTimeout(espera);
    // `buscar` suele ser una función nueva en cada render; la búsqueda depende
    // solo de lo escrito y de si la lista está abierta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, abierto, suficiente]);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  function elegir(opcion: T) {
    onSeleccionar(opcion);
    if (limpiarAlElegir) {
      setConsulta("");
      setOpciones([]);
    }
    setAbierto(false);
  }

  function teclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActiva((i) => (visibles.length ? (i + 1) % visibles.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiva((i) => (visibles.length ? (i - 1 + visibles.length) % visibles.length : -1));
    } else if (e.key === "Enter") {
      if (abierto && activa >= 0 && visibles[activa]) {
        e.preventDefault();
        elegir(visibles[activa]);
      }
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  const listaId = `${id}-lista`;
  const mostrarLista = abierto && suficiente;

  return (
    <div ref={contenedor} className={`relative ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          role="combobox"
          aria-label={ariaLabel ?? placeholder}
          aria-expanded={mostrarLista}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={mostrarLista && activa >= 0 ? `${id}-op-${activa}` : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={consulta}
          placeholder={placeholder}
          onChange={(e) => { setConsulta(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onKeyDown={teclado}
          className="w-full rounded-lg border border-border bg-white py-1.5 pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        {cargando ? (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : consulta ? (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onClick={() => { setConsulta(""); setOpciones([]); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {abierto && !suficiente && minimo > 0 && consulta.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">Escribe al menos {minimo} letras.</p>
      )}

      {mostrarLista && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-white py-1 shadow-lg"
        >
          {error ? (
            <li className="px-3 py-2 text-xs text-red-600">{error}</li>
          ) : !cargando && visibles.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">{textoSinResultados}</li>
          ) : (
            visibles.map((opcion, i) => (
              <li
                key={obtenerClave(opcion)}
                id={`${id}-op-${i}`}
                role="option"
                aria-selected={i === activa}
                // mousedown y no click: así se elige antes de que el campo pierda el foco.
                onMouseDown={(e) => { e.preventDefault(); elegir(opcion); }}
                onMouseEnter={() => setActiva(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === activa ? "bg-primary/10 dark:bg-accent/15" : ""}`}
              >
                {renderOpcion(opcion, consulta.trim())}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Resalta en `texto` las partes que coinciden con alguna palabra de `consulta`, sin importar tildes. */
export function Resaltar({ texto: original, consulta }: { texto: string; consulta: string }) {
  const palabras = sinTildes(consulta).split(/\s+/).filter((p) => p.length > 0);
  if (!original || palabras.length === 0) return <>{original}</>;
  // Se marca sobre la versión sin tildes y se corta el texto en las mismas
  // posiciones: en NFC, quitar la tilde no cambia la longitud de cada letra.
  const texto = original.normalize("NFC");
  const base = sinTildes(texto);
  const marcas = new Array<boolean>(texto.length).fill(false);
  for (const palabra of palabras) {
    let desde = base.indexOf(palabra);
    while (desde !== -1) {
      for (let i = desde; i < desde + palabra.length; i++) marcas[i] = true;
      desde = base.indexOf(palabra, desde + palabra.length);
    }
  }
  const partes: ReactNode[] = [];
  let i = 0;
  while (i < texto.length) {
    const marcada = marcas[i];
    let j = i;
    while (j < texto.length && marcas[j] === marcada) j++;
    const trozo = texto.slice(i, j);
    partes.push(marcada ? <mark key={i} className="rounded-sm bg-accent/60 px-0 text-inherit dark:bg-accent/30">{trozo}</mark> : trozo);
    i = j;
  }
  return <>{partes}</>;
}
