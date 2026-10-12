"""Planes de acceso con pago manual (ver services/planes.py).

Público: la sección «Planes» del home y la inscripción (`/planes/inscripcion`),
que funciona sin sesión. Admin: editar los planes y revisar las inscripciones.
"""
import json
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field, ValidationError, model_validator
from sqlalchemy.orm import Session

from models.usuario import Usuario
from services import planes as svc
from utils.dependencies import get_db, get_optional_current_user, require_rol
from utils.limiter import RATE_LIMIT_PLANES, limiter

router = APIRouter(prefix="/planes", tags=["Planes"])


# ── Esquemas ─────────────────────────────────────────────────────────────────

class DatosInscripcion(BaseModel):
    """Lo que se pide para crear la cuenta y facturar (los mismos datos del registro)."""
    email: EmailStr
    tipo_persona: Literal["natural", "juridica"] = "natural"
    nombre: Optional[str] = Field(None, max_length=120)
    apellido: Optional[str] = Field(None, max_length=120)
    tipo_documento: Optional[str] = Field(None, max_length=30)
    numero_documento: Optional[str] = Field(None, max_length=50)
    razon_social: Optional[str] = Field(None, max_length=255)
    nit: Optional[str] = Field(None, max_length=50)
    indicativo_pais_telefono: str = Field("+57", pattern=r"^\+\d{1,4}$")
    telefono: str = Field(..., min_length=7, max_length=30)
    ciudad: Optional[str] = Field(None, max_length=100)
    acepto_condiciones: bool
    acepto_datos: bool

    @model_validator(mode="after")
    def validar(self):
        for campo in ("nombre", "apellido", "tipo_documento", "numero_documento", "razon_social", "nit",
                      "telefono", "ciudad"):
            valor = getattr(self, campo)
            if isinstance(valor, str):
                setattr(self, campo, valor.strip() or None)
        self.email = self.email.lower()
        requeridos = ("razon_social", "nit") if self.tipo_persona == "juridica" else (
            "nombre", "apellido", "tipo_documento", "numero_documento")
        faltan = [c for c in requeridos if not getattr(self, c)]
        if faltan:
            raise ValueError(f"Faltan: {', '.join(faltan)}")
        if not self.acepto_condiciones:
            raise ValueError("Debes aceptar las condiciones de los planes")
        if not self.acepto_datos:
            raise ValueError("Debes autorizar el tratamiento de tus datos")
        return self


class PlanCampos(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=80)
    para_quien: Optional[str] = Field(None, max_length=200)
    precio_cop: int = Field(..., ge=0, le=1_000_000_000)
    iva_pct: int = Field(19, ge=0, le=100)
    solicitudes_incluidas: int = Field(0, ge=0, le=10000)
    vigencia_meses: int = Field(12, ge=1, le=120)
    dias_tendencias: Optional[int] = Field(None, ge=1, le=3650)
    precio_solicitud_adicional_cop: Optional[int] = Field(None, ge=0, le=100_000_000)
    incluye: List[str] = Field(default_factory=list, max_length=12)
    cupos_totales: Optional[int] = Field(None, ge=0, le=100000)
    destacado: bool = False
    orden: int = Field(0, ge=0, le=1000)
    activo: bool = True


class PlanCrear(PlanCampos):
    clave: str = Field(..., min_length=2, max_length=40, pattern=r"^[a-z0-9-]+$")


class PlanActualizar(BaseModel):
    clave: Optional[str] = Field(None, min_length=2, max_length=40, pattern=r"^[a-z0-9-]+$")
    nombre: Optional[str] = Field(None, min_length=2, max_length=80)
    para_quien: Optional[str] = Field(None, max_length=200)
    precio_cop: Optional[int] = Field(None, ge=0, le=1_000_000_000)
    iva_pct: Optional[int] = Field(None, ge=0, le=100)
    solicitudes_incluidas: Optional[int] = Field(None, ge=0, le=10000)
    vigencia_meses: Optional[int] = Field(None, ge=1, le=120)
    dias_tendencias: Optional[int] = Field(None, ge=1, le=3650)
    precio_solicitud_adicional_cop: Optional[int] = Field(None, ge=0, le=100_000_000)
    incluye: Optional[List[str]] = Field(None, max_length=12)
    cupos_totales: Optional[int] = Field(None, ge=0, le=100000)
    destacado: Optional[bool] = None
    orden: Optional[int] = Field(None, ge=0, le=1000)
    activo: Optional[bool] = None


class Rechazo(BaseModel):
    motivo: str = Field(..., min_length=3, max_length=500)


def _usuario_opcional(db: Session, current_user: Optional[dict]) -> Optional[Usuario]:
    if not current_user:
        return None
    return db.query(Usuario).filter(Usuario.id == current_user["user_id"], Usuario.activo.is_(True)).first()


def _admin(db: Session, current_user: dict) -> Usuario:
    return db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()


def _datos(crudo: str) -> dict:
    """Los datos llegan como JSON en un campo del formulario (junto al archivo)."""
    try:
        return DatosInscripcion.model_validate(json.loads(crudo)).model_dump()
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Datos inválidos")
    except ValidationError as exc:
        primero = exc.errors()[0]
        mensaje = str(primero.get("msg", "Datos inválidos")).removeprefix("Value error, ")
        campo = ".".join(str(x) for x in primero.get("loc", ()) if x != "__root__")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"{campo}: {mensaje}" if campo else mensaje)


# ── Público ──────────────────────────────────────────────────────────────────

@router.get("")
def listar_planes(db: Session = Depends(get_db)):
    """Planes activos con precio, IVA, lo que incluyen y cupos restantes."""
    from services import comprobantes

    return {"planes": svc.listar(db), "datos_pago": comprobantes.datos_pago(db)}


@router.post("/{clave}/inscripcion", status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_PLANES)
async def inscribirse(
    request: Request,
    clave: str,
    datos: str = Form(...),
    comprobante: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    """Inscripción con el comprobante de la transferencia. No exige sesión."""
    limpios = _datos(datos)
    plan = svc.por_clave(db, clave)
    contenido = await comprobante.read(svc.MAX_COMPROBANTE_BYTES + 1)
    ins = svc.inscribir(db, plan, limpios, archivo_nombre=comprobante.filename or "comprobante",
                        archivo=contenido, usuario=_usuario_opcional(db, current_user))
    db.commit()
    return {"id": ins.id, "estado": ins.estado, "total_cop": ins.total_cop}


@router.post("/{clave}/lista-espera", status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_PLANES)
async def entrar_lista_espera(
    request: Request,
    clave: str,
    datos: DatosInscripcion,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    plan = svc.por_clave(db, clave)
    ins = svc.lista_espera(db, plan, datos.model_dump(), _usuario_opcional(db, current_user))
    db.commit()
    return {"id": ins.id, "estado": ins.estado}


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/planes")
def admin_planes(db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    return svc.listar(db, admin=True)


@router.post("/admin/planes", status_code=status.HTTP_201_CREATED)
def admin_crear_plan(datos: PlanCrear, db: Session = Depends(get_db),
                     current_user: dict = Depends(require_rol("admin"))):
    plan = svc.crear(db, datos.model_dump())
    db.commit()
    return svc.a_dict(db, plan, admin=True)


@router.put("/admin/planes/{plan_id}")
def admin_actualizar_plan(plan_id: str, datos: PlanActualizar, db: Session = Depends(get_db),
                          current_user: dict = Depends(require_rol("admin"))):
    """Cambiar el precio no toca las inscripciones ya hechas: guardan lo que costaba."""
    plan = svc.actualizar(db, plan_id, datos.model_dump(exclude_unset=True))
    db.commit()
    return svc.a_dict(db, plan, admin=True)


@router.get("/admin/inscripciones")
def admin_inscripciones(
    estado: Optional[str] = Query(None, pattern="^(pendiente|activa|rechazada|lista_espera)$"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    return [svc.ins_a_dict(db, i) for i in svc.listar_inscripciones(db, estado)]


@router.get("/admin/inscripciones/{inscripcion_id}/comprobante")
def admin_comprobante(inscripcion_id: str, db: Session = Depends(get_db),
                      current_user: dict = Depends(require_rol("admin"))):
    ins = svc.obtener_inscripcion(db, inscripcion_id)
    ruta = svc.ruta_comprobante(ins)
    if ruta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Esta inscripción no tiene comprobante")
    return FileResponse(ruta, media_type=ins.comprobante_mime or "application/octet-stream",
                        filename=ins.comprobante_nombre or ruta.name)


@router.post("/admin/inscripciones/{inscripcion_id}/activar")
def admin_activar(inscripcion_id: str, db: Session = Depends(get_db),
                  current_user: dict = Depends(require_rol("admin"))):
    ins = svc.activar(db, inscripcion_id, _admin(db, current_user))
    db.commit()
    return svc.ins_a_dict(db, ins)


@router.post("/admin/inscripciones/{inscripcion_id}/rechazar")
def admin_rechazar(inscripcion_id: str, datos: Rechazo, db: Session = Depends(get_db),
                   current_user: dict = Depends(require_rol("admin"))):
    ins = svc.rechazar(db, inscripcion_id, _admin(db, current_user), datos.motivo)
    db.commit()
    return svc.ins_a_dict(db, ins)
