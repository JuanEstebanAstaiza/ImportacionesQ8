import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urlparse
from uuid import UUID as PyUUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import String, and_, func, or_
from sqlalchemy.orm import Session

import config
from utils.security_middleware import MAX_UPLOAD_BYTES
from models.chat import ConversacionChat, MensajeChat
from models.curso import CompraCurso, Curso, EstadoCurso, LeccionCurso
from models.certificacion import Certificacion
from models.importador import Importador
from models.documental import (
    Archivo,
    ArchivoEtiqueta,
    Carpeta,
    CursoRecurso,
    Etiqueta,
    Favorito,
    MensajeAdjunto,
)
from schemas.documental import (
    ArchivoCreate,
    ArchivoItem,
    ArchivoUpdate,
    CarpetaCreate,
    CarpetaItem,
    CarpetaUpdate,
    ChatAttachmentItem,
    CompartirRecursosChatRequest,
    EtiquetaCreate,
    EtiquetaItem,
    ExplorerResponse,
    FavoritoToggle,
    ResourceTagAssign,
)
from services.documental_service import (
    clonar_archivo_para_chat,
    create_document_file,
    ensure_file_not_linked_to_active_course,
    infer_extension,
    soft_delete_file,
)
from utils.dependencies import get_current_user, get_db, get_optional_current_user

router = APIRouter(prefix="/documentos", tags=["Gestión Documental"])
BACKEND_ROOT = Path(__file__).resolve().parent.parent
LOCAL_STORAGE_ROOTS = [
    BACKEND_ROOT,
    BACKEND_ROOT / "generated_docs",
    BACKEND_ROOT / "uploads",
    BACKEND_ROOT / "media",
]
LOCAL_UPLOADS_DIR = BACKEND_ROOT / "uploads" / "documentos"


def _current_user_id(current_user: dict) -> str:
    try:
        return str(PyUUID(current_user["user_id"]))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario autenticado inválido") from exc


def _folder_owner_check(folder: Carpeta, user_id: str) -> None:
    if folder.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado sobre esta carpeta")


def _file_owner_check(file_row: Archivo, user_id: str) -> None:
    if file_row.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado sobre este archivo")


def _is_favorite_map(db: Session, user_id: str, recurso_tipo: str, ids: List[str]) -> Dict[str, bool]:
    if not ids:
        return {}
    rows = (
        db.query(Favorito)
        .filter(
            Favorito.owner_user_id == user_id,
            Favorito.recurso_tipo == recurso_tipo,
            Favorito.recurso_id.in_(ids),
            Favorito.deleted_at.is_(None),
        )
        .all()
    )
    return {row.recurso_id: True for row in rows}


def _tags_by_file(db: Session, file_ids: List[str]) -> Dict[str, List[EtiquetaItem]]:
    if not file_ids:
        return {}
    rows = (
        db.query(ArchivoEtiqueta, Etiqueta)
        .join(Etiqueta, Etiqueta.id == ArchivoEtiqueta.etiqueta_id)
        .filter(
            ArchivoEtiqueta.archivo_id.in_(file_ids),
            ArchivoEtiqueta.deleted_at.is_(None),
            Etiqueta.deleted_at.is_(None),
        )
        .all()
    )
    result: Dict[str, List[EtiquetaItem]] = {}
    for link, tag in rows:
        result.setdefault(link.archivo_id, []).append(EtiquetaItem.model_validate(tag))
    return result


def _to_archivo_items(db: Session, files: List[Archivo], user_id: str) -> List[ArchivoItem]:
    file_ids = [row.id for row in files]
    fav_map = _is_favorite_map(db, user_id, "archivo", file_ids)
    tag_map = _tags_by_file(db, file_ids)
    result = []
    for row in files:
        item = ArchivoItem.model_validate(row)
        item.favorito = fav_map.get(row.id, False)
        item.etiquetas = tag_map.get(row.id, [])
        result.append(item)
    return result


def _resolve_local_storage_path(file_row: Archivo) -> Optional[Path]:
    candidates: List[Path] = []

    if file_row.storage_path:
        declared = Path(file_row.storage_path)
        candidates.append(declared)
        if not declared.is_absolute():
            candidates.append(BACKEND_ROOT / declared)
        for root in LOCAL_STORAGE_ROOTS:
            candidates.append(root / declared.name)

    storage_url = (file_row.storage_url or "").strip()
    if storage_url and not storage_url.lower().startswith(("http://", "https://")):
        parsed = urlparse(storage_url)
        relative = (parsed.path or storage_url).lstrip("/\\")
        if relative:
            rel_path = Path(relative)
            candidates.append(BACKEND_ROOT / rel_path)
            for root in LOCAL_STORAGE_ROOTS:
                candidates.append(root / rel_path)
                candidates.append(root / rel_path.name)

    # Fallback pragmático: buscar por nombre actual del archivo.
    if file_row.nombre:
        for root in LOCAL_STORAGE_ROOTS:
            candidates.append(root / file_row.nombre)

    seen: set[str] = set()
    for path in candidates:
        try:
            resolved = path.resolve(strict=False)
        except Exception:
            continue
        key = str(resolved)
        if key in seen:
            continue
        seen.add(key)
        if resolved.exists() and resolved.is_file():
            return resolved
    return None


@router.get("/explorador", response_model=ExplorerResponse)
async def listar_explorador(
    parent_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)

    folders = (
        db.query(Carpeta)
        .filter(
            Carpeta.owner_user_id == user_id,
            Carpeta.parent_id == parent_id,
            Carpeta.deleted_at.is_(None),
        )
        .order_by(Carpeta.nombre.asc())
        .all()
    )
    files = (
        db.query(Archivo)
        .filter(
            Archivo.owner_user_id == user_id,
            Archivo.carpeta_id == parent_id,
            Archivo.deleted_at.is_(None),
        )
        .order_by(Archivo.nombre.asc())
        .all()
    )

    return ExplorerResponse(
        carpetas=[CarpetaItem.model_validate(folder) for folder in folders],
        archivos=_to_archivo_items(db, files, user_id),
    )


@router.post("/carpetas", response_model=CarpetaItem, status_code=status.HTTP_201_CREATED)
async def crear_carpeta(
    payload: CarpetaCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)

    if payload.parent_id:
        parent = db.query(Carpeta).filter(Carpeta.id == payload.parent_id, Carpeta.deleted_at.is_(None)).first()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carpeta padre no encontrada")
        _folder_owner_check(parent, user_id)

    folder = Carpeta(id=str(uuid4()), owner_user_id=user_id, parent_id=payload.parent_id, nombre=payload.nombre.strip())
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return CarpetaItem.model_validate(folder)


@router.patch("/carpetas/{carpeta_id}", response_model=CarpetaItem)
async def actualizar_carpeta(
    carpeta_id: str,
    payload: CarpetaUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)
    folder = db.query(Carpeta).filter(Carpeta.id == carpeta_id, Carpeta.deleted_at.is_(None)).first()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carpeta no encontrada")
    _folder_owner_check(folder, user_id)

    provided_fields = payload.model_fields_set

    if payload.nombre is not None:
        folder.nombre = payload.nombre.strip()
    if "parent_id" in provided_fields:
        if payload.parent_id == carpeta_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Una carpeta no puede ser su propio padre")
        if payload.parent_id:
            parent = db.query(Carpeta).filter(Carpeta.id == payload.parent_id, Carpeta.deleted_at.is_(None)).first()
            if not parent:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carpeta destino no encontrada")
            _folder_owner_check(parent, user_id)
        folder.parent_id = payload.parent_id

    db.commit()
    db.refresh(folder)
    return CarpetaItem.model_validate(folder)


@router.delete("/carpetas/{carpeta_id}", response_model=dict)
async def eliminar_carpeta(
    carpeta_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)
    folder = db.query(Carpeta).filter(Carpeta.id == carpeta_id, Carpeta.deleted_at.is_(None)).first()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carpeta no encontrada")
    _folder_owner_check(folder, user_id)

    now = datetime.utcnow()
    folder.deleted_at = now
    db.query(Archivo).filter(Archivo.carpeta_id == carpeta_id, Archivo.deleted_at.is_(None)).update(
        {Archivo.deleted_at: now}, synchronize_session=False
    )
    db.commit()
    return {"success": True}


@router.post("/archivos", response_model=ArchivoItem, status_code=status.HTTP_201_CREATED)
async def crear_archivo(
    payload: ArchivoCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)

    if payload.carpeta_id:
        folder = db.query(Carpeta).filter(Carpeta.id == payload.carpeta_id, Carpeta.deleted_at.is_(None)).first()
        if not folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carpeta no encontrada")
        _folder_owner_check(folder, user_id)

    file_row = create_document_file(
        db,
        owner_user_id=user_id,
        nombre=payload.nombre,
        carpeta_id=payload.carpeta_id,
        extension=payload.extension,
        mime_type=payload.mime_type,
        size_bytes=payload.size_bytes,
        storage_url=payload.storage_url,
        storage_path=None,
        origen=payload.origen,
    )
    db.commit()
    db.refresh(file_row)
    return _to_archivo_items(db, [file_row], user_id)[0]


@router.post("/archivos/upload", response_model=ArchivoItem, status_code=status.HTTP_201_CREATED)
async def subir_archivo(
    archivo: UploadFile = File(...),
    carpeta_id: Optional[str] = Form(default=None),
    origen: str = Form(default="manual"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)

    if carpeta_id:
        folder = db.query(Carpeta).filter(Carpeta.id == carpeta_id, Carpeta.deleted_at.is_(None)).first()
        if not folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carpeta no encontrada")
        _folder_owner_check(folder, user_id)

    original_name = Path(archivo.filename or "archivo").name
    if not original_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nombre de archivo inválido")

    # Se valida la extensión antes de tocar disco: si el formato no está
    # soportado, escribir primero dejaba el binario huérfano en uploads/ sin
    # ninguna fila en base de datos que lo respaldara.
    extension = infer_extension(original_name)

    # Se vuelca por trozos y no con `await archivo.read()`: un vídeo de curso
    # puede pesar cientos de MB y cargarlo entero en memoria multiplicaba ese
    # peso por cada worker que estuviera recibiendo una subida a la vez.
    LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4()}_{original_name}"
    storage_path = LOCAL_UPLOADS_DIR / stored_name

    size_bytes = 0
    try:
        with storage_path.open("wb") as destino:
            while trozo := await archivo.read(1024 * 1024):
                size_bytes += len(trozo)
                # El middleware ya corta por `Content-Length`, pero esa cabecera
                # puede faltar (transfer-encoding: chunked) o mentir: el tope se
                # vuelve a comprobar sobre lo que realmente llega.
                if size_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=(
                            f"El archivo supera el máximo de "
                            f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
                        ),
                    )
                destino.write(trozo)
    except Exception:
        # Sin esto, un archivo rechazado a mitad de subida dejaba su binario
        # huérfano en uploads/ sin ninguna fila que lo respaldara.
        storage_path.unlink(missing_ok=True)
        raise

    file_row = create_document_file(
        db,
        owner_user_id=user_id,
        nombre=original_name,
        carpeta_id=carpeta_id,
        extension=extension,
        mime_type=archivo.content_type or None,
        size_bytes=size_bytes,
        storage_url=None,
        storage_path=str(storage_path.relative_to(BACKEND_ROOT)),
        origen=origen,
    )

    db.commit()
    db.refresh(file_row)
    return _to_archivo_items(db, [file_row], user_id)[0]


@router.patch("/archivos/{archivo_id}", response_model=ArchivoItem)
async def actualizar_archivo(
    archivo_id: str,
    payload: ArchivoUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)
    file_row = db.query(Archivo).filter(Archivo.id == archivo_id, Archivo.deleted_at.is_(None)).first()
    if not file_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    _file_owner_check(file_row, user_id)

    provided_fields = payload.model_fields_set

    if payload.nombre is not None:
        file_row.nombre = payload.nombre.strip()
    if "carpeta_id" in provided_fields:
        if payload.carpeta_id:
            folder = db.query(Carpeta).filter(Carpeta.id == payload.carpeta_id, Carpeta.deleted_at.is_(None)).first()
            if not folder:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carpeta destino no encontrada")
            _folder_owner_check(folder, user_id)
        file_row.carpeta_id = payload.carpeta_id

    db.commit()
    db.refresh(file_row)
    return _to_archivo_items(db, [file_row], user_id)[0]


@router.delete("/archivos/{archivo_id}", response_model=dict)
async def eliminar_archivo(
    archivo_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)
    file_row = db.query(Archivo).filter(Archivo.id == archivo_id, Archivo.deleted_at.is_(None)).first()
    if not file_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    _file_owner_check(file_row, user_id)

    ensure_file_not_linked_to_active_course(db, archivo_id)
    soft_delete_file(file_row)
    db.commit()
    return {"success": True}


@router.post("/etiquetas", response_model=EtiquetaItem, status_code=status.HTTP_201_CREATED)
async def crear_etiqueta(
    payload: EtiquetaCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)

    existing = (
        db.query(Etiqueta)
        .filter(Etiqueta.owner_user_id == user_id, Etiqueta.nombre == payload.nombre.strip(), Etiqueta.deleted_at.is_(None))
        .first()
    )
    if existing:
        return EtiquetaItem.model_validate(existing)

    tag = Etiqueta(id=str(uuid4()), owner_user_id=user_id, nombre=payload.nombre.strip(), color=payload.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return EtiquetaItem.model_validate(tag)


@router.put("/archivos/{archivo_id}/etiquetas", response_model=List[EtiquetaItem])
async def asignar_etiquetas_archivo(
    archivo_id: str,
    payload: ResourceTagAssign,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)
    file_row = db.query(Archivo).filter(Archivo.id == archivo_id, Archivo.deleted_at.is_(None)).first()
    if not file_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    _file_owner_check(file_row, user_id)

    db.query(ArchivoEtiqueta).filter(ArchivoEtiqueta.archivo_id == archivo_id, ArchivoEtiqueta.deleted_at.is_(None)).update(
        {ArchivoEtiqueta.deleted_at: datetime.utcnow()}, synchronize_session=False
    )

    if payload.etiqueta_ids:
        tags = (
            db.query(Etiqueta)
            .filter(
                Etiqueta.id.in_(payload.etiqueta_ids),
                Etiqueta.owner_user_id == user_id,
                Etiqueta.deleted_at.is_(None),
            )
            .all()
        )
        tag_ids = {tag.id for tag in tags}
        missing = [tag_id for tag_id in payload.etiqueta_ids if tag_id not in tag_ids]
        if missing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Etiquetas no encontradas: {', '.join(missing)}")

        for tag_id in payload.etiqueta_ids:
            db.add(ArchivoEtiqueta(id=str(uuid4()), archivo_id=archivo_id, etiqueta_id=tag_id))

    db.commit()
    tags_resp = _tags_by_file(db, [archivo_id]).get(archivo_id, [])
    return tags_resp


@router.put("/favoritos", response_model=dict)
async def toggle_favorito(
    payload: FavoritoToggle,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)

    if payload.recurso_tipo == "archivo":
        file_row = db.query(Archivo).filter(Archivo.id == payload.recurso_id, Archivo.deleted_at.is_(None)).first()
        if not file_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
        _file_owner_check(file_row, user_id)
    else:
        folder = db.query(Carpeta).filter(Carpeta.id == payload.recurso_id, Carpeta.deleted_at.is_(None)).first()
        if not folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carpeta no encontrada")
        _folder_owner_check(folder, user_id)

    favorite = (
        db.query(Favorito)
        .filter(
            Favorito.owner_user_id == user_id,
            Favorito.recurso_tipo == payload.recurso_tipo,
            Favorito.recurso_id == payload.recurso_id,
        )
        .first()
    )

    if payload.activo:
        if favorite:
            favorite.deleted_at = None
        else:
            db.add(
                Favorito(
                    id=str(uuid4()),
                    owner_user_id=user_id,
                    recurso_tipo=payload.recurso_tipo,
                    recurso_id=payload.recurso_id,
                )
            )
    else:
        if favorite:
            favorite.deleted_at = datetime.utcnow()

    db.commit()
    return {"success": True}


@router.get("/buscar", response_model=List[ArchivoItem])
async def buscar_archivos(
    q: Optional[str] = Query(default=None),
    tipo_recurso: Optional[str] = Query(default=None),
    etiqueta_ids: Optional[List[str]] = Query(default=None),
    favorito: Optional[bool] = Query(default=None),
    fecha_desde: Optional[datetime] = Query(default=None),
    fecha_hasta: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)

    query = db.query(Archivo).filter(Archivo.owner_user_id == user_id, Archivo.deleted_at.is_(None))

    if q:
        query = query.filter(Archivo.nombre.ilike(f"%{q.strip()}%"))
    if tipo_recurso:
        query = query.filter(Archivo.tipo_recurso == tipo_recurso)
    if fecha_desde:
        query = query.filter(Archivo.created_at >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Archivo.created_at <= fecha_hasta)

    if etiqueta_ids:
        query = query.join(ArchivoEtiqueta, and_(ArchivoEtiqueta.archivo_id == Archivo.id, ArchivoEtiqueta.deleted_at.is_(None)))
        query = query.filter(ArchivoEtiqueta.etiqueta_id.in_(etiqueta_ids))

    files = query.order_by(Archivo.updated_at.desc()).all()
    items = _to_archivo_items(db, files, user_id)

    if favorito is not None:
        items = [item for item in items if item.favorito == favorito]

    return items


def _can_access_chat(conversation: ConversacionChat, current_user: dict) -> bool:
    uid = current_user.get("user_id")
    role = current_user.get("rol")
    if role == "solicitante":
        return conversation.solicitante_id == uid
    if role in ("importador", "asesor"):
        return conversation.importador_usuario_id == uid
    return role == "admin"


@router.post("/compartir-chat", response_model=dict)
async def compartir_recursos_chat(
    payload: CompartirRecursosChatRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _current_user_id(current_user)

    files = (
        db.query(Archivo)
        .filter(
            Archivo.id.in_(payload.archivo_ids),
            Archivo.owner_user_id == user_id,
            Archivo.deleted_at.is_(None),
        )
        .all()
    )
    if len(files) != len(set(payload.archivo_ids)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uno o más archivos no existen o no están disponibles")

    sent_messages = 0
    for conversation_id in payload.conversacion_ids:
        conversation = db.query(ConversacionChat).filter(ConversacionChat.id == conversation_id).first()
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Conversación no encontrada: {conversation_id}")
        if not _can_access_chat(conversation, current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para compartir en una de las conversaciones")

        message_text = payload.mensaje or "Recursos compartidos desde gestión documental"
        message = MensajeChat(
            id=str(uuid4()),
            conversacion_id=conversation_id,
            remitente_id=user_id,
            contenido=message_text,
            tipo="archivo",
            metadata_json={
                "archivo_ids": payload.archivo_ids,
            },
        )
        db.add(message)
        db.flush()

        # Una copia por participante: cada uno la ve en su propia gestión
        # documental y queda autorizado a descargarla vía `MensajeAdjunto`.
        destinatarios = {conversation.solicitante_id, conversation.importador_usuario_id}
        destinatarios.add(user_id)

        for file_row in files:
            for destinatario_id in destinatarios:
                cloned = clonar_archivo_para_chat(
                    db,
                    archivo=file_row,
                    destinatario_id=destinatario_id,
                    conversacion_id=conversation_id,
                )
                db.add(MensajeAdjunto(id=str(uuid4()), mensaje_id=message.id, archivo_id=cloned.id))

        if config.redis_client:
            try:
                config.redis_client.publish(
                    f"chat:{conversation_id}",
                    json.dumps(
                        {
                            "id": message.id,
                            "conversacion_id": conversation_id,
                            "remitente_id": user_id,
                            "contenido": message_text,
                            "tipo": "archivo",
                            "metadata": {"archivo_ids": payload.archivo_ids},
                            "fecha_envio": datetime.utcnow().isoformat(),
                        }
                    ),
                )
            except Exception:
                pass
        sent_messages += 1

    db.commit()
    return {"success": True, "mensajes_creados": sent_messages}


@router.get("/chats/{conversacion_id}/adjuntos", response_model=List[ChatAttachmentItem])
async def listar_adjuntos_chat(
    conversacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    conversation = db.query(ConversacionChat).filter(ConversacionChat.id == conversacion_id).first()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada")
    if not _can_access_chat(conversation, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    rows = (
        db.query(MensajeAdjunto, MensajeChat, Archivo)
        .join(MensajeChat, MensajeChat.id == MensajeAdjunto.mensaje_id)
        .join(Archivo, Archivo.id == MensajeAdjunto.archivo_id)
        .filter(
            MensajeChat.conversacion_id == conversacion_id,
            MensajeAdjunto.deleted_at.is_(None),
            Archivo.deleted_at.is_(None),
        )
        .order_by(MensajeChat.fecha_envio.desc())
        .all()
    )

    # Cada adjunto se guarda una vez por participante (así aparece en la gestión
    # documental de ambos). Aquí se colapsa a una sola tarjeta por archivo,
    # prefiriendo la copia del propio usuario; los adjuntos antiguos, clonados
    # solo para el emisor, siguen visibles gracias al fallback.
    user_id = _current_user_id(current_user)
    elegidos: Dict[tuple, Archivo] = {}
    fechas: Dict[tuple, datetime] = {}
    for link, message, file_row in rows:
        clave = (message.id, file_row.nombre, file_row.size_bytes)
        actual = elegidos.get(clave)
        if actual is None or (actual.owner_user_id != user_id and file_row.owner_user_id == user_id):
            elegidos[clave] = file_row
            fechas[clave] = message.fecha_envio

    items = []
    for clave, file_row in elegidos.items():
        mensaje_id = clave[0]
        items.append(
            ChatAttachmentItem(
                archivo_id=file_row.id,
                mensaje_id=mensaje_id,
                conversacion_id=conversacion_id,
                nombre=file_row.nombre,
                mime_type=file_row.mime_type,
                extension=file_row.extension,
                tipo_recurso=file_row.tipo_recurso,
                size_bytes=file_row.size_bytes,
                # URL canónica del archivo que este usuario sí puede descargar.
                storage_url=f"/documentos/archivos/{file_row.id}/descargar",
                created_at=fechas[clave],
            )
        )
    return items


def _es_adjunto_de_chat_del_usuario(db: Session, archivo_id: str, user_id: str) -> bool:
    linked = (
        db.query(MensajeAdjunto)
        .join(MensajeChat, MensajeChat.id == MensajeAdjunto.mensaje_id)
        .join(ConversacionChat, ConversacionChat.id == MensajeChat.conversacion_id)
        .filter(
            MensajeAdjunto.archivo_id == archivo_id,
            MensajeAdjunto.deleted_at.is_(None),
            or_(
                ConversacionChat.solicitante_id == user_id,
                ConversacionChat.importador_usuario_id == user_id,
            ),
        )
        .first()
    )
    return linked is not None


def _es_recurso_publico_de_curso(db: Session, archivo_id: str) -> bool:
    """Portada del curso y media de lecciones marcadas como vista previa.

    Es exactamente lo que `GET /cursos/{id_o_slug}` ya entrega sin sesión, así
    que servirlo sin token no expone nada nuevo: sin esto la portada del
    catálogo y el tráiler del curso respondían 401 y no se veían.
    """
    fila = (
        db.query(CursoRecurso.id)
        .join(Curso, Curso.id == CursoRecurso.curso_id)
        .outerjoin(LeccionCurso, LeccionCurso.id == CursoRecurso.leccion_id)
        .filter(
            CursoRecurso.archivo_id == archivo_id,
            CursoRecurso.deleted_at.is_(None),
            Curso.deleted_at.is_(None),
            Curso.estado == EstadoCurso.publicado.value,
            or_(
                CursoRecurso.leccion_id.is_(None),
                LeccionCurso.es_preview.is_(True),
            ),
        )
        .first()
    )
    if fila is not None:
        return True

    # Cursos publicados antes de que las portadas se vincularan como recurso:
    # se reconocen por la propia `portada_url` para no dejarlos sin imagen.
    try:
        PyUUID(archivo_id)
    except ValueError:
        return False

    portada = (
        db.query(Curso.id)
        .filter(
            Curso.deleted_at.is_(None),
            Curso.estado == EstadoCurso.publicado.value,
            Curso.portada_url.like(f"%/{archivo_id}/%"),
        )
        .first()
    )
    return portada is not None


def _es_imagen_publica_de_empresa(db: Session, archivo_id: str) -> bool:
    """Logo y banner de portada de una empresa importadora.

    El catálogo de empresas y la ficha pública son visibles sin sesión, así que
    sus imágenes tienen que servirse igual: si no, el `<img>` del perfil pedía un
    archivo privado y siempre caía al placeholder.
    """
    try:
        PyUUID(archivo_id)
    except ValueError:
        return False

    patron = f"%/{archivo_id}/%"
    fila = (
        db.query(Importador.id)
        .filter(
            Importador.estado == "activo",
            or_(
                Importador.logo_url.like(patron),
                # `perfil_publico` es JSON: en MySQL y SQLite se busca el id como
                # texto dentro del documento serializado.
                func.cast(Importador.perfil_publico, String).like(f"%{archivo_id}%"),
            ),
        )
        .first()
    )
    if fila is not None:
        return True

    # Logos de los sellos que otorga la plataforma: se muestran junto a la
    # empresa en el catálogo público, así que también van sin sesión.
    sello = (
        db.query(Certificacion.id)
        .filter(Certificacion.activa.is_(True), Certificacion.logo_url.like(patron))
        .first()
    )
    return sello is not None


def _tiene_acceso_por_curso(db: Session, archivo_id: str, current_user: dict) -> bool:
    """Alumno inscrito en el curso, o cuenta de la empresa que lo publica.

    El archivo lo sube el dueño de la empresa, así que sin esta regla ningún
    alumno podía reproducir el video que compró.
    """
    base = (
        db.query(CursoRecurso.id)
        .join(Curso, Curso.id == CursoRecurso.curso_id)
        .filter(
            CursoRecurso.archivo_id == archivo_id,
            CursoRecurso.deleted_at.is_(None),
            Curso.deleted_at.is_(None),
        )
    )

    importador_id = current_user.get("importador_id")
    if importador_id and base.filter(Curso.importador_id == importador_id).first():
        return True

    comprado = (
        base.join(CompraCurso, CompraCurso.curso_id == Curso.id)
        .filter(CompraCurso.usuario_id == current_user.get("user_id"))
        .first()
    )
    return comprado is not None


@router.get("/archivos/{archivo_id}/descargar")
async def descargar_archivo(
    archivo_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    file_row = db.query(Archivo).filter(Archivo.id == archivo_id, Archivo.deleted_at.is_(None)).first()
    if not file_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")

    allowed = _es_recurso_publico_de_curso(db, archivo_id) or _es_imagen_publica_de_empresa(db, archivo_id)

    if not allowed and current_user is not None:
        user_id = _current_user_id(current_user)
        # El owner puede descargar siempre; quienes lo reciben por chat y los
        # alumnos del curso donde está vinculado, también.
        allowed = (
            file_row.owner_user_id == user_id
            or current_user.get("rol") == "admin"
            or _es_adjunto_de_chat_del_usuario(db, archivo_id, user_id)
            or _tiene_acceso_por_curso(db, archivo_id, current_user)
        )

    if not allowed:
        if current_user is None:
            # Este 401 se ve sobre todo al pegar la dirección en la barra del
            # navegador: al navegar a una URL no se manda la cabecera
            # `Authorization` (el token no es una cookie), así que la petición
            # llega sin sesión aunque el usuario la tenga abierta. El mensaje lo
            # dice, porque "inicia sesión" a secas confunde a quien acaba de
            # iniciarla.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    "Este archivo requiere una sesión válida. Ábrelo desde la plataforma: "
                    "pegar la dirección en el navegador no envía tu token de acceso."
                ),
                headers={"WWW-Authenticate": "Bearer"},
            )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para descargar este archivo")

    local_path = _resolve_local_storage_path(file_row)
    if local_path:
        # `inline` en imágenes y video: el navegador los muestra en vez de
        # forzar descarga, y FileResponse atiende Range (206) para que el
        # reproductor pueda buscar sin traerse el archivo completo.
        disposition = "inline" if file_row.tipo_recurso in ("imagen", "video") else "attachment"
        return FileResponse(
            path=str(local_path),
            media_type=file_row.mime_type,
            filename=file_row.nombre,
            content_disposition_type=disposition,
        )

    if file_row.storage_url and file_row.storage_url.startswith("http"):
        return {"download_url": file_row.storage_url}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay contenido descargable para este archivo")
