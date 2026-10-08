"""Acceso a Tendencias por suscripción o cortesía, acceso libre temporal y
gestión de aprobadores.

Tendencias v2 (feed de productos virales) vive en routers/tendencias_virales.py
y hoy es público. Lo de aquí queda listo para cuando se cobre la suscripción:
checkout, simulación de pago, cortesías y acceso libre.
"""
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import config
from models.pago import EstadoPago, Pago
from models.tendencias import AccesoTendencias, CambioTendencias, OrigenAcceso, SuscripcionAvisoTendencias
from models.usuario import Usuario
from schemas import tendencias as sch
from services import configuracion, tendencias as svc
from services.tendencias_calculo import bogota_a_utc
from utils.dependencies import get_current_user, get_db, require_rol

router = APIRouter(prefix="/tendencias", tags=["Tendencias"])


# ── Dependencias ─────────────────────────────────────────────────────────────

def _usuario(db: Session, current_user: dict) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    if usuario is None or not usuario.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no válido")
    return usuario


def usuario_actual(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> Usuario:
    return _usuario(db, current_user)


def aprobador(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)) -> Usuario:
    if not svc.puede_curar(usuario):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el equipo aprobador puede hacer esto")
    return usuario


# ── Comprador: acceso y suscripción ──────────────────────────────────────────

@router.get("/acceso")
def mi_acceso(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    vigente = svc.acceso_vigente(db, usuario.id)
    hasta = svc.acceso_hasta(db, usuario.id)
    libre_hasta = svc.acceso_libre_hasta(db)
    precio = svc.precio_suscripcion(db)
    aviso = db.query(SuscripcionAvisoTendencias).filter(SuscripcionAvisoTendencias.usuario_id == usuario.id).first()
    # Si el acceso libre dura más que el propio, se informa ese.
    origen = vigente.origen if vigente else None
    if libre_hasta and (hasta is None or libre_hasta > hasta):
        origen, hasta = "libre", libre_hasta
    return {
        "tiene_acceso": svc.tiene_acceso(db, usuario),
        "es_curador": svc.puede_curar(usuario),
        "origen": origen,
        "vigente_hasta": hasta.isoformat() + "Z" if hasta else None,
        "acceso_libre_hasta": libre_hasta.isoformat() + "Z" if libre_hasta else None,
        "precio_cop": precio,
        "dias_suscripcion": svc.dias_suscripcion(db),
        "venta_habilitada": precio is not None and usuario.rol == "solicitante",
        "pago_simulado": bool(getattr(config, "WOMPI_SIMULATE", True)),
        "aviso_suscrito": aviso is not None,
    }


@router.post("/suscripcion/checkout", status_code=status.HTTP_201_CREATED)
def iniciar_suscripcion(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    """Crea el pago pendiente de un periodo de suscripción y devuelve el enlace
    de Wompi. El acceso se activa cuando el webhook confirma el pago."""
    if usuario.rol != "solicitante":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="La suscripción a Tendencias es para cuentas de comprador")
    precio = svc.precio_suscripcion(db)
    if precio is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="La suscripción todavía no está a la venta")
    if config.APP_ENV == "production" and getattr(config, "WOMPI_SIMULATE", True):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Pagos Wompi no configurados para producción (WOMPI_SIMULATE=true)")

    dias = svc.dias_suscripcion(db)
    # Igual que la compra de créditos: referencia local mientras la integración
    # real con Wompi sigue pendiente (ver docs 03-Backend/Pagos-Wompi).
    wompi_payment_id = f"wpm_{secrets.token_hex(12)}"
    pago = Pago(
        usuario_id=usuario.id,
        wompi_payment_id=wompi_payment_id,
        monto_usd=0,
        monto_cop=float(precio),
        creditos_comprados=0,
        concepto=svc.CONCEPTO_PAGO_SUSCRIPCION,
        dias_acceso=dias,
        estado=EstadoPago.pendiente.value,
    )
    db.add(pago)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se pudo crear el pago, inténtalo de nuevo")
    return {
        "pago_id": pago.id,
        "wompi_payment_id": wompi_payment_id,
        "checkout_url": f"https://checkout.wompi.co/l/{wompi_payment_id}",
        "monto_cop": precio,
        "dias": dias,
        "pago_simulado": bool(getattr(config, "WOMPI_SIMULATE", True)),
    }


@router.post("/suscripcion/simular-pago/{pago_id}")
def simular_pago(pago_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    """Solo fuera de producción y con WOMPI_SIMULATE: confirma el pago como lo
    haría el webhook, para poder probar el flujo completo en local."""
    if config.APP_ENV == "production" or not getattr(config, "WOMPI_SIMULATE", True):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No disponible")
    pago = db.query(Pago).filter(Pago.id == pago_id, Pago.usuario_id == usuario.id).first()
    if pago is None or pago.concepto != svc.CONCEPTO_PAGO_SUSCRIPCION:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    ganado = (
        db.query(Pago)
        .filter(Pago.id == pago.id, Pago.estado == EstadoPago.pendiente.value)
        .update({Pago.estado: EstadoPago.confirmado.value, Pago.fecha_confirmacion: datetime.utcnow()},
                synchronize_session=False)
    )
    if ganado != 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El pago ya fue procesado")
    acceso = svc.activar_suscripcion_pagada(db, pago)
    db.commit()
    return {"vigente_hasta": acceso.fin.isoformat() + "Z"}


class ParametrosSuscripcion(BaseModel):
    # Sin precio (o 0) la suscripción no se vende; solo se regala.
    precio_cop: Optional[int] = Field(None, ge=0, le=100_000_000)
    dias_suscripcion: int = Field(30, ge=1, le=3650)


def _parametros(db: Session) -> dict:
    libre = svc.acceso_libre_hasta(db)
    return {
        "precio_cop": svc.precio_suscripcion(db),
        "dias_suscripcion": svc.dias_suscripcion(db),
        "acceso_libre_hasta": libre.isoformat() + "Z" if libre else None,
    }


@router.get("/admin/suscripcion")
def ver_suscripcion(db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    return _parametros(db)


@router.put("/admin/suscripcion")
def guardar_suscripcion(datos: ParametrosSuscripcion, db: Session = Depends(get_db),
                        current_user: dict = Depends(require_rol("admin"))):
    uid = current_user["user_id"]
    configuracion.guardar(db, svc.CLAVE_PRECIO_COP, str(datos.precio_cop) if datos.precio_cop else None, uid)
    configuracion.guardar(db, svc.CLAVE_DIAS_SUSCRIPCION, str(datos.dias_suscripcion), uid)
    db.commit()
    return _parametros(db)


# ── Admin: accesos y curadores ───────────────────────────────────────────────

def _acceso_dict(a: AccesoTendencias, usuario: Optional[Usuario], ahora: datetime) -> dict:
    return {
        "id": a.id,
        "usuario_id": a.usuario_id,
        "email": usuario.email if usuario else None,
        "nombre": usuario.nombre if usuario else None,
        "origen": a.origen,
        "inicio": a.inicio.isoformat() + "Z",
        "fin": a.fin.isoformat() + "Z",
        "nota": a.nota,
        "revocado": a.revocado_en is not None,
        "vigente": a.revocado_en is None and a.inicio <= ahora < a.fin,
    }


@router.get("/admin/accesos")
def listar_accesos(solo_vigentes: bool = True, db: Session = Depends(get_db),
                   current_user: dict = Depends(require_rol("admin"))):
    ahora = datetime.utcnow()
    consulta = db.query(AccesoTendencias, Usuario).join(Usuario, Usuario.id == AccesoTendencias.usuario_id)
    if solo_vigentes:
        consulta = consulta.filter(AccesoTendencias.revocado_en.is_(None), AccesoTendencias.fin > ahora)
    filas = consulta.order_by(AccesoTendencias.fin.desc()).limit(500).all()
    return [_acceso_dict(a, u, ahora) for a, u in filas]


@router.post("/admin/accesos", status_code=status.HTTP_201_CREATED)
def otorgar_cortesia(datos: sch.OtorgarAcceso, db: Session = Depends(get_db),
                     current_user: dict = Depends(require_rol("admin"))):
    """Regala acceso por `dias` a un usuario existente, sin pago."""
    usuario = db.query(Usuario).filter(func.lower(Usuario.email) == datos.email.lower()).first()
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay ninguna cuenta con ese correo")
    acceso = svc.otorgar_acceso(
        db, usuario_id=usuario.id, dias=datos.dias, origen=OrigenAcceso.cortesia.value,
        otorgado_por=current_user["user_id"], nota=datos.nota,
    )
    from services.notificacion_service import notificar

    notificar(
        db, usuario_id=usuario.id, tipo="tendencias",
        titulo="Tienes acceso a Tendencias",
        mensaje=f"El equipo de Zarpi te dio acceso a Tendencias por {datos.dias} días.",
        enlace_relativo="/tendencias", whatsapp=False,
    )
    db.commit()
    return _acceso_dict(acceso, usuario, datetime.utcnow())


@router.post("/admin/accesos/{acceso_id}/revocar")
def revocar_acceso(acceso_id: str, db: Session = Depends(get_db),
                   current_user: dict = Depends(require_rol("admin"))):
    acceso = db.query(AccesoTendencias).filter(AccesoTendencias.id == acceso_id).first()
    if acceso is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Acceso no encontrado")
    if acceso.revocado_en is None:
        acceso.revocado_en = datetime.utcnow()
        db.commit()
    usuario = db.query(Usuario).filter(Usuario.id == acceso.usuario_id).first()
    return _acceso_dict(acceso, usuario, datetime.utcnow())


@router.put("/admin/acceso-libre")
def fijar_acceso_libre(datos: sch.AccesoLibre, db: Session = Depends(get_db),
                       current_user: dict = Depends(require_rol("admin"))):
    """Abre Tendencias a todos los usuarios con sesión durante `dias` días o
    hasta `hasta` (hora de Bogotá). Sin ninguno de los dos, lo cierra ya: vuelve
    a ser solo para suscriptores e invitados."""
    ahora = datetime.utcnow()
    if datos.hasta is not None:
        hasta = bogota_a_utc(datos.hasta.replace(tzinfo=None))
        if hasta <= ahora:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La fecha de fin debe ser futura")
    elif datos.dias is not None:
        hasta = ahora + timedelta(days=datos.dias)
    else:
        hasta = None
    configuracion.guardar(db, svc.CLAVE_ACCESO_LIBRE_HASTA, hasta.isoformat() if hasta else None,
                          current_user["user_id"])
    db.add(CambioTendencias(usuario_id=current_user["user_id"],
                            accion="acceso_libre_abierto" if hasta else "acceso_libre_cerrado",
                            datos={"hasta": hasta.isoformat() + "Z" if hasta else None}))
    db.commit()
    return {"acceso_libre_hasta": hasta.isoformat() + "Z" if hasta else None}


@router.get("/admin/curadores")
def listar_curadores(db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    return [
        {"id": u.id, "email": u.email, "nombre": u.nombre, "rol": u.rol}
        for u in db.query(Usuario).filter(Usuario.es_curador.is_(True)).order_by(Usuario.email).all()
    ]


@router.put("/admin/curadores")
def asignar_curador(email: str, datos: sch.Curador, db: Session = Depends(get_db),
                    current_user: dict = Depends(require_rol("admin"))):
    usuario = db.query(Usuario).filter(func.lower(Usuario.email) == email.strip().lower()).first()
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay ninguna cuenta con ese correo")
    usuario.es_curador = datos.es_curador
    db.add(CambioTendencias(usuario_id=current_user["user_id"], accion="curador_asignado" if datos.es_curador else "curador_quitado",
                            datos={"usuario_id": usuario.id, "email": usuario.email}))
    db.commit()
    return {"id": usuario.id, "email": usuario.email, "nombre": usuario.nombre, "rol": usuario.rol,
            "es_curador": usuario.es_curador}

