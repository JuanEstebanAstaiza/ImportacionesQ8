from uuid import uuid4, UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models.usuario import Usuario
from models.organizacion import OrganizacionSolicitante, MiembroOrganizacion, RolOrganizacion
from schemas.features import (
    OrganizacionResponse, MiembroResponse, InvitarMiembroRequest, ActualizarMiembroRequest,
)
from utils.dependencies import get_db, require_rol
from utils.security import hash_password

router = APIRouter(prefix="/organizaciones", tags=["Organizaciones solicitantes"])


def _miembro_activo(db: Session, user_id: str) -> MiembroOrganizacion:
    m = db.query(MiembroOrganizacion).filter(
        MiembroOrganizacion.usuario_id == user_id,
        MiembroOrganizacion.activo == True,  # noqa: E712
    ).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No perteneces a una organización")
    return m


def _require_admin_org(db: Session, user_id: str) -> MiembroOrganizacion:
    m = _miembro_activo(db, user_id)
    if m.rol_org not in (RolOrganizacion.owner.value, RolOrganizacion.admin.value):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo owner/admin de la organización")
    return m


@router.get("/me", response_model=OrganizacionResponse)
async def mi_organizacion(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    usuario = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    if not usuario or not usuario.organizacion_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No perteneces a una organización")
    org = db.query(OrganizacionSolicitante).filter(OrganizacionSolicitante.id == usuario.organizacion_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organización no encontrada")
    return org


@router.get("/me/miembros", response_model=List[MiembroResponse])
async def listar_miembros(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    m = _miembro_activo(db, current_user["user_id"])
    miembros = db.query(MiembroOrganizacion).filter(
        MiembroOrganizacion.organizacion_id == m.organizacion_id
    ).all()
    out = []
    for mem in miembros:
        u = db.query(Usuario).filter(Usuario.id == mem.usuario_id).first()
        out.append(MiembroResponse(
            id=mem.id,
            organizacion_id=mem.organizacion_id,
            usuario_id=mem.usuario_id,
            email=u.email if u else None,
            nombre=u.nombre if u else None,
            rol_org=mem.rol_org,
            activo=mem.activo,
        ))
    return out


@router.post("/me/invitar", response_model=MiembroResponse, status_code=status.HTTP_201_CREATED)
async def invitar_miembro(
    datos: InvitarMiembroRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    """Crea o vincula un solicitante al wallet corporativo de la organización."""
    admin = _require_admin_org(db, current_user["user_id"])
    org = db.query(OrganizacionSolicitante).filter(OrganizacionSolicitante.id == admin.organizacion_id).first()

    existente = db.query(Usuario).filter(Usuario.email == datos.email).first()
    if existente:
        if existente.rol != "solicitante":
            raise HTTPException(status_code=400, detail="Solo se pueden invitar cuentas solicitante")
        if existente.organizacion_id and existente.organizacion_id != org.id:
            raise HTTPException(status_code=400, detail="El usuario ya pertenece a otra organización")
        usuario = existente
        usuario.organizacion_id = org.id
        # El saldo personal no se usa mientras esté en la org
    else:
        usuario = Usuario(
            id=str(uuid4()),
            email=datos.email,
            password_hash=hash_password(datos.password),
            rol="solicitante",
            tipo_persona="natural",
            nombre=datos.nombre or datos.email.split("@")[0],
            organizacion_id=org.id,
            creditos_balance=0.0,
            activo=True,
            perfil_completo=True,
            acepto_politica_datos=True,
        )
        db.add(usuario)
        db.flush()

    ya = db.query(MiembroOrganizacion).filter(
        MiembroOrganizacion.organizacion_id == org.id,
        MiembroOrganizacion.usuario_id == usuario.id,
    ).first()
    if ya:
        ya.activo = True
        ya.rol_org = datos.rol_org
        miembro = ya
    else:
        miembro = MiembroOrganizacion(
            id=str(uuid4()),
            organizacion_id=org.id,
            usuario_id=usuario.id,
            rol_org=datos.rol_org,
            activo=True,
        )
        db.add(miembro)

    db.commit()
    db.refresh(miembro)
    return MiembroResponse(
        id=miembro.id,
        organizacion_id=miembro.organizacion_id,
        usuario_id=miembro.usuario_id,
        email=usuario.email,
        nombre=usuario.nombre,
        rol_org=miembro.rol_org,
        activo=miembro.activo,
    )


@router.put("/me/miembros/{miembro_id}", response_model=MiembroResponse)
async def actualizar_miembro(
    miembro_id: str,
    datos: ActualizarMiembroRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    admin = _require_admin_org(db, current_user["user_id"])
    try:
        mid = str(UUID(miembro_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")

    miembro = db.query(MiembroOrganizacion).filter(
        MiembroOrganizacion.id == mid,
        MiembroOrganizacion.organizacion_id == admin.organizacion_id,
    ).first()
    if not miembro:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    if miembro.rol_org == RolOrganizacion.owner.value:
        raise HTTPException(status_code=400, detail="No se puede modificar al owner")

    if datos.rol_org is not None:
        miembro.rol_org = datos.rol_org
    if datos.activo is not None:
        miembro.activo = datos.activo
        if not datos.activo:
            u = db.query(Usuario).filter(Usuario.id == miembro.usuario_id).first()
            if u:
                u.organizacion_id = None

    db.commit()
    u = db.query(Usuario).filter(Usuario.id == miembro.usuario_id).first()
    return MiembroResponse(
        id=miembro.id,
        organizacion_id=miembro.organizacion_id,
        usuario_id=miembro.usuario_id,
        email=u.email if u else None,
        nombre=u.nombre if u else None,
        rol_org=miembro.rol_org,
        activo=miembro.activo,
    )
