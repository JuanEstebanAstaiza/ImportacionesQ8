export type BackendAuthRole = "solicitante" | "importador" | "admin" | "asesor";

export interface LoginRequest {
	email: string;
	password: string;
}

export interface LoginResponse {
	access_token: string;
	token_type: "bearer";
	user_id: string;
	rol: BackendAuthRole;
	perfil_completo: boolean;
}

export interface ForgotPasswordRequest {
	email: string;
}

export interface ForgotPasswordResponse {
	mensaje: string;
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
