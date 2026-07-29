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
| `PUT` | `/notificaciones/leer-todas` | JWT | Marca todas como leídas |

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
      "data": { "orden_id": "...", "estado_nuevo": "embarcada" },
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

---

## `PUT /notificaciones/{id}/leer`

Marca una notificación **propia** como leída. 404 si no existe o no es del usuario.

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
| Solicitante inicia negociación (`PUT .../propuestas/aceptar`) | Asesor asignado | `negociacion` |
| Asesor inicia chat (`POST /chat/iniciar`) | Solicitante | `negociacion` |
| Compra de curso | Comprador | `curso` |

Redis Pub/Sub sigue existiendo para tiempo real; la bandeja REST es la fuente de verdad persistente.

---

## Migración

Tabla `notificaciones` en revisión Alembic `20260728_0005`.
