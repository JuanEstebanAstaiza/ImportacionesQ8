# APIs — Notificaciones in-app

> Backend real: `routers/notificaciones.py` + `services/notificacion_service.py`.  
> Sustituye la agregación local del Frontend (eventos de chat/órdenes/propuestas en memoria).

Base URL local: `http://localhost:8000`.

---

## Resumen

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/notificaciones` | JWT | Lista notificaciones del usuario |
| `PUT` | `/notificaciones/{id}/leer` | JWT | Marca una como leída |
| `PATCH` | `/notificaciones/{id}/leida` | JWT | Igual que `PUT .../leer` (idempotente) |
| `PUT` | `/notificaciones/leer-todas` | JWT | Marca todas como leídas |
| `POST` | `/notificaciones/stream-ticket` | JWT | Ticket de un solo uso (60 s) para el stream |
| `GET` | `/notificaciones/stream` | `?ticket=` o JWT | Stream SSE en tiempo real |

---

## `GET /notificaciones`

**Query**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `solo_no_leidas` | bool | false | Filtra solo no leídas |
| `limit` | int | 50 | 1–200 |
| `offset` | int | 0 | Paginación |

**Respuesta**

```json
{
  "items": [
    {
      "id": "uuid",
      "usuario_id": "uuid",
      "tipo": "orden",
      "titulo": "Actualización de tu orden",
      "mensaje": "La orden pasó de en_proceso a embarcada.",
      "cuerpo": "La orden pasó de en_proceso a embarcada.",
      "data": { "orden_id": "...", "estado_nuevo": "embarcada" },
      "cotizacion_id": null,
      "conversacion_id": null,
      "leida": false,
      "fecha_creacion": "2026-07-28T12:00:00",
      "fecha_lectura": null
    }
  ],
  "total": 12,
  "no_leidas": 3
}
```

**Tipos habituales:** `sistema`, `chat`, `cotizacion`, `propuesta`, `orden`, `curso`, `negociacion`.

El campo `data` es JSON libre para deep-links en el Frontend (`orden_id`, `cotizacion_id`, `curso_id`, `conversacion_id`, …).
`cotizacion_id` y `conversacion_id` además se guardan como columnas (se copian de `data`). `cuerpo` es alias de `mensaje`.

---

## `PUT /notificaciones/{id}/leer`

Marca una notificación **propia** como leída. 404 si no existe o no es del usuario.

`PATCH /notificaciones/{id}/leida` hace exactamente lo mismo; devuelve la notificación actualizada.

---

## Tiempo real: `GET /notificaciones/stream` (SSE)

Cada notificación se emite **después del commit** de la transacción que la creó (si hay rollback no se emite nada).

```js
const { ticket } = await api.post("/notificaciones/stream-ticket");
const es = new EventSource(`${API}/notificaciones/stream?ticket=${ticket}`);
es.addEventListener("notificacion", (e) => {
  const notif = JSON.parse(e.data); // misma forma que un item de GET /notificaciones
});
```

- `EventSource` no envía headers, por eso el ticket (de un solo uso; pedir uno nuevo al reconectar). Con `fetch` se puede usar `Authorization: Bearer`.
- Comentario `: ping` cada 25 s para mantener viva la conexión.
- Con Redis viaja por el canal `usuario:{id}:notificaciones` (sirve con varios workers); sin Redis se reparte en memoria del proceso.

---

## `PUT /notificaciones/leer-todas`

```json
{ "actualizadas": 5, "mensaje": "Notificaciones marcadas como leídas" }
```

---

## Origen de las notificaciones (backend)

Se persisten (best-effort, no rompen el flujo de negocio) al menos en:

| Evento | Destinatario | Tipo |
|--------|--------------|------|
| Cambio de estado de orden | Solicitante | `orden` |
| Asesor/dueño reclama cotización (`POST /cotizaciones/{id}/reclamar`) | Solicitante | `negociacion` (con `cotizacion_id` y `conversacion_id` del chat creado) |
| Solicitante inicia negociación (`PUT .../propuestas/aceptar`) | Asesor asignado | `negociacion` |
| Asesor inicia chat (`POST /chat/iniciar`) | Solicitante | `negociacion` |
| Compra de curso | Comprador | `curso` |

Redis Pub/Sub sigue existiendo para tiempo real; la bandeja REST es la fuente de verdad persistente.

---

## Migración

Tabla `notificaciones` en revisión Alembic `20260728_0005`; columnas `cotizacion_id` / `conversacion_id` en `20260929_0023`.
