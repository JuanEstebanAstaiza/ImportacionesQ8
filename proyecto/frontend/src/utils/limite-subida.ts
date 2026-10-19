import { apiRequest } from "@/services/api-client";

/**
 * Tamaño máximo por archivo, servido por `GET /configuracion-publica`.
 *
 * Se consulta para poder rechazar el archivo ANTES de empezar a transferirlo:
 * sin esto, subir un vídeo de curso demasiado grande obligaba a esperar a que
 * viajara entero para recibir un 413 al final. Peor aún, ese 413 lo emitía un
 * middleware por fuera de CORS, así que el navegador ni siquiera lo mostraba
 * como "archivo demasiado grande" sino como un error de CORS.
 *
 * El valor se cachea a nivel de módulo: hay muchos botones de subida repartidos
 * por la interfaz y no tiene sentido que cada uno pregunte por su cuenta.
 */
const LIMITE_POR_DEFECTO = 300 * 1024 * 1024;

let consultaEnCurso: Promise<number> | null = null;
let limiteConocido = LIMITE_POR_DEFECTO;

export function obtenerLimiteSubidaCacheado(): number {
  return limiteConocido;
}

export async function obtenerLimiteSubida(): Promise<number> {
  if (!consultaEnCurso) {
    consultaEnCurso = apiRequest<{ max_subida_bytes?: number }>("/configuracion-publica")
      .then((config) => {
        if (typeof config.max_subida_bytes === "number" && config.max_subida_bytes > 0) {
          limiteConocido = config.max_subida_bytes;
        }
        return limiteConocido;
      })
      .catch(() => {
        // Backend antiguo o sin conexión: se sigue con el valor por defecto y
        // que sea el servidor quien rechace. Nunca bloquear una subida válida
        // por no haber podido leer la configuración.
        consultaEnCurso = null;
        return limiteConocido;
      });
  }

  return consultaEnCurso;
}

export function formatearTamano(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
