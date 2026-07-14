from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from schemas.auth import (
    RegistroRequest, LoginRequest, TokenResponse, LoginResponse,
    ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest,
    RegistroPendienteResponse, VerificarEmailRequest, ReenviarOtpRequest,
    ReenviarOtpResponse, LoginOtpRequest,
)
from services.auth_service import (
    register_user, login_user, forgot_password, reset_password,
    verificar_email, reenviar_otp, verificar_login_otp,
)
from utils.dependencies import get_db, get_current_user
from utils.security import create_access_token
from utils.limiter import limiter
from config import (
    ACCESS_TOKEN_EXPIRE, RATE_LIMIT_LOGIN, RATE_LIMIT_REGISTER,
    RATE_LIMIT_FORGOT_PASSWORD, RATE_LIMIT_OTP,
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", response_model=RegistroPendienteResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_REGISTER)
async def registrar_usuario(request: Request, registro: RegistroRequest, db: Session = Depends(get_db)):
    """
    Registra un solicitante y envía OTP al correo. No emite JWT hasta
    `POST /auth/verificar-email`.
    """
    return register_user(registro, db)


@router.post("/verificar-email", response_model=LoginResponse)
@limiter.limit(RATE_LIMIT_OTP)
async def verificar_correo(request: Request, solicitud: VerificarEmailRequest, db: Session = Depends(get_db)):
    """Confirma el OTP de registro y emite el JWT de sesión."""
    return verificar_email(solicitud, db)


@router.post("/reenviar-otp", response_model=ReenviarOtpResponse)
@limiter.limit(RATE_LIMIT_OTP)
async def reenviar_codigo(request: Request, solicitud: ReenviarOtpRequest, db: Session = Depends(get_db)):
    """Reenvía OTP de verificación de email o de login tardío (respuesta genérica)."""
    return reenviar_otp(solicitud, db)


@router.post("/login", response_model=LoginResponse)
@limiter.limit(RATE_LIMIT_LOGIN)
async def iniciar_sesion(request: Request, login: LoginRequest, db: Session = Depends(get_db)):
    """
    Login con email/password. Si el último acceso fue hace más de 72h,
    responde `requiere_otp=true` + `challenge_token` (sin JWT) hasta
    `POST /auth/login/verificar-otp`.
    """
    return login_user(login, db)


@router.post("/login/verificar-otp", response_model=LoginResponse)
@limiter.limit(RATE_LIMIT_OTP)
async def confirmar_login_otp(request: Request, solicitud: LoginOtpRequest, db: Session = Depends(get_db)):
    """Completa el login tardío con challenge_token + OTP."""
    return verificar_login_otp(solicitud, db)


@router.post("/refresh", response_model=TokenResponse)
async def renovar_token(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Renueva un token JWT si el usuario sigue autenticado y activo."""
    from datetime import timedelta
    access_token = create_access_token(
        current_user["user_id"],
        current_user["rol"],
        expires_delta=ACCESS_TOKEN_EXPIRE - timedelta(minutes=1),
        importador_id=current_user.get("importador_id")
    )

    return TokenResponse(
        access_token=access_token,
        user_id=current_user["user_id"],
        rol=current_user["rol"]
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit(RATE_LIMIT_FORGOT_PASSWORD)
async def olvido_password(request: Request, solicitud: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Inicia la recuperación de contraseña: si el correo está registrado, envía un
    enlace + un código OTP de 6 dígitos (vencen en unos minutos).

    Siempre responde 200 con el mismo mensaje genérico, exista o no la cuenta,
    para no permitir enumeración de usuarios registrados.
    """
    return forgot_password(solicitud, db)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(RATE_LIMIT_FORGOT_PASSWORD)
async def restablecer_password(request: Request, solicitud: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Completa la recuperación de contraseña con el token del enlace + el OTP
    recibidos por correo. El token es de un solo uso y expira a los pocos minutos.
    """
    reset_password(solicitud, db)
    return None


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def cerrar_sesion(current_user: dict = Depends(get_current_user)):
    """
    Cierra sesión del usuario.

    En el MVP, no se revoca el token (no hay blacklist). El cliente debe eliminar el token localmente.
    """
    return None
