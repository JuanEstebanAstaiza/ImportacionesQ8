import logging
import re
from uuid import UUID as PyUUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.documental import Archivo
from models.reto import EstadoRecompensa, EleccionRecompensa, RetoParticipacion
from schemas.cuenta_pago import CuentaPagoDatos
from schemas.usuario import CambioContrasena, UsuarioMeResponse, UsuarioMeUpdate, CotizacionAsignadaItem
from services import cuentas_pago
from utils.limiter import RATE_LIMIT_CAMBIO_CONTRASENA, limiter
from utils.security import hash_password, verify_password
from schemas.cotizante import CotizantePerfilPublicoResponse
from utils.dependencies import get_db, get_current_user, require_rol_in

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])
# Router separado para el panel del asesor ("cuántas cotizaciones tengo asignadas")
asesores_router = APIRouter(prefix="/asesores", tags=["Asesores"])
# Vista pública del cotizante bajo su propio recurso (misma respuesta que
# `/usuarios/{id}/perfil-publico`, que se mantiene por compatibilidad).
cotizantes_router = APIRouter(prefix="/cotizantes", tags=["Cotizantes"])


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


def _perfil_publico(db: Session, solicitante_id: str, current_user: dict) -> CotizantePerfilPublicoResponse:
    from services.cotizante_service import obtener_perfil_publico_cotizante as obtener_metricas

    # El cotizante puede ver cómo lo ven las empresas, pero solo el suyo.
    if current_user["rol"] == "solicitante" and current_user["user_id"] != solicitante_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    perfil = obtener_metricas(db, solicitante_id)
    if not perfil:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotizante no encontrado")
    return perfil


@router.get("/{solicitante_id}/perfil-publico", response_model=CotizantePerfilPublicoResponse)
async def obtener_perfil_publico_cotizante(
    solicitante_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor", "admin", "solicitante")),
):
    """Métricas operativas de un cotizante visibles para cuentas de empresa."""
    return _perfil_publico(db, solicitante_id, current_user)


@cotizantes_router.get("/{solicitante_id}/perfil-publico", response_model=CotizantePerfilPublicoResponse)
async def obtener_perfil_publico(
    solicitante_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor", "admin", "solicitante")),
):
    """Métricas del cotizante calculadas en vivo: volumen de órdenes finalizadas,
    importaciones dentro/fuera de la plataforma y promedios en USD."""
    return _perfil_publico(db, solicitante_id, current_user)


_PATRON_ARCHIVO = re.compile(r"^/documentos/archivos/([0-9a-f-]{36})/descargar$")


def _validar_foto(db: Session, ruta: Optional[str], usuario: Usuario) -> Optional[str]:
    """La foto es una imagen que subió la misma cuenta (o una URL https de los
    perfiles anteriores). Nada de `javascript:`, `data:` ni archivos ajenos."""
    ruta = (ruta or "").strip()
    if not ruta:
        return None
    if ruta.startswith("https://"):
        return ruta
    m = _PATRON_ARCHIVO.match(ruta)
    if not m:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sube la foto desde tu perfil")
    archivo = db.query(Archivo).filter(Archivo.id == m.group(1), Archivo.deleted_at.is_(None)).first()
    if archivo is None or archivo.tipo_recurso != "imagen" or archivo.owner_user_id != usuario.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La foto debe ser una imagen que subiste tú")
    return ruta


def _yo(db: Session, current_user: dict) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == str(PyUUID(current_user["user_id"]))).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return usuario


@router.post("/me/contrasena", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(RATE_LIMIT_CAMBIO_CONTRASENA)
async def cambiar_mi_contrasena(
    request: Request,
    datos: CambioContrasena,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Cambia la contraseña con la sesión abierta; pide la actual."""
    usuario = _yo(db, current_user)
    if not verify_password(datos.actual, usuario.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual no es correcta")
    if verify_password(datos.nueva, usuario.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La nueva contraseña debe ser distinta de la actual")
    usuario.password_hash = hash_password(datos.nueva)
    db.commit()
    logger.info("Contraseña cambiada desde el perfil usuario_id=%s", usuario.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/cuenta-pago")
async def obtener_mi_cuenta_pago(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """La cuenta para recibir pagos (recompensas del reto), enmascarada."""
    usuario = _yo(db, current_user)
    return {"cuenta": cuentas_pago.resumen(cuentas_pago.de_usuario(db, usuario.id))}


@router.put("/me/cuenta-pago")
async def guardar_mi_cuenta_pago(
    datos: CuentaPagoDatos,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    usuario = _yo(db, current_user)
    cuenta = cuentas_pago.guardar(db, usuario, datos.model_dump())
    db.commit()
    db.refresh(cuenta)
    return {"cuenta": cuentas_pago.resumen(cuenta)}


@router.delete("/me/cuenta-pago", status_code=status.HTTP_204_NO_CONTENT)
async def borrar_mi_cuenta_pago(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    usuario = _yo(db, current_user)
    pendiente = db.query(RetoParticipacion.id).filter(
        RetoParticipacion.usuario_id == usuario.id,
        RetoParticipacion.eleccion == EleccionRecompensa.efectivo.value,
        RetoParticipacion.estado_recompensa == EstadoRecompensa.solicitada.value,
    ).first()
    if pendiente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Tienes un pago en camino a esta cuenta. Puedes cambiarla, pero no borrarla.")
    cuenta = cuentas_pago.de_usuario(db, usuario.id)
    if cuenta is not None:
        db.delete(cuenta)
        db.commit()


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
    if "foto_url" in datos_actualizados:
        datos_actualizados["foto_url"] = _validar_foto(db, datos_actualizados["foto_url"], usuario)
    for campo in ("nombre", "apellido", "telefono", "whatsapp", "indicativo_pais_telefono"):
        if isinstance(datos_actualizados.get(campo), str):
            datos_actualizados[campo] = datos_actualizados[campo].strip() or None
    # Columna NOT NULL: un null explícito equivale a "no lo cambies".
    if datos_actualizados.get("importaciones_fuera_plataforma") is None:
        datos_actualizados.pop("importaciones_fuera_plataforma", None)
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
    current_user: dict = Depends(require_rol_in("importador", "asesor"))
):
    """
    Cotizaciones que la cuenta autenticada ha reclamado (pantalla "cuántas
    tengo asignadas" del panel de empresa).

    Acepta al dueño además del asesor: `POST /cotizaciones/{id}/reclamar` permite
    reclamar a ambos, así que limitar esta consulta a "asesor" dejaba al dueño con
    un 403 en la pantalla que lista justamente lo que él acababa de reclamar.
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
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    """
    Métricas de rendimiento de la cuenta de empresa autenticada: cotizaciones
    respondidas, tasa de aceptación, volumen cotizado y órdenes asociadas.

    El dueño también reclama y responde cotizaciones, así que ve sus propias
    métricas con el mismo cálculo que un asesor.
    """
    from schemas.metricas_empresa import MetricasAsesorResponse
    from models.propuesta import Propuesta, EstadoPropuesta
    from models.orden import Orden

    from sqlalchemy import func

    asesor_id = str(PyUUID(current_user["user_id"]))
    importador_id = current_user.get("importador_id")

    cotizaciones_asignadas = db.query(func.count(Cotizacion.id)).filter(
        Cotizacion.asesor_asignado_id == asesor_id
    ).scalar() or 0

    enviadas = db.query(func.count(Propuesta.id)).filter(
        Propuesta.creado_por_usuario_id == asesor_id,
        Propuesta.estado != EstadoPropuesta.borrador.value,
    ).scalar() or 0
    aceptadas = db.query(func.count(Propuesta.id)).filter(
        Propuesta.creado_por_usuario_id == asesor_id,
        Propuesta.estado == EstadoPropuesta.aceptada.value,
    ).scalar() or 0
    volumen = db.query(func.coalesce(func.sum(Propuesta.precio_ofrecido_usd), 0.0)).filter(
        Propuesta.creado_por_usuario_id == asesor_id,
        Propuesta.estado != EstadoPropuesta.borrador.value,
    ).scalar() or 0.0

    # Cotizaciones asignadas con al menos una propuesta enviada de la empresa (sin N+1)
    respondidas = 0
    if importador_id:
        respondidas = (
            db.query(func.count(func.distinct(Cotizacion.id)))
            .join(
                Propuesta,
                and_(
                    Propuesta.cotizacion_id == Cotizacion.id,
                    Propuesta.importador_id == importador_id,
                    Propuesta.estado != EstadoPropuesta.borrador.value,
                ),
            )
            .filter(Cotizacion.asesor_asignado_id == asesor_id)
            .scalar()
            or 0
        )

    tasa = (aceptadas / enviadas * 100) if enviadas else 0.0
    ordenes = db.query(func.count(Orden.id)).filter(
        Orden.asesor_asignado_id == asesor_id
    ).scalar() or 0

    return MetricasAsesorResponse(
        asesor_id=asesor_id,
        cotizaciones_asignadas=int(cotizaciones_asignadas),
        cotizaciones_respondidas=int(respondidas),
        propuestas_enviadas=int(enviadas),
        propuestas_aceptadas=int(aceptadas),
        tasa_aceptacion_pct=round(float(tasa), 2),
        volumen_cotizado_usd=round(float(volumen), 2),
        ordenes_asociadas=int(ordenes),
    )
