from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional

class RegistroRequest(BaseModel):
    """
    Registro público de solicitante (persona natural o jurídica).

    Solo el rol "solicitante" puede auto-registrarse (ver `services/auth_service.py`).
    Los campos obligatorios difieren según `tipo_persona`:
    - "juridica": `nit`, `razon_social`, `telefono` + `indicativo_pais_telefono`
    - "natural": `numero_documento`, `tipo_documento`, `nombre`, `apellido`,
      `telefono` + `indicativo_pais_telefono`

    En ambos casos, `acepto_politica_datos` debe ser `true`.
    """
    email: EmailStr
    password: str = Field(..., min_length=9, description="La contraseña debe tener al menos 9 caracteres")
    rol: str = Field(..., description="Rol del usuario. El auto-registro público solo permite 'solicitante'")
    tipo_persona: str = Field(..., description="'natural' o 'juridica'")

    # Persona jurídica
    nit: Optional[str] = Field(None, description="NIT de la empresa (obligatorio si tipo_persona='juridica')")
    razon_social: Optional[str] = Field(None, description="Nombre de la empresa (obligatorio si tipo_persona='juridica')")

    # Persona natural
    tipo_documento: Optional[str] = Field(None, description="Cédula, pasaporte, cédula de extranjería, etc. (obligatorio si tipo_persona='natural')")
    numero_documento: Optional[str] = Field(None, description="Número de documento (obligatorio si tipo_persona='natural')")
    nombre: Optional[str] = Field(None, description="Nombre (obligatorio si tipo_persona='natural')")
    apellido: Optional[str] = Field(None, description="Apellido (obligatorio si tipo_persona='natural')")

    # Comunes a ambos tipos
    indicativo_pais_telefono: str = Field(..., description="Indicativo de país del teléfono, ej. '+57'")
    telefono: str = Field(..., description="Número de teléfono sin el indicativo de país")
    acepto_politica_datos: bool = Field(..., description="Debe ser true: aceptación de la política de tratamiento de datos")
    codigo_referido: Optional[str] = Field(None, description="Código de referido opcional al registrarse")

    @model_validator(mode="after")
    def validar_campos_condicionales(self):
        if self.tipo_persona not in ("natural", "juridica"):
            raise ValueError("tipo_persona debe ser 'natural' o 'juridica'")

        if not self.acepto_politica_datos:
            raise ValueError("Debes aceptar la política de tratamiento de datos para registrarte")

        if self.tipo_persona == "juridica":
            faltantes = [campo for campo in ("nit", "razon_social") if not getattr(self, campo)]
            if faltantes:
                raise ValueError(f"Para persona jurídica son obligatorios: {', '.join(faltantes)}")
        else:  # natural
            faltantes = [campo for campo in ("tipo_documento", "numero_documento", "nombre", "apellido") if not getattr(self, campo)]
            if faltantes:
                raise ValueError(f"Para persona natural son obligatorios: {', '.join(faltantes)}")

        return self

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    # Mensaje genérico siempre igual, exista o no el email, para evitar
    # enumeración de usuarios registrados.
    mensaje: str = "Si el correo está registrado, recibirás un enlace y un código para restablecer tu contraseña"

class ResetPasswordRequest(BaseModel):
    token: str
    otp: str = Field(..., min_length=6, max_length=6)
    nueva_password: str = Field(..., min_length=9, description="La contraseña debe tener al menos 9 caracteres")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    rol: str

class LoginResponse(TokenResponse):
    perfil_completo: bool