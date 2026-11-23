"""Piezas comunes de los archivos en GridFS de los módulos de la suite.

Cada módulo decide qué tipos admite y quién ve cada archivo; esto es lo que no
cambia entre módulos: reconocer el formato por sus primeros bytes, interpretar
`Range` y leer por trozos sin cargar el archivo entero en memoria.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Iterator, Optional, Tuple
from urllib.parse import quote

from gridfs import GridFSBucket
from gridfs.errors import NoFile

MIME_POR_EXTENSION = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp",
    "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime", "pdf": "application/pdf",
}

TROZO = 1024 * 1024


def disposicion(nombre: str, modo: str = "inline") -> str:
    """`Content-Disposition` que aguanta tildes y eñes (RFC 6266): las cabeceras HTTP
    van en latin-1, así que el nombre real viaja aparte en `filename*` (UTF-8) y
    `filename` lleva una versión ASCII para clientes viejos."""
    limpio = " ".join((nombre or "archivo").replace('"', "").replace("\\", "").split())
    ascii_ = unicodedata.normalize("NFKD", limpio).encode("ascii", "ignore").decode("ascii") or "archivo"
    return f"{modo}; filename=\"{ascii_}\"; filename*=UTF-8''{quote(limpio, safe='')}"


def firma_valida(extension: str, cabecera: bytes) -> bool:
    """Comprueba los primeros bytes: la extensión sola la cambia cualquiera."""
    if extension in ("jpg", "jpeg"):
        return cabecera.startswith(b"\xff\xd8\xff")
    if extension == "png":
        return cabecera.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == "webp":
        return cabecera[:4] == b"RIFF" and cabecera[8:12] == b"WEBP"
    if extension == "pdf":
        return cabecera.startswith(b"%PDF")
    if extension in ("mp4", "mov"):
        return cabecera[4:8] == b"ftyp" or cabecera[4:8] in (b"moov", b"mdat", b"wide", b"free")
    if extension == "webm":
        return cabecera.startswith(b"\x1a\x45\xdf\xa3")
    return False


_RANGO = re.compile(r"bytes=(\d*)-(\d*)$")


def rango(cabecera: Optional[str], tamano: int) -> Optional[Tuple[int, int]]:
    """Interpreta `Range: bytes=a-b` (un solo rango). None si no aplica."""
    if not cabecera:
        return None
    m = _RANGO.match(cabecera.strip())
    if not m or (not m.group(1) and not m.group(2)):
        return None
    if m.group(1):
        inicio = int(m.group(1))
        fin = int(m.group(2)) if m.group(2) else tamano - 1
    else:
        # bytes=-N: los últimos N bytes.
        inicio = max(tamano - int(m.group(2)), 0)
        fin = tamano - 1
    fin = min(fin, tamano - 1)
    if inicio > fin:
        return None
    return inicio, fin


def leer_trozos(bucket: GridFSBucket, archivo_id, inicio: int = 0, fin: Optional[int] = None) -> Iterator[bytes]:
    try:
        salida = bucket.open_download_stream(archivo_id)
    except NoFile:
        return
    try:
        if inicio:
            salida.seek(inicio)
        restante = (fin - inicio + 1) if fin is not None else None
        while restante is None or restante > 0:
            trozo = salida.read(TROZO if restante is None else min(TROZO, restante))
            if not trozo:
                break
            if restante is not None:
                restante -= len(trozo)
            yield trozo
    finally:
        salida.close()
