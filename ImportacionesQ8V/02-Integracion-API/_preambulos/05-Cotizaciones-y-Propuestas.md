## Shipping mark (marca de embarque)

Es la etiqueta que va rotulada en las cajas para distinguir la mercancía de un
cliente dentro del contenedor de la empresa importadora. Se compone de dos
partes que viven en sitios distintos:

| Parte | Quién la pone | Dónde | Ejemplo |
|---|---|---|---|
| Prefijo | La empresa importadora | `PUT /importadores/{id}` → `shipping_mark_prefijo` | `ctl` |
| Sufijo | El cliente, al cotizar | `POST /cotizaciones` → `shipping_mark_sufijo` | `prendas control` |

El resultado es **`ctl-prendascontrol`**. Ambas partes se normalizan a `[a-z0-9]`
(sin tildes, sin eñes, sin espacios ni signos) porque la marca acaba impresa o
estarcida sobre cartón y la leen operarios de bodega y agentes de aduana en
varios países.

Dónde aparece cada campo:

- `CotizacionResponse.shipping_mark_sufijo` — lo que escribió el cliente, tal cual
  (`"prendas control"`), para poder mostrárselo de vuelta.
- `CotizacionResponse.shipping_mark` — la marca ya compuesta. Es `null` mientras no
  se sepa qué empresa importará: en modalidad **abierta** no hay prefijo hasta que
  una empresa gana la propuesta.
- `OrdenResponse.shipping_mark` — **copia congelada** en el momento de crear la
  orden. No se recalcula: si la empresa cambia su prefijo más adelante, las cajas
  ya rotuladas y los documentos emitidos tienen que seguir cuadrando.
- `ImportadorResponse.shipping_mark_prefijo` — público a propósito, para que el
  solicitante vea cómo quedará rotulada su carga antes de pedir la cotización.

Ambas partes son opcionales. Si falta cualquiera de las dos, `shipping_mark` es
`null`: media marca (`ctl-`) en un documento de embarque es peor que ninguna.

## Congruencia de categoría

Una empresa solo puede responder cotizaciones de su especialidad
(`Importador.especialidad_producto` frente a `Cotizacion.linea_producto`). La
comparación **no es de cadena exacta**: tolera mayúsculas, tildes, plurales y
variantes léxicas, de modo que `"Químicos"` y `"Química"`, o `"Textiles"` y
`"Textil"`, se consideran la misma categoría (ver `backend/utils/categorias.py`).

Consecuencias para quien integra:

- `POST /cotizaciones` en modalidad **dirigida** devuelve `400` si la empresa
  destino no trabaja esa línea de producto. El aviso llega al cliente al crearla,
  no a la empresa al intentar responderla.
- `GET /cotizaciones` para una cuenta de empresa (`importador` / `asesor`) solo
  devuelve las abiertas **asignadas** a esa empresa que además puede responder
  (ver [[23-Asignacion-de-Solicitudes]]). Las dirigidas a ella se listan siempre.
- Una empresa **sin especialidades declaradas** no queda bloqueada al responder,
  pero tampoco entra en el reparto automático de cotizaciones abiertas.

## Cantidad y unidad (desde 2026-10-03)

- `cantidad_minima` admite decimales y va acompañada de `unidad_cantidad`:
  `"unidades"` (por defecto, debe ser entera; si no, `422`) o `"m3"`.
- La propuesta puede traer `cantidad` (la que cubre el precio). Si no la trae, se
  entiende la pedida. `precio_ofrecido_usd` es el **total** de la propuesta.

## Asignación, propuestas selladas y motivo de elección (desde 2026-10-03)

- Una abierta solo la ve, reclama y responde una empresa que la tenga asignada; si
  no, `403`.
- Para una empresa, la cotización abierta oculta datos de la competencia:
  responsable, contacto, chat, y que ya haya propuestas.
- El solicitante recibe las propuestas en orden de llegada, con un campo `empresa`
  que trae el cumplimiento de cada una. Al aceptar puede enviar `motivo_eleccion`
  (`precio`, `tiempo`, `condiciones`, `otro`) y `motivo_detalle`, que pasan a
  `motivo_descarte` de las propuestas perdedoras.
- `POST /cotizaciones/{id}/vista` marca que la empresa abrió la solicitud (para la
  bitácora).

Detalle en [[23-Asignacion-de-Solicitudes]] y [[24-Eventos-y-Panel-Empresa]].
