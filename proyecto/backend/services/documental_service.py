import mimetypes
import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.curso import Curso, EstadoCurso
from models.documental import Archivo, Carpeta, CursoRecurso

DOC_EXTENSIONS = {"pdf", "doc", "docx", "pptx", "xls", "xlsx", "txt"}
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
# Solo contenedores que un <video> reproduce de forma nativa: aceptar avi/mkv
# dejaría subir archivos que después no se pueden ver en el reproductor.
VIDEO_EXTENSIONS = {"mp4", "webm", "mov", "m4v"}
ALLOWED_EXTENSIONS = DOC_EXTENSIONS | IMAGE_EXTENSIONS | VIDEO_EXTENSIONS

DOCUMENTAL_URL_RE = re.compile(r"/documentos/archivos/([0-9a-fA-F-]{36})/descargar")

VIDEO_MIME_TYPES = {
    "mp4": "video/mp4",
    "webm": "video/webm",
    "mov": "video/quicktime",
    "m4v": "video/x-m4v",
}


def _normalize_folder_name(value: str) -> str:
    cleaned = unicodedata.normalize("NFKD", str(value or ""))
    cleaned = "".join(ch for ch in cleaned if not unicodedata.combining(ch))
    return " ".join(cleaned.strip().lower().split())


def infer_file_type(extension: str) -> str:
    ext = extension.lower().lstrip(".")
    if ext in DOC_EXTENSIONS:
        return "documento"
    if ext in IMAGE_EXTENSIONS:
        return "imagen"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    permitidas = ", ".join(sorted(ALLOWED_EXTENSIONS)).upper()
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Tipo de archivo no soportado ({ext or 'sin extensión'}). Permitidos: {permitidas}.",
    )


def infer_extension(nombre: str, extension: Optional[str] = None) -> str:
    if extension:
        ext = extension.lower().lstrip(".")
    else:
        _, ext_part = os.path.splitext(nombre)
        ext = ext_part.lower().lstrip(".")

    if not ext:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No se pudo determinar la extension del archivo")
    infer_file_type(ext)
    return ext


def infer_mime_type(nombre: str, extension: str, mime_type: Optional[str] = None) -> str:
    # En video la extensión manda: el navegador reporta mimes genéricos
    # (application/octet-stream) que luego impiden reproducir el archivo.
    if extension in VIDEO_MIME_TYPES:
        if mime_type and mime_type.lower().startswith("video/"):
            return mime_type
        return VIDEO_MIME_TYPES[extension]
    if mime_type:
        return mime_type
    guessed, _ = mimetypes.guess_type(f"{nombre}.{extension}")
    if guessed:
        return guessed
    if extension in {"jpg", "jpeg"}:
        return "image/jpeg"
    if extension == "png":
        return "image/png"
    if extension == "webp":
        return "image/webp"
    if extension == "pdf":
        return "application/pdf"
    return "application/octet-stream"


def create_document_file(
    db: Session,
    *,
    owner_user_id: str,
    nombre: str,
    carpeta_id: Optional[str],
    extension: Optional[str],
    mime_type: Optional[str],
    size_bytes: Optional[int],
    storage_url: Optional[str],
    storage_path: Optional[str],
    origen: str,
) -> Archivo:
    normalized_ext = infer_extension(nombre, extension)
    tipo_recurso = infer_file_type(normalized_ext)
    archivo = Archivo(
        id=str(uuid4()),
        owner_user_id=owner_user_id,
        carpeta_id=carpeta_id,
        nombre=nombre.strip(),
        extension=normalized_ext,
        mime_type=infer_mime_type(nombre, normalized_ext, mime_type),
        tipo_recurso=tipo_recurso,
        size_bytes=size_bytes,
        storage_url=storage_url,
        storage_path=storage_path,
        origen=origen,
    )
    db.add(archivo)
    db.flush()

    if not archivo.storage_url:
        archivo.storage_url = f"/documentos/archivos/{archivo.id}/descargar"

    return archivo


def carpeta_chat_de_usuario(db: Session, *, owner_user_id: str, conversacion_id: str) -> Optional[str]:
    """Carpeta `Chats/Conversacion-xxxxxxxx` del usuario en gestión documental."""
    return ensure_folder_path(
        db,
        owner_user_id=owner_user_id,
        segments=["Chats", f"Conversacion-{str(conversacion_id)[:8]}"],
    )


def clonar_archivo_para_chat(
    db: Session,
    *,
    archivo: Archivo,
    destinatario_id: str,
    conversacion_id: str,
) -> Archivo:
    """Copia un archivo a la carpeta de chat de un participante.

    El binario no se duplica (`storage_path` se comparte), pero `storage_url` se
    regenera a partir del id del clon: heredar la del original apuntaba la
    descarga a un archivo que solo el emisor podía leer, así que el destinatario
    recibía 403 al abrir el adjunto.

    Si el archivo vive en un almacenamiento externo (URL absoluta y sin ruta
    local) se conserva su URL, porque ahí no hay nada que servir por el endpoint
    de descarga.
    """
    externo = bool(archivo.storage_url) and str(archivo.storage_url).startswith("http") and not archivo.storage_path
    return create_document_file(
        db,
        owner_user_id=destinatario_id,
        nombre=archivo.nombre,
        carpeta_id=carpeta_chat_de_usuario(
            db, owner_user_id=destinatario_id, conversacion_id=conversacion_id
        ),
        extension=archivo.extension,
        mime_type=archivo.mime_type,
        size_bytes=archivo.size_bytes,
        storage_url=archivo.storage_url if externo else None,
        storage_path=archivo.storage_path,
        origen="chat",
    )


def ensure_file_not_linked_to_active_course(db: Session, archivo_id: str) -> None:
    relation = (
        db.query(CursoRecurso)
        .join(Curso, Curso.id == CursoRecurso.curso_id)
        .filter(
            CursoRecurso.archivo_id == archivo_id,
            CursoRecurso.deleted_at.is_(None),
            Curso.deleted_at.is_(None),
            Curso.estado.in_([EstadoCurso.publicado.value, EstadoCurso.borrador.value]),
        )
        .first()
    )
    if relation:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar/desvincular un recurso asociado a un curso activo o vigente.",
        )


def extract_document_file_id_from_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    match = DOCUMENTAL_URL_RE.search(value)
    if not match:
        return None
    return match.group(1)


def soft_delete_file(archivo: Archivo) -> None:
    archivo.deleted_at = datetime.utcnow()


def ensure_generated_docs_dir() -> Path:
    folder = Path(__file__).resolve().parent.parent / "generated_docs"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def ensure_folder_path(
    db: Session,
    *,
    owner_user_id: str,
    segments: list[str],
) -> Optional[str]:
    """Crea (si falta) y devuelve la carpeta final de una ruta jerárquica."""
    parent_id: Optional[str] = None
    for raw_name in segments:
        name = str(raw_name or "").strip()
        if not name:
            continue
        siblings = (
            db.query(Carpeta)
            .filter(
                Carpeta.owner_user_id == owner_user_id,
                Carpeta.parent_id == parent_id,
                Carpeta.deleted_at.is_(None),
            )
            .order_by(Carpeta.created_at.asc(), Carpeta.id.asc())
            .all()
        )
        normalized_target = _normalize_folder_name(name)
        folder = next((row for row in siblings if _normalize_folder_name(row.nombre) == normalized_target), None)
        if folder is None:
            folder = Carpeta(
                owner_user_id=owner_user_id,
                parent_id=parent_id,
                nombre=name,
            )
            db.add(folder)
            db.flush()
        parent_id = folder.id
    return parent_id
