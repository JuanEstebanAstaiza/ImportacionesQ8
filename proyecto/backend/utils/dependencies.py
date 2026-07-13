from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError

# Importacion condicional para evitar conectar a MySQL en tests
try:
    from database import get_db as _get_db
except Exception:
    def _get_db():
        """Fallback para cuando no hay conexion a MySQL"""
        return None

from utils.security import decode_access_token

# Esquema de seguridad para extraer el token del header Authorization
# Configurar auto_error=False para retornar 401 en lugar de 403 cuando no hay token
security = HTTPBearer(auto_error=False)

def get_db():
    """
    Dependencia FastAPI para obtener una sesion de base de datos.

    Debe *yield*-ear la sesion. Un `return _get_db()` devolveria el objeto
    generator y en produccion falla con
    `AttributeError: 'generator' object has no attribute 'query'`
    (los tests enmascaraban el bug al overridear esta dependencia).
    """
    gen = _get_db()
    if gen is None:
        yield None
        return
    yield from gen

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependencia que extrae y valida el JWT token del header Authorization.
    
    Returns:
        Diccionario con {user_id, rol} si el token es valido
        
    Raises:
        HTTPException 401: Si el token es invalido o esta expirado
    """
    # Si no hay credentials (no se proporciono token), retornar 401
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
        rol = payload.get("rol")
        importador_id = payload.get("importador_id")
        
        if user_id is None or rol is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalido",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token invalido o expirado: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {"user_id": user_id, "rol": rol, "importador_id": importador_id}

def require_rol(rol: str):
    """
    Dependencia que verifica el rol del usuario autenticado.
    
    Args:
        rol: Rol requerido para acceder al endpoint
        
    Returns:
        Funcion de dependencia que valida el rol del usuario
    """
    async def verificar_rol(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["rol"] != rol:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado - Rol insuficiente"
            )
        return current_user
    
    return verificar_rol

def require_rol_in(*roles: str):
    """
    Dependencia que permite el acceso a cualquiera de varios roles (ej. la cuenta
    duena "importador" y sus "asesor" comparten algunos endpoints del panel
    de empresa).
    """
    async def verificar_rol(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["rol"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado - Rol insuficiente"
            )
        return current_user
    
    return verificar_rol

def get_current_solicitante(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependencia que verifica que el usuario sea un solicitante"""
    if current_user["rol"] != "solicitante":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Se requiere rol de solicitante"
        )
    return current_user

def get_current_importador(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependencia que verifica que el usuario sea un importador"""
    if current_user["rol"] != "importador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Se requiere rol de importador"
        )
    return current_user

def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependencia que verifica que el usuario sea un admin"""
    if current_user["rol"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Se requiere rol de administrador"
        )
    return current_user
