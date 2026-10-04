import { useEffect, useRef } from "react";

import { apiRequest, getApiBaseUrl } from "@/services/api-client";

/**
 * Conecta al canal de chat en vivo que el backend ya expone (`/ws/chat/{id}`).
 *
 * Hasta ahora el frontend no abría ningún WebSocket, así que un mensaje entrante
 * solo aparecía si el usuario recargaba o hacía clic en algo. El handshake usa
 * el ticket de un solo uso de `POST /chat/ws-ticket` (no el JWT en la query,
 * que quedaría registrado en los logs del servidor).
 */
export interface ChatSocketMessage {
  id: string;
  conversacion_id: string;
  remitente_id: string;
  contenido: string;
  tipo: string;
  metadata?: unknown;
  fecha_envio: string;
}

interface WsTicketResponse {
  ticket: string;
  expires_in_seconds?: number;
}

/**
 * `path` es solo la ruta; la query va en `params`.
 *
 * Asignar a `url.pathname` una cadena que ya traía `?ticket=...` no construye
 * una query: la API de URL escapa el `?` y el ticket terminaba dentro de la
 * ruta (`/ws/chat/<id>%3Fticket=...`). El backend no veía ningún ticket y
 * cerraba el handshake con 403, así que el canal en vivo nunca llegaba a
 * abrirse y reintentaba cada 3 s indefinidamente.
 */
function buildWebSocketUrl(path: string, params: Record<string, string> = {}): string {
  const base = getApiBaseUrl();
  try {
    const url = new URL(base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const prefix = url.pathname.replace(/\/+$/, "");
    url.pathname = `${prefix}${path}`;
    for (const [clave, valor] of Object.entries(params)) {
      url.searchParams.set(clave, valor);
    }
    return url.toString();
  } catch {
    return "";
  }
}

const RECONNECT_DELAY_MS = 3_000;

export function useChatSocket(
  conversationId: string | null | undefined,
  onMessage: (message: ChatSocketMessage) => void,
  enabled = true,
): void {
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled || !conversationId) {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let cancelled = false;

    async function connect() {
      if (cancelled) {
        return;
      }

      let ticket: string;
      try {
        const respuesta = await apiRequest<WsTicketResponse>("/chat/ws-ticket", {
          method: "POST",
          body: { conversacion_id: conversationId },
        });
        ticket = respuesta.ticket;
      } catch {
        // Sin ticket no hay canal en vivo; el refresco periódico sigue cubriendo
        // la conversación, así que no se muestra ningún error al usuario.
        return;
      }

      if (cancelled || !ticket) {
        return;
      }

      const url = buildWebSocketUrl(`/ws/chat/${conversationId}`, { ticket });
      if (!url) {
        return;
      }

      try {
        socket = new WebSocket(url);
      } catch {
        return;
      }

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as ChatSocketMessage;
          if (payload?.id) {
            onMessageRef.current(payload);
          }
        } catch {
          /* frame no-JSON: se ignora */
        }
      };

      socket.onclose = () => {
        // El ticket es de un solo uso y expira en 60s: al caer la conexión hay
        // que pedir uno nuevo, no reutilizar el anterior.
        if (!cancelled) {
          reconnectTimer = window.setTimeout(() => void connect(), RECONNECT_DELAY_MS);
        }
      };
    }

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [conversationId, enabled]);
}
