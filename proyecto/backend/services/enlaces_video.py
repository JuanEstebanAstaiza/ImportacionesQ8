"""Enlaces a videos de TikTok, Instagram y YouTube: validar, normalizar, enriquecer.

Reglas (docs/Tendencias · Guía de construcción.html, sección 3):
- Solo se aceptan esos tres dominios. Los enlaces cortos (vm.tiktok.com,
  tiktok.com/t/…) se resuelven siguiendo redirecciones, validando el dominio en
  cada salto para no terminar consultando un host arbitrario (SSRF).
- La forma normalizada (sin parámetros de seguimiento ni fragmentos, con el id
  del video) es lo que se compara para detectar repetidos.
- TikTok y YouTube tienen oEmbed público. Instagram exige una app aprobada por
  Meta: en V1 el aprobador pega el código de inserción oficial a mano.
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
    return None


def _es_corto_tiktok(partes) -> bool:
    host = partes.hostname.lower()
    return host in HOSTS_CORTOS_TIKTOK or (host in HOSTS_TIKTOK and partes.path.startswith("/t/"))


def resolver_corto(url: str, cliente: Optional[httpx.Client] = None) -> str:
    """Sigue las redirecciones de un enlace corto de TikTok, sin salir nunca de
    los dominios de TikTok."""
    actual = url
    propio = cliente is None
    cliente = cliente or httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT, follow_redirects=False)
    try:
        for _ in range(MAX_REDIRECCIONES):
            partes = urlparse(actual)
            if plataforma_de(partes.hostname or "") != "tiktok":
                raise EnlaceInvalido("El enlace redirige fuera de TikTok.")
            if not _es_corto_tiktok(partes):
                return actual
            try:
                respuesta = cliente.get(actual)
            except httpx.HTTPError as exc:
                raise EnlaceInvalido("No pudimos abrir el enlace corto. Pega el enlace completo del video.") from exc
            destino = respuesta.headers.get("location")
            if respuesta.status_code not in (301, 302, 303, 307, 308) or not destino:
                raise EnlaceInvalido("El enlace corto de TikTok no lleva a un video.")
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
        raise EnlaceInvalido("Solo aceptamos videos de TikTok, Instagram o YouTube.")

    if plataforma == "tiktok":
        if _es_corto_tiktok(partes):
            partes = urlparse(resolver_corto(partes.geturl(), cliente))
        m = RE_TIKTOK_VIDEO.search(partes.path) or RE_TIKTOK_V.search(partes.path)
        if not m:
            raise EnlaceInvalido("El enlace de TikTok no apunta a un video.")
        id_video = m.group(1)
        usuario = re.search(r"/@([\w.\-]+)/", partes.path)
        publica = (f"https://www.tiktok.com/@{usuario.group(1)}/video/{id_video}" if usuario
                   else f"https://www.tiktok.com/video/{id_video}")
        return Enlace("tiktok", id_video, f"https://www.tiktok.com/video/{id_video}", publica)

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
    else:
        return enlace

    propio = cliente is None
    cliente = cliente or httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT, follow_redirects=False)
    try:
        try:
            respuesta = cliente.get(url, params=params)
        except httpx.HTTPError:
            return enlace
        if respuesta.status_code in (400, 401, 403, 404):
            raise VideoNoDisponible(enlace.normalizada)
        if respuesta.status_code != 200:
            return enlace
        try:
            datos = respuesta.json()
        except ValueError:
            return enlace
        if not isinstance(datos, dict):
            return enlace
        enlace.autor = (str(datos.get("author_name") or "")[:200]) or None
        miniatura = str(datos.get("thumbnail_url") or "")
        enlace.miniatura_url = miniatura[:1000] if miniatura.startswith("https://") else None
        enlace.embed_html = (str(datos.get("html") or "")[:20000]) or None
        enlace.titulo = (str(datos.get("title") or "")[:300]) or None
        enlace.datos = {k: datos.get(k) for k in ("author_url", "provider_name") if datos.get(k)}
        return enlace
    finally:
        if propio:
            cliente.close()


def codigo_desde_embed_instagram(embed_html: str) -> Optional[str]:
    """Del código de inserción oficial de Instagram, el código de la publicación."""
    m = re.search(r"https://www\.instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]{5,40})", embed_html or "")
    return m.group(1) if m else None
