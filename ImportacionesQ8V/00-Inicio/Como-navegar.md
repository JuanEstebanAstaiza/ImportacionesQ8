# Cómo navegar este vault

> **Última actualización:** 2026-10-01 · El producto se llama **Zarpi**. El repositorio y este vault conservan el nombre técnico **ImportacionesQ8**, igual que las notas históricas.

## Orden de las carpetas

Las carpetas van **numeradas de 00 a 06** a propósito: se leen de arriba abajo en el explorador de Obsidian.

```text
00-Inicio              ← estás aquí (puerta de entrada)
01-Negocio             ← qué es el producto y cómo gana dinero
02-Integracion-API     ← cómo conectar un cliente a la API (frontend)
03-Backend             ← cómo está construido el servidor
04-Frontend-UI         ← pantallas y diseño
05-Calidad-y-Seguridad ← auditorías, OWASP, pruebas de carga
06-Historial           ← semanas de desarrollo (archivo)
```

## Tipos de nota

| Prefijo / tipo | Significado |
|----------------|-------------|
| `Indice-*` | **Mapa de la carpeta** (empieza siempre por aquí dentro de cada área) |
| `00-`, `01-`, … | Guías ordenadas (sobre todo en Integración API) |
| Resto | Temas concretos (un módulo, un informe, una pantalla) |

## Enlaces

- Dentro del vault se usan wikilinks: `[[Nombre-de-la-nota]]`.
- Obsidian resuelve por **nombre de archivo**, no por carpeta: no importa en qué carpeta esté la nota si el nombre es único.
- Cada carpeta tiene un índice con tabla de contenidos; no hace falta memorizar rutas.

## Qué leer y qué no al principio

| Prioridad | Leer | Puede esperar |
|-----------|------|----------------|
| Alta | `Indice-*`, env, catálogo API, propuesta, estado | Detalle de cada semana en Historial |
| Media | Backend por módulo, pantallas UI | Informes de auditoría largos |
| Baja (archivo) | Tareas-Semana-1…4 | Solo si investigas *por qué* se hizo algo |

## Si te pierdes

1. Vuelve a [[Inicio]]
2. Elige tu rol en la tabla
3. Entra al `Indice-*` de esa área
