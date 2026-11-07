"""Archivos del módulo en GridFS: subida validada, descarga con Range y acceso.

Dos buckets:
- `medios`: fotos y videos de los lotes.
- `documentos`: fichas técnicas, comprobantes de pago, facturas y RUT.

Un archivo nace suelto (solo con su cuenta dueña) y queda ligado a un lote o
a una operación cuando el servicio lo adjunta; a partir de ahí, quién lo ve lo
decide aquello a lo que está ligado (ver `puede_ver`).
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import BinaryIO, Dict, Iterator, List, Optional, Tuple

from bson import ObjectId
from bson.errors import InvalidId
from gridfs.errors import NoFile
from pymongo.database import Database

from liquidaciones import db as mongo
from liquidaciones import parametros
from liquidaciones.identidad import cuenta_de, es_equipo

# tipo de archivo → (bucket, extensiones admitidas)
TIPOS: Dict[str, Tuple[str, Tuple[str, ...]]] = {
    "foto": (mongo.BUCKET_MEDIOS, ("jpg", "jpeg", "png", "webp")),
    "video": (mongo.BUCKET_MEDIOS, ("mp4", "webm", "mov")),
    "ficha_tecnica": (mongo.BUCKET_DOCUMENTOS, ("pdf",)),
    "comprobante_pago": (mongo.BUCKET_DOCUMENTOS, ("pdf", "jpg", "jpeg", "png")),
    "factura": (mongo.BUCKET_DOCUMENTOS, ("pdf", "jpg", "jpeg", "png")),
    "rut": (mongo.BUCKET_DOCUMENTOS, ("pdf", "jpg", "jpeg", "png")),
}

MIME_POR_EXTENSION = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp",
    "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime", "pdf": "application/pdf",
}

# Lotes cuyos medios y ficha técnica son públicos (los ve la landing sin sesión).
ESTADOS_LOTE_PUBLICOS = ("publicado", "reservado", "vendido")

TROZO = 1024 * 1024

# Un archivo que se sube y nunca se adjunta (formulario abandonado, foto quitada
# antes de enviar) no lo ve nadie: pasado este plazo se borra.
HORAS_ARCHIVO_SUELTO = 24
_ultima_limpieza: Optional[datetime] = None


class ArchivoInvalido(ValueError):
    """El archivo no es del tipo declarado o supera el tamaño permitido."""


class ArchivoDemasiadoGrande(ArchivoInvalido):
    pass


def _firma_valida(extension: str, cabecera: bytes) -> bool:
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


def _limite_bytes(db: Database, tipo: str) -> int:
    p = parametros.leer(db)
    if tipo == "foto":
        return int(p["mb_max_foto"]) * 1024 * 1024
    if tipo == "video":
        return int(p["mb_max_video"]) * 1024 * 1024
    return int(p["mb_max_documento"]) * 1024 * 1024


def subir(
    db: Database,
    *,
    tipo: str,
    nombre_original: str,
    contenido: BinaryIO,
    usuario: dict,
) -> Dict:
    """Vuelca el archivo a GridFS por trozos, sin cargarlo entero en memoria."""
    try:
        limpiar_huerfanos(db)
    except Exception:  # noqa: BLE001 - la limpieza nunca debe tumbar una subida
        pass
    if tipo not in TIPOS:
        raise ArchivoInvalido("Tipo de archivo no admitido")
    nombre_bucket, extensiones = TIPOS[tipo]
    nombre = Path(nombre_original or "archivo").name[:200] or "archivo"
    extension = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else ""
    if extension not in extensiones:
        raise ArchivoInvalido(f"Formato no admitido. Usa: {', '.join(extensiones)}")

    limite = _limite_bytes(db, tipo)
    primer_trozo = contenido.read(TROZO)
    if not primer_trozo:
        raise ArchivoInvalido("El archivo está vacío")
    if not _firma_valida(extension, primer_trozo[:16]):
        raise ArchivoInvalido("El contenido del archivo no corresponde a su formato")

    metadata = {
        "cuenta": cuenta_de(usuario),
        "subido_por": usuario["user_id"],
        "tipo": tipo,
        "nombre_original": nombre,
        "content_type": MIME_POR_EXTENSION[extension],
        "lote_id": None,
        "operacion_id": None,
        "subido_en": datetime.utcnow(),
    }
    bucket = mongo.bucket(db, nombre_bucket)
    flujo = bucket.open_upload_stream(nombre, metadata=metadata)
    tamano = 0
    try:
        trozo = primer_trozo
        while trozo:
            tamano += len(trozo)
            if tamano > limite:
                raise ArchivoDemasiadoGrande(f"El archivo supera el máximo de {limite // (1024 * 1024)} MB")
            flujo.write(trozo)
            trozo = contenido.read(TROZO)
        flujo.close()
    except Exception:
        # abort() borra los trozos ya escritos: sin esto quedarían huérfanos.
        flujo.abort()
        raise

    return a_dict(nombre_bucket, flujo._id, metadata, tamano)


def a_dict(nombre_bucket: str, archivo_id, metadata: Dict, tamano: int) -> Dict:
    return {
        "id": str(archivo_id),
        "bucket": nombre_bucket,
        "tipo": metadata.get("tipo"),
        "nombre": metadata.get("nombre_original"),
        "content_type": metadata.get("content_type"),
        "tamano": tamano,
        "url": url_de(nombre_bucket, archivo_id),
    }


def url_de(nombre_bucket: str, archivo_id) -> str:
    return f"/liquidaciones/archivos/{nombre_bucket}/{archivo_id}"


def _oid(archivo_id: str) -> Optional[ObjectId]:
    try:
        return ObjectId(str(archivo_id))
    except (InvalidId, TypeError):
        return None


def buscar(db: Database, nombre_bucket: str, archivo_id: str) -> Optional[Dict]:
    oid = _oid(archivo_id)
    if oid is None or nombre_bucket not in mongo.BUCKETS:
        return None
    return db[f"{nombre_bucket}.files"].find_one({"_id": oid})


def info(db: Database, nombre_bucket: str, archivo_id: str) -> Optional[Dict]:
    fila = buscar(db, nombre_bucket, archivo_id)
    if not fila:
        return None
    return a_dict(nombre_bucket, fila["_id"], fila.get("metadata") or {}, fila.get("length", 0))


def reclamar(
    db: Database,
    *,
    ids: list,
    tipo: str,
    cuenta: str,
    lote_id: Optional[str] = None,
    operacion_id: Optional[str] = None,
) -> List[Dict]:
    """Liga archivos sueltos de la cuenta a un lote o a una operación.

    Solo admite archivos que subió esa misma cuenta, del tipo esperado y que no
    estén ligados a otra cosa: así nadie adjunta el archivo de otro adivinando su id.
    Verifica todos antes de ligar ninguno, para que un archivo inválido no deje
    los demás atados a una publicación que no se creó.
    """
    filas = verificar(db, ids=ids, tipo=tipo, cuenta=cuenta, lote_id=lote_id, operacion_id=operacion_id)
    if filas:
        db[f"{TIPOS[tipo][0]}.files"].update_many(
            {"_id": {"$in": [fila["_id"] for fila in filas]}},
            {"$set": {"metadata.lote_id": lote_id, "metadata.operacion_id": operacion_id}},
        )
    return [{"id": str(fila["_id"]), "nombre": fila["metadata"].get("nombre_original"),
             "content_type": fila["metadata"].get("content_type"), "tamano": fila.get("length", 0)}
            for fila in filas]


def verificar(
    db: Database,
    *,
    ids: list,
    tipo: str,
    cuenta: str,
    lote_id: Optional[str] = None,
    operacion_id: Optional[str] = None,
) -> List[Dict]:
    """Comprueba, sin modificar nada, que `reclamar` aceptaría esos archivos."""
    coleccion = db[f"{TIPOS[tipo][0]}.files"]
    filas = []
    for archivo_id in ids:
        oid = _oid(archivo_id)
        fila = coleccion.find_one({"_id": oid}) if oid else None
        meta = (fila or {}).get("metadata") or {}
        if not fila or meta.get("cuenta") != cuenta or meta.get("tipo") != tipo:
            raise ArchivoInvalido("Uno de los archivos no existe o no es tuyo")
        ligado_a = meta.get("lote_id") or meta.get("operacion_id")
        if ligado_a and ligado_a not in (lote_id, operacion_id):
            raise ArchivoInvalido("Uno de los archivos ya está adjunto a otra publicación")
        filas.append(fila)
    return filas


def ref_documento(referencia) -> Optional[Dict]:
    """Referencia guardada en un lote u operación, lista para el cliente."""
    if not referencia:
        return None
    if isinstance(referencia, str):
        referencia = {"id": referencia}
    return {**referencia, "url": url_de(mongo.BUCKET_DOCUMENTOS, referencia["id"])}


def borrar(db: Database, nombre_bucket: str, ids) -> None:
    bucket = mongo.bucket(db, nombre_bucket)
    for archivo_id in ids:
        oid = _oid(archivo_id)
        if oid is None:
            continue
        try:
            bucket.delete(oid)
        except NoFile:
            pass


def limpiar_huerfanos(db: Database, *, ahora: Optional[datetime] = None, forzar: bool = False) -> int:
    """Borra los archivos sueltos de más de `HORAS_ARCHIVO_SUELTO` y los ligados a
    un lote que no existe. Sin tarea programada: se llama al subir y corre como
    mucho una vez por hora en cada proceso. Devuelve cuántos borró."""
    global _ultima_limpieza
    ahora = ahora or datetime.utcnow()
    if not forzar and _ultima_limpieza and ahora - _ultima_limpieza < timedelta(hours=1):
        return 0
    _ultima_limpieza = ahora
    limite = ahora - timedelta(hours=HORAS_ARCHIVO_SUELTO)
    # El RUT queda suelto a propósito (no es de un lote ni de una operación).
    ruts = {str((a.get("rut") or {}).get("id")) for a in db.activaciones.find({}, {"rut.id": 1})}
    borrados = 0
    for nombre_bucket in (mongo.BUCKET_MEDIOS, mongo.BUCKET_DOCUMENTOS):
        candidatos = []
        filas = db[f"{nombre_bucket}.files"].find(
            {"uploadDate": {"$lt": limite}, "metadata.operacion_id": None}, {"metadata": 1}).limit(500)
        for fila in filas:
            meta = fila.get("metadata") or {}
            if meta.get("lote_id"):
                if db.lotes.find_one({"_id": meta["lote_id"]}, {"_id": 1}):
                    continue
            elif meta.get("tipo") == "rut" and str(fila["_id"]) in ruts:
                continue
            candidatos.append(fila["_id"])
        borrar(db, nombre_bucket, candidatos)
        borrados += len(candidatos)
    return borrados


def puede_ver(db: Database, fila: Dict, usuario: Optional[dict]) -> bool:
    meta = fila.get("metadata") or {}
    if usuario and es_equipo(usuario):
        return True
    if usuario and meta.get("cuenta") == cuenta_de(usuario):
        return True

    tipo = meta.get("tipo")
    if tipo in ("foto", "video", "ficha_tecnica") and meta.get("lote_id"):
        lote = db.lotes.find_one({"_id": meta["lote_id"]}, {"estado": 1})
        return bool(lote and lote.get("estado") in ESTADOS_LOTE_PUBLICOS)

    if tipo in ("comprobante_pago", "factura") and meta.get("operacion_id") and usuario:
        operacion = db.operaciones.find_one(
            {"_id": meta["operacion_id"]}, {"cuenta_comprador": 1, "cuenta_vendedor": 1}
        )
        cuenta = cuenta_de(usuario)
        return bool(operacion and cuenta in (operacion.get("cuenta_comprador"), operacion.get("cuenta_vendedor")))

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


def leer_trozos(db: Database, nombre_bucket: str, archivo_id, inicio: int = 0, fin: Optional[int] = None) -> Iterator[bytes]:
    try:
        salida = mongo.bucket(db, nombre_bucket).open_download_stream(archivo_id)
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
