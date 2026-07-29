"""Módulo LMS de cursos: catálogo, publicación, compra y progreso."""
import logging
import re
import unicodedata
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

from models.curso import (
    Curso, ModuloCurso, LeccionCurso, RecursoLeccion, CompraCurso, ProgresoLeccion,
    EstadoCurso,
)
from models.importador import Importador
from models.usuario import Usuario
from schemas.curso import (
    CursoCreate, CursoListItem, CursoDetailResponse, CompraCursoResponse,
    ProgresoLeccionRequest, ProgresoLeccionResponse, ModuloResponse, LeccionResponse,
    RecursoLeccionResponse,
)
from services.notificacion_service import crear_notificacion_best_effort
from services.token_revocation import jti_revocado
from utils.dependencies import get_db, get_current_user, require_rol, security
from utils.security import decode_access_token, JWTError

logger = logging.getLogger("importacionesq8")

router = APIRouter(tags=["Cursos"])


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[dict]:
    """JWT opcional: catálogo/detalle públicos; progreso si hay sesión."""
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        jti = payload.get("jti")
        if not user_id or not jti:
            return None
        if db is not None and jti_revocado(db, jti):
            return None
        usuario = db.query(Usuario).filter(Usuario.id == str(user_id)).first()
        if not usuario or not usuario.activo:
            return None
        return {
            "user_id": str(usuario.id),
            "rol": usuario.rol,
            "importador_id": usuario.importador_id,
        }
    except JWTError:
        return None


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


def _nombre_importadora(db: Session, importador_id: str) -> Optional[str]:
    imp = db.query(Importador).filter(Importador.id == importador_id).first()
    return imp.nombre_empresa if imp else None


def _to_list_item(curso: Curso, db: Session) -> CursoListItem:
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
        importadora_nombre=_nombre_importadora(db, curso.importador_id),
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


def _modulos_response(curso: Curso) -> List[ModuloResponse]:
    resultado = []
    for mod in sorted(curso.modulos or [], key=lambda m: m.orden):
        lecciones = []
        for lec in sorted(mod.lecciones or [], key=lambda l: l.orden):
            recursos = [
                RecursoLeccionResponse(id=str(r.id), nombre=r.nombre, url=r.url, tipo=r.tipo)
                for r in (lec.recursos or [])
            ]
            lecciones.append(LeccionResponse(
                id=str(lec.id),
                titulo=lec.titulo,
                duracion=lec.duracion,
                video_url=lec.video_url,
                es_preview=bool(lec.es_preview),
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


@router.get("/cursos", response_model=List[CursoListItem])
async def listar_cursos(
    categoria: Optional[str] = Query(None, description="Filtrar por categoría"),
    nivel: Optional[str] = Query(None, description="'Principiante' o 'Avanzado'"),
    q: Optional[str] = Query(None, description="Búsqueda por título/descripción"),
    recomendados: Optional[bool] = Query(None, description="Ordenar por rating y popularidad"),
    importador_id: Optional[str] = Query(None, description="Cursos de una empresa"),
    db: Session = Depends(get_db),
):
    """Catálogo público de cursos publicados con filtros y recomendaciones."""
    query = db.query(Curso).filter(Curso.estado == EstadoCurso.publicado.value)

    if categoria:
        query = query.filter(Curso.categoria.ilike(f"%{categoria}%"))
    if nivel:
        query = query.filter(Curso.nivel == nivel)
    if importador_id:
        query = query.filter(Curso.importador_id == importador_id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Curso.titulo.ilike(like), Curso.descripcion.ilike(like)))

    if recomendados:
        query = query.order_by(Curso.rating.desc(), Curso.estudiantes_count.desc())
    else:
        query = query.order_by(Curso.fecha_creacion.desc())

    cursos = query.limit(100).all()
    return [_to_list_item(c, db) for c in cursos]


@router.get("/cursos/{id_o_slug}", response_model=CursoDetailResponse)
async def obtener_curso(
    id_o_slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """Detalle del curso con temario, vista previa y módulos."""
    curso = _cargar_curso_detalle(db, id_o_slug)
    if not curso or curso.estado == EstadoCurso.archivado.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")

    if curso.estado == EstadoCurso.borrador.value:
        if not current_user or current_user.get("importador_id") != curso.importador_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")

    item = _to_list_item(curso, db)
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

    return CursoDetailResponse(
        **item.model_dump(),
        modulos=_modulos_response(curso),
        comprado=comprado,
        lecciones_completadas=lecciones_completadas,
        progreso_pct=progreso_pct,
    )


@router.post("/cursos", response_model=CursoDetailResponse, status_code=status.HTTP_201_CREATED)
async def crear_curso(
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
    )
    db.add(curso)

    primera_leccion = True
    for i, mod_in in enumerate(datos.modulos):
        mod = ModuloCurso(
            id=str(uuid4()),
            curso_id=curso_id,
            titulo=mod_in.titulo.strip(),
            orden=i,
        )
        db.add(mod)
        db.flush()
        for j, lec_in in enumerate(mod_in.lecciones):
            es_preview = lec_in.es_preview or primera_leccion
            lec = LeccionCurso(
                id=str(uuid4()),
                modulo_id=mod.id,
                curso_id=curso_id,
                titulo=lec_in.titulo.strip(),
                duracion=lec_in.duracion or "10 min",
                video_url=lec_in.video_url.strip(),
                orden=j,
                es_preview=es_preview,
            )
            db.add(lec)
            db.flush()
            primera_leccion = False
            for rec_in in lec_in.recursos:
                db.add(RecursoLeccion(
                    id=str(uuid4()),
                    leccion_id=lec.id,
                    nombre=rec_in.nombre.strip(),
                    url=rec_in.url.strip(),
                    tipo=rec_in.tipo,
                ))

    db.commit()
    curso = _cargar_curso_detalle(db, curso_id)
    item = _to_list_item(curso, db)
    return CursoDetailResponse(
        **item.model_dump(),
        modulos=_modulos_response(curso),
        comprado=False,
        lecciones_completadas=[],
        progreso_pct=0.0,
    )


@router.post("/cursos/{curso_id}/comprar", response_model=CompraCursoResponse, status_code=status.HTTP_201_CREATED)
async def comprar_curso(
    curso_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Registra la compra/inscripción del usuario autenticado en el curso.
    Idempotente: si ya compró, devuelve la inscripción existente (200 vía 201 body).
    """
    curso = db.query(Curso).filter(
        Curso.id == curso_id,
        Curso.estado == EstadoCurso.publicado.value,
    ).first()
    if not curso:
        # También aceptar slug
        curso = db.query(Curso).filter(
            Curso.slug == curso_id,
            Curso.estado == EstadoCurso.publicado.value,
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
            curso=_to_list_item(curso, db),
        )

    compra = CompraCurso(
        id=str(uuid4()),
        curso_id=curso.id,
        usuario_id=usuario_id,
        precio_pagado=float(curso.precio or 0),
        fecha_compra=datetime.utcnow(),
    )
    db.add(compra)
    curso.estudiantes_count = int(curso.estudiantes_count or 0) + 1

    crear_notificacion_best_effort(
        db,
        usuario_id=usuario_id,
        tipo="curso",
        titulo="Inscripción al curso confirmada",
        mensaje=f"Ya puedes empezar: {curso.titulo}",
        data={"curso_id": str(curso.id), "slug": curso.slug},
    )

    db.commit()
    db.refresh(compra)

    return CompraCursoResponse(
        id=str(compra.id),
        curso_id=str(curso.id),
        usuario_id=usuario_id,
        precio_pagado=float(compra.precio_pagado),
        fecha_compra=compra.fecha_compra,
        curso=_to_list_item(curso, db),
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
        item = _to_list_item(curso, db)
        lecciones_completadas, _, progreso_pct = _progreso_usuario(db, usuario_id, curso.id)
        resultado.append(CursoDetailResponse(
            **item.model_dump(),
            modulos=_modulos_response(curso),
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
    if not curso:
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
