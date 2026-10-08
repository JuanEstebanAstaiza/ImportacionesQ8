"""Reto comunitario de Tendencias: rondas, inscripción, reclamo y pagos."""
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from models.reto import EstadoRonda, RetoRonda
from models.usuario import Usuario
from services import reto as svc
from services.tendencias_calculo import bogota_a_utc
from utils.dependencies import get_current_user, get_db, get_optional_current_user, require_rol
from utils.limiter import RATE_LIMIT_RETO_LISTA, limiter

router = APIRouter(prefix="/reto", tags=["Reto"])


class RondaDatos(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=80)
    max_participantes: int = Field(20, ge=1, le=10000)
    umbral_aprobados: int = Field(10, ge=1, le=1000)
    recompensa_cop: int = Field(50000, ge=0, le=100_000_000)
    recompensa_cotizaciones: int = Field(5, ge=0, le=1000)
    # Hora de Bogotá.
    fecha_limite: datetime
    abrir_siguiente_al_llenarse: bool = True


class RondaCambios(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=80)
    max_participantes: Optional[int] = Field(None, ge=1, le=10000)
    fecha_limite: Optional[datetime] = None
    abrir_siguiente_al_llenarse: Optional[bool] = None
    cerrar: bool = False


class Reclamo(BaseModel):
    eleccion: Literal["efectivo", "cotizaciones"]


class CuentaPagoDatos(BaseModel):
    banco: str = Field(..., min_length=2, max_length=80)
    tipo_cuenta: Literal["ahorros", "corriente"]
    numero_cuenta: str = Field(..., min_length=6, max_length=30)
    titular: str = Field(..., min_length=3, max_length=150)
    documento_titular: str = Field(..., min_length=5, max_length=20)

    @field_validator("numero_cuenta")
    @classmethod
    def solo_digitos(cls, v: str) -> str:
        digitos = "".join(c for c in v if c.isdigit())
        if len(digitos) < 6:
            raise ValueError("El número de cuenta debe tener al menos 6 dígitos")
        return digitos


class Pagado(BaseModel):
    referencia: str = Field(..., min_length=3, max_length=120)


class ListaEspera(BaseModel):
    email: EmailStr


def _usuario(db: Session, current_user: dict) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    if usuario is None or not usuario.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no válido")
    return usuario


# ── Público y participantes ──────────────────────────────────────────────────

@router.get("/rondas/abierta")
def ronda_abierta(response: Response, db: Session = Depends(get_db)):
    """La ronda que acepta inscripciones, con los cupos que quedan en vivo."""
    response.headers["Cache-Control"] = "no-store"
    ronda = svc.ronda_abierta(db)
    return {"ronda": svc.ronda_dict(db, ronda) if ronda else None, "exclusiones": svc.EXCLUSIONES}


@router.post("/rondas/{ronda_id}/inscribirme", status_code=status.HTTP_201_CREATED)
def inscribirme(ronda_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    usuario = _usuario(db, current_user)
    participacion = svc.inscribir(db, ronda_id, usuario)
    return svc.resumen_participacion(db, participacion)


@router.post("/lista-espera", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(RATE_LIMIT_RETO_LISTA)
def lista_espera(request: Request, datos: ListaEspera, db: Session = Depends(get_db),
                 current_user: Optional[dict] = Depends(get_optional_current_user)):
    usuario = _usuario(db, current_user) if current_user else None
    svc.anotar_lista_espera(db, datos.email, usuario)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/mi-participacion")
def mi_participacion(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """La participación vigente y, si no hay, la última con recompensa pendiente
    de cobro (para no perder el reclamo cuando la ronda ya cerró)."""
    usuario = _usuario(db, current_user)
    participacion = svc.participacion_vigente(db, usuario.id)
    if participacion is None:
        from models.reto import EstadoRecompensa, RetoParticipacion

        participacion = (
            db.query(RetoParticipacion)
            .filter(RetoParticipacion.usuario_id == usuario.id,
                    RetoParticipacion.estado_recompensa.in_(
                        (EstadoRecompensa.reclamable.value, EstadoRecompensa.solicitada.value)))
            .order_by(RetoParticipacion.fecha_inscripcion.desc()).first()
        )
    return {
        "participacion": svc.resumen_participacion(db, participacion),
        "cotizaciones_gratis": usuario.cotizaciones_gratis or 0,
    }


@router.post("/participaciones/{participacion_id}/reclamar")
def reclamar(participacion_id: str, datos: Reclamo, db: Session = Depends(get_db),
             current_user: dict = Depends(get_current_user)):
    usuario = _usuario(db, current_user)
    return svc.resumen_participacion(db, svc.reclamar(db, participacion_id, usuario, datos.eleccion))


@router.put("/participaciones/{participacion_id}/cuenta-pago")
def cuenta_pago(participacion_id: str, datos: CuentaPagoDatos, db: Session = Depends(get_db),
                current_user: dict = Depends(get_current_user)):
    usuario = _usuario(db, current_user)
    return svc.resumen_participacion(db, svc.guardar_cuenta(db, participacion_id, usuario, datos.model_dump()))


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/rondas")
def listar_rondas(db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    rondas = db.query(RetoRonda).order_by(RetoRonda.fecha_creacion.desc()).limit(100).all()
    return [svc.ronda_dict(db, r, admin=True) for r in rondas]


@router.post("/rondas", status_code=status.HTTP_201_CREATED)
def crear_ronda(datos: RondaDatos, db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    fin = bogota_a_utc(datos.fecha_limite.replace(tzinfo=None))
    if fin <= datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La fecha límite debe ser futura")
    if svc.ronda_abierta(db) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Ya hay una ronda abierta. Ciérrala antes de abrir otra.")
    ronda = RetoRonda(**{**datos.model_dump(), "fecha_limite": fin}, creada_por=current_user["user_id"])
    db.add(ronda)
    db.commit()
    db.refresh(ronda)
    svc.avisar_lista_espera(db, ronda)
    return svc.ronda_dict(db, ronda, admin=True)


@router.patch("/rondas/{ronda_id}")
def editar_ronda(ronda_id: str, datos: RondaCambios, db: Session = Depends(get_db),
                 current_user: dict = Depends(require_rol("admin"))):
    ronda = db.query(RetoRonda).filter(RetoRonda.id == ronda_id).first()
    if ronda is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ronda no encontrada")
    if datos.cerrar:
        ronda.estado = EstadoRonda.cerrada.value
    if datos.nombre is not None:
        ronda.nombre = datos.nombre
    if datos.abrir_siguiente_al_llenarse is not None:
        ronda.abrir_siguiente_al_llenarse = datos.abrir_siguiente_al_llenarse
    if datos.max_participantes is not None:
        if datos.max_participantes < svc.inscritos(db, ronda.id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="No puedes dejar menos cupos que inscritos")
        ronda.max_participantes = datos.max_participantes
        if ronda.estado == EstadoRonda.llena.value and datos.max_participantes > svc.inscritos(db, ronda.id):
            ronda.estado = EstadoRonda.abierta.value
    if datos.fecha_limite is not None:
        ronda.fecha_limite = bogota_a_utc(datos.fecha_limite.replace(tzinfo=None))
    db.commit()
    return svc.ronda_dict(db, ronda, admin=True)


@router.get("/rondas/{ronda_id}/participantes")
def participantes(ronda_id: str, db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    """Incluye los datos bancarios descifrados: solo para el admin que paga."""
    return svc.participantes(db, ronda_id)


@router.patch("/participaciones/{participacion_id}/pagado")
def marcar_pagado(participacion_id: str, datos: Pagado, db: Session = Depends(get_db),
                  current_user: dict = Depends(require_rol("admin"))):
    svc.marcar_pagado(db, participacion_id, datos.referencia)
    return {"ok": True}
