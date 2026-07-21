export type BackendAuthRole = "solicitante" | "importador" | "admin" | "asesor";

export interface LoginRequest {
	email: string;
	password: string;
}

export interface LoginResponse {
	requiere_otp?: boolean;
	motivo_otp?: string | null;
	challenge_token?: string | null;
	mensaje?: string | null;
	access_token?: string | null;
	token_type: "bearer";
	user_id?: string | null;
	rol?: BackendAuthRole | null;
	perfil_completo?: boolean | null;
}

export interface RegisterRequest {
	email: string;
	password: string;
	rol: "solicitante" | "importador" | "admin";
	tipo_persona: "natural" | "juridica";
	nit?: string;
	razon_social?: string;
	tipo_documento?: string;
	numero_documento?: string;
	nombre?: string;
	apellido?: string;
	indicativo_pais_telefono: string;
	telefono: string;
	acepto_politica_datos: boolean;
	codigo_referido?: string;
}

export interface RegisterResponse {
	user_id: string;
	email: string;
	requiere_verificacion: boolean;
	mensaje: string;
}

export interface VerifyEmailRequest {
	email: string;
	otp: string;
}

export interface ForgotPasswordRequest {
	email: string;
}

export interface ForgotPasswordResponse {
	mensaje: string;
}

export interface ResetPasswordRequest {
	token: string;
	otp: string;
	nueva_password: string;
}

export interface CurrentUserResponse {
	id: string;
	email: string;
	rol: BackendAuthRole;
	importador_id: string | null;
	nombre: string | null;
	telefono: string | null;
	foto_url: string | null;
	whatsapp: string | null;
	activo: boolean;
	perfil_completo: boolean;
	fecha_creacion: string;
}

export interface AuthErrorResponse {
	detail?: string;
}
