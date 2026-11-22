"""Archivos del módulo en GridFS: subida validada, descarga y acceso.

Un archivo nace suelto (con la cuenta que lo subió) y queda ligado cuando el
servicio lo adjunta a algo (el expediente de una maquiladora, por ahora). Lo
suelto que nadie adjunta en 24 h se borra (`limpiar_huerfanos`).

Quién ve qué:
- El equipo de Zarpi, todo.
- La cuenta dueña, lo suyo.
- La galería de trabajos y las fotos de los productos de marca blanca de una
  maquiladora verificada son públicas (vitrina).
- RUT, cámara de comercio y certificados: solo la maquiladora y el equipo.
- Lo de una solicitud (referencias, ficha técnica): el cliente y las maquiladoras a las que
  llegó (si es confidencial, solo las que aceptaron el acuerdo).
- Lo de un pedido o de un chat (muestras, evidencias, comprobantes, adjuntos): las dos partes.
- Lo de una marca o un encargo de diseño: el cliente dueño y el equipo de Diseño; la maquila,
  solo los archivos de la marca que el cliente adjuntó a una solicitud que le llegó.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import BinaryIO, Dict, Iterator, List, Optional, Tuple

from bson import ObjectId
from bson.errors import InvalidId
from gridfs.errors import NoFile
from pymongo.database import Database

from maquilas import db as mongo
from maquilas import parametros
from maquilas.identidad import cuenta_de, es_equipo
from utils import gridfs_archivos
from utils.gridfs_archivos import MIME_POR_EXTENSION, TROZO, rango  # noqa: F401 - el router usa `rango`

# tipo de archivo → (bucket, extensiones admitidas)
_IMAGENES = ("jpg", "jpeg", "png", "webp")
_DOCUMENTOS = ("pdf", "jpg", "jpeg", "png")
TIPOS: Dict[str, Tuple[str, Tuple[str, ...]]] = {
    # Expediente de la maquiladora
    "foto": (mongo.BUCKET_MEDIOS, _IMAGENES),
    "rut": (mongo.BUCKET_DOCUMENTOS, _DOCUMENTOS),
    "camara_comercio": (mongo.BUCKET_DOCUMENTOS, _DOCUMENTOS),
    "certificado": (mongo.BUCKET_DOCUMENTOS, _DOCUMENTOS),
    # Solicitud del cliente
    "referencia": (mongo.BUCKET_MEDIOS, _IMAGENES),
    "ficha_tecnica": (mongo.BUCKET_DOCUMENTOS, ("pdf",)),
    # Pedido
    "muestra": (mongo.BUCKET_MEDIOS, _IMAGENES + ("mp4", "webm", "mov")),
    "evidencia": (mongo.BUCKET_MEDIOS, _IMAGENES),
    "comprobante": (mongo.BUCKET_DOCUMENTOS, _DOCUMENTOS),
    # Chat
    "adjunto": (mongo.BUCKET_DOCUMENTOS, _DOCUMENTOS),
    # Catálogo de marca blanca
    "producto": (mongo.BUCKET_MEDIOS, _IMAGENES),
    # Estudio de marca: logo, archivos de la marca (etiquetas, empaques, manual) y entregas del diseñador
    "marca": (mongo.BUCKET_MEDIOS, _IMAGENES),
    "marca_archivo": (mongo.BUCKET_DOCUMENTOS, _DOCUMENTOS),
    "diseno": (mongo.BUCKET_DOCUMENTOS, _DOCUMENTOS),
}
TIPOS_EXPEDIENTE = ("rut", "camara_comercio", "certificado", "foto")
# Qué sube cada lado.
TIPOS_MAQUILADORA = TIPOS_EXPEDIENTE + ("muestra", "evidencia", "adjunto", "producto")
# Vitrina: públicos si la maquiladora está verificada.
TIPOS_VITRINA = ("foto", "producto")
TIPOS_CLIENTE = ("referencia", "ficha_tecnica", "comprobante", "adjunto", "marca", "marca_archivo")
TIPOS_DISENO = ("diseno",)

HORAS_ARCHIVO_SUELTO = 24
_ultima_limpieza: Optional[datetime] = None


class ArchivoInvalido(ValueError):
    """El archivo no es del tipo declarado o supera el tamaño permitido."""


class ArchivoDemasiadoGrande(ArchivoInvalido):
    pass


def _limite_bytes(db: Database, tipo: str, extension: str = "") -> int:
    p = parametros.leer(db)
    if extension in ("mp4", "webm", "mov"):
        return int(p["mb_max_video"]) * 1024 * 1024
    if TIPOS.get(tipo, ("",))[0] == mongo.BUCKET_MEDIOS:
        return int(p["mb_max_foto"]) * 1024 * 1024
    return int(p["mb_max_documento"]) * 1024 * 1024


def subir(db: Database, *, tipo: str, nombre_original: str, contenido: BinaryIO, usuario: dict) -> Dict:
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

    limite = _limite_bytes(db, tipo, extension)
    primer_trozo = contenido.read(TROZO)
    if not primer_trozo:
        raise ArchivoInvalido("El archivo está vacío")
    if not gridfs_archivos.firma_valida(extension, primer_trozo[:16]):
        raise ArchivoInvalido("El contenido del archivo no corresponde a su formato")

    metadata = {
        "cuenta": cuenta_de(db, usuario),
        "subido_por": usuario["user_id"],
        "tipo": tipo,
        "nombre_original": nombre,
        "content_type": MIME_POR_EXTENSION[extension],
        "ligado": False,
        "subido_en": datetime.utcnow(),
    }
    flujo = mongo.bucket(db, nombre_bucket).open_upload_stream(nombre, metadata=metadata)
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


def guardar_generado(db: Database, *, tipo: str, nombre: str, contenido: bytes, usuario: dict, cuenta: str,
                     contexto: Dict) -> Dict:
    """Guarda un archivo que genera el sistema (p. ej. el PDF de la ficha técnica), ya ligado."""
    nombre_bucket = TIPOS[tipo][0]
    extension = nombre.rsplit(".", 1)[-1].lower()
    metadata = {
        "cuenta": cuenta,
        "subido_por": usuario["user_id"],
        "tipo": tipo,
        "nombre_original": nombre[:200],
        "content_type": MIME_POR_EXTENSION[extension],
        "ligado": True,
        "contexto": contexto,
        "generado": True,
        "subido_en": datetime.utcnow(),
    }
    archivo_id = mongo.bucket(db, nombre_bucket).upload_from_stream(nombre[:200], contenido, metadata=metadata)
    return ref(nombre_bucket, {"_id": archivo_id, "metadata": metadata, "length": len(contenido)})


def url_de(nombre_bucket: str, archivo_id) -> str:
    return f"/maquilas/archivos/{nombre_bucket}/{archivo_id}"


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


def _oid(archivo_id) -> Optional[ObjectId]:
    try:
        return ObjectId(str(archivo_id))
    except (InvalidId, TypeError):
        return None


def buscar(db: Database, nombre_bucket: str, archivo_id: str) -> Optional[Dict]:
    oid = _oid(archivo_id)
    if oid is None or nombre_bucket not in mongo.BUCKETS:
        return None
    return db[f"{nombre_bucket}.files"].find_one({"_id": oid})


def ligar(db: Database, *, ids: List[str], tipo: str, cuenta: str, contexto: Optional[Dict] = None) -> List[Dict]:
    """Adjunta archivos sueltos de la cuenta y devuelve sus referencias.

    Solo acepta archivos que subió esa misma cuenta y del tipo esperado: nadie
    adjunta el archivo de otro adivinando su id. Verifica todos antes de ligar.
    `contexto` dice a qué quedan ligados (`solicitud_id`, `pedido_id` o `hilo`), y
    con eso se decide quién más los puede ver.
    """
    coleccion = db[f"{TIPOS[tipo][0]}.files"]
    filas = []
    for archivo_id in ids:
        oid = _oid(archivo_id)
        fila = coleccion.find_one({"_id": oid}) if oid else None
        meta = (fila or {}).get("metadata") or {}
        if not fila or meta.get("cuenta") != cuenta or meta.get("tipo") != tipo:
            raise ArchivoInvalido("Uno de los archivos no existe o no es tuyo")
        if meta.get("ligado") and contexto and meta.get("contexto") and meta.get("contexto") != contexto:
            raise ArchivoInvalido("Uno de los archivos ya está adjunto a otra cosa")
        filas.append(fila)
    if filas:
        cambios = {"metadata.ligado": True}
        if contexto:
            cambios["metadata.contexto"] = contexto
        coleccion.update_many({"_id": {"$in": [f["_id"] for f in filas]}}, {"$set": cambios})
    return [ref(TIPOS[tipo][0], f) for f in filas]


def ref(nombre_bucket: str, fila: Dict) -> Dict:
    meta = fila.get("metadata") or {}
    return {"id": str(fila["_id"]), "bucket": nombre_bucket, "nombre": meta.get("nombre_original"),
            "content_type": meta.get("content_type"), "tamano": fila.get("length", 0)}


def con_url(referencia: Optional[Dict]) -> Optional[Dict]:
    if not referencia:
        return None
    return {**referencia, "url": url_de(referencia.get("bucket") or mongo.BUCKET_DOCUMENTOS, referencia["id"])}


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
    """Borra lo que se subió y nunca se adjuntó. Sin tarea programada: corre al
    subir, como mucho una vez por hora en cada proceso. Devuelve cuántos borró."""
    global _ultima_limpieza
    ahora = ahora or datetime.utcnow()
    if not forzar and _ultima_limpieza and ahora - _ultima_limpieza < timedelta(hours=1):
        return 0
    _ultima_limpieza = ahora
    limite = ahora - timedelta(hours=HORAS_ARCHIVO_SUELTO)
    borrados = 0
    for nombre_bucket in mongo.BUCKETS:
        ids = [f["_id"] for f in db[f"{nombre_bucket}.files"].find(
            {"uploadDate": {"$lt": limite}, "metadata.ligado": False}, {"_id": 1}).limit(500)]
        borrar(db, nombre_bucket, ids)
        borrados += len(ids)
    return borrados


def puede_ver(db: Database, fila: Dict, usuario: Optional[dict]) -> bool:
    meta = fila.get("metadata") or {}
    if es_equipo(usuario):
        return True
    if usuario and usuario.get("rol") and meta.get("cuenta"):
        try:
            if meta["cuenta"] == cuenta_de(db, usuario):
                return True
        except Exception:  # noqa: BLE001 - una maquiladora sin vínculo simplemente no es dueña
            pass
    # La galería y el catálogo de una maquiladora verificada son su vitrina pública.
    if meta.get("tipo") in TIPOS_VITRINA and meta.get("ligado") and str(meta.get("cuenta", "")).startswith("maquiladora:"):
        maquiladora_id = meta["cuenta"].split(":", 1)[1]
        return db.maquiladoras.count_documents({"_id": maquiladora_id, "estado": "verificada"}, limit=1) > 0
    contexto = meta.get("contexto") or {}
    if not usuario or not contexto:
        return False
    from maquilas import acceso  # aquí para no crear un import circular

    if contexto.get("marca_id") or contexto.get("encargo_id"):
        return _puede_ver_de_marca(db, fila, contexto, usuario)

    if contexto.get("solicitud_id"):
        solicitud = db.solicitudes.find_one({"_id": contexto["solicitud_id"]})
        return bool(solicitud) and acceso.puede_ver_detalle_solicitud(db, solicitud, usuario)
    if contexto.get("pedido_id"):
        pedido = db.pedidos.find_one({"_id": contexto["pedido_id"]})
        return bool(pedido) and acceso.es_parte_del_pedido(db, pedido, usuario)
    if contexto.get("hilo"):
        return acceso.puede_usar_hilo(db, contexto["hilo"], usuario)
    return False


def _puede_ver_de_marca(db: Database, fila: Dict, contexto: Dict, usuario: dict) -> bool:
    from maquilas import acceso
    from maquilas.identidad import es_disenador, es_maquiladora, maquiladora_id_de

    if es_disenador(usuario):
        return True
    cuenta = acceso.cuenta_cliente(usuario)
    if cuenta:
        if contexto.get("encargo_id"):
            return db.encargos.count_documents({"_id": contexto["encargo_id"], "cuenta_cliente": cuenta}, limit=1) > 0
        return db.marcas.count_documents({"_id": contexto["marca_id"], "cuenta_cliente": cuenta}, limit=1) > 0
    if es_maquiladora(usuario):
        # Solo lo que el cliente compartió al adjuntar su marca a una solicitud que le llegó.
        maquiladora_id = maquiladora_id_de(db, usuario)
        for solicitud in db.solicitudes.find({"marca.archivos_ids": str(fila["_id"]), "destinos.maquiladora_id": maquiladora_id}):
            if acceso.acuerdo_ok(solicitud, acceso.destino_de(solicitud, maquiladora_id)):
                return True
    return False


def leer_trozos(db: Database, nombre_bucket: str, archivo_id, inicio: int = 0, fin: Optional[int] = None) -> Iterator[bytes]:
    return gridfs_archivos.leer_trozos(mongo.bucket(db, nombre_bucket), archivo_id, inicio, fin)
