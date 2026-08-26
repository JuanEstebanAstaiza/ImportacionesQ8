"""Reseñas de empresas importadoras.

Solo reseña quien importó: hace falta una **orden** con esa empresa. Sin ese
requisito la calificación del catálogo no significaría nada, porque cualquiera
podría puntuar a cualquiera sin haber hecho negocio.

El promedio que se muestra en el catálogo (`Importador.calificacion_promedio`)
se recalcula en cada alta, edición, respuesta o moderación; antes era una
columna suelta que nadie alimentaba.
"""
import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.importador import Importador
from models.orden import EstadoOrden, Orden
from models.resena import ResenaImportador
from models.usuario import Usuario
from schemas.resena import (
    OcultarResenaRequest,
    OrdenResenableItem,
    ResenaCreate,
    ResenaResponse,
    ResenaUpdate,
    RespuestaEmpresaRequest,
    ResumenResenasResponse,
)
from services.resena_service import promedio_de_campo, recalcular_calificacion, resumen_de
from utils.dependencies import get_db, get_current_user, require_rol, require_rol_in

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/resenas", tags=["Reseñas"])

# Estados en los que ya hubo entrega y tiene sentido opinar. Reseñar una orden
# recién creada solo mide expectativas, no el cumplimiento.
ESTADOS_RESENABLES = (
    EstadoOrden.bodega_local.value,
    EstadoOrden.entregado.value,
)


def _uuid_o_404(valor: str, que: str) -> str:
    try:
        return str(UUID(valor))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{que} no encontrada")


def _a_respuesta(db: Session, resena: ResenaImportador) -> ResenaResponse:
    autor = db.query(Usuario).filter(Usuario.id == resena.autor_usuario_id).first()
    datos = ResenaResponse.model_validate(resena, from_attributes=True)
    # Solo el nombre de pila: la reseña es pública y no hace falta identificar a
    # la persona para que resulte útil a quien la lee.
    datos.autor_nombre = (autor.nombre if autor else None) or "Cliente verificado"
    return datos


@router.get("/pendientes", response_model=List[OrdenResenableItem])
async def ordenes_pendientes_de_resena(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    """Órdenes entregadas del solicitante que todavía no tienen reseña.

    Es lo que alimenta el aviso de "cuéntanos qué tal fue": sin esta lista, el
    usuario tendría que acordarse por su cuenta de volver a puntuar.
    """
    user_id = str(UUID(current_user["user_id"]))

    ya_resenadas = {
        fila[0]
        for fila in db.query(ResenaImportador.orden_id)
        .filter(ResenaImportador.autor_usuario_id == user_id)
        .all()
    }

    ordenes = (
        db.query(Orden)
        .filter(
            Orden.solicitante_id == user_id,
            Orden.estado.in_(ESTADOS_RESENABLES),
        )
        .order_by(Orden.fecha_creacion.desc())
        .limit(50)
        .all()
    )

    pendientes = []
    for orden in ordenes:
        if str(orden.id) in ya_resenadas:
            continue
        empresa = db.query(Importador).filter(Importador.id == orden.importador_id).first()
        pendientes.append(
            OrdenResenableItem(
                orden_id=str(orden.id),
                importador_id=str(orden.importador_id),
                nombre_empresa=empresa.nombre_empresa if empresa else "Empresa importadora",
                producto=orden.cotizacion.nombre_producto if orden.cotizacion else "Producto importado",
                fecha_creacion=orden.fecha_creacion,
            )
        )

    return pendientes


@router.get("/importador/{importador_id}", response_model=List[ResenaResponse])
async def listar_resenas_de_importador(
    importador_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0, le=10_000),
    db: Session = Depends(get_db),
):
    """Reseñas públicas de una empresa. No exige sesión: el catálogo es público
    y quien está eligiendo proveedor todavía puede no haberse registrado."""
    importador_id_str = _uuid_o_404(importador_id, "Empresa")

    filas = (
        db.query(ResenaImportador)
        .filter(
            ResenaImportador.importador_id == importador_id_str,
            ResenaImportador.visible.is_(True),
        )
        .order_by(ResenaImportador.fecha_creacion.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [_a_respuesta(db, fila) for fila in filas]


@router.get("/importador/{importador_id}/resumen", response_model=ResumenResenasResponse)
async def resumen_de_importador(
    importador_id: str,
    db: Session = Depends(get_db),
):
    """Promedio, total y reparto por estrellas para la cabecera de la ficha."""
    importador_id_str = _uuid_o_404(importador_id, "Empresa")
    resumen = resumen_de(db, importador_id_str)

    return ResumenResenasResponse(
        promedio=resumen["promedio"],
        total=resumen["total"],
        reparto=resumen["reparto"],
        puntualidad=promedio_de_campo(db, importador_id_str, ResenaImportador.puntualidad),
        calidad_producto=promedio_de_campo(db, importador_id_str, ResenaImportador.calidad_producto),
        comunicacion=promedio_de_campo(db, importador_id_str, ResenaImportador.comunicacion),
    )


@router.post("", response_model=ResenaResponse, status_code=status.HTTP_201_CREATED)
async def crear_resena(
    datos: ResenaCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    """Publica una reseña sobre la empresa de una orden propia ya entregada."""
    user_id = str(UUID(current_user["user_id"]))
    orden_id = _uuid_o_404(datos.orden_id, "Orden")

    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")

    if orden.solicitante_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes reseñar empresas con las que hayas importado",
        )

    if orden.estado not in ESTADOS_RESENABLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Todavía no se puede reseñar esta orden: la valoración se habilita "
                "cuando la mercancía llega a bodega o se entrega."
            ),
        )

    nueva = ResenaImportador(
        id=str(uuid4()),
        importador_id=orden.importador_id,
        autor_usuario_id=user_id,
        orden_id=orden_id,
        calificacion=datos.calificacion,
        comentario=datos.comentario,
        puntualidad=datos.puntualidad,
        calidad_producto=datos.calidad_producto,
        comunicacion=datos.comunicacion,
    )
    db.add(nueva)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya publicaste una reseña sobre esta orden. Puedes editarla.",
        )

    recalcular_calificacion(db, orden.importador_id)
    _avisar_a_la_empresa(db, resena=nueva)
    db.commit()
    db.refresh(nueva)

    return _a_respuesta(db, nueva)


@router.put("/{resena_id}", response_model=ResenaResponse)
async def editar_resena(
    resena_id: str,
    datos: ResenaUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    """Corrige la propia reseña. La opinión puede cambiar; el derecho a opinar no."""
    user_id = str(UUID(current_user["user_id"]))
    resena = db.query(ResenaImportador).filter(ResenaImportador.id == _uuid_o_404(resena_id, "Reseña")).first()
    if not resena:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")

    if resena.autor_usuario_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado sobre esta reseña")

    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(resena, campo, valor)

    recalcular_calificacion(db, resena.importador_id)
    db.commit()
    db.refresh(resena)

    return _a_respuesta(db, resena)


@router.post("/{resena_id}/responder", response_model=ResenaResponse)
async def responder_resena(
    resena_id: str,
    datos: RespuestaEmpresaRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    """Derecho de réplica de la empresa reseñada.

    Una reseña pública sin posibilidad de responder deja a la empresa sin
    defensa ante una crítica injusta, y al lector sin la otra versión.
    """
    resena = db.query(ResenaImportador).filter(ResenaImportador.id == _uuid_o_404(resena_id, "Reseña")).first()
    if not resena:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")

    if resena.importador_id != current_user.get("importador_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes responder reseñas dirigidas a tu empresa",
        )

    resena.respuesta_empresa = datos.respuesta.strip()
    resena.fecha_respuesta = datetime.utcnow()
    db.commit()
    db.refresh(resena)

    return _a_respuesta(db, resena)


@router.put("/{resena_id}/moderar", response_model=ResenaResponse)
async def moderar_resena(
    resena_id: str,
    datos: OcultarResenaRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Oculta o restaura una reseña. No se borra: se conserva la trazabilidad."""
    resena = db.query(ResenaImportador).filter(ResenaImportador.id == _uuid_o_404(resena_id, "Reseña")).first()
    if not resena:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")

    resena.visible = datos.visible
    resena.motivo_ocultacion = datos.motivo if not datos.visible else None

    recalcular_calificacion(db, resena.importador_id)
    db.commit()
    db.refresh(resena)

    return _a_respuesta(db, resena)


@router.get("/mias", response_model=List[ResenaResponse])
async def mis_resenas(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Reseñas escritas por el solicitante, o recibidas por su empresa.

    Un mismo endpoint sirve a los dos lados porque la pregunta es la misma
    ("¿qué reseñas me tocan?") y la respuesta depende del rol de quien pregunta.
    """
    rol = current_user["rol"]

    consulta = db.query(ResenaImportador)
    if rol == "solicitante":
        consulta = consulta.filter(ResenaImportador.autor_usuario_id == str(UUID(current_user["user_id"])))
    elif rol in ("importador", "asesor"):
        importador_id = current_user.get("importador_id")
        if not importador_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cuenta no está asociada a ninguna empresa importadora",
            )
        consulta = consulta.filter(ResenaImportador.importador_id == importador_id)
    elif rol != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    filas = consulta.order_by(ResenaImportador.fecha_creacion.desc()).limit(100).all()
    return [_a_respuesta(db, fila) for fila in filas]


def _avisar_a_la_empresa(db: Session, *, resena: ResenaImportador) -> None:
    """Aviso in-app a las cuentas de la empresa reseñada (best-effort).

    Va dentro de la misma transacción que la reseña, pero no puede tumbarla: que
    falle una notificación no debe impedir que la opinión quede registrada.
    """
    try:
        from services.notificacion_service import notificar

        cuentas = (
            db.query(Usuario)
            .filter(
                Usuario.importador_id == resena.importador_id,
                Usuario.rol.in_(("importador", "asesor")),
                Usuario.activo.is_(True),
            )
            .all()
        )
        for cuenta in cuentas:
            notificar(
                db,
                usuario_id=str(cuenta.id),
                tipo="resena",
                titulo=f"Nueva reseña de {resena.calificacion} estrellas",
                mensaje="Un cliente valoró su experiencia con tu empresa. Puedes responderle.",
                data={"resena_id": str(resena.id), "importador_id": resena.importador_id},
                enlace_relativo="/perfil-empresa",
            )
    except Exception:
        logger.warning("No se pudo notificar la reseña %s a la empresa", resena.id)
