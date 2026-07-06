from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from schemas.auth import RegistroRequest, LoginRequest, TokenResponse, LoginResponse
from services.auth_service import register_user, login_user
from utils.dependencies import get_db, get_current_user
from utils.security import create_access_token
from config import ACCESS_TOKEN_EXPIRE

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def registrar_usuario(registro: RegistroRequest, db: Session = Depends(get_db)):
    """
    Registra un nuevo usuario en el sistema.
    
    - **email**: Email del usuario (debe ser único)
    - **password**: Contraseña (mínimo 8 caracteres)
    - **rol**: Rol del usuario ("solicitante", "importador" o "admin")
    
    Retorna un JWT token si el registro es exitoso.
    """
    return register_user(registro, db)

@router.post("/login", response_model=LoginResponse)
async def iniciar_sesion(login: LoginRequest, db: Session = Depends(get_db)):
    """
    Inicia sesión de un usuario existente.
    
    - **email**: Email del usuario
    - **password**: Contraseña
    
    Retorna un JWT token y los datos del usuario si las credenciales son válidas.
    """
    return login_user(login, db)

@router.post("/refresh", response_model=TokenResponse)
async def renovar_token(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Renueva un token JWT expirado.
    
    El token actual debe estar en el header Authorization: Bearer <token>.
    Si el token es válido pero está expirado, se genera uno nuevo.
    """
    from datetime import timedelta
    # Generar nuevo token con los mismos claims del usuario autenticado
    # Usamos un expires_delta más corto para garantizar que sea diferente al anterior
    access_token = create_access_token(
        current_user["user_id"], 
        current_user["rol"],
        expires_delta=ACCESS_TOKEN_EXPIRE - timedelta(minutes=1)  # 1 minuto menos de expiración
    )
    
    return TokenResponse(
        access_token=access_token,
        user_id=current_user["user_id"],
        rol=current_user["rol"]
    )

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def cerrar_sesion(current_user: dict = Depends(get_current_user)):
    """
    Cierra sesión del usuario.
    
    En el MVP, no se revoca el token (no hay blacklist). El cliente debe eliminar el token localmente.
    """
    return None