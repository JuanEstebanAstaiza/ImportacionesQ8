import bcrypt
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError, PyJWTError

from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE
from utils.password_policy import password_cumple_politica  # re-export


class JWTError(InvalidTokenError):
    """Alias compatible con el código que esperaba jose.JWTError."""


def hash_password(password: str) -> str:
    if isinstance(password, str):
        password_bytes = password.encode("utf-8")[:72]
    elif isinstance(password, bytes):
        password_bytes = password[:72]
    else:
        raise TypeError("Password must be a string or bytes")

    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if isinstance(plain_password, str):
        password_bytes = plain_password.encode("utf-8")[:72]
    elif isinstance(plain_password, bytes):
        password_bytes = plain_password[:72]
    else:
        raise TypeError("Password must be a string or bytes")

    if isinstance(hashed_password, str):
        hashed_password_bytes = hashed_password.encode("utf-8")
    elif isinstance(hashed_password, bytes):
        hashed_password_bytes = hashed_password
    else:
        raise TypeError("Hashed password must be a string or bytes")

    return bcrypt.checkpw(password_bytes, hashed_password_bytes)


def create_access_token(
    user_id: str,
    rol: str,
    expires_delta: timedelta = None,
    importador_id: str = None,
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRE

    to_encode = {
        "sub": user_id,
        "rol": rol,
        "importador_id": importador_id,
        "jti": uuid4().hex,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except (ExpiredSignatureError, InvalidTokenError, PyJWTError) as e:
        raise JWTError(str(e)) from e


def generar_otp(digitos: int = 6) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(digitos))


def generar_token_seguro() -> str:
    return secrets.token_urlsafe(32)


def hash_token(valor: str) -> str:
    """HMAC-SHA256 con SECRET_KEY como pepper (OTP/reset/challenge)."""
    return hmac.new(
        SECRET_KEY.encode("utf-8"),
        valor.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
