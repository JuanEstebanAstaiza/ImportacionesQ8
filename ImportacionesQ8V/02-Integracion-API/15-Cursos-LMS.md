# APIs — Cursos / LMS (estilo Domestika)

> Backend real: `routers/cursos.py`. Sustituye el manejo en Frontend (`src/features/courses/` + `localStorage`).

Base URL local: `http://localhost:8000`.

---

## Resumen de endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/cursos` | Público | Catálogo con filtros (categoría, nivel, recomendaciones) |
| `GET` | `/cursos/{id_o_slug}` | Público (JWT opcional) | Detalle con temario, módulos y preview |
| `POST` | `/cursos` | JWT `importador` | Publicar curso (módulos, lecciones, videos, adjuntos) |
| `POST` | `/cursos/{id}/comprar` | JWT | Compra/inscripción del usuario |
| `GET` | `/mis-cursos` | JWT | Cursos comprados + progreso |
| `POST` | `/cursos/{id}/lecciones/{leccion_id}/progreso` | JWT | Marcar lección completada |

---

## `GET /cursos`

**Query**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `categoria` | string | Filtro parcial (ILIKE) |
| `nivel` | string | `Principiante` \| `Avanzado` |
| `q` | string | Búsqueda en título/descripción |
| `recomendados` | bool | Ordena por `rating` y `estudiantes_count` |
| `importador_id` | string | Solo cursos de esa empresa |

**Respuesta:** array de `CursoListItem` (sin temario completo).

---

## `GET /cursos/{id_o_slug}`

Acepta UUID o `slug`. Con JWT, incluye:

- `comprado: bool`
- `lecciones_completadas: string[]`
- `progreso_pct: number`

**Respuesta:** `CursoDetailResponse` con `modulos[].lecciones[].recursos[]`.

La primera lección se marca `es_preview=true` al publicar (vista previa del catálogo).

### Paywall (seguridad)

Sin compra (y sin ser dueño de la empresa publicadora):

- Las lecciones **no** preview devuelven `video_url: ""` y `recursos: []`.
- Sí se listan títulos/duración del temario (índice).
- Tras `POST .../comprar`, el detalle con JWT del comprador devuelve media completa.

`video_url`, `portada_url` y URLs de recursos solo aceptan esquemas `http`/`https`.

---

## `POST /cursos`

Solo rol **`importador`** (dueño de la empresa).

```json
{
  "titulo": "Incoterms 2020 para importar",
  "descripcion": "Aprende a negociar sin sobrecostos.",
  "portada_url": "https://...",
  "precio": 149,
  "nivel": "Principiante",
  "categoria": "Logistica Internacional",
  "modulos": [
    {
      "titulo": "Fundamentos",
      "lecciones": [
        {
          "titulo": "Qué cubren los Incoterms",
          "duracion": "12 min",
          "video_url": "https://www.youtube.com/embed/...",
          "recursos": [
            {
              "nombre": "Matriz.xlsx",
              "url": "https://example.com/matriz.xlsx",
              "tipo": "plantilla"
            }
          ]
        }
      ]
    }
  ]
}
```

Tipos de recurso: `archivo` | `plantilla` | `checklist` | `guia`.

---

## `POST /cursos/{id}/comprar`

- **Rol:** solo `solicitante`.
- Registra inscripción + incrementa `estudiantes_count` (atómico).
- **Idempotente:** si ya compró (o carrera concurrente), devuelve la misma inscripción.
- Crea notificación tipo `curso` al comprador.
- **MVP / residual de seguridad:** sin pasarela de pago real; el precio queda en `precio_pagado` de forma informativa. Ver [[Auditoria-Seguridad-Modulos-2026-07-28]] (H6).

---

## `GET /mis-cursos`

Lista cursos del usuario autenticado con progreso.

---

## `POST /cursos/{id}/lecciones/{leccion_id}/progreso`

Body:

```json
{ "completada": true }
```

Requiere haber comprado el curso. Responde con `progreso_pct` y lista de lecciones completadas.

---

## Migración

Alembic: `20260728_0005_cursos_notificaciones` — tablas `cursos`, `modulos_curso`, `lecciones_curso`, `recursos_leccion`, `compras_curso`, `progreso_lecciones`.

## Frontend

Reemplazar `useCourses` / `localStorage` por estos endpoints. Tipos TS en `src/features/courses/types.ts` alinean con el schema backend.
