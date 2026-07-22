"""
Módulo académico:
- Importadoras (dueño/asesor) publican y gestionan cursos y lecciones.
- Solo solicitantes pueden comprar.
- Progreso = lecciones completadas / total lecciones * 100.
"""
from __future__ import annotations

import secrets
from datetime import datetime
from typing import List, Optional
from uuid import UUID as PyUUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

import config
from models.academia import (
    Curso, CursoLeccion, CompraCurso, ProgresoLeccion,
    EstadoCurso, EstadoCompraCurso,
)
from models.usuario import Usuario
from schemas.academia import (
    CursoCreate, CursoUpdate, CursoResponse, CursoDetalleResponse,
    LeccionCreate, LeccionUpdate, LeccionResponse,
    CompraCursoResponse, ProgresoCursoResponse,
)
from utils.dependencies import get_db, get_current_user, require_rol, require_rol_in

router = APIRouter(prefix="/academia", tags=["Academia"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uuid(value: str, label: str = "ID") -> str:
    try:
        return str(PyUUID(value))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} no encontrado")


def _require_importador_empresa(current_user: dict) -> str:
    if current_user["rol"] not in ("importador", "asesor"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo personal de importadora")
    importador_id = current_user.get("importador_id")
    if not importador_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta no está vinculada a una empresa importadora",
        )
    return str(importador_id)


def _get_curso(db: Session, curso_id: str) -> Curso:
    curso = db.query(Curso).filter(Curso.id == _uuid(curso_id, "Curso")).first()
    if not curso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")
    return curso


def _assert_curso_de_empresa(curso: Curso, importador_id: str) -> None:
    if curso.importador_id != importador_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado sobre este curso")


def _contar_lecciones(db: Session, curso_id: str) -> int:
    return db.query(func.count(CursoLeccion.id)).filter(CursoLeccion.curso_id == curso_id).scalar() or 0


def _curso_to_response(db: Session, curso: Curso) -> CursoResponse:
    data = CursoResponse.model_validate(curso)
    data.total_lecciones = _contar_lecciones(db, curso.id)
    return data


def _compra_confirmada(db: Session, curso_id: str, usuario_id: str) -> Optional[CompraCurso]:
    return (
        db.query(CompraCurso)
        .filter(
            CompraCurso.curso_id == curso_id,
            CompraCurso.comprador_id == usuario_id,
            CompraCurso.estado == EstadoCompraCurso.confirmada.value,
        )
        .first()
    )


def _progreso_stats(db: Session, curso_id: str, usuario_id: str) -> tuple[int, int, float]:
    total = _contar_lecciones(db, curso_id)
    if total == 0:
        return 0, 0, 0.0
    completadas = (
        db.query(func.count(ProgresoLeccion.id))
        .filter(
            ProgresoLeccion.curso_id == curso_id,
            ProgresoLeccion.usuario_id == usuario_id,
            ProgresoLeccion.completada == True,  # noqa: E712
        )
        .scalar()
        or 0
    )
    pct = round((completadas / total) * 100.0, 2)
    return total, completadas, pct


def _lecciones_ordered(db: Session, curso_id: str) -> List[CursoLeccion]:
    return (
        db.query(CursoLeccion)
        .filter(CursoLeccion.curso_id == curso_id)
        .order_by(CursoLeccion.orden.asc())
        .all()
    )


def _leccion_response(
    leccion: CursoLeccion,
    *,
    incluir_contenido: bool,
    completada: Optional[bool] = None,
) -> LeccionResponse:
    return LeccionResponse(
        id=leccion.id,
        curso_id=leccion.curso_id,
        titulo=leccion.titulo,
        descripcion=leccion.descripcion,
        tipo=leccion.tipo,
        contenido_url=leccion.contenido_url if incluir_contenido else None,
        contenido_texto=leccion.contenido_texto if incluir_contenido else None,
        orden=leccion.orden,
        duracion_segundos=leccion.duracion_segundos,
        completada=completada,
    )


# ---------------------------------------------------------------------------
# Gestión (importadora / asesor)
# ---------------------------------------------------------------------------

@router.post("/cursos", response_model=CursoResponse, status_code=status.HTTP_201_CREATED)
async def crear_curso(
    datos: CursoCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    importador_id = _require_importador_empresa(current_user)
    curso = Curso(
        id=str(uuid4()),
        importador_id=importador_id,
        creado_por_usuario_id=current_user["user_id"],
        titulo=datos.titulo,
        descripcion=datos.descripcion,
        categoria=datos.categoria,
        precio_usd=float(datos.precio_usd),
        imagen_url=datos.imagen_url,
        estado=EstadoCurso.borrador.value,
    )
    db.add(curso)
    db.commit()
    db.refresh(curso)
    return _curso_to_response(db, curso)


@router.get("/mis-cursos", response_model=List[CursoResponse])
async def listar_mis_cursos(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    importador_id = _require_importador_empresa(current_user)
    cursos = (
        db.query(Curso)
        .filter(Curso.importador_id == importador_id)
        .order_by(Curso.fecha_creacion.desc())
        .all()
    )
    return [_curso_to_response(db, c) for c in cursos]


@router.put("/cursos/{curso_id}", response_model=CursoResponse)
async def actualizar_curso(
    curso_id: str,
    datos: CursoUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    importador_id = _require_importador_empresa(current_user)
    curso = _get_curso(db, curso_id)
    _assert_curso_de_empresa(curso, importador_id)

    payload = datos.model_dump(exclude_unset=True)
    if "estado" in payload and payload["estado"] == EstadoCurso.publicado.value:
        if _contar_lecciones(db, curso.id) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes publicar un curso sin al menos una lección",
            )
    for k, v in payload.items():
        setattr(curso, k, v)
    curso.fecha_actualizacion = datetime.utcnow()
    db.commit()
    db.refresh(curso)
    return _curso_to_response(db, curso)


@router.post("/cursos/{curso_id}/publicar", response_model=CursoResponse)
async def publicar_curso(
    curso_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    importador_id = _require_importador_empresa(current_user)
    curso = _get_curso(db, curso_id)
    _assert_curso_de_empresa(curso, importador_id)
    if _contar_lecciones(db, curso.id) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes publicar un curso sin al menos una lección",
        )
    curso.estado = EstadoCurso.publicado.value
    curso.fecha_actualizacion = datetime.utcnow()
    db.commit()
    db.refresh(curso)
    return _curso_to_response(db, curso)


@router.post(
    "/cursos/{curso_id}/lecciones",
    response_model=LeccionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_leccion(
    curso_id: str,
    datos: LeccionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    importador_id = _require_importador_empresa(current_user)
    curso = _get_curso(db, curso_id)
    _assert_curso_de_empresa(curso, importador_id)

    if datos.orden is None:
        max_orden = (
            db.query(func.max(CursoLeccion.orden))
            .filter(CursoLeccion.curso_id == curso.id)
            .scalar()
        )
        orden = int(max_orden or 0) + 1
    else:
        orden = datos.orden
        existe = (
            db.query(CursoLeccion)
            .filter(CursoLeccion.curso_id == curso.id, CursoLeccion.orden == orden)
            .first()
        )
        if existe:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una lección con orden={orden} en este curso",
            )

    leccion = CursoLeccion(
        id=str(uuid4()),
        curso_id=curso.id,
        titulo=datos.titulo,
        descripcion=datos.descripcion,
        tipo=datos.tipo,
        contenido_url=datos.contenido_url,
        contenido_texto=datos.contenido_texto,
        orden=orden,
        duracion_segundos=datos.duracion_segundos,
    )
    db.add(leccion)
    curso.fecha_actualizacion = datetime.utcnow()
    db.commit()
    db.refresh(leccion)
    return _leccion_response(leccion, incluir_contenido=True)


@router.put("/cursos/{curso_id}/lecciones/{leccion_id}", response_model=LeccionResponse)
async def actualizar_leccion(
    curso_id: str,
    leccion_id: str,
    datos: LeccionUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    importador_id = _require_importador_empresa(current_user)
    curso = _get_curso(db, curso_id)
    _assert_curso_de_empresa(curso, importador_id)
    leccion = (
        db.query(CursoLeccion)
        .filter(CursoLeccion.id == _uuid(leccion_id, "Lección"), CursoLeccion.curso_id == curso.id)
        .first()
    )
    if not leccion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lección no encontrada")

    payload = datos.model_dump(exclude_unset=True)
    if "orden" in payload and payload["orden"] != leccion.orden:
        conflicto = (
            db.query(CursoLeccion)
            .filter(
                CursoLeccion.curso_id == curso.id,
                CursoLeccion.orden == payload["orden"],
                CursoLeccion.id != leccion.id,
            )
            .first()
        )
        if conflicto:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Orden de lección en uso")
    for k, v in payload.items():
        setattr(leccion, k, v)
    curso.fecha_actualizacion = datetime.utcnow()
    db.commit()
    db.refresh(leccion)
    return _leccion_response(leccion, incluir_contenido=True)


@router.delete("/cursos/{curso_id}/lecciones/{leccion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_leccion(
    curso_id: str,
    leccion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    importador_id = _require_importador_empresa(current_user)
    curso = _get_curso(db, curso_id)
    _assert_curso_de_empresa(curso, importador_id)
    leccion = (
        db.query(CursoLeccion)
        .filter(CursoLeccion.id == _uuid(leccion_id, "Lección"), CursoLeccion.curso_id == curso.id)
        .first()
    )
    if not leccion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lección no encontrada")
    db.query(ProgresoLeccion).filter(ProgresoLeccion.leccion_id == leccion.id).delete()
    db.delete(leccion)
    db.flush()
    restantes = _contar_lecciones(db, curso.id)
    if curso.estado == EstadoCurso.publicado.value and restantes == 0:
        curso.estado = EstadoCurso.borrador.value
    curso.fecha_actualizacion = datetime.utcnow()
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Catálogo y compra (solicitante)
# ---------------------------------------------------------------------------

@router.get("/catalogo", response_model=List[CursoResponse])
async def catalogo_cursos(
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Listado de cursos publicados. Cualquier usuario autenticado puede explorar."""
    q = db.query(Curso).filter(Curso.estado == EstadoCurso.publicado.value)
    if categoria:
        q = q.filter(Curso.categoria == categoria)
    cursos = q.order_by(Curso.fecha_creacion.desc()).all()
    return [_curso_to_response(db, c) for c in cursos]


@router.get("/cursos/{curso_id}", response_model=CursoDetalleResponse)
async def detalle_curso(
    curso_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    curso = _get_curso(db, curso_id)
    es_dueño = (
        current_user.get("importador_id")
        and curso.importador_id == current_user.get("importador_id")
        and current_user["rol"] in ("importador", "asesor")
    )
    if curso.estado != EstadoCurso.publicado.value and not es_dueño:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")

    compra = None
    if current_user["rol"] == "solicitante":
        compra = _compra_confirmada(db, curso.id, current_user["user_id"])

    incluir_contenido = bool(es_dueño or compra)
    lecciones = _lecciones_ordered(db, curso.id)
    completadas_ids = set()
    progreso_pct = None
    lecciones_completadas = None
    if compra:
        total, lecciones_completadas, progreso_pct = _progreso_stats(db, curso.id, current_user["user_id"])
        rows = (
            db.query(ProgresoLeccion.leccion_id)
            .filter(
                ProgresoLeccion.usuario_id == current_user["user_id"],
                ProgresoLeccion.curso_id == curso.id,
                ProgresoLeccion.completada == True,  # noqa: E712
            )
            .all()
        )
        completadas_ids = {r[0] for r in rows}

    leccion_resps = [
        _leccion_response(
            lec,
            incluir_contenido=incluir_contenido,
            completada=(lec.id in completadas_ids) if compra else None,
        )
        for lec in lecciones
    ]

    base = _curso_to_response(db, curso)
    return CursoDetalleResponse(
        **base.model_dump(),
        lecciones=leccion_resps,
        comprado=bool(compra),
        progreso_pct=progreso_pct,
        lecciones_completadas=lecciones_completadas,
    )


@router.post("/cursos/{curso_id}/comprar", response_model=CompraCursoResponse, status_code=status.HTTP_201_CREATED)
async def comprar_curso(
    curso_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    """Solo solicitantes. Simula Wompi si WOMPI_SIMULATE=true (dev)."""
    curso = _get_curso(db, curso_id)
    if curso.estado != EstadoCurso.publicado.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El curso no está disponible para compra")
    if _contar_lecciones(db, curso.id) < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El curso no tiene lecciones")

    existente = (
        db.query(CompraCurso)
        .filter(
            CompraCurso.curso_id == curso.id,
            CompraCurso.comprador_id == current_user["user_id"],
            CompraCurso.estado.in_([
                EstadoCompraCurso.confirmada.value,
                EstadoCompraCurso.pendiente.value,
            ]),
        )
        .first()
    )
    if existente:
        if existente.estado == EstadoCompraCurso.confirmada.value:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya compraste este curso")
        return CompraCursoResponse.model_validate(existente)

    precio = float(curso.precio_usd or 0)
    wompi_payment_id = f"curso_{secrets.token_hex(12)}"
    checkout_url = f"https://checkout.wompi.co/l/{wompi_payment_id}"

    # Gratis o simulación: acceso inmediato
    acceso_inmediato = precio <= 0 or getattr(config, "WOMPI_SIMULATE", True)
    if config.APP_ENV == "production" and precio > 0 and getattr(config, "WOMPI_SIMULATE", True):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pagos Wompi no configurados para producción (WOMPI_SIMULATE=true)",
        )

    compra = CompraCurso(
        id=str(uuid4()),
        curso_id=curso.id,
        comprador_id=current_user["user_id"],
        precio_pagado_usd=precio,
        estado=EstadoCompraCurso.confirmada.value if acceso_inmediato else EstadoCompraCurso.pendiente.value,
        wompi_payment_id=wompi_payment_id if precio > 0 else None,
        checkout_url=checkout_url if precio > 0 and not acceso_inmediato else None,
        fecha_confirmacion=datetime.utcnow() if acceso_inmediato else None,
    )
    if precio > 0 and acceso_inmediato:
        compra.checkout_url = checkout_url  # referencia simulada
    db.add(compra)
    db.commit()
    db.refresh(compra)
    return CompraCursoResponse.model_validate(compra)


@router.get("/mis-compras", response_model=List[CompraCursoResponse])
async def mis_compras(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    compras = (
        db.query(CompraCurso)
        .filter(CompraCurso.comprador_id == current_user["user_id"])
        .order_by(CompraCurso.fecha_creacion.desc())
        .all()
    )
    out = []
    for c in compras:
        item = CompraCursoResponse.model_validate(c)
        curso = db.query(Curso).filter(Curso.id == c.curso_id).first()
        if curso:
            item.curso = _curso_to_response(db, curso)
        out.append(item)
    return out


# ---------------------------------------------------------------------------
# Progreso
# ---------------------------------------------------------------------------

@router.get("/cursos/{curso_id}/progreso", response_model=ProgresoCursoResponse)
async def obtener_progreso(
    curso_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    curso = _get_curso(db, curso_id)
    compra = _compra_confirmada(db, curso.id, current_user["user_id"])
    if not compra:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes comprar el curso para ver el progreso",
        )
    total, completadas, pct = _progreso_stats(db, curso.id, current_user["user_id"])
    done = {
        r[0]
        for r in db.query(ProgresoLeccion.leccion_id)
        .filter(
            ProgresoLeccion.usuario_id == current_user["user_id"],
            ProgresoLeccion.curso_id == curso.id,
            ProgresoLeccion.completada == True,  # noqa: E712
        )
        .all()
    }
    lecciones = [
        _leccion_response(lec, incluir_contenido=True, completada=lec.id in done)
        for lec in _lecciones_ordered(db, curso.id)
    ]
    return ProgresoCursoResponse(
        curso_id=curso.id,
        total_lecciones=total,
        lecciones_completadas=completadas,
        progreso_pct=pct,
        lecciones=lecciones,
    )


@router.post(
    "/cursos/{curso_id}/lecciones/{leccion_id}/completar",
    response_model=ProgresoCursoResponse,
)
async def marcar_leccion_completada(
    curso_id: str,
    leccion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    curso = _get_curso(db, curso_id)
    compra = _compra_confirmada(db, curso.id, current_user["user_id"])
    if not compra:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes comprar el curso para marcar progreso",
        )
    leccion = (
        db.query(CursoLeccion)
        .filter(CursoLeccion.id == _uuid(leccion_id, "Lección"), CursoLeccion.curso_id == curso.id)
        .first()
    )
    if not leccion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lección no encontrada")

    existente = (
        db.query(ProgresoLeccion)
        .filter(
            ProgresoLeccion.usuario_id == current_user["user_id"],
            ProgresoLeccion.leccion_id == leccion.id,
        )
        .first()
    )
    if existente:
        if not existente.completada:
            existente.completada = True
            existente.fecha_completada = datetime.utcnow()
            db.commit()
    else:
        db.add(ProgresoLeccion(
            id=str(uuid4()),
            usuario_id=current_user["user_id"],
            curso_id=curso.id,
            leccion_id=leccion.id,
            compra_id=compra.id,
            completada=True,
            fecha_completada=datetime.utcnow(),
        ))
        db.commit()

    # Reutilizar respuesta de progreso
    return await obtener_progreso(curso_id=curso_id, db=db, current_user=current_user)


@router.delete(
    "/cursos/{curso_id}/lecciones/{leccion_id}/completar",
    response_model=ProgresoCursoResponse,
)
async def desmarcar_leccion_completada(
    curso_id: str,
    leccion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    curso = _get_curso(db, curso_id)
    compra = _compra_confirmada(db, curso.id, current_user["user_id"])
    if not compra:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Debes comprar el curso")
    leccion = (
        db.query(CursoLeccion)
        .filter(CursoLeccion.id == _uuid(leccion_id, "Lección"), CursoLeccion.curso_id == curso.id)
        .first()
    )
    if not leccion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lección no encontrada")
    db.query(ProgresoLeccion).filter(
        ProgresoLeccion.usuario_id == current_user["user_id"],
        ProgresoLeccion.leccion_id == leccion.id,
    ).delete()
    db.commit()
    return await obtener_progreso(curso_id=curso_id, db=db, current_user=current_user)
