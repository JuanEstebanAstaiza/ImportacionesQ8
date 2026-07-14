from datetime import datetime, timedelta, timezone

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
from services.token_revocation import revocar_jti
from utils.dependencies import get_db, get_current_user
from utils.security import create_access_token
from utils.limiter import limiter
from config import (
    ACCESS_TOKEN_EXPIRE, RATE_LIMIT_LOGIN, RATE_LIMIT_REGISTER,
    RATE_LIMIT_FORGOT_PASSWORD, RATE_LIMIT_OTP,
)
from models.usuario import Usuario

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", response_model=RegistroPendienteResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_REGISTER)
async def registrar_usuario(request: Request, registro: RegistroRequest, db: Session = Depends(get_db)):
    return register_user(registro, db)


@router.post("/verificar-email", response_model=LoginResponse)
@limiter.limit(RATE_LIMIT_OTP)
async def verificar_correo(request: Request, solicitud: VerificarEmailRequest, db: Session = Depends(get_db)):
    return verificar_email(solicitud, db)


@router.post("/reenviar-otp", response_model=ReenviarOtpResponse)
@limiter.limit(RATE_LIMIT_OTP)
async def reenviar_codigo(request: Request, solicitud: ReenviarOtpRequest, db: Session = Depends(get_db)):
    return reenviar_otp(solicitud, db)


@router.post("/login", response_model=LoginResponse)
@limiter.limit(RATE_LIMIT_LOGIN)
async def iniciar_sesion(request: Request, login: LoginRequest, db: Session = Depends(get_db)):
    return login_user(login, db)


@router.post("/login/verificar-otp", response_model=LoginResponse)
@limiter.limit(RATE_LIMIT_OTP)
async def confirmar_login_otp(request: Request, solicitud: LoginOtpRequest, db: Session = Depends(get_db)):
    return verificar_login_otp(solicitud, db)


@router.post("/refresh", response_model=TokenResponse)
async def renovar_token(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Renueva JWT tras revalidar usuario activo; revoca el jti anterior."""
    usuario = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    if not usuario or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta desactivada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    exp = current_user.get("exp")
    if current_user.get("jti") and exp:
        expira = datetime.fromtimestamp(exp, tz=timezone.utc).replace(tzinfo=None)
        revocar_jti(db, current_user["jti"], usuario.id, expira)

    access_token = create_access_token(
        str(usuario.id),
        usuario.rol,
        expires_delta=ACCESS_TOKEN_EXPIRE,
        importador_id=usuario.importador_id,
    )
    return TokenResponse(
        access_token=access_token,
        user_id=str(usuario.id),
        rol=usuario.rol,
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit(RATE_LIMIT_FORGOT_PASSWORD)
async def olvido_password(request: Request, solicitud: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return forgot_password(solicitud, db)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(RATE_LIMIT_FORGOT_PASSWORD)
async def restablecer_password(request: Request, solicitud: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_password(solicitud, db)
    return None


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def cerrar_sesion(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoca el jti del JWT actual (blacklist hasta su expiración)."""
    exp = current_user.get("exp")
    jti = current_user.get("jti")
    if jti and exp:
        expira = datetime.fromtimestamp(exp, tz=timezone.utc).replace(tzinfo=None)
        revocar_jti(db, jti, current_user["user_id"], expira)
    return None
