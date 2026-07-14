# APIs — Autenticación

> Generado desde OpenAPI en vivo (`/openapi.json`). Base URL local: `http://localhost:8000`.

### `POST /auth/forgot-password`

- **Resumen:** Olvido Password
- **Auth:** Público
- **Códigos:** 200, 422

**Body (`ForgotPasswordRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `email` | `string` | sí |  |

```json
{
  "email": "cliente@ejemplo.com"
}
```

**Respuesta (`ForgotPasswordResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `mensaje` | `string` | no |  |

---

### `POST /auth/login`

- **Resumen:** Iniciar Sesion
- **Auth:** Público
- **Códigos:** 200, 422

**Body (`LoginRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `email` | `string` | sí |  |
| `password` | `string` | sí |  |

```json
{
  "email": "cliente@ejemplo.com",
  "password": "ClaveSegura1"
}
```

**Respuesta (`LoginResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `requiere_otp` | `boolean` | no |  |
| `motivo_otp` | `Optional[string]` | no |  |
| `challenge_token` | `Optional[string]` | no |  |
| `mensaje` | `Optional[string]` | no |  |
| `access_token` | `Optional[string]` | no |  |
| `token_type` | `string` | no |  |
| `user_id` | `Optional[string]` | no |  |
| `rol` | `Optional[string]` | no |  |
| `perfil_completo` | `Optional[boolean]` | no |  |

---

### `POST /auth/login/verificar-otp`

- **Resumen:** Confirmar Login Otp
- **Auth:** Público
- **Códigos:** 200, 422

**Body (`LoginOtpRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `challenge_token` | `string` | sí |  |
| `otp` | `string` | sí |  |

```json
{
  "challenge_token": "<challenge del login tardío>",
  "otp": "123456"
}
```

**Respuesta (`LoginResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `requiere_otp` | `boolean` | no |  |
| `motivo_otp` | `Optional[string]` | no |  |
| `challenge_token` | `Optional[string]` | no |  |
| `mensaje` | `Optional[string]` | no |  |
| `access_token` | `Optional[string]` | no |  |
| `token_type` | `string` | no |  |
| `user_id` | `Optional[string]` | no |  |
| `rol` | `Optional[string]` | no |  |
| `perfil_completo` | `Optional[boolean]` | no |  |

---

### `POST /auth/logout`

- **Resumen:** Cerrar Sesion
- **Auth:** Bearer JWT
- **Códigos:** 204

---

### `POST /auth/reenviar-otp`

- **Resumen:** Reenviar Codigo
- **Auth:** Público
- **Códigos:** 200, 422

**Body (`ReenviarOtpRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `email` | `string` | sí |  |
| `proposito` | `string` | sí | 'verificacion_email' o 'login_tardio' |

```json
{
  "email": "cliente@ejemplo.com",
  "proposito": "verificacion_email"
}
```

**Respuesta (`ReenviarOtpResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `mensaje` | `string` | no |  |
| `challenge_token` | `Optional[string]` | no |  |

---

### `POST /auth/refresh`

- **Resumen:** Renovar Token
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`TokenResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `access_token` | `string` | sí |  |
| `token_type` | `string` | no |  |
| `user_id` | `string` | sí |  |
| `rol` | `string` | sí |  |

---

### `POST /auth/register`

- **Resumen:** Registrar Usuario
- **Auth:** Público
- **Códigos:** 201, 422

**Body (`RegistroRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `email` | `string` | sí |  |
| `password` | `string` | sí | La contraseña debe tener al menos 9 caracteres |
| `rol` | `string` | sí | Rol del usuario. El auto-registro público solo permite 'solicitante' |
| `tipo_persona` | `string` | sí | 'natural' o 'juridica' |
| `nit` | `Optional[string]` | no | NIT de la empresa (obligatorio si tipo_persona='juridica') |
| `razon_social` | `Optional[string]` | no | Nombre de la empresa (obligatorio si tipo_persona='juridica') |
| `tipo_documento` | `Optional[string]` | no | Cédula, pasaporte, cédula de extranjería, etc. (obligatorio si tipo_persona='natural') |
| `numero_documento` | `Optional[string]` | no | Número de documento (obligatorio si tipo_persona='natural') |
| `nombre` | `Optional[string]` | no | Nombre (obligatorio si tipo_persona='natural') |
| `apellido` | `Optional[string]` | no | Apellido (obligatorio si tipo_persona='natural') |
| `indicativo_pais_telefono` | `string` | sí | Indicativo de país del teléfono, ej. '+57' |
| `telefono` | `string` | sí | Número de teléfono sin el indicativo de país |
| `acepto_politica_datos` | `boolean` | sí | Debe ser true: aceptación de la política de tratamiento de datos |
| `codigo_referido` | `Optional[string]` | no | Código de referido opcional al registrarse |

```json
{
  "email": "cliente@ejemplo.com",
  "password": "ClaveSegura1",
  "rol": "solicitante",
  "tipo_persona": "natural",
  "tipo_documento": "cedula",
  "numero_documento": "1234567890",
  "nombre": "Ana",
  "apellido": "Pérez",
  "indicativo_pais_telefono": "+57",
  "telefono": "3001234567",
  "acepto_politica_datos": true,
  "codigo_referido": null
}
```

**Respuesta (`RegistroPendienteResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `user_id` | `string` | sí |  |
| `email` | `string` | sí |  |
| `requiere_verificacion` | `boolean` | no |  |
| `mensaje` | `string` | no |  |

---

### `POST /auth/reset-password`

- **Resumen:** Restablecer Password
- **Auth:** Público
- **Códigos:** 204, 422

**Body (`ResetPasswordRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `token` | `string` | sí |  |
| `otp` | `string` | sí |  |
| `nueva_password` | `string` | sí | La contraseña debe tener al menos 9 caracteres |

```json
{
  "token": "<token del correo>",
  "otp": "123456",
  "nueva_password": "NuevaClave9"
}
```

---

### `POST /auth/verificar-email`

- **Resumen:** Verificar Correo
- **Auth:** Público
- **Códigos:** 200, 422

**Body (`VerificarEmailRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `email` | `string` | sí |  |
| `otp` | `string` | sí |  |

```json
{
  "email": "cliente@ejemplo.com",
  "otp": "123456"
}
```

**Respuesta (`LoginResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `requiere_otp` | `boolean` | no |  |
| `motivo_otp` | `Optional[string]` | no |  |
| `challenge_token` | `Optional[string]` | no |  |
| `mensaje` | `Optional[string]` | no |  |
| `access_token` | `Optional[string]` | no |  |
| `token_type` | `string` | no |  |
| `user_id` | `Optional[string]` | no |  |
| `rol` | `Optional[string]` | no |  |
| `perfil_completo` | `Optional[boolean]` | no |  |

---
