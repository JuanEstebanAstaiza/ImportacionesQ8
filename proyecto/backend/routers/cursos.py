"""Módulo LMS de cursos: catálogo, publicación, compra y progreso."""
import logging
import re
import unicodedata
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

from models.curso import (
    Curso, ModuloCurso, LeccionCurso, RecursoLeccion, CompraCurso, ProgresoLeccion,
    CertificadoCurso, EstadoCurso,
)
from models.documental import Archivo, CursoRecurso
from models.importador import Importador
from schemas.curso import (
    CursoCreate, CursoUpdate, CursoListItem, CursoDetailResponse, CompraCursoResponse,
    ProgresoLeccionRequest, ProgresoLeccionResponse, ModuloResponse, LeccionResponse,
    RecursoLeccionResponse, CertificadoCursoResponse,
)
from services.notificacion_service import crear_notificacion_best_effort
from services.documental_service import extract_document_file_id_from_url, ensure_folder_path
from utils.dependencies import (
    get_db,
    get_current_user,
    get_optional_current_user as get_optional_user,
    require_rol,
    require_rol_in,
)
from utils.limiter import limiter, RATE_LIMIT_PUBLIC_READ, RATE_LIMIT_PUBLIC_WRITE
from utils.query_safety import like_contains_pattern, clamp_str

logger = logging.getLogger("importacionesq8")


def _modulo_educativo_activo() -> None:
    """Apaga el módulo LMS entero desde `MODULO_EDUCATIVO_HABILITADO`.

    Se responde 404 (no 403) para que la sección sea indistinguible de una que
    no existe cuando el cliente decide no ofrecer formación.
    """
    import config as app_config

    if not app_config.MODULO_EDUCATIVO_HABILITADO:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El módulo de cursos no está habilitado en esta instalación",
        )


router = APIRouter(tags=["Cursos"], dependencies=[Depends(_modulo_educativo_activo)])


def _slugify(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto)
    sin_acentos = "".join(c for c in normalizado if not unicodedata.combining(c))
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", sin_acentos.lower()).strip("-")
    return slug[:200] or "curso"


def _slug_unico(db: Session, titulo: str) -> str:
    base = _slugify(titulo)
    slug = base
    n = 1
    while db.query(Curso.id).filter(Curso.slug == slug).first():
        n += 1
        slug = f"{base}-{n}"
    return slug


def _nombres_importadoras(db: Session, importador_ids: List[str]) -> dict:
    """Batch load — evita N+1 en catálogo de cursos."""
    if not importador_ids:
        return {}
    rows = db.query(Importador.id, Importador.nombre_empresa).filter(
        Importador.id.in_(list(set(importador_ids)))
    ).all()
    return {r[0]: r[1] for r in rows}


def _to_list_item(curso: Curso, nombres: Optional[dict] = None, db: Optional[Session] = None) -> CursoListItem:
    nombre = None
    if nombres is not None:
        nombre = nombres.get(curso.importador_id)
    elif db is not None:
        nombre = _nombres_importadoras(db, [curso.importador_id]).get(curso.importador_id)
    return CursoListItem(
        id=str(curso.id),
        slug=curso.slug,
        titulo=curso.titulo,
        descripcion=curso.descripcion or "",
        portada_url=curso.portada_url,
        precio=float(curso.precio or 0),
        nivel=curso.nivel,
        categoria=curso.categoria,
        importador_id=curso.importador_id,
        importadora_nombre=nombre,
        rating=float(curso.rating or 0),
        estudiantes_count=int(curso.estudiantes_count or 0),
        estado=curso.estado,
        fecha_creacion=curso.fecha_creacion,
    )


def _cargar_curso_detalle(db: Session, id_o_slug: str) -> Optional[Curso]:
    q = db.query(Curso).options(
        joinedload(Curso.modulos).joinedload(ModuloCurso.lecciones).joinedload(LeccionCurso.recursos)
    )
    curso = q.filter(Curso.id == id_o_slug).first()
    if not curso:
        curso = q.filter(Curso.slug == id_o_slug).first()
    return curso


def _progreso_usuario(db: Session, usuario_id: str, curso_id: str) -> tuple:
    total = db.query(func.count(LeccionCurso.id)).filter(LeccionCurso.curso_id == curso_id).scalar() or 0
    completadas = [
        row.leccion_id
        for row in db.query(ProgresoLeccion).filter(
            ProgresoLeccion.usuario_id == usuario_id,
            ProgresoLeccion.curso_id == curso_id,
            ProgresoLeccion.completada.is_(True),
        ).all()
    ]
    pct = round((len(completadas) / total * 100), 2) if total > 0 else 0.0
    return completadas, int(total), pct


def _modulos_response(curso: Curso, *, acceso_completo: bool) -> List[ModuloResponse]:
    """
    Paywall de contenido:
    - acceso_completo=True (comprado o dueño de la empresa): video + recursos completos.
    - acceso_completo=False: solo lecciones es_preview exponen video_url/recursos;
      el resto del temario se listan (título/duración) pero el media se redacts.
    """
    resultado = []
    for mod in sorted(curso.modulos or [], key=lambda m: m.orden):
        lecciones = []
        for lec in sorted(mod.lecciones or [], key=lambda l: l.orden):
            es_preview = bool(lec.es_preview)
            revelar = acceso_completo or es_preview
            if revelar:
                recursos = [
                    RecursoLeccionResponse(id=str(r.id), nombre=r.nombre, url=r.url, tipo=r.tipo)
                    for r in (lec.recursos or [])
                ]
                video_url = lec.video_url
            else:
                # No filtrar media de pago al público (A01)
                recursos = []
                video_url = ""
            lecciones.append(LeccionResponse(
                id=str(lec.id),
                titulo=lec.titulo,
                duracion=lec.duracion,
                video_url=video_url,
                es_preview=es_preview,
                orden=lec.orden,
                recursos=recursos,
            ))
        resultado.append(ModuloResponse(
            id=str(mod.id),
            titulo=mod.titulo,
            orden=mod.orden,
            lecciones=lecciones,
        ))
    return resultado


def _puede_ver_contenido_completo(curso: Curso, current_user: Optional[dict], comprado: bool) -> bool:
    if comprado:
        return True
    if not current_user:
        return False
    if current_user.get("rol") == "admin":
        return True
    # Cualquier cuenta de la empresa publicadora (dueño o asesor): el asesor que
    # sube y edita el material también necesita verlo, y limitarlo al dueño lo
    # dejaba tras el muro de pago de su propio curso.
    if (
        current_user.get("rol") in ("importador", "asesor")
        and current_user.get("importador_id")
        and current_user.get("importador_id") == curso.importador_id
    ):
        return True
    return False


def _vincular_recurso_documental(
    db: Session,
    *,
    curso_id: str,
    leccion_id: Optional[str],
    recurso_url: str,
    tipo: str,
) -> None:
    archivo_id = extract_document_file_id_from_url(recurso_url)
    if not archivo_id:
        return
    archivo = db.query(Archivo).filter(Archivo.id == archivo_id, Archivo.deleted_at.is_(None)).first()
    if not archivo:
        return
    exists = (
        db.query(CursoRecurso)
        .filter(
            CursoRecurso.curso_id == curso_id,
            CursoRecurso.leccion_id == leccion_id,
            CursoRecurso.archivo_id == archivo_id,
            CursoRecurso.deleted_at.is_(None),
        )
        .first()
    )
    if exists:
        return
    db.add(
        CursoRecurso(
            id=str(uuid4()),
            curso_id=curso_id,
            leccion_id=leccion_id,
            archivo_id=archivo_id,
            tipo=tipo,
        )
    )


def _vincular_portada_curso(db: Session, curso: Curso) -> None:
    """Vincula la portada al curso para que la descarga la autorice sin sesión.

    La portada se muestra en el catálogo público; sin este vínculo el `<img>`
    del catálogo pedía un archivo privado y caía siempre al placeholder.
    """
    db.query(CursoRecurso).filter(
        CursoRecurso.curso_id == curso.id,
        CursoRecurso.tipo == "portada",
    ).delete(synchronize_session=False)
    _vincular_recurso_documental(
        db,
        curso_id=curso.id,
        leccion_id=None,
        recurso_url=curso.portada_url or "",
        tipo="portada",
    )


def _url_documental_obligatoria(value: str, *, campo: str) -> str:
    url = (value or "").strip()
    if not url.startswith("/documentos/archivos/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{campo} debe apuntar a un archivo subido a la plataforma",
        )
    return url


def _asegurar_carpeta_curso(db: Session, curso: Curso) -> None:
    ensure_folder_path(
        db,
        owner_user_id=str(curso.creado_por_usuario_id),
        segments=["Cursos", curso.slug],
    )


def _reemplazar_estructura_curso(db: Session, curso: Curso, modulos: List) -> None:
    """Reconcilia el temario del curso conservando las lecciones que siguen ahí.

    Antes se borraba todo y se recreaba con ids nuevos, así que cualquier
    edición del temario —hasta corregir una tilde en un título— dejaba las filas
    de `ProgresoLeccion` apuntando a lecciones inexistentes y todos los alumnos
    volvían a 0%. Ahora solo se elimina lo que el editor quitó de verdad.
    """
    modulos_existentes = {str(m.id): m for m in curso.modulos}
    lecciones_existentes = {
        str(leccion.id): leccion
        for modulo in curso.modulos
        for leccion in modulo.lecciones
    }

    modulos_conservados: set = set()
    lecciones_conservadas: set = set()

    # `CursoRecurso` es un índice derivado del temario: se reconstruye entero.
    db.query(CursoRecurso).filter(CursoRecurso.curso_id == curso.id).delete(synchronize_session=False)

    primera_leccion = True
    for modulo_index, modulo_data in enumerate(modulos):
        modulo = modulos_existentes.get(str(getattr(modulo_data, "id", None) or ""))
        if modulo is None:
            modulo = ModuloCurso(id=str(uuid4()), curso_id=curso.id)
            db.add(modulo)
        modulo.titulo = modulo_data.titulo.strip()
        modulo.orden = modulo_index
        db.flush()
        modulos_conservados.add(str(modulo.id))

        for leccion_index, leccion_data in enumerate(modulo_data.lecciones):
            video_url = _url_documental_obligatoria(leccion_data.video_url, campo="video_url")
            leccion = lecciones_existentes.get(str(getattr(leccion_data, "id", None) or ""))
            if leccion is None:
                leccion = LeccionCurso(id=str(uuid4()), curso_id=curso.id)
                db.add(leccion)
            leccion.modulo_id = modulo.id
            leccion.curso_id = curso.id
            leccion.titulo = leccion_data.titulo.strip()
            leccion.duracion = leccion_data.duracion or "10 min"
            leccion.video_url = video_url
            leccion.orden = leccion_index
            leccion.es_preview = bool(leccion_data.es_preview or primera_leccion)
            db.flush()
            lecciones_conservadas.add(str(leccion.id))

            _vincular_recurso_documental(
                db,
                curso_id=curso.id,
                leccion_id=leccion.id,
                recurso_url=video_url,
                tipo="video",
            )

            # Los materiales adjuntos no tienen progreso asociado, así que se
            # reemplazan sin más.
            for recurso_previo in list(leccion.recursos):
                db.delete(recurso_previo)
            db.flush()

            for recurso_data in leccion_data.recursos:
                recurso_url = _url_documental_obligatoria(recurso_data.url, campo="url de recurso")
                recurso = RecursoLeccion(
                    id=str(uuid4()),
                    leccion_id=leccion.id,
                    nombre=recurso_data.nombre.strip(),
                    url=recurso_url,
                    tipo=recurso_data.tipo,
                )
                db.add(recurso)
                db.flush()
                _vincular_recurso_documental(
                    db,
                    curso_id=curso.id,
                    leccion_id=leccion.id,
                    recurso_url=recurso_url,
                    tipo="material",
                )

            primera_leccion = False

    # Lo que el editor eliminó: se borra junto con el progreso que apuntaba a él,
    # para no dejar filas huérfanas que falseen el porcentaje del alumno.
    for leccion_id, leccion in lecciones_existentes.items():
        if leccion_id in lecciones_conservadas:
            continue
        db.query(ProgresoLeccion).filter(
            ProgresoLeccion.leccion_id == leccion_id
        ).delete(synchronize_session=False)
        db.delete(leccion)

    for modulo_id, modulo in modulos_existentes.items():
        if modulo_id not in modulos_conservados:
            db.delete(modulo)

    db.flush()
    db.expire(curso, ["modulos"])

    _vincular_portada_curso(db, curso)
    _asegurar_carpeta_curso(db, curso)


@router.get("/cursos", response_model=List[CursoListItem])
@limiter.limit(RATE_LIMIT_PUBLIC_READ)
async def listar_cursos(
    request: Request,
    categoria: Optional[str] = Query(None, description="Filtrar por categoría"),
    nivel: Optional[str] = Query(None, description="'Principiante' o 'Avanzado'"),
    q: Optional[str] = Query(None, description="Búsqueda por título/descripción"),
    recomendados: Optional[bool] = Query(None, description="Ordenar por rating y popularidad"),
    importador_id: Optional[str] = Query(None, description="Cursos de una empresa"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0, le=10_000),
    db: Session = Depends(get_db),
):
    """Catálogo público de cursos publicados con filtros y recomendaciones."""
    query = db.query(Curso).filter(Curso.estado == EstadoCurso.publicado.value)
    query = query.filter(Curso.deleted_at.is_(None))

    categoria = clamp_str(categoria, 120)
    q = clamp_str(q, 120)
    if categoria:
        query = query.filter(Curso.categoria.ilike(like_contains_pattern(categoria), escape="\\"))
    if nivel:
        query = query.filter(Curso.nivel == nivel)
    if importador_id:
        query = query.filter(Curso.importador_id == importador_id)
    if q:
        pat = like_contains_pattern(q)
        query = query.filter(or_(
            Curso.titulo.ilike(pat, escape="\\"),
            Curso.descripcion.ilike(pat, escape="\\"),
        ))

    if recomendados:
        query = query.order_by(Curso.rating.desc(), Curso.estudiantes_count.desc())
    else:
        query = query.order_by(Curso.fecha_creacion.desc())

    cursos = query.offset(offset).limit(limit).all()
    nombres = _nombres_importadoras(db, [c.importador_id for c in cursos])
    return [_to_list_item(c, nombres=nombres) for c in cursos]


@router.get("/cursos/{id_o_slug}", response_model=CursoDetailResponse)
async def obtener_curso(
    id_o_slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """Detalle del curso con temario, vista previa y módulos."""
    curso = _cargar_curso_detalle(db, id_o_slug)
    if not curso or curso.estado == EstadoCurso.archivado.value or curso.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")

    if curso.estado == EstadoCurso.borrador.value:
        if not current_user or current_user.get("importador_id") != curso.importador_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")

    item = _to_list_item(curso, db=db)
    comprado = False
    lecciones_completadas: List[str] = []
    progreso_pct = 0.0

    if current_user:
        compra = db.query(CompraCurso).filter(
            CompraCurso.curso_id == curso.id,
            CompraCurso.usuario_id == current_user["user_id"],
        ).first()
        comprado = compra is not None
        if comprado:
            lecciones_completadas, _, progreso_pct = _progreso_usuario(
                db, current_user["user_id"], curso.id
            )

    acceso = _puede_ver_contenido_completo(curso, current_user, comprado)
    return CursoDetailResponse(
        **item.model_dump(),
        modulos=_modulos_response(curso, acceso_completo=acceso),
        comprado=comprado,
        lecciones_completadas=lecciones_completadas,
        progreso_pct=progreso_pct,
    )


@router.post("/cursos", response_model=CursoDetailResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_PUBLIC_WRITE)
async def crear_curso(
    request: Request,
    datos: CursoCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador")),
):
    """
    Publica un curso con módulos, lecciones, URLs de video y archivos adjuntos.
    Solo la cuenta dueña de la empresa importadora.
    """
    importador_id = current_user.get("importador_id")
    if not importador_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta no está asociada a ninguna empresa importadora",
        )

    importador = db.query(Importador).filter(Importador.id == importador_id).first()
    if not importador:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importador no encontrado")

    curso_id = str(uuid4())
    curso = Curso(
        id=curso_id,
        slug=_slug_unico(db, datos.titulo),
        titulo=datos.titulo.strip(),
        descripcion=datos.descripcion or "",
        portada_url=datos.portada_url,
        precio=float(datos.precio),
        nivel=datos.nivel,
        categoria=datos.categoria.strip(),
        importador_id=importador_id,
        creado_por_usuario_id=current_user["user_id"],
        rating=4.5,
        estudiantes_count=0,
        estado=EstadoCurso.publicado.value,
        fecha_creacion=datetime.utcnow(),
        deleted_at=None,
    )
    db.add(curso)
    _reemplazar_estructura_curso(db, curso, datos.modulos)

    db.commit()
    curso = _cargar_curso_detalle(db, curso_id)
    item = _to_list_item(curso, db=db)
    return CursoDetailResponse(
        **item.model_dump(),
        modulos=_modulos_response(curso, acceso_completo=True),
        comprado=False,
        lecciones_completadas=[],
        progreso_pct=0.0,
    )


@router.post("/cursos/{curso_id}/comprar", response_model=CompraCursoResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_PUBLIC_WRITE)
async def comprar_curso(
    request: Request,
    curso_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("solicitante", "importador", "asesor")),
):
    """
    Registra la compra/inscripción del usuario en el curso.
    Idempotente: si ya compró, devuelve la inscripción existente.

    Cualquier cuenta de negocio puede inscribirse (no solo el solicitante):
    restringirlo al rol "solicitante" devolvía 403 a los asesores y dueños de
    empresa que quisieran tomar un curso de otra importadora.

    Nota de seguridad: MVP sin pasarela — no hay cobro real. Ver residual en
    auditoría 2026-07-28 (A04 diseño de pagos).
    """
    from sqlalchemy.exc import IntegrityError

    curso = db.query(Curso).filter(
        Curso.id == curso_id,
        Curso.estado == EstadoCurso.publicado.value,
        Curso.deleted_at.is_(None),
    ).first()
    if not curso:
        # También aceptar slug
        curso = db.query(Curso).filter(
            Curso.slug == curso_id,
            Curso.estado == EstadoCurso.publicado.value,
            Curso.deleted_at.is_(None),
        ).first()
    if not curso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")

    usuario_id = current_user["user_id"]
    existente = db.query(CompraCurso).filter(
        CompraCurso.curso_id == curso.id,
        CompraCurso.usuario_id == usuario_id,
    ).first()
    if existente:
        return CompraCursoResponse(
            id=str(existente.id),
            curso_id=str(curso.id),
            usuario_id=usuario_id,
            precio_pagado=float(existente.precio_pagado),
            fecha_compra=existente.fecha_compra,
            curso=_to_list_item(curso, db=db),
        )

    compra = CompraCurso(
        id=str(uuid4()),
        curso_id=curso.id,
        usuario_id=usuario_id,
        precio_pagado=float(curso.precio or 0),
        fecha_compra=datetime.utcnow(),
    )
    db.add(compra)
    # Incremento atómico del contador (evita race en estudiantes_count)
    db.query(Curso).filter(Curso.id == curso.id).update(
        {Curso.estudiantes_count: Curso.estudiantes_count + 1},
        synchronize_session=False,
    )

    crear_notificacion_best_effort(
        db,
        usuario_id=usuario_id,
        tipo="curso",
        titulo="Inscripción al curso confirmada",
        mensaje=f"Ya puedes empezar: {curso.titulo}",
        data={"curso_id": str(curso.id), "slug": curso.slug},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Carrera concurrente: otro request ya insertó la compra
        existente = db.query(CompraCurso).filter(
            CompraCurso.curso_id == curso.id,
            CompraCurso.usuario_id == usuario_id,
        ).first()
        if existente:
            return CompraCursoResponse(
                id=str(existente.id),
                curso_id=str(curso.id),
                usuario_id=usuario_id,
                precio_pagado=float(existente.precio_pagado),
                fecha_compra=existente.fecha_compra,
                curso=_to_list_item(curso, db=db),
            )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se pudo completar la compra")

    db.refresh(compra)
    db.refresh(curso)

    return CompraCursoResponse(
        id=str(compra.id),
        curso_id=str(curso.id),
        usuario_id=usuario_id,
        precio_pagado=float(compra.precio_pagado),
        fecha_compra=compra.fecha_compra,
        curso=_to_list_item(curso, db=db),
    )


@router.get("/mis-cursos", response_model=List[CursoDetailResponse])
async def mis_cursos(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Cursos comprados/inscritos por el usuario logueado, con progreso."""
    usuario_id = current_user["user_id"]
    compras = (
        db.query(CompraCurso)
        .filter(CompraCurso.usuario_id == usuario_id)
        .order_by(CompraCurso.fecha_compra.desc())
        .all()
    )
    resultado = []
    for compra in compras:
        curso = _cargar_curso_detalle(db, compra.curso_id)
        if not curso:
            continue
        if curso.deleted_at is not None:
            continue
        item = _to_list_item(curso, db=db)
        lecciones_completadas, _, progreso_pct = _progreso_usuario(db, usuario_id, curso.id)
        resultado.append(CursoDetailResponse(
            **item.model_dump(),
            modulos=_modulos_response(curso, acceso_completo=True),
            comprado=True,
            lecciones_completadas=lecciones_completadas,
            progreso_pct=progreso_pct,
        ))
    return resultado


@router.post(
    "/cursos/{curso_id}/lecciones/{leccion_id}/progreso",
    response_model=ProgresoLeccionResponse,
)
async def marcar_progreso_leccion(
    curso_id: str,
    leccion_id: str,
    datos: ProgresoLeccionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Marca una lección como completada (o no) y devuelve el avance del curso."""
    usuario_id = current_user["user_id"]

    curso = db.query(Curso).filter(or_(Curso.id == curso_id, Curso.slug == curso_id)).first()
    if not curso or curso.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")

    compra = db.query(CompraCurso).filter(
        CompraCurso.curso_id == curso.id,
        CompraCurso.usuario_id == usuario_id,
    ).first()
    if not compra:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes comprar el curso para registrar progreso",
        )

    leccion = db.query(LeccionCurso).filter(
        LeccionCurso.id == leccion_id,
        LeccionCurso.curso_id == curso.id,
    ).first()
    if not leccion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lección no encontrada")

    progreso = db.query(ProgresoLeccion).filter(
        ProgresoLeccion.usuario_id == usuario_id,
        ProgresoLeccion.leccion_id == leccion_id,
    ).first()

    ahora = datetime.utcnow()
    if not progreso:
        progreso = ProgresoLeccion(
            id=str(uuid4()),
            usuario_id=usuario_id,
            curso_id=curso.id,
            leccion_id=leccion_id,
            completada=datos.completada,
            fecha_completado=ahora if datos.completada else None,
            fecha_ultima_vista=ahora,
        )
        db.add(progreso)
    else:
        progreso.completada = datos.completada
        progreso.fecha_ultima_vista = ahora
        if datos.completada and not progreso.fecha_completado:
            progreso.fecha_completado = ahora
        if not datos.completada:
            progreso.fecha_completado = None

    db.commit()

    lecciones_completadas, total, pct = _progreso_usuario(db, usuario_id, curso.id)
    return ProgresoLeccionResponse(
        curso_id=str(curso.id),
        leccion_id=leccion_id,
        completada=datos.completada,
        lecciones_completadas=lecciones_completadas,
        total_lecciones=total,
        progreso_pct=pct,
        fecha_completado=progreso.fecha_completado,
    )


@router.get("/cursos/{curso_id}/certificado", response_model=CertificadoCursoResponse)
async def obtener_certificado_curso(
    curso_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Certificado de finalización del alumno que completó el 100% del curso.

    Es idempotente: el PDF se emite una sola vez y queda en la carpeta
    `Certificados` de su gestión documental; las llamadas siguientes devuelven
    el mismo archivo.
    """
    from models.usuario import Usuario
    from services.pdf_document_service import generate_course_certificate

    usuario_id = current_user["user_id"]

    curso = db.query(Curso).filter(or_(Curso.id == curso_id, Curso.slug == curso_id)).first()
    if not curso or curso.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")

    compra = db.query(CompraCurso).filter(
        CompraCurso.curso_id == curso.id,
        CompraCurso.usuario_id == usuario_id,
    ).first()
    if not compra:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes estar inscrito en el curso para obtener el certificado",
        )

    _, total, pct = _progreso_usuario(db, usuario_id, curso.id)
    if total == 0 or pct < 100:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Completa el 100% del curso para descargar tu certificado (llevas {pct}%)",
        )

    certificado = db.query(CertificadoCurso).filter(
        CertificadoCurso.curso_id == curso.id,
        CertificadoCurso.usuario_id == usuario_id,
    ).first()

    if not certificado:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        if not usuario:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

        archivo_id = generate_course_certificate(
            db,
            curso=curso,
            usuario=usuario,
            empresa_nombre=_nombres_importadoras(db, [curso.importador_id]).get(curso.importador_id),
        )
        certificado = CertificadoCurso(
            id=str(uuid4()),
            curso_id=curso.id,
            usuario_id=usuario_id,
            archivo_id=archivo_id,
            fecha_emision=datetime.utcnow(),
        )
        db.add(certificado)
        db.commit()
        db.refresh(certificado)

    return CertificadoCursoResponse(
        curso_id=str(curso.id),
        curso_titulo=curso.titulo,
        archivo_id=str(certificado.archivo_id),
        url_descarga=f"/documentos/archivos/{certificado.archivo_id}/descargar",
        fecha_emision=certificado.fecha_emision,
    )


@router.put("/cursos/{curso_id}", response_model=CursoDetailResponse)
@limiter.limit(RATE_LIMIT_PUBLIC_WRITE)
async def actualizar_curso(
    request: Request,
    curso_id: str,
    datos: CursoUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador")),
):
    curso = db.query(Curso).filter(or_(Curso.id == curso_id, Curso.slug == curso_id), Curso.deleted_at.is_(None)).first()
    if not curso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")

    if curso.importador_id != current_user.get("importador_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para actualizar este curso")

    if datos.titulo is not None:
        curso.titulo = datos.titulo.strip()
        if curso.slug != _slugify(curso.titulo):
            curso.slug = _slug_unico(db, curso.titulo)
    if datos.descripcion is not None:
        curso.descripcion = datos.descripcion
    if datos.portada_url is not None:
        curso.portada_url = _url_documental_obligatoria(datos.portada_url, campo="portada_url")
    if datos.precio is not None:
        curso.precio = float(datos.precio)
    if datos.nivel is not None:
        curso.nivel = datos.nivel
    if datos.categoria is not None:
        curso.categoria = datos.categoria.strip()
    if datos.estado is not None:
        curso.estado = datos.estado

    if datos.modulos is not None:
        _reemplazar_estructura_curso(db, curso, datos.modulos)
    elif datos.portada_url is not None:
        _vincular_portada_curso(db, curso)

    curso.fecha_actualizacion = datetime.utcnow()
    db.commit()

    refreshed = _cargar_curso_detalle(db, str(curso.id))
    item = _to_list_item(refreshed, db=db)
    return CursoDetailResponse(
        **item.model_dump(),
        modulos=_modulos_response(refreshed, acceso_completo=True),
        comprado=False,
        lecciones_completadas=[],
        progreso_pct=0.0,
    )


@router.delete("/cursos/{curso_id}", response_model=dict)
@limiter.limit(RATE_LIMIT_PUBLIC_WRITE)
async def eliminar_curso(
    request: Request,
    curso_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador")),
):
    curso = db.query(Curso).filter(or_(Curso.id == curso_id, Curso.slug == curso_id), Curso.deleted_at.is_(None)).first()
    if not curso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")

    if curso.importador_id != current_user.get("importador_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para eliminar este curso")

    now = datetime.utcnow()
    curso.deleted_at = now
    curso.estado = EstadoCurso.archivado.value
    db.query(CursoRecurso).filter(CursoRecurso.curso_id == curso.id, CursoRecurso.deleted_at.is_(None)).update(
        {CursoRecurso.deleted_at: now}, synchronize_session=False
    )
    db.commit()
    return {"success": True}
