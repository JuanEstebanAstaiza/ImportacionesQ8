"""Panel de admin: asignación de solicitudes abiertas y ajustes de operación.

- Modo de asignación (manual en el piloto) y cupo de empresas por solicitud.
- TRM: la vigente, de dónde salió, y el valor de respaldo.
- Solicitudes abiertas con sus empresas asignadas; candidatas con su encaje;
  asignar y quitar asignaciones.

La lógica vive en `services/asignacion.py`, `services/configuracion.py` y
`services/trm.py`.
"""
from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from models.cotizacion import Cotizacion
from models.importador import Importador
from models.propuesta import EstadoPropuesta, Propuesta
from schemas.asignacion import (
    ActualizarAsignacionRequest,
    ActualizarTrmRequest,
    AsignarRequest,
    CandidatosResponse,
    ConfiguracionOperacionResponse,
    EstadoTrm,
    SolicitudAbiertaAdmin,
)
from services import asignacion, configuracion, trm
from utils.dependencies import get_current_user, get_db, require_rol

router = APIRouter(prefix="/admin", tags=["Administración"])
# TRM vigente para cualquier usuario con sesión (el frontend la usa para
# mostrar equivalencias en pesos).
trm_router = APIRouter(prefix="/trm", tags=["Cotizaciones"])


def _configuracion(db: Session) -> dict:
    return {
        "asignacion": {
            "modo": configuracion.modo_asignacion(db),
            "cupo_por_solicitud": configuracion.cupo_por_solicitud(db),
        },
        "trm": trm.estado_trm(db),
    }


@router.get("/configuracion-operacion", response_model=ConfiguracionOperacionResponse)
async def obtener_configuracion_operacion(
    current_user: dict = Depends(require_rol("admin")),
    db: Session = Depends(get_db),
):
    """Modo y cupo de asignación, y el estado de la TRM."""
    datos = _configuracion(db)
    db.commit()  # si la TRM se acaba de consultar, queda guardada
    return datos


@router.put("/configuracion-operacion/asignacion", response_model=ConfiguracionOperacionResponse)
async def actualizar_asignacion(
    datos: ActualizarAsignacionRequest,
    current_user: dict = Depends(require_rol("admin")),
    db: Session = Depends(get_db),
):
    """Cambia el modo de asignación (`manual` / `automatica`) o el cupo por solicitud.

    Bajar el cupo no quita asignaciones ya hechas: solo impide añadir más.
    """
    if datos.modo is not None:
        configuracion.guardar(db, configuracion.CLAVE_MODO_ASIGNACION, datos.modo, current_user["user_id"])
    if datos.cupo_por_solicitud is not None:
        configuracion.guardar(
            db, configuracion.CLAVE_CUPO_POR_SOLICITUD, str(datos.cupo_por_solicitud), current_user["user_id"]
        )
    db.commit()
    return _configuracion(db)


@router.put("/configuracion-operacion/trm", response_model=EstadoTrm)
async def actualizar_trm_respaldo(
    datos: ActualizarTrmRequest,
    current_user: dict = Depends(require_rol("admin")),
    db: Session = Depends(get_db),
):
    """Fija (o quita, con `null`) la TRM de respaldo que se usa si falla la oficial."""
    configuracion.guardar(
        db, trm.CLAVE_RESPALDO, str(datos.respaldo) if datos.respaldo is not None else None, current_user["user_id"]
    )
    db.commit()
    estado = trm.estado_trm(db)
    db.commit()
    return estado


@router.post("/configuracion-operacion/trm/consultar", response_model=EstadoTrm)
async def consultar_trm_ahora(
    current_user: dict = Depends(require_rol("admin")),
    db: Session = Depends(get_db),
):
    """Vuelve a consultar la TRM oficial ahora, sin esperar al día siguiente."""
    trm.reiniciar_cache()
    configuracion.guardar(db, trm.CLAVE_OFICIAL_CONSULTA, None)
    estado = trm.estado_trm(db)
    db.commit()
    return estado


def _resumen_solicitud(db: Session, cotizacion: Cotizacion, cupo: int, ahora: datetime) -> dict:
    recepciones = asignacion.asignaciones(db, cotizacion.id)
    nombres = {
        str(i): n for i, n in db.query(Importador.id, Importador.nombre_empresa).filter(
            Importador.id.in_([r.importador_id for r in recepciones] or [""])
        )
    }
    propuestas = {
        p.importador_id: getattr(p.estado, "value", p.estado)
        for p in db.query(Propuesta).filter(Propuesta.cotizacion_id == cotizacion.id)
    }
    return {
        "id": str(cotizacion.id),
        "nombre_producto": cotizacion.nombre_producto,
        "linea_producto": cotizacion.linea_producto,
        "pais_importacion": cotizacion.pais_importacion,
        "cantidad_minima": cotizacion.cantidad_minima,
        "unidad_cantidad": cotizacion.unidad_cantidad or "unidades",
        "precio_objetivo_usd": cotizacion.precio_objetivo_usd,
        "moneda_precio_objetivo": cotizacion.moneda_precio_objetivo or "USD",
        "tipo_calidad": cotizacion.tipo_calidad,
        "incoterm": cotizacion.incoterm,
        "estado": getattr(cotizacion.estado, "value", cotizacion.estado),
        "fecha_creacion": cotizacion.fecha_creacion,
        "horas_desde_creacion": round(((ahora - cotizacion.fecha_creacion).total_seconds() / 3600), 1)
        if cotizacion.fecha_creacion else 0,
        "asignadas": len(recepciones),
        "cupo_por_solicitud": cupo,
        "propuestas_enviadas": sum(1 for e in propuestas.values() if e != EstadoPropuesta.borrador.value),
        "empresas": [
            {
                "importador_id": r.importador_id,
                "nombre_empresa": nombres.get(r.importador_id, "Empresa"),
                "origen": r.origen,
                "fecha_asignacion": r.fecha_recepcion,
                "estado_propuesta": propuestas.get(r.importador_id),
            }
            for r in recepciones
        ],
    }


def _cotizacion_abierta(db: Session, cotizacion_id: str) -> Cotizacion:
    try:
        cotizacion_id = str(UUID(cotizacion_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada")
    cotizacion = db.query(Cotizacion).filter(Cotizacion.id == cotizacion_id).first()
    if cotizacion is None or cotizacion.modalidad != "abierta":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud abierta no encontrada")
    return cotizacion


@router.get("/solicitudes-abiertas", response_model=List[SolicitudAbiertaAdmin])
async def listar_solicitudes_abiertas_admin(
    filtro: str = Query("vigentes", pattern="^(por_asignar|vigentes|todas)$"),
    limite: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(require_rol("admin")),
    db: Session = Depends(get_db),
):
    """Solicitudes abiertas con sus empresas asignadas.

    - `por_asignar`: vigentes con huecos libres en el cupo.
    - `vigentes`: las que todavía admiten propuestas.
    - `todas`: también las cerradas y canceladas.
    """
    consulta = db.query(Cotizacion).filter(Cotizacion.modalidad == "abierta")
    if filtro in ("por_asignar", "vigentes"):
        consulta = consulta.filter(Cotizacion.estado.in_(asignacion.ESTADOS_ASIGNABLES))
    cotizaciones = consulta.order_by(Cotizacion.fecha_creacion.desc()).limit(limite).all()

    cupo = configuracion.cupo_por_solicitud(db)
    ahora = datetime.utcnow()
    resumenes = [_resumen_solicitud(db, c, cupo, ahora) for c in cotizaciones]
    if filtro == "por_asignar":
        resumenes = [r for r in resumenes if r["asignadas"] < cupo]
        # La más antigua primero: es la que más lleva esperando.
        resumenes.sort(key=lambda r: r["fecha_creacion"])
    return resumenes


@router.get("/solicitudes-abiertas/{cotizacion_id}/candidatos", response_model=CandidatosResponse)
async def candidatos_para_solicitud(
    cotizacion_id: str,
    solo_que_encajan: bool = Query(False, description="Solo empresas de esa categoría y país"),
    current_user: dict = Depends(require_rol("admin")),
    db: Session = Depends(get_db),
):
    """Empresas del circuito abierto con su encaje (categoría, país, pedido
    mínimo, capacidad), su desempeño y su cupo del día. Primero las ya
    asignadas y luego por puntaje de encaje."""
    cotizacion = _cotizacion_abierta(db, cotizacion_id)
    return {
        "solicitud": _resumen_solicitud(db, cotizacion, configuracion.cupo_por_solicitud(db), datetime.utcnow()),
        "candidatos": asignacion.evaluar_candidatos(db, cotizacion, solo_que_encajan=solo_que_encajan),
    }


def _avisar_empresas(db: Session, cotizacion: Cotizacion, importador_ids: List[str]) -> None:
    from routers.cotizaciones import _notificar_empresa

    for importador_id in importador_ids:
        _notificar_empresa(
            db,
            importador_id=importador_id,
            tipo="cotizacion",
            titulo="Nueva solicitud asignada",
            mensaje=f"Zarpi te asignó una solicitud abierta: {cotizacion.nombre_producto}.",
            data={"cotizacion_id": str(cotizacion.id), "modalidad": "abierta"},
            enlace_relativo="/cotizaciones",
        )


@router.post("/solicitudes-abiertas/{cotizacion_id}/asignar", response_model=SolicitudAbiertaAdmin)
async def asignar_solicitud(
    cotizacion_id: str,
    datos: AsignarRequest,
    current_user: dict = Depends(require_rol("admin")),
    db: Session = Depends(get_db),
):
    """Asigna la solicitud a una o varias empresas, sin pasar del cupo por solicitud.

    409 si se pasaría del cupo, si la solicitud ya no admite propuestas o si una
    empresa agotó su límite diario; 400 si la empresa no trabaja la categoría.
    """
    cotizacion = _cotizacion_abierta(db, cotizacion_id)
    try:
        nuevas = asignacion.asignar(db, cotizacion, datos.importador_ids, admin=current_user)
    except asignacion.ErrorAsignacion as error:
        db.rollback()
        raise HTTPException(status_code=error.codigo, detail=error.mensaje)
    db.commit()

    asignacion.publicar_en_redis(cotizacion, nuevas)
    try:
        _avisar_empresas(db, cotizacion, nuevas)
        db.commit()
    except Exception:
        db.rollback()

    db.refresh(cotizacion)
    return _resumen_solicitud(db, cotizacion, configuracion.cupo_por_solicitud(db), datetime.utcnow())


@router.delete("/solicitudes-abiertas/{cotizacion_id}/asignaciones/{importador_id}", response_model=SolicitudAbiertaAdmin)
async def quitar_asignacion(
    cotizacion_id: str,
    importador_id: str,
    current_user: dict = Depends(require_rol("admin")),
    db: Session = Depends(get_db),
):
    """Quita la asignación a una empresa que todavía no envió propuesta."""
    cotizacion = _cotizacion_abierta(db, cotizacion_id)
    try:
        asignacion.desasignar(db, cotizacion, importador_id, admin=current_user)
    except asignacion.ErrorAsignacion as error:
        db.rollback()
        raise HTTPException(status_code=error.codigo, detail=error.mensaje)
    db.commit()
    return _resumen_solicitud(db, cotizacion, configuracion.cupo_por_solicitud(db), datetime.utcnow())


@trm_router.get("", response_model=dict)
async def trm_vigente(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """TRM que usa hoy la plataforma: `{valor, fuente, vigencia, fecha_consulta}`.

    `fuente` es `oficial`, `respaldo_admin`, `ultima_oficial` o `por_defecto`.
    """
    vigente = trm.obtener_trm(db)
    db.commit()
    return vigente
