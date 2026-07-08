from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime, timedelta

import config
from models.usuario import Usuario
from models.password_reset import PasswordResetToken
from schemas.auth import (
    RegistroRequest, LoginRequest, TokenResponse, LoginResponse,
    ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest
)
from utils.security import hash_password, verify_password, create_access_token, generar_otp, generar_token_seguro, hash_token
from utils.email import enviar_correo_recuperacion_password
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
    # El auto-registro público solo permite el rol "solicitante". Las cuentas de
    # "importador" (dueño de empresa) y "asesor" las crea un admin o el dueño
    # de la empresa respectivamente, y "admin" solo se crea por otro admin o por
    # seed inicial: esto cierra el hueco de seguridad de auto-registro de cuentas
    # privilegiadas.
    if registro.rol != "solicitante":
        detalle = "Rol inválido. El auto-registro público solo permite el rol 'solicitante'"
        if registro.rol == "importador":
            detalle = "Contáctese con el equipo administrativo para registrar tu empresa importadora"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detalle
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
    
    # Nombre completo a partir de los campos condicionales (persona natural usa
    # nombre + apellido; persona jurídica usa la razón social como "nombre" de
    # contacto para mostrar en el perfil).
    nombre_registro = registro.nombre if registro.tipo_persona == "natural" else registro.razon_social

    # Crear nuevo usuario en la base de datos
    nuevo_usuario = Usuario(
        id=str(uuid4()),  # Generar UUID como string para SQLite
        email=registro.email,
        password_hash=password_hash,
        rol=registro.rol,
        tipo_persona=registro.tipo_persona,
        tipo_documento=registro.tipo_documento,
        numero_documento=registro.numero_documento,
        nit=registro.nit,
        razon_social=registro.razon_social,
        nombre=nombre_registro,
        apellido=registro.apellido,
        indicativo_pais_telefono=registro.indicativo_pais_telefono,
        telefono=registro.telefono,
        acepto_politica_datos=registro.acepto_politica_datos,
        fecha_aceptacion_politica=datetime.utcnow(),
        creditos_balance=config.CREDITO_BONO_REGISTRO,
        perfil_completo=True
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
    
    # Una cuenta desactivada (por un admin, o por el dueño de la empresa a un
    # asesor) no puede iniciar sesión, aunque la contraseña sea correcta.
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta desactivada. Contacta al administrador de tu cuenta",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generar JWT token
    access_token = create_access_token(str(usuario.id), usuario.rol, importador_id=usuario.importador_id)
    
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
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta desactivada",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generar nuevo token JWT
    access_token = create_access_token(str(usuario.id), usuario.rol, importador_id=usuario.importador_id)
    
    return TokenResponse(
        access_token=access_token,
        user_id=str(usuario.id),
        rol=usuario.rol
    )

def forgot_password(solicitud: ForgotPasswordRequest, db: Session) -> ForgotPasswordResponse:
    """
    Inicia la recuperación de contraseña: genera un OTP + token de un solo uso,
    los guarda hasheados, y envía por correo el enlace + el OTP.

    Siempre responde el mismo mensaje genérico exista o no el email, para no
    permitir enumeración de cuentas registradas (se ejecuta el mismo trabajo
    "shape" en ambos casos salvo el envío real del correo).
    """
    usuario = db.query(Usuario).filter(Usuario.email == solicitud.email).first()

    if usuario and usuario.activo:
        otp = generar_otp()
        token = generar_token_seguro()

        # Invalidar cualquier token de recuperación pendiente anterior del usuario
        db.query(PasswordResetToken).filter(
            PasswordResetToken.usuario_id == usuario.id,
            PasswordResetToken.usado == False  # noqa: E712
        ).update({"usado": True})

        nuevo_token = PasswordResetToken(
            id=str(uuid4()),
            usuario_id=str(usuario.id),
            token_hash=hash_token(token),
            otp_hash=hash_token(otp),
            expira_en=datetime.utcnow() + timedelta(minutes=config.PASSWORD_RESET_EXPIRE_MINUTES),
            usado=False
        )
        db.add(nuevo_token)
        db.commit()

        enviar_correo_recuperacion_password(usuario.email, otp, token)

    return ForgotPasswordResponse()

def reset_password(solicitud: ResetPasswordRequest, db: Session) -> None:
    """
    Completa la recuperación de contraseña validando el token + OTP (ambos
    deben corresponder al mismo registro, no estar usados ni expirados).
    """
    token_hash = hash_token(solicitud.token)
    otp_hash = hash_token(solicitud.otp)

    registro_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.usado == False  # noqa: E712
    ).first()

    if (
        not registro_token
        or registro_token.otp_hash != otp_hash
        or registro_token.expira_en < datetime.utcnow()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token u OTP inválido o expirado"
        )

    usuario = db.query(Usuario).filter(Usuario.id == registro_token.usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token u OTP inválido o expirado")

    usuario.password_hash = hash_password(solicitud.nueva_password)
    registro_token.usado = True
    db.commit()