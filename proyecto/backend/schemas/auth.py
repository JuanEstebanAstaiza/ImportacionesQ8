from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class RegistroRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=9, description="La contraseña debe tener al menos 9 caracteres")
    rol: str = Field(..., description="Rol del usuario: 'solicitante', 'importador' o 'admin'")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    rol: str

class LoginResponse(TokenResponse):
    perfil_completo: bool