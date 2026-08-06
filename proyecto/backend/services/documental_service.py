import mimetypes
import os
import re
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
VIDEO_EXTENSIONS = {"mp4"}

DOCUMENTAL_URL_RE = re.compile(r"/documentos/archivos/([0-9a-fA-F-]{36})/descargar")


def infer_file_type(extension: str) -> str:
    ext = extension.lower().lstrip(".")
    if ext in DOC_EXTENSIONS:
        return "documento"
    if ext in IMAGE_EXTENSIONS:
        return "imagen"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Tipo de archivo no soportado. Permitidos: PDF, DOC, DOCX, PPTX, XLS, XLSX, TXT, PNG, JPG, JPEG, WEBP y MP4.",
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
    if mime_type:
        return mime_type
    guessed, _ = mimetypes.guess_type(f"{nombre}.{extension}")
    if guessed:
        return guessed
    if extension == "mp4":
        return "video/mp4"
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
        folder = (
            db.query(Carpeta)
            .filter(
                Carpeta.owner_user_id == owner_user_id,
                Carpeta.parent_id == parent_id,
                Carpeta.nombre == name,
                Carpeta.deleted_at.is_(None),
            )
            .first()
        )
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
