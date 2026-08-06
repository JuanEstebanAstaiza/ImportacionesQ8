from datetime import datetime
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

try:
    from database import get_db as _get_db
except Exception:
    def _get_db():
        return None

from utils.security import decode_access_token, JWTError
from services.token_revocation import jti_revocado

security = HTTPBearer(auto_error=False)


def get_db():
    gen = _get_db()
    if gen is None:
        yield None
        return
    yield from gen


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    """
    Valida JWT, comprueba blacklist (logout), y revalida en DB que el usuario
    siga activo. Los claims rol/importador_id se toman de la BD (fuente de verdad).
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se proporcionaron credenciales",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        jti = payload.get("jti")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not jti:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if db is not None and jti_revocado(db, jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión revocada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from models.usuario import Usuario

    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Base de datos no disponible",
        )

    usuario = db.query(Usuario).filter(Usuario.id == str(user_id)).first()
    if not usuario or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta desactivada o no encontrada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "user_id": str(usuario.id),
        "rol": usuario.rol,
        "importador_id": usuario.importador_id,
        "jti": jti,
        "exp": payload.get("exp"),
        "token": token,
    }


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[dict]:
    """Igual que `get_current_user`, pero devuelve None en lugar de fallar.

    Para rutas donde conviven contenido público y privado (portada del catálogo y
    vista previa de un curso frente al material de pago): sin token se sirve solo
    lo público, con token válido se amplía el acceso.
    """
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials=credentials, db=db)
    except HTTPException:
        return None


def require_rol(rol: str):
    async def verificar_rol(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["rol"] != rol:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado - Rol insuficiente",
            )
        return current_user

    return verificar_rol


def require_rol_in(*roles: str):
    async def verificar_rol(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["rol"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado - Rol insuficiente",
            )
        return current_user

    return verificar_rol


def get_current_solicitante(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["rol"] != "solicitante":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Se requiere rol de solicitante",
        )
    return current_user


def get_current_importador(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["rol"] != "importador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Se requiere rol de importador",
        )
    return current_user


def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["rol"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Se requiere rol de administrador",
        )
    return current_user
