import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/services/api-client";

/**
 * Flags de plataforma servidos por `GET /configuracion-publica`.
 *
 * El backend es la única fuente de verdad: si el módulo educativo se apaga allí,
 * su API responde 404, así que duplicar el flag en el `.env` del frontend solo
 * abriría la puerta a que ambos quedaran desincronizados.
 */
export interface PlatformConfig {
  modulo_educativo_habilitado: boolean;
  /** Registro público abierto; cerrado, las cuentas las crea el equipo. */
  registro_abierto: boolean;
  /** Cada cotización consume 1 token. */
  cobro_cotizaciones: boolean;
  correo_contacto: string;
  notificaciones_email: boolean;
  /** Tamaño máximo por archivo subido, en bytes. Ver `lib/limite-subida.ts`. */
  max_subida_bytes: number;
}

const DEFAULT_CONFIG: PlatformConfig = {
  // Optimista mientras carga: evita que la navegación parpadee ocultando
  // "Cursos" durante el primer render y volviéndolo a mostrar al responder.
  modulo_educativo_habilitado: true,
  registro_abierto: true,
  cobro_cotizaciones: false,
  correo_contacto: "contacto@zarpi.co",
  notificaciones_email: false,
  max_subida_bytes: 300 * 1024 * 1024,
};

export function usePlatformConfig(): { config: PlatformConfig; isLoading: boolean; recargar: () => void } {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  // El admin enciende o apaga módulos en caliente: tras cambiarlos se vuelve a pedir.
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;

    apiRequest<PlatformConfig>("/configuracion-publica")
      .then((respuesta) => {
        if (!cancelled) {
          setConfig({ ...DEFAULT_CONFIG, ...respuesta });
        }
      })
      .catch(() => {
        // Backend viejo o sin conexión: se conservan los valores por defecto.
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  return { config, isLoading, recargar };
}
