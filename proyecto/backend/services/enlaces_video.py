"""Enlaces de TikTok, Instagram, YouTube y Pinterest: validar, normalizar, enriquecer.

Reglas (docs/Tendencias · Guía de construcción.html, sección 3):
- Solo se aceptan esas cuatro plataformas. Los enlaces cortos (vm.tiktok.com,
  tiktok.com/t/…, pin.it/…) se resuelven siguiendo redirecciones, validando el
  dominio en cada salto para no terminar consultando un host arbitrario (SSRF).
- La forma normalizada (sin parámetros de seguimiento ni fragmentos, con el id
  del video) es lo que se compara para detectar repetidos.
- TikTok, YouTube y Pinterest tienen oEmbed público. Instagram exige una app
  aprobada por Meta: en V1 el aprobador pega el código de inserción oficial a mano.
- En Pinterest, quien guarda un pin no siempre es quien creó el contenido. El
  widget de pines (el que usa el botón oficial de Pinterest) dice quién lo creó;
  ese es el dueño que se muestra y, si Pinterest no lo sabe, la cuenta que lo publicó.
- Nunca se descarga el video ni su miniatura.

El reproductor se arma con el `embed_url` oficial de cada plataforma (un
iframe) a partir del id validado, en vez de inyectar el HTML que devuelve el
oEmbed: así no hay manera de colar scripts de terceros en la página.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import parse_qs, urlparse

import httpx

USER_AGENT = "Zarpi/1.0 (+https://zarpi.co)"
TIMEOUT = httpx.Timeout(10.0, connect=5.0)
MAX_REDIRECCIONES = 3

HOSTS_TIKTOK = {"tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"}
HOSTS_CORTOS_TIKTOK = {"vm.tiktok.com", "vt.tiktok.com"}
HOSTS_YOUTUBE = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
HOSTS_INSTAGRAM = {"instagram.com", "www.instagram.com"}

RE_TIKTOK_VIDEO = re.compile(r"/(?:@[\w.\-]+/)?video/(\d{8,25})")
RE_TIKTOK_V = re.compile(r"/v/(\d{8,25})")
RE_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
RE_INSTAGRAM = re.compile(r"^/(?:p|reel|reels|tv)/([A-Za-z0-9_-]{5,40})")

HOSTS_CORTOS_PINTEREST = {"pin.it"}
# Pinterest usa subdominios por país (co.pinterest.com) y dominios propios en
# algunos países (pinterest.es, pinterest.com.mx…). De esos solo se lee el id
# del pin: las consultas van siempre a www.pinterest.com o, desde un enlace
# corto, a los hosts de redirección de Pinterest.
RE_HOST_PINTEREST = re.compile(
    r"^(?:(?:www|api|[a-z]{2})\.)?pinterest\."
    r"(?:com|ca|cl|de|es|fr|it|jp|nz|ph|pt|at|ch|dk|ie|se|co\.uk|co\.kr|com\.au|com\.mx)$"
)
# /pin/123…/ y la forma con título: /pin/sala-moderna--123…/
RE_PINTEREST_PIN = re.compile(r"^/pin/(?:[^/]*--)?(\d{5,25})(?:/|$)")
OEMBED_PINTEREST = "https://www.pinterest.com/oembed.json"
WIDGET_PINES_PINTEREST = "https://widgets.pinterest.com/v3/pidgets/pins/info/"

NOMBRE_PLATAFORMA = {"tiktok": "TikTok", "instagram": "Instagram", "youtube": "YouTube", "pinterest": "Pinterest"}


class EnlaceInvalido(ValueError):
    """El enlace no es de una plataforma admitida o no apunta a un video."""


@dataclass
class Enlace:
    plataforma: str
    id_video: str
    # Lo que se compara para detectar repetidos.
    normalizada: str
    # Enlace limpio para "Abrir en [plataforma]".
    url_publica: str
    autor: Optional[str] = None
    miniatura_url: Optional[str] = None
    embed_html: Optional[str] = None
    titulo: Optional[str] = None
    datos: dict = field(default_factory=dict)


def _url(texto: str):
    texto = (texto or "").strip()
    if not texto:
        raise EnlaceInvalido("Pega el enlace del video.")
    if not re.match(r"^https?://", texto, re.I):
        texto = "https://" + texto
    partes = urlparse(texto)
    if partes.scheme not in ("http", "https") or not partes.hostname:
        raise EnlaceInvalido("El enlace no es válido.")
    return partes


def plataforma_de(host: str) -> Optional[str]:
    host = (host or "").lower()
    if host in HOSTS_TIKTOK:
        return "tiktok"
    if host in HOSTS_YOUTUBE:
        return "youtube"
    if host in HOSTS_INSTAGRAM:
        return "instagram"
    if host in HOSTS_CORTOS_PINTEREST or RE_HOST_PINTEREST.match(host):
        return "pinterest"
    return None


def _es_corto(partes) -> bool:
    host = partes.hostname.lower()
    if host in HOSTS_CORTOS_TIKTOK or (host in HOSTS_TIKTOK and partes.path.startswith("/t/")):
        return True
    return host in HOSTS_CORTOS_PINTEREST or (
        host == "api.pinterest.com" and partes.path.startswith("/url_shortener/"))


def resolver_corto(url: str, cliente: Optional[httpx.Client] = None) -> str:
    """Sigue las redirecciones de un enlace corto (TikTok o pin.it), sin salir
    nunca de los dominios de esa plataforma."""
    plataforma = plataforma_de(urlparse(url).hostname or "")
    nombre = NOMBRE_PLATAFORMA.get(plataforma or "", "la plataforma")
    destino_esperado = "un pin" if plataforma == "pinterest" else "un video"
    actual = url
    propio = cliente is None
    cliente = cliente or httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT, follow_redirects=False)
    try:
        for _ in range(MAX_REDIRECCIONES):
            partes = urlparse(actual)
            if plataforma is None or plataforma_de(partes.hostname or "") != plataforma:
                raise EnlaceInvalido(f"El enlace redirige fuera de {nombre}.")
            if not _es_corto(partes):
                return actual
            try:
                respuesta = cliente.get(actual)
            except httpx.HTTPError as exc:
                raise EnlaceInvalido(
                    f"No pudimos abrir el enlace corto. Pega el enlace completo de {destino_esperado}.") from exc
            destino = respuesta.headers.get("location")
            if respuesta.status_code not in (301, 302, 303, 307, 308) or not destino:
                raise EnlaceInvalido(f"El enlace corto de {nombre} no lleva a {destino_esperado}.")
            actual = httpx.URL(actual).join(destino).__str__()
        raise EnlaceInvalido("El enlace tiene demasiadas redirecciones.")
    finally:
        if propio:
            cliente.close()


def normalizar(url_texto: str, cliente: Optional[httpx.Client] = None) -> Enlace:
    """Valida, resuelve (si es corto) y normaliza el enlace. No consulta oEmbed."""
    partes = _url(url_texto)
    plataforma = plataforma_de(partes.hostname)
    if plataforma is None:
        raise EnlaceInvalido("Solo aceptamos enlaces de TikTok, Instagram, YouTube o Pinterest.")

    if plataforma == "tiktok":
        if _es_corto(partes):
            partes = urlparse(resolver_corto(partes.geturl(), cliente))
        m = RE_TIKTOK_VIDEO.search(partes.path) or RE_TIKTOK_V.search(partes.path)
        if not m:
            raise EnlaceInvalido("El enlace de TikTok no apunta a un video.")
        id_video = m.group(1)
        usuario = re.search(r"/@([\w.\-]+)/", partes.path)
        publica = (f"https://www.tiktok.com/@{usuario.group(1)}/video/{id_video}" if usuario
                   else f"https://www.tiktok.com/video/{id_video}")
        return Enlace("tiktok", id_video, f"https://www.tiktok.com/video/{id_video}", publica)

    if plataforma == "pinterest":
        if _es_corto(partes):
            partes = urlparse(resolver_corto(partes.geturl(), cliente))
        m = RE_PINTEREST_PIN.match(partes.path)
        if not m:
            raise EnlaceInvalido("El enlace de Pinterest no apunta a un pin.")
        canonica = f"https://www.pinterest.com/pin/{m.group(1)}/"
        return Enlace("pinterest", m.group(1), canonica, canonica)

    if plataforma == "youtube":
        host = partes.hostname.lower()
        id_video = None
        if host == "youtu.be":
            id_video = partes.path.strip("/").split("/")[0]
        elif partes.path == "/watch":
            id_video = (parse_qs(partes.query).get("v") or [""])[0]
        else:
            m = re.match(r"^/(?:shorts|embed|live|v)/([^/?#]+)", partes.path)
            id_video = m.group(1) if m else None
        if not id_video or not RE_YOUTUBE_ID.match(id_video):
            raise EnlaceInvalido("El enlace de YouTube no apunta a un video.")
        canonica = f"https://www.youtube.com/watch?v={id_video}"
        return Enlace("youtube", id_video, canonica, canonica)

    m = RE_INSTAGRAM.match(partes.path)
    if not m:
        raise EnlaceInvalido("El enlace de Instagram no apunta a una publicación o reel.")
    codigo = m.group(1)
    # Las publicaciones y los reels comparten espacio de códigos.
    canonica = f"https://www.instagram.com/p/{codigo}/"
    return Enlace("instagram", codigo, canonica, canonica)


def embed_url(plataforma: str, id_video: str) -> Optional[str]:
    """Reproductor oficial (iframe) de cada plataforma."""
    if plataforma == "tiktok" and re.fullmatch(r"\d{8,25}", id_video or ""):
        return f"https://www.tiktok.com/embed/v2/{id_video}"
    if plataforma == "youtube" and RE_YOUTUBE_ID.match(id_video or ""):
        return f"https://www.youtube-nocookie.com/embed/{id_video}"
    if plataforma == "instagram" and re.fullmatch(r"[A-Za-z0-9_-]{5,40}", id_video or ""):
        return f"https://www.instagram.com/p/{id_video}/embed"
    if plataforma == "pinterest" and re.fullmatch(r"\d{5,25}", id_video or ""):
        return f"https://assets.pinterest.com/ext/embed.html?id={id_video}"
    return None


class VideoNoDisponible(Exception):
    """La plataforma dice que el video no existe o ya no está disponible."""


def consultar_oembed(enlace: Enlace, cliente: Optional[httpx.Client] = None) -> Enlace:
    """Completa autor, miniatura y código de inserción con el oEmbed público.

    Levanta `VideoNoDisponible` si la plataforma responde que no existe (404,
    400, 401, 403). Si la plataforma no responde, devuelve el enlace sin datos:
    el aprobador lo verá igual en el panel.
    """
    if enlace.plataforma == "tiktok":
        url = "https://www.tiktok.com/oembed"
        params = {"url": enlace.url_publica}
    elif enlace.plataforma == "youtube":
        url = "https://www.youtube.com/oembed"
        params = {"url": enlace.url_publica, "format": "json"}
    elif enlace.plataforma == "pinterest":
        url = OEMBED_PINTEREST
        params = {"url": enlace.url_publica}
    else:
        return enlace

    propio = cliente is None
    cliente = cliente or httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT, follow_redirects=False)
    try:
        try:
            respuesta = (_get_en_pinterest(cliente, url, params) if enlace.plataforma == "pinterest"
                         else cliente.get(url, params=params))
        except httpx.HTTPError:
            respuesta = None
        if respuesta is not None and respuesta.status_code in (400, 401, 403, 404):
            raise VideoNoDisponible(enlace.normalizada)
        datos = _json_de(respuesta)
        if datos:
            _aplicar_oembed(enlace, datos)
        if enlace.plataforma == "pinterest":
            _dueno_pinterest(enlace, cliente)
        return enlace
    finally:
        if propio:
            cliente.close()


def _json_de(respuesta: Optional[httpx.Response]) -> dict:
    if respuesta is None or respuesta.status_code != 200:
        return {}
    try:
        datos = respuesta.json()
    except ValueError:
        return {}
    return datos if isinstance(datos, dict) else {}


def _aplicar_oembed(enlace: Enlace, datos: dict) -> None:
    enlace.autor = (str(datos.get("author_name") or "")[:200]) or None
    miniatura = str(datos.get("thumbnail_url") or "")
    enlace.miniatura_url = miniatura[:1000] if miniatura.startswith("https://") else None
    enlace.embed_html = (str(datos.get("html") or "")[:20000]) or None
    enlace.titulo = (str(datos.get("title") or "")[:300]) or None
    enlace.datos = {k: datos.get(k) for k in ("author_url", "provider_name") if datos.get(k)}


def _es_host_pinterest(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == "pinterest.com" or host.endswith(".pinterest.com")


def _get_en_pinterest(cliente: httpx.Client, url: str, params: Optional[dict]) -> Optional[httpx.Response]:
    """GET que sigue redirecciones solo dentro de *.pinterest.com: el oEmbed
    manda al subdominio del país (co.pinterest.com)."""
    for _ in range(MAX_REDIRECCIONES):
        respuesta = cliente.get(url, params=params)
        destino = respuesta.headers.get("location")
        if respuesta.status_code not in (301, 302, 303, 307, 308) or not destino:
            return respuesta
        # La redirección ya trae los parámetros en la URL.
        url, params = str(httpx.URL(url).join(destino)), None
        if not _es_host_pinterest(url):
            return None
    return None


def _nombre_cuenta_pinterest(cuenta: dict) -> Optional[str]:
    """«Nombre (@usuario)» de una cuenta del widget de pines."""
    nombre = str(cuenta.get("full_name") or "").strip()
    perfil = str(cuenta.get("profile_url") or "")
    usuario = str(cuenta.get("username") or "").strip()
    if not usuario and _es_host_pinterest(perfil):
        usuario = urlparse(perfil).path.strip("/").split("/")[0]
    if nombre and usuario and nombre.lower() != usuario.lower():
        return f"{nombre} (@{usuario})"[:200]
    return (nombre or (f"@{usuario}" if usuario else ""))[:200] or None


def _dueno_pinterest(enlace: Enlace, cliente: httpx.Client) -> None:
    """Completa el dueño del pin con el widget de pines: el creador original
    (`native_creator`) si Pinterest lo conoce; si no, la cuenta que lo guardó.
    Si el widget no responde, se queda con lo del oEmbed."""
    try:
        respuesta = cliente.get(WIDGET_PINES_PINTEREST, params={"pin_ids": enlace.id_video})
    except httpx.HTTPError:
        return
    pines = _json_de(respuesta).get("data")
    pin = pines[0] if isinstance(pines, list) and pines and isinstance(pines[0], dict) else None
    if pin is None:
        return
    if pin.get("error"):
        raise VideoNoDisponible(enlace.normalizada)
    for clave in ("native_creator", "pinner"):
        cuenta = pin.get(clave)
        nombre = _nombre_cuenta_pinterest(cuenta) if isinstance(cuenta, dict) else None
        if nombre:
            enlace.autor = nombre
            perfil = str(cuenta.get("profile_url") or "")
            if _es_host_pinterest(perfil):
                enlace.datos["author_url"] = perfil[:500]
            break
    imagenes = pin.get("images") if isinstance(pin.get("images"), dict) else {}
    imagen = (imagenes.get("564x") or {}).get("url")
    if isinstance(imagen, str) and imagen.startswith("https://"):
        enlace.miniatura_url = imagen[:1000]
    enlace.datos["es_video"] = bool(pin.get("is_video"))
    if pin.get("link"):
        # El sitio de donde salió el pin: muchas veces, la tienda del producto.
        enlace.datos["enlace_origen"] = str(pin["link"])[:1000]


# La tarjeta de un pin es la imagen a lo ancho más un pie fijo de ~100 px
# (título y quién lo publicó). El oEmbed da el tamaño de la tarjeta completa.
ALTO_PIE_PIN = 100


def proporcion_pin(embed_html: Optional[str]) -> Optional[float]:
    """Alto/ancho de la imagen del pin, sacado del iframe que da el oEmbed. Con
    eso el frontend arma un marco del tamaño justo, sin espacio vacío."""
    ancho = re.search(r'\bwidth="(\d{2,4})"', embed_html or "")
    alto = re.search(r'\bheight="(\d{2,4})"', embed_html or "")
    if not ancho or not alto or int(alto.group(1)) <= ALTO_PIE_PIN:
        return None
    return round((int(alto.group(1)) - ALTO_PIE_PIN) / int(ancho.group(1)), 4)


def codigo_desde_embed_instagram(embed_html: str) -> Optional[str]:
    """Del código de inserción oficial de Instagram, el código de la publicación."""
    m = re.search(r"https://www\.instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]{5,40})", embed_html or "")
    return m.group(1) if m else None
