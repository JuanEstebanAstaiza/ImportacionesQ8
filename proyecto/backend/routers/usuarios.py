import logging
from uuid import UUID as PyUUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from schemas.usuario import UsuarioMeResponse, UsuarioMeUpdate, CotizacionAsignadaItem
from utils.dependencies import get_db, get_current_user, require_rol

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])
# Router separado para el panel del trabajador ("cuántas cotizaciones tengo asignadas")
trabajadores_router = APIRouter(prefix="/trabajadores", tags=["Trabajadores"])


@router.get("/me", response_model=UsuarioMeResponse)
async def obtener_mi_perfil(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Obtiene el perfil personal de la cuenta autenticada (cualquier rol)."""
    user_id_str = str(PyUUID(current_user["user_id"]))
    usuario = db.query(Usuario).filter(Usuario.id == user_id_str).first()

    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    return usuario


@router.put("/me", response_model=UsuarioMeResponse)
async def actualizar_mi_perfil(
    datos: UsuarioMeUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Personaliza el perfil personal de la cuenta autenticada: nombre, teléfono,
    foto y WhatsApp (aplica tanto al cliente solicitante como a las cuentas de la
    empresa importadora: dueño y trabajadores).
    """
    user_id_str = str(PyUUID(current_user["user_id"]))
    usuario = db.query(Usuario).filter(Usuario.id == user_id_str).first()

    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    datos_actualizados = datos.model_dump(exclude_unset=True)
    for campo, valor in datos_actualizados.items():
        setattr(usuario, campo, valor)

    if any([usuario.nombre, usuario.telefono]):
        usuario.perfil_completo = True

    db.commit()
    db.refresh(usuario)

    return usuario


@trabajadores_router.get("/me/cotizaciones", response_model=List[CotizacionAsignadaItem])
async def listar_mis_cotizaciones_asignadas(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("trabajador"))
):
    """
    Cotizaciones que el trabajador autenticado ha reclamado (pantalla "cuántas
    tengo asignadas" del panel de empresa).
    """
    user_id_str = str(PyUUID(current_user["user_id"]))

    cotizaciones = db.query(Cotizacion).filter(
        Cotizacion.trabajador_asignado_id == user_id_str
    ).order_by(Cotizacion.fecha_creacion.desc()).all()

    return [
        CotizacionAsignadaItem(
            id=str(c.id),
            solicitante_id=c.solicitante_id,
            modalidad=c.modalidad,
            nombre_producto=c.nombre_producto,
            descripcion_cliente=c.descripcion_cliente,
            cantidad_minima=c.cantidad_minima,
            precio_objetivo_usd=c.precio_objetivo_usd,
            incoterm=c.incoterm,
            estado=c.estado.value if isinstance(c.estado, EstadoCotizacion) else c.estado,
            fecha_creacion=c.fecha_creacion.isoformat() if hasattr(c.fecha_creacion, "isoformat") else str(c.fecha_creacion),
            trabajador_asignado_id=c.trabajador_asignado_id
        )
        for c in cotizaciones
    ]
