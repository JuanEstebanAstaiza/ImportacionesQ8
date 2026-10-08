# APIs — Tendencias v2 (productos virales) y reto comunitario

> Backend: `models/tendencias_virales.py`, `models/reto.py`, `services/enlaces_video.py`, `services/tendencias_virales.py`, `services/reto.py`, `services/origen_cotizacion.py`, `utils/cifrado.py`, `routers/tendencias_virales.py`, `routers/reto.py`.
> Frontend: `features/tendencias/*` (feed, ficha, envío, panel de aprobación, recomendados), `features/reto/*`, `services/tendencias.service.ts`, `services/reto.service.ts`.
> Guía de producto: `docs/Tendencias · Guía de construcción.html`. Migración `20261008_0030`. Desde el 2026-10-08.

## Qué es

Una sección con productos virales para importar, alimentada de tres lados:
- **El equipo de Zarpi.**
- **Las importadoras**, que recomiendan productos.
- **La comunidad**, a la que se le paga por subir productos que terminen aprobados.

Cada producto entra como un **enlace** a TikTok, Instagram o YouTube. Una persona del equipo lo aprueba, le pone una **portada propia** y ahí se publica. **Nunca se descarga ni se guarda el video** ni su miniatura. La ficha **no muestra precio**: su única acción es pedir propuestas.

## Reglas que viven en el código

| Regla | Dónde |
|-------|-------|
| Solo TikTok, Instagram y YouTube. Los enlaces cortos se resuelven sin salir de esos dominios (evita SSRF) | `enlaces_video.normalizar` / `resolver_corto` |
| Mismo video con o sin parámetros = una sola ficha (`url_normalizada` UNIQUE). Al repetido se le responde quién lo subió, sin decir su nombre | `tendencias_virales.enviar` |
| El reproductor es un iframe oficial armado desde el id validado. Nunca se inyecta el HTML del oEmbed. Para Instagram, el código pegado debe ser del mismo post | `enlaces_video.embed_url`, `tendencias_virales.editar` |
| No se publica sin portada. Se puede «aprobar sin portada» (`aprobado_sin_portada`) y publicar después | `tendencias_virales.aprobar` |
| El feed no devuelve el reproductor; la ficha sí | `tarjeta` / `ficha` |
| La solicitud nacida de una ficha queda atribuida (`cotizaciones.tendencia_item_id`) y suma `cotizaciones_count` | `origen_cotizacion` |
| Si la ficha la recomienda una importadora, la solicitud **debe** ir dirigida a ella (si no, 400): el cliente es suyo | `origen_cotizacion.validar_origen` |
| Las cuentas de importadora o asesor no ven el botón de cotizar | `features/tendencias/piezas.tsx::puedeCotizar` |
| Portadas: públicas una vez publicadas; antes solo las ve el equipo aprobador. Una importadora solo puede usar sus propias fotos | `routers/documentos.py`, `validar_archivo_propio` |

**Aprobadores:** el admin, y quien tenga la capacidad `usuarios.es_curador`. Se asignan en *Aprobación › Equipo aprobador*.

## Reto comunitario

- **Rondas de cupos limitados:** por defecto 20 personas, umbral de 10 aprobados, $50.000 o 5 cotizaciones gratis, y fecha límite.
- **Inscripción:** se bloquea la fila de la ronda (`SELECT … FOR UPDATE`) y hay UNIQUE(ronda, usuario), así que dos inscripciones simultáneas al último cupo no superan el máximo.
- **Al llenarse:** la ronda pasa a `llena` y, si `abrir_siguiente_al_llenarse`, se abre otra igual y se avisa a la lista de espera.
- **Qué cuenta:** solo los envíos hechos estando inscrito en una ronda vigente. **Una recompensa por persona y ronda.**
- **Hitos:** con 7 aprobados se avisa «te faltan 3»; con 10, la recompensa queda `reclamable`.
- **Reclamo:**
  - **cotizaciones:** suma `usuarios.cotizaciones_gratis`, un saldo que se descontará cuando exista el cobro por cotización;
  - **efectivo:** se piden los datos bancarios, cifrados con Fernet (`CLAVE_CIFRADO_DATOS`; obligatoria en producción). El admin transfiere a mano y marca «Pagado» con la referencia.
- **Cuenta bancaria:** es una por usuario (`cuentas_pago`) y se carga desde *Mi perfil* o al reclamar; las dos vías escriben la misma fila (`services/cuentas_pago.py`). Si ya la tenía, al elegir efectivo no se le vuelve a pedir. No se puede borrar con un pago en camino, pero sí cambiar.
- **Presupuesto dinámico** (`reto.presupuesto`):
  - `presupuesto_cop` = inscritos × recompensa;
  - `presupuesto_maximo_cop` = cupos × recompensa;
  - `por_pagar_cop` = quienes llegaron y no cobraron;
  - `pagado_cop` = suma de `monto_pagado_cop`, guardado al marcar «Pagado» (migración `20261009_0031`).

  El admin puede cambiar recompensa y umbral de una ronda: lo pagado no se mueve, y bajar el umbral habilita a quien ya lo alcanza.
- **Notificaciones:** van por el módulo existente (`notificar`), con tipo `tendencias` o `reto` y correo según la tabla de la guía.

### Tarea diaria (`TENDENCIAS_TAREA_HORAS`, 24 por defecto)

Corre en un solo worker gracias a un candado en Redis:
- Vuelve a consultar el oEmbed de lo publicado en TikTok y YouTube; si el video ya no está, la ficha pasa a «caído» y se avisa a quien la aprobó.
- Avisa a quien lleva 7 días sin enviar.
- Cierra las rondas vencidas.

## Endpoints

| Método | Ruta | Acceso |
|--------|------|--------|
| GET | `/tendencias/feed?semana=&categoria=&importador_id=` | Público |
| GET | `/tendencias/items/{id}` | Público (solo publicados) |
| POST | `/tendencias/enviar` | Sesión. Límite `RATE_LIMIT_TENDENCIAS_ENVIO` |
| GET | `/tendencias/mis-envios` | Sesión |
| GET | `/tendencias/aprobacion/cola?estado=` · `contadores` · `motivos` · `publicados` | Aprobador |
| PATCH | `/tendencias/items/{id}` | Aprobador |
| POST | `/tendencias/items/{id}/aprobar` · `rechazar` · `archivar` | Aprobador |
| GET | `/reto/rondas/abierta` | Público, sin caché |
| POST | `/reto/lista-espera` | Público |
| POST | `/reto/rondas/{id}/inscribirme` | Sesión |
| GET | `/reto/mi-participacion` | Sesión |
| POST | `/reto/participaciones/{id}/reclamar` | Sesión |
| PUT | `/reto/participaciones/{id}/cuenta-pago` | Sesión |
| GET · PUT · DELETE | `/usuarios/me/cuenta-pago` | Sesión. Cuenta del perfil, enmascarada; DELETE da 409 con un pago en camino |
| GET | `/reto/rondas` | Admin |
| POST | `/reto/rondas` | Admin |
| PATCH | `/reto/rondas/{id}` | Admin |
| GET | `/reto/rondas/{id}/participantes` | Admin; devuelve los datos bancarios descifrados |
| PATCH | `/reto/participaciones/{id}/pagado` | Admin |

## Lo que se retiró de Tendencias v1

Se retiraron:
- las ediciones semanales y su panel de curador;
- las temporadas, el calendario y las fechas ideales;
- los videos subidos al servidor;
- los guardados, el aviso semanal y el muro de pago en la interfaz.

Se conservan:
- **Tablas y datos.**
- **`services/tendencias_calculo.py`**, que lo usan las migraciones.
- **El acceso por suscripción** (`/tendencias/acceso`, checkout, simulación, webhook), **la cortesía y el acceso libre**, listos para cobrar por ver Tendencias más adelante.
