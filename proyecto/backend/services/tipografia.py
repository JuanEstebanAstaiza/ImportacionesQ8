"""Tipografía de la plataforma, elegida por el admin entre ~2.100 fuentes libres.

Catálogo: la API pública de Fontsource (https://fontsource.org/docs/api), que
reúne Google Fonts y otras fuentes de código abierto. No pide clave y todas
sus fuentes tienen licencias que permiten alojarlas en servidor propio (OFL,
Apache, UFL, CC0, MIT, Unlicense).

Cuando el admin aplica una fuente, el servidor descarga sus archivos WOFF2 una
sola vez y desde entonces los sirve él mismo (`/tipografia/...`): los
visitantes nunca se conectan a Fontsource ni a su CDN.

Seguridad:
- Solo se habla con dos hosts fijos (`api.fontsource.org` y
  `cdn.jsdelivr.net/fontsource/`); las URLs que devuelve la API se validan
  contra esa lista antes de descargarlas (evita SSRF).
- El id de la fuente se valida con una expresión estricta y nunca llega crudo
  a una ruta de disco ni al CSS.
- Cada archivo debe ser WOFF2 de verdad (firma `wOF2`) y no superar un tamaño
  máximo; se descartan licencias que no estén en la lista permitida.
- El CSS usa alias fijos ("Zarpi Texto"/"Zarpi Titulos"), no el nombre que
  viene de la API, así que nada externo se interpola en la hoja de estilos.
"""
from __future__ import annotations

import json
import logging
import re
import shutil
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from services import configuracion

logger = logging.getLogger("importacionesq8")

API_BASE = "https://api.fontsource.org/v1/fonts"
CDN_PERMITIDO = "https://cdn.jsdelivr.net/fontsource/"
USER_AGENT = "Zarpi/1.0 (+https://zarpi.co)"
TIMEOUT = httpx.Timeout(20.0, connect=10.0)

LICENCIAS_PERMITIDAS = {"ofl-1.1", "apache-2.0", "ufl-1.0", "cc0-1.0", "mit", "unlicense"}
CATEGORIAS = ("sans-serif", "serif", "display", "handwriting", "monospace")
PATRON_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
PATRON_ARCHIVO = re.compile(r"^(latin|latin-ext)-(\d{3})-(normal|italic)\.woff2$")

# Pesos y estilos que se descargan: los que usa la interfaz.
PESOS = (300, 400, 500, 600, 700, 800)
CURSIVAS = (400, 700)
SUBCONJUNTOS = ("latin", "latin-ext")
MAX_BYTES_ARCHIVO = 2 * 1024 * 1024

CARPETA = Path(__file__).resolve().parent.parent / "uploads" / "fuentes"
CARPETA_PREVIAS = CARPETA / "_previas"

CLAVE_CONFIG = "tipografia.activa"
CATALOGO_TTL_SEGUNDOS = 24 * 3600

_catalogo_cache: Dict[str, object] = {"datos": None, "hasta": 0.0}
_candado = threading.Lock()


class ErrorTipografia(Exception):
    """Algo falló al consultar o descargar una fuente; el mensaje es para el admin."""


def id_valido(fuente_id: str) -> bool:
    return bool(fuente_id) and bool(PATRON_ID.match(fuente_id))


def _get(url: str) -> httpx.Response:
    try:
        respuesta = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT, follow_redirects=False)
    except httpx.HTTPError as exc:
        raise ErrorTipografia("No se pudo contactar el catálogo de fuentes. Inténtalo de nuevo.") from exc
    if respuesta.status_code == 404:
        raise ErrorTipografia("La fuente no existe en el catálogo.")
    if respuesta.status_code != 200:
        raise ErrorTipografia(f"El catálogo de fuentes respondió {respuesta.status_code}.")
    return respuesta


def _resumen(f: dict) -> dict:
    return {
        "id": f["id"],
        "familia": f.get("family") or f["id"],
        "categoria": f.get("category"),
        "pesos": sorted(int(p) for p in (f.get("weights") or [])),
        "estilos": list(f.get("styles") or []),
        "variable": bool(f.get("variable")),
        "licencia": f.get("license"),
        "origen": f.get("type"),
    }


def _apta(f: dict) -> bool:
    return (
        id_valido(str(f.get("id", "")))
        and str(f.get("license", "")).lower() in LICENCIAS_PERMITIDAS
        and f.get("category") in CATEGORIAS
        and "latin" in (f.get("subsets") or [])
        and 400 in (f.get("weights") or [])
    )


def catalogo() -> List[dict]:
    """Fuentes aptas (licencia libre, con latín y peso 400), cacheadas un día."""
    with _candado:
        if _catalogo_cache["datos"] is not None and time.time() < float(_catalogo_cache["hasta"]):
            return _catalogo_cache["datos"]  # type: ignore[return-value]
    datos = _get(API_BASE).json()
    if not isinstance(datos, list):
        raise ErrorTipografia("El catálogo de fuentes respondió en un formato inesperado.")
    aptas = sorted((_resumen(f) for f in datos if isinstance(f, dict) and _apta(f)), key=lambda f: f["familia"].lower())
    with _candado:
        _catalogo_cache.update(datos=aptas, hasta=time.time() + CATALOGO_TTL_SEGUNDOS)
    return aptas


def buscar(q: str = "", categoria: Optional[str] = None, pagina: int = 1, por_pagina: int = 40) -> dict:
    fuentes = catalogo()
    if categoria:
        fuentes = [f for f in fuentes if f["categoria"] == categoria]
    termino = (q or "").strip().lower()
    if termino:
        fuentes = [f for f in fuentes if termino in f["familia"].lower() or termino in f["id"]]
        fuentes.sort(key=lambda f: (not f["familia"].lower().startswith(termino), f["familia"].lower()))
    inicio = (pagina - 1) * por_pagina
    return {"total": len(fuentes), "pagina": pagina, "fuentes": fuentes[inicio:inicio + por_pagina]}


def detalle(fuente_id: str) -> dict:
    if not id_valido(fuente_id):
        raise ErrorTipografia("Identificador de fuente inválido.")
    datos = _get(f"{API_BASE}/{fuente_id}").json()
    if not isinstance(datos, dict) or datos.get("id") != fuente_id:
        raise ErrorTipografia("El catálogo de fuentes respondió en un formato inesperado.")
    if str(datos.get("license", "")).lower() not in LICENCIAS_PERMITIDAS:
        raise ErrorTipografia("La licencia de esta fuente no permite alojarla en el servidor.")
    return datos


def _descargar_woff2(url: str) -> bytes:
    if not isinstance(url, str) or not url.startswith(CDN_PERMITIDO):
        raise ErrorTipografia("La fuente apunta a un origen no permitido.")
    contenido = _get(url).content
    if len(contenido) > MAX_BYTES_ARCHIVO:
        raise ErrorTipografia("Un archivo de la fuente supera el tamaño permitido.")
    if not contenido.startswith(b"wOF2"):
        raise ErrorTipografia("Un archivo de la fuente no es un WOFF2 válido.")
    return contenido


def _url(datos: dict, peso: int, estilo: str, subconjunto: str) -> Optional[str]:
    try:
        return datos["variants"][str(peso)][estilo][subconjunto]["url"]["woff2"]
    except (KeyError, TypeError):
        return None


def peso_cercano(pesos: List[int], deseado: int) -> int:
    return min(pesos, key=lambda p: (abs(p - deseado), p))


def vista_previa(fuente_id: str, peso: int = 400) -> bytes:
    """Un WOFF2 (latín, normal) para previsualizar en el panel. Se guarda en
    una carpeta de paso para no pedirlo dos veces al CDN."""
    if not id_valido(fuente_id):
        raise ErrorTipografia("Identificador de fuente inválido.")
    CARPETA_PREVIAS.mkdir(parents=True, exist_ok=True)
    archivo = CARPETA_PREVIAS / f"{fuente_id}-{int(peso)}.woff2"
    if archivo.exists():
        return archivo.read_bytes()
    datos = detalle(fuente_id)
    pesos = sorted(int(p) for p in datos.get("weights") or [])
    if not pesos:
        raise ErrorTipografia("La fuente no tiene archivos disponibles.")
    elegido = peso_cercano(pesos, int(peso))
    url = _url(datos, elegido, "normal", "latin") or _url(datos, elegido, "italic", "latin")
    if not url:
        raise ErrorTipografia("La fuente no tiene versión para alfabeto latino.")
    contenido = _descargar_woff2(url)
    archivo.write_bytes(contenido)
    _limpiar_previas()
    return contenido


def _limpiar_previas(maximo: int = 300) -> None:
    archivos = sorted(CARPETA_PREVIAS.glob("*.woff2"), key=lambda p: p.stat().st_mtime)
    for viejo in archivos[:-maximo]:
        viejo.unlink(missing_ok=True)


def instalar(fuente_id: str) -> dict:
    """Descarga al servidor los WOFF2 que usa la plataforma y deja un
    manifiesto con las caras disponibles. Si ya está instalada, no vuelve a
    descargar nada."""
    if not id_valido(fuente_id):
        raise ErrorTipografia("Identificador de fuente inválido.")
    carpeta = CARPETA / fuente_id
    manifiesto = carpeta / "manifiesto.json"
    if manifiesto.exists():
        return json.loads(manifiesto.read_text(encoding="utf-8"))

    datos = detalle(fuente_id)
    disponibles = sorted(int(p) for p in datos.get("weights") or [])
    pesos = [p for p in PESOS if p in disponibles] or [peso_cercano(disponibles, 400)]
    rangos = datos.get("unicodeRange") or {}

    temporal = CARPETA / f".{fuente_id}.tmp"
    shutil.rmtree(temporal, ignore_errors=True)
    temporal.mkdir(parents=True)
    caras = []
    try:
        for subconjunto in SUBCONJUNTOS:
            for peso in pesos:
                estilos = ["normal"] + (["italic"] if peso in CURSIVAS else [])
                for estilo in estilos:
                    url = _url(datos, peso, estilo, subconjunto)
                    if not url:
                        continue
                    nombre = f"{subconjunto}-{peso}-{estilo}.woff2"
                    (temporal / nombre).write_bytes(_descargar_woff2(url))
                    rango = rangos.get(subconjunto)
                    caras.append({
                        "archivo": nombre,
                        "peso": peso,
                        "estilo": estilo,
                        # El rango viene de la API: solo se aceptan caracteres de un unicode-range.
                        "unicode_range": rango if isinstance(rango, str) and re.fullmatch(r"[U+0-9A-Fa-f?,\- ]+", rango) else None,
                    })
        if not caras:
            raise ErrorTipografia("La fuente no tiene archivos para alfabeto latino.")
        info = {
            "id": fuente_id,
            "familia": datos.get("family") or fuente_id,
            "categoria": datos.get("category"),
            "licencia": datos.get("license"),
            "version": datos.get("version"),
            "pesos": pesos,
            "caras": caras,
            "instalada_en": datetime.utcnow().isoformat() + "Z",
        }
        (temporal / "manifiesto.json").write_text(json.dumps(info, ensure_ascii=False), encoding="utf-8")
        shutil.rmtree(carpeta, ignore_errors=True)
        temporal.rename(carpeta)
        return info
    except Exception:
        shutil.rmtree(temporal, ignore_errors=True)
        raise


def manifiesto(fuente_id: str) -> Optional[dict]:
    if not id_valido(fuente_id):
        return None
    ruta = CARPETA / fuente_id / "manifiesto.json"
    if not ruta.exists():
        return None
    return json.loads(ruta.read_text(encoding="utf-8"))


def ruta_archivo(fuente_id: str, archivo: str) -> Optional[Path]:
    if not id_valido(fuente_id) or not PATRON_ARCHIVO.match(archivo):
        return None
    ruta = CARPETA / fuente_id / archivo
    return ruta if ruta.is_file() else None


# ── Configuración activa ─────────────────────────────────────────────────────

def activa(db: Session) -> dict:
    """{"texto": {id, familia, ...} | None, "titulos": ... | None}. Sin texto,
    la plataforma usa la tipografía de marca (Elvellon y AT Avenor)."""
    valor = configuracion.obtener(db, CLAVE_CONFIG)
    if not valor:
        return {"texto": None, "titulos": None}
    try:
        datos = json.loads(valor)
    except ValueError:
        return {"texto": None, "titulos": None}
    return {"texto": datos.get("texto"), "titulos": datos.get("titulos"), "aplicada_en": datos.get("aplicada_en")}


def aplicar(db: Session, texto_id: Optional[str], titulos_id: Optional[str], usuario_id: str) -> dict:
    """Instala (si hace falta) y deja activas las fuentes. `texto_id` vacío
    vuelve a la tipografía de marca; `titulos_id` vacío usa la del texto."""
    if not texto_id:
        configuracion.guardar(db, CLAVE_CONFIG, None, usuario_id)
        return {"texto": None, "titulos": None}
    texto = instalar(texto_id)
    titulos = instalar(titulos_id) if titulos_id and titulos_id != texto_id else None

    def _corto(info: Optional[dict]) -> Optional[dict]:
        if info is None:
            return None
        return {k: info[k] for k in ("id", "familia", "categoria", "licencia", "pesos")}

    valor = {"texto": _corto(texto), "titulos": _corto(titulos), "aplicada_en": datetime.utcnow().isoformat() + "Z"}
    configuracion.guardar(db, CLAVE_CONFIG, json.dumps(valor, ensure_ascii=False), usuario_id)
    return valor


GENERICAS = {
    "serif": "Georgia, serif",
    "monospace": "ui-monospace, monospace",
    "handwriting": "cursive",
}


def _caras_css(alias: str, info: dict) -> List[str]:
    reglas = []
    for cara in info.get("caras", []):
        if not PATRON_ARCHIVO.match(cara.get("archivo", "")):
            continue
        partes = [
            f'font-family:"{alias}"',
            # Relativa a /tipografia/activa.css: funciona detrás de cualquier proxy o dominio.
            f'src:url("archivos/{info["id"]}/{cara["archivo"]}") format("woff2")',
            f'font-weight:{int(cara["peso"])}',
            f'font-style:{"italic" if cara.get("estilo") == "italic" else "normal"}',
            "font-display:swap",
        ]
        if cara.get("unicode_range"):
            partes.append(f'unicode-range:{cara["unicode_range"]}')
        reglas.append("@font-face{" + ";".join(partes) + "}")
    return reglas


def css(db: Session) -> str:
    """Hoja que sobrescribe la tipografía de marca. Vacía si no hay una
    personalizada. Las variables son las de theme.css (`--font-sans`,
    `--font-display`...); se declara fuera de capas para ganarle al tema."""
    config = activa(db)
    texto = manifiesto(config["texto"]["id"]) if config.get("texto") else None
    if texto is None:
        return "/* Tipografía de marca: sin personalización. */\n"
    titulos = manifiesto(config["titulos"]["id"]) if config.get("titulos") else None

    reglas = _caras_css("Zarpi Texto", texto)
    familia_texto = '"Zarpi Texto", ' + GENERICAS.get(texto.get("categoria"), "system-ui, sans-serif")
    familia_titulos = familia_texto
    if titulos is not None:
        reglas += _caras_css("Zarpi Titulos", titulos)
        familia_titulos = '"Zarpi Titulos", ' + GENERICAS.get(titulos.get("categoria"), "system-ui, sans-serif")

    reglas.append(
        ":root{"
        f"--font-sans:{familia_texto};--font-accent:{familia_texto};--font-avenor:{familia_texto};"
        f"--font-display:{familia_titulos};--font-elvellon:{familia_titulos}"
        "}"
    )
    # Las clases utilitarias de Tailwind llevan el nombre de la fuente
    # incrustado (no la variable), así que se cubren aparte.
    reglas.append(f".font-sans,.font-avenor,.font-accent{{font-family:{familia_texto}!important}}")
    reglas.append(f".font-display,.font-elvellon{{font-family:{familia_titulos}!important}}")
    return "\n".join(reglas) + "\n"
