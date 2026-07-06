from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime

from models.usuario import Usuario
from schemas.auth import RegistroRequest, LoginRequest, TokenResponse, LoginResponse
from utils.security import hash_password, verify_password, create_access_token
from fastapi import HTTPException, status

def register_user(registro: RegistroRequest, db: Session) -> TokenResponse:
    """
    Registra un nuevo usuario en el sistema.
    
    Args:
        registro: Datos de registro (email, password, rol)
        db: Sesión de base de datos
        
    Returns:
        TokenResponse con access_token, user_id y rol
        
    Raises:
        HTTPException 400: Si el email ya está registrado o el rol es inválido
    """
    # Validar que el rol sea válido
    roles_validos = ["solicitante", "importador", "admin"]
    if registro.rol not in roles_validos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rol inválido. Roles permitidos: solicitante, importador, admin"
        )
    
    # Verificar que el email no exista ya en la base de datos
    usuario_existente = db.query(Usuario).filter(Usuario.email == registro.email).first()
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado"
        )
    
    # Generar hash de la contraseña
    password_hash = hash_password(registro.password)
    
    # Crear nuevo usuario en la base de datos
    nuevo_usuario = Usuario(
        id=str(uuid4()),  # Generar UUID como string para SQLite
        email=registro.email,
        password_hash=password_hash,
        rol=registro.rol,
        perfil_completo=False
    )
    
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    
    # Generar JWT token
    access_token = create_access_token(str(nuevo_usuario.id), nuevo_usuario.rol)
    
    return TokenResponse(
        access_token=access_token,
        user_id=str(nuevo_usuario.id),
        rol=nuevo_usuario.rol
    )

def login_user(login: LoginRequest, db: Session) -> LoginResponse:
    """
    Inicia sesión de un usuario existente.
    
    Args:
        login: Datos de inicio de sesión (email, password)
        db: Sesión de base de datos
        
    Returns:
        LoginResponse con access_token, user_id, rol y perfil_completo
        
    Raises:
        HTTPException 401: Si las credenciales son inválidas
    """
    # Buscar usuario por email
    usuario = db.query(Usuario).filter(Usuario.email == login.email).first()
    
    if not usuario or not verify_password(login.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generar JWT token
    access_token = create_access_token(str(usuario.id), usuario.rol)
    
    return LoginResponse(
        access_token=access_token,
        user_id=str(usuario.id),
        rol=usuario.rol,
        perfil_completo=usuario.perfil_completo
    )

def refresh_token(token: str, db: Session) -> TokenResponse:
    """
    Renueva un token JWT expirado (si el usuario sigue activo).
    
    Args:
        token: Token JWT actual a renovar
        db: Sesión de base de datos
        
    Returns:
        TokenResponse con nuevo access_token
        
    Raises:
        HTTPException 401: Si el token es inválido o está expirado
    """
    from utils.security import decode_access_token
    
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        rol = payload.get("rol")
        
        if user_id is None or rol is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido o expirado: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verificar que el usuario aún existe y está activo
    usuario = db.query(Usuario).filter(Usuario.id == str(user_id)).first()  # Convertir a string para SQLite
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generar nuevo token JWT
    access_token = create_access_token(str(usuario.id), usuario.rol)
    
    return TokenResponse(
        access_token=access_token,
        user_id=str(usuario.id),
        rol=usuario.rol
    )