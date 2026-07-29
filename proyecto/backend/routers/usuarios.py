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
# Router separado para el panel del asesor ("cuántas cotizaciones tengo asignadas")
asesores_router = APIRouter(prefix="/asesores", tags=["Asesores"])


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
    empresa importadora: dueño y asesores).
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


@asesores_router.get("/me/cotizaciones", response_model=List[CotizacionAsignadaItem])
async def listar_mis_cotizaciones_asignadas(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("asesor"))
):
    """
    Cotizaciones que el asesor autenticado ha reclamado (pantalla "cuántas
    tengo asignadas" del panel de empresa).
    """
    user_id_str = str(PyUUID(current_user["user_id"]))

    cotizaciones = db.query(Cotizacion).filter(
        Cotizacion.asesor_asignado_id == user_id_str
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
            asesor_asignado_id=c.asesor_asignado_id
        )
        for c in cotizaciones
    ]


@asesores_router.get("/dashboard/stats")
async def dashboard_stats_asesor(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("asesor")),
):
    """
    Métricas de rendimiento del asesor: cotizaciones respondidas, tasa de
    aceptación, volumen cotizado y órdenes asociadas.
    """
    from schemas.metricas_empresa import MetricasAsesorResponse
    from models.propuesta import Propuesta, EstadoPropuesta
    from models.orden import Orden

    asesor_id = str(PyUUID(current_user["user_id"]))

    cotizaciones_asignadas = db.query(Cotizacion).filter(
        Cotizacion.asesor_asignado_id == asesor_id
    ).count()

    propuestas = db.query(Propuesta).filter(
        Propuesta.creado_por_usuario_id == asesor_id
    ).all()
    enviadas = [p for p in propuestas if p.estado != EstadoPropuesta.borrador.value]
    aceptadas = [p for p in propuestas if p.estado == EstadoPropuesta.aceptada.value]

    # Cotizaciones asignadas que ya tienen al menos una propuesta de la empresa
    importador_id = current_user.get("importador_id")
    cot_asignadas = db.query(Cotizacion).filter(
        Cotizacion.asesor_asignado_id == asesor_id
    ).all()
    respondidas = 0
    if importador_id:
        for c in cot_asignadas:
            tiene = db.query(Propuesta).filter(
                Propuesta.cotizacion_id == c.id,
                Propuesta.importador_id == importador_id,
                Propuesta.estado != EstadoPropuesta.borrador.value,
            ).first()
            if tiene:
                respondidas += 1

    tasa = (len(aceptadas) / len(enviadas) * 100) if enviadas else 0.0
    volumen = sum(float(p.precio_ofrecido_usd or 0) for p in enviadas)

    ordenes = db.query(Orden).filter(Orden.asesor_asignado_id == asesor_id).count()

    return MetricasAsesorResponse(
        asesor_id=asesor_id,
        cotizaciones_asignadas=cotizaciones_asignadas,
        cotizaciones_respondidas=respondidas,
        propuestas_enviadas=len(enviadas),
        propuestas_aceptadas=len(aceptadas),
        tasa_aceptacion_pct=round(tasa, 2),
        volumen_cotizado_usd=round(volumen, 2),
        ordenes_asociadas=ordenes,
    )
