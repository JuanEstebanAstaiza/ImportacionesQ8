"""Cargue y descargue de pagos: comprobantes manuales (tokens, suscripción, cursos, reto)."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.usuario import Usuario
from services import comprobantes as svc
from services import tendencias as tendencias_svc
from utils.dependencies import get_current_user, get_db, require_rol

router = APIRouter(prefix="/comprobantes", tags=["Pagos"])


class NuevoComprobante(BaseModel):
    tipo: Literal["tokens", "suscripcion", "curso"]
    archivo_id: str = Field(..., min_length=36, max_length=36)
    # Solo `curso`: el curso que paga (el valor es el del curso).
    curso_id: Optional[str] = Field(None, min_length=36, max_length=36)
    # Tokens o días que dice haber pagado, y el monto. Orientativos: decide el admin.
    cantidad: Optional[int] = Field(None, ge=1, le=10000)
    monto_cop: Optional[int] = Field(None, ge=0, le=100_000_000)
    nota: Optional[str] = Field(None, max_length=500)


class Aprobacion(BaseModel):
    # Tokens a acreditar (tokens) o días de suscripción (suscripcion). Un curso no lleva cantidad.
    cantidad: Optional[int] = Field(None, ge=1, le=10000)


class Rechazo(BaseModel):
    motivo: str = Field(..., min_length=3, max_length=300)


class ComprobanteReto(BaseModel):
    participacion_id: str = Field(..., min_length=36, max_length=36)
    archivo_id: str = Field(..., min_length=36, max_length=36)


class ConfigPagos(BaseModel):
    precio_token_cop: Optional[int] = Field(None, ge=0, le=100_000_000)
    # Cuenta, titular, NIT… lo que el usuario necesita para transferir.
    datos_pago: Optional[str] = Field(None, max_length=2000)


def _usuario(db: Session, current_user: dict) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    if usuario is None or not usuario.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no válido")
    return usuario


# ── Usuario ──────────────────────────────────────────────────────────────────

@router.get("/resumen")
def resumen(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Cómo pagar y el saldo: precio por token, datos de la cuenta, suscripción."""
    from services import acceso_cursos

    usuario = _usuario(db, current_user)
    return {
        # Los cursos con precio se pagan subiendo el comprobante (carpeta «Cursos»).
        "cursos_pago_manual": acceso_cursos.pago_manual_activo(db),
        "precio_token_cop": svc.precio_token(db),
        "datos_pago": svc.datos_pago(db),
        "tokens": int(usuario.puntos_cotizacion or 0),
        "cotizaciones_gratis": int(usuario.cotizaciones_gratis or 0),
        "suscripcion": {
            "precio_cop": tendencias_svc.precio_suscripcion(db),
            "dias": tendencias_svc.dias_suscripcion(db),
            "vigente_hasta": (h.isoformat() + "Z") if (h := tendencias_svc.acceso_hasta(db, usuario.id)) else None,
        },
    }


@router.get("/cursos")
def cursos_por_pagar(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Los cursos con precio que el usuario todavía no tiene, para elegir cuál paga.
    `pendiente`: ya mandó el comprobante y lo estamos revisando."""
    from models.comprobante import ComprobantePago, EstadoComprobante
    from models.curso import CompraCurso
    from services import acceso_cursos

    usuario = _usuario(db, current_user)
    if not acceso_cursos.pago_manual_activo(db):
        return []
    propios = {fila[0] for fila in db.query(CompraCurso.curso_id).filter(CompraCurso.usuario_id == usuario.id)}
    pendientes = {fila[0] for fila in db.query(ComprobantePago.curso_id).filter(
        ComprobantePago.usuario_id == usuario.id, ComprobantePago.tipo == "curso",
        ComprobantePago.estado == EstadoComprobante.pendiente.value)}
    return [
        {**curso, "pendiente": curso["id"] in pendientes}
        for curso in acceso_cursos.catalogo_publicado(db)
        if curso["precio"] > 0 and curso["id"] not in propios
    ]


@router.get("")
def mis_comprobantes(tipo: Optional[Literal["tokens", "suscripcion", "reto", "curso"]] = None,
                     db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    usuario = _usuario(db, current_user)
    return [svc.a_dict(db, c) for c in svc.mios(db, usuario.id, tipo)]


@router.post("", status_code=status.HTTP_201_CREATED)
def subir(datos: NuevoComprobante, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Registra un comprobante ya subido a gestión documental (`archivo_id`).
    Queda pendiente hasta que el admin lo revise."""
    usuario = _usuario(db, current_user)
    c = svc.crear(db, usuario, tipo=datos.tipo, archivo_id=datos.archivo_id, cantidad=datos.cantidad,
                  monto_cop=datos.monto_cop, nota=datos.nota, curso_id=datos.curso_id)
    db.commit()
    return svc.a_dict(db, c)


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin")
def para_admin(estado: Optional[Literal["pendiente", "aprobado", "rechazado", "enviado"]] = None,
               tipo: Optional[Literal["tokens", "suscripcion", "reto", "curso"]] = None,
               db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    return [svc.a_dict(db, c, admin=True) for c in svc.para_admin(db, estado=estado, tipo=tipo)]


@router.post("/{comprobante_id}/aprobar")
def aprobar(comprobante_id: str, datos: Aprobacion, db: Session = Depends(get_db),
            current_user: dict = Depends(require_rol("admin"))):
    c = svc.aprobar(db, comprobante_id, _usuario(db, current_user), datos.cantidad)
    db.commit()
    return svc.a_dict(db, c, admin=True)


@router.post("/{comprobante_id}/rechazar")
def rechazar(comprobante_id: str, datos: Rechazo, db: Session = Depends(get_db),
             current_user: dict = Depends(require_rol("admin"))):
    c = svc.rechazar(db, comprobante_id, _usuario(db, current_user), datos.motivo)
    db.commit()
    return svc.a_dict(db, c, admin=True)


@router.post("/admin/reto", status_code=status.HTTP_201_CREATED)
def subir_reto(datos: ComprobanteReto, db: Session = Depends(get_db),
               current_user: dict = Depends(require_rol("admin"))):
    """El comprobante de la transferencia de una recompensa del reto."""
    c = svc.subir_reto(db, _usuario(db, current_user), datos.participacion_id, datos.archivo_id)
    db.commit()
    return svc.a_dict(db, c, admin=True)


@router.get("/admin/config")
def ver_config(db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    return {"precio_token_cop": svc.precio_token(db), "datos_pago": svc.datos_pago(db)}


@router.put("/admin/config")
def guardar_config(datos: ConfigPagos, db: Session = Depends(get_db),
                   current_user: dict = Depends(require_rol("admin"))):
    svc.guardar_config(db, precio_token_cop=datos.precio_token_cop, datos=datos.datos_pago,
                       usuario_id=current_user["user_id"])
    db.commit()
    return {"precio_token_cop": svc.precio_token(db), "datos_pago": svc.datos_pago(db)}
