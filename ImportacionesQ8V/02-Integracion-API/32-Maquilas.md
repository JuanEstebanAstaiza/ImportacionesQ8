# Zarpi Maquilas

Módulo de la suite Zarpi que conecta a **clientes** (emprendedores y marcas) con **maquiladoras** (talleres y plantas) para fabricar productos personalizados y crear su propia marca. Sigue el flujo de Importaciones (solicitud → propuestas → pedido → seguimiento) y le suma lo propio de fabricar: muestra, producción por etapas, control de calidad y herramientas de marca.

Se construye por fases:
- **Fase 1:** la cuenta de la maquiladora, su registro, su expediente y la verificación del equipo.
- **Fase 2:** directorio, solicitudes de fabricación (dirigidas y abiertas), confidencialidad, propuestas comparables, pedido con muestra, producción por etapas, pagos por hitos y chat.
- **Fase 3:** marca blanca, ficha técnica guiada con PDF, calculadora de costo y margen, checklist y reporte de calidad, reseñas con métricas públicas y repetir pedido.
- Siguiente (fase 4): estudio de marca, ruta legal y el admin completo.

## Arquitectura

- **Base aparte.** MongoDB, base `zarpi_maquilas` (`MONGO_DB_MAQUILAS`), en la misma instancia que [[31-Liquidaciones]]. El cliente de Mongo es uno solo para toda la suite (`utils/mongo.py`); cada módulo usa su base. Código: paquete `proyecto/backend/maquilas/`.
- **Archivos en GridFS**, dos buckets: `medios` (galería de trabajos) y `documentos` (RUT, cámara de comercio, certificados). Las piezas comunes (firma del archivo, `Range`, lectura por trozos) están en `utils/gridfs_archivos.py` y las comparte Liquidaciones. Un archivo nace suelto y queda «ligado» al adjuntarlo al expediente; lo suelto de más de 24 h se borra solo.
- **La maquiladora es un rol propio: `maquiladora`.** Es un `Usuario` de MySQL (login compartido); su empresa vive en Mongo:
  - `maquiladoras`: datos de la empresa, fabricación, expediente y estado.
  - `miembros`: qué usuarios atienden cada maquiladora (`_id` = id del usuario, `rol` dueño o colaborador). La cuenta del módulo es `maquiladora:<id>`.
- **Solo usa Maquilas.** En el frontend tiene lista blanca de pantallas (`PANTALLAS_MAQUILADORA`) y no ve el selector de productos. Liquidaciones la excluye por rol.
- **Lo único que escribe en MySQL:** la cuenta del usuario y los avisos de la campana. Como no hay transacción entre bases, el alta crea el usuario y, si Mongo falla, lo borra.
- **Interruptor** «Zarpi Maquilas» en *Módulos* (`MODULO_MAQUILAS_HABILITADO`). Apagado, la API responde 404 y el módulo desaparece del selector, del registro y del panel.

## Cuenta y verificación

| Estado | Qué significa |
|---|---|
| `registrada` | Cuenta creada; completa perfil y expediente |
| `en_revision` | La envió a verificación |
| `verificada` | Sello «Verificada por Zarpi»; su galería se vuelve pública |
| `rechazada` | El equipo pidió cambios (con motivo); corrige y reenvía |
| `suspendida` | El admin la sacó (con motivo); al reactivarla vuelve a su estado anterior |

- **Alta pública** en `/maquilas/registro` (3 pasos: empresa, representante, qué fabrica). Pide los mismos datos legales que a cualquier empresa: razón social, nombre comercial, NIT, ciudad, representante con documento, celular, correo y contraseña. Respeta el interruptor «Registro público». Después confirma el correo con el código OTP (`POST /auth/verificar-email`), como cualquier cuenta.
- **Alta desde el panel:** Admin › Usuarios › Crear usuario › «Maquila» (el panel crea cualquier tipo de cuenta). Queda con el correo verificado.
- **Un NIT, una maquiladora** (índice único sobre el NIT normalizado).
- **Para enviar a verificación** el expediente necesita RUT, cámara de comercio, descripción de 30+ caracteres, al menos una categoría, un proceso y una foto en la galería. La razón social y el NIT solo se editan mientras está `registrada` o `rechazada`.
- Las categorías, procesos y certificaciones salen de los parámetros del módulo (colección `configuracion`, documento `parametros`).

## Endpoints (`/maquilas`)

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| GET | `/parametros` | Público | Categorías, procesos, certificaciones y límites |
| POST | `/registro` | Público | Crea la cuenta y la maquiladora; envía el OTP |
| GET | `/archivos/{bucket}/{id}` | Según el archivo | Descarga con `Range` (ver acceso abajo) |
| POST | `/archivos/{bucket}` | Maquiladora | Sube `foto`, `rut`, `camara_comercio` o `certificado` |
| GET / PUT | `/mi-maquiladora` | Maquiladora (edita el dueño) | Perfil y estado, con lo pendiente |
| PUT | `/mi-maquiladora/documentos` | Dueño | Liga RUT, cámara, certificados y galería |
| POST | `/mi-maquiladora/enviar-verificacion` | Dueño | Pasa a `en_revision` y avisa al equipo |
| POST | `/admin/maquiladoras` | Admin | Alta de una maquiladora con su cuenta dueña |
| GET | `/admin/maquiladoras?estado=&q=` | Admin, soporte | Cola y búsqueda, con contadores por estado |
| GET | `/admin/maquiladoras/{id}` | Admin, soporte | Expediente completo |
| POST | `/admin/maquiladoras/{id}/aprobar` · `/rechazar` | Admin, soporte | Verifica o pide cambios (motivo) |
| POST | `/admin/maquiladoras/{id}/suspender` · `/reactivar` | Admin | Suspende (motivo) o reactiva |

**Acceso a archivos:** el equipo ve todo; la maquiladora ve lo suyo; la galería de una maquiladora **verificada** es pública; RUT, cámara y certificados solo los ven la maquiladora y el equipo.

## Frontend

- Módulo en `proyecto/frontend/src/apps/maquilas/` (rutas `maq-*`, `MaquilasRouter`, pantallas, `useMaquilas.ts` con react-query) y `services/maquilas.service.ts`.
- Públicas: `maq-landing` (`/maquilas`, con «Registra tu maquila») y `maq-registro` (`/maquilas/registro`).
- Maquiladora: `maq-panel` (estado y pasos de la verificación) y `maq-perfil` (perfil, documentos y galería). Inicia sesión eligiendo «Maquila» en el login.
- Admin: grupo «Maquilas» › Verificación (`/admin/maquilas/verificacion[/<id>]`), también para soporte.
- Registro de la suite: `MAQUILAS` en `shared/suite/suite.ts`.

## Fase 2: del brief al pedido

**Clientes:** cotizante y empresa importadora (dueña y asesores comparten las solicitudes de la empresa). Entran a Maquilas desde la rueda; su inicio es el directorio.

### Solicitud de fabricación

| Estado | Qué significa |
|---|---|
| `abierta` | Publicada; esperando propuestas |
| `con_propuestas` | Al menos una maquila propuso |
| `aceptada` | El cliente eligió una propuesta y se abrió el pedido |
| `cancelada` | El cliente la retiró antes de elegir |

- **Brief guiado:** categoría, nombre, descripción, cantidad, presupuesto por unidad, fecha objetivo, ciudad de entrega, referencias (fotos) y ficha técnica (PDF). Cada categoría añade sus preguntas (plantillas en los parámetros: tallas y tela en textil, presentación y fórmula en cosmética…).
- **Dirigida:** le llega a una maquila verificada; valida que la cantidad alcance su pedido mínimo.
- **Abierta:** se reparte a las `cupo_abierta` (5) maquilas verificadas de esa categoría cuyo pedido mínimo quepa en la cantidad; primero las de la misma ciudad, luego las que tienen capacidad para el volumen y más certificaciones. Sin ninguna compatible, no se publica (409).
- **Confidencialidad:** si el cliente la pide, la maquila ve solo nombre, categoría, cantidad, ciudad y fecha hasta aceptar el acuerdo (queda registrado quién y cuándo). Antes no ve descripción, referencias ni ficha, no chatea y no propone.
- Cada maquila destino tiene su estado: `pendiente`, `propuesta` o `rechazada` (con motivo, que le llega al cliente).

### Propuestas

- Una por maquila y solicitud (índice único); se edita mientras está `enviada`.
- **Tramos de precio por cantidad** (el primero debe cubrir la cantidad pedida), costo de la muestra, días de muestra y de producción, condiciones y validez (1 a 60 días).
- **Hitos de pago** que suman 100 %: `anticipo`, `contra_muestra`, `contra_entrega` (por defecto 50 / 0 / 50).
- El cliente las compara lado a lado (precio aplicado a su cantidad, total, tiempos, pagos) y elige una con un motivo opcional. Al elegir, la solicitud se cierra con una actualización condicional (dos clics no crean dos pedidos), la elegida queda `aceptada` y las demás `descartada`. Una propuesta vencida no se puede aceptar.

### Pedido

| Estado | Qué pasa |
|---|---|
| `muestra` | La maquila envía la muestra por rondas; el cliente la aprueba o pide ajustes |
| `produccion` | La maquila completa las etapas en orden, con nota y fotos |
| `despachado` | Se completó el despacho; el cliente confirma que lo recibió |
| `entregado` | Cerrado |
| `cancelado` | Cualquiera de las partes, mientras está en la muestra, con motivo |

- **Total:** precio por unidad × cantidad + costo de la muestra. La fecha comprometida es la de aceptación + días de muestra + días de producción; pasada sin entregar, el pedido sale como «Retrasado».
- **Etapas** (parámetros): compra de insumos, corte o preparación, fabricación, acabado, control de calidad, empaque y despacho.
- **Pagos:** Zarpi no recibe el dinero. Cada hito va `pendiente` → `enviado` (el cliente subió el comprobante) → `confirmado` o `rechazado` (con motivo; el cliente puede subir otro). Lo revisa la maquila.
- **Compuertas:**
  - La muestra se envía cuando el anticipo está confirmado (si lo hay).
  - La producción avanza cuando la muestra está aprobada y el pago contra muestra confirmado (si lo hay).
  - El despacho exige confirmados todos los pagos menos el de contra entrega, que se puede pagar después de recibir.
- Cada lado ve un aviso con lo que le toca hacer o a quién espera, y la lista marca los pedidos que esperan algo de quien mira.

### Chat y avisos

- Un hilo por pareja solicitud–maquila (`<solicitud_id>:<maquiladora_id>`): empieza en la negociación y sigue en el pedido. Texto y adjuntos (PDF o imagen). Los eventos (propuesta, aceptación, muestra, pagos, etapas, cancelación) dejan un mensaje de sistema. El equipo de Zarpi lo lee pero no escribe.
- Avisos en la campana (y por correo los importantes: nueva solicitud, propuesta, muestra, comprobantes, despacho, cancelación) para la otra parte. Al abrir un aviso se va a la solicitud o al pedido.
- «Reportar un problema» en el pedido abre un ticket de la mesa de ayuda con `modulo=maquilas` y `referencia=pedido:<id>`.

### Endpoints de la fase 2 (`/maquilas`)

| Método | Ruta | Quién |
|---|---|---|
| GET | `/directorio?categoria=&proceso=&ciudad=&q=&cantidad=` · `/directorio/{id}` | Cualquier rol del módulo |
| POST · GET | `/solicitudes` | Cliente (crea · las suyas) |
| GET | `/recibidas` | Maquiladora |
| GET | `/solicitudes/{id}` | Cliente dueño, maquila destino, equipo |
| POST | `/solicitudes/{id}/cancelar` | Cliente |
| POST | `/solicitudes/{id}/acuerdo` · `/rechazar` | Maquiladora |
| PUT | `/solicitudes/{id}/propuesta` | Maquiladora (crea o edita) |
| POST | `/propuestas/{id}/aceptar` | Cliente |
| GET | `/pedidos` · `/pedidos/{id}` | Las dos partes (el equipo puede ver el detalle) |
| POST | `/pedidos/{id}/muestras` · `/etapas/{clave}` · `/hitos/{clave}/confirmar` · `/hitos/{clave}/rechazar` | Maquiladora |
| POST | `/pedidos/{id}/muestras/responder` · `/hitos/{clave}/comprobante` · `/recibido` | Cliente |
| POST | `/pedidos/{id}/cancelar` | Cualquiera de las partes |
| GET · POST | `/hilos/{hilo}/mensajes` | Las partes (el equipo solo lee) |

Archivos nuevos (`POST /archivos/{bucket}`): el cliente sube `referencia`, `ficha_tecnica`, `comprobante` y `adjunto`; la maquila, `muestra` (foto o video), `evidencia` y `adjunto`. Quedan ligados a la solicitud, al pedido o al hilo, y solo los ven sus partes (las referencias de una solicitud confidencial, después del acuerdo).

Frontend: cliente `maq-directorio`, `maq-maquiladora/<id>`, `maq-solicitar[/<maquila>]`, `maq-solicitudes[/<id>]`, `maq-pedidos[/<id>]`; maquila `maq-recibidas[/<id>]` y `maq-produccion[/<id>]`. Pruebas: `tests/test_maquilas_fase2.py`.

## Fase 3: marca, calidad y confianza

### Marca blanca (`productos_mb`)

- La maquila publica productos que ya fabrica: nombre, categoría (una de las suyas), descripción, fotos (`producto`, vitrina pública como la galería; máximo `fotos_producto_max`), pedido mínimo, precio por cantidad, qué personaliza el cliente (`personalizaciones`: logo, etiqueta, empaque, color, aroma o sabor), costo y días de la muestra, días de producción. Hasta `productos_max` (30) por maquila.
- Se guarda como borrador o publicado (`activo`). Publicar exige la maquila verificada y al menos una foto. El catálogo muestra solo lo publicado, de maquilas verificadas y no oculto por el equipo; ordena por pedidos.
- El cliente lo pide con una solicitud `marca_blanca`: le llega a esa maquila, la categoría es la del producto, la cantidad mínima es la del producto (no la de la maquila) y la personalización tiene que estar entre las que ofrece. La solicitud guarda una copia del producto (nombre, tramos, foto). La propuesta de la maquila arranca con su precio de catálogo.
- Cada pedido aceptado suma al contador `pedidos` del producto. Las fotos que la maquila saca de un producto no se borran (las solicitudes las siguen mostrando).
- El equipo oculta un producto con motivo (le llega por correo a la maquila) y lo vuelve a mostrar desde *Maquilas › Moderación*.

### Ficha técnica guiada

- En la solicitud, el cliente llena por secciones: medidas y tallas, materiales, colores (Pantone), acabados, empaque, etiquetado y notas. Se guarda estructurada (`ficha_guiada`) y, si no subió un PDF propio, se genera el PDF (`maquilas/pdf.py`, sin dependencias, con tildes) y queda como la ficha técnica adjunta.
- `POST /fichas/vista-previa` devuelve el PDF para descargarlo antes de enviar.

### Calculadora de costo y margen

Solo en el frontend (`features/calculadora.ts`, función pura). Costo por unidad = fabricación + empaque + etiquetas + (envío + costos del lote) / cantidad. Precio sugerido antes de IVA = costo / (1 − comisión − margen); con IVA encima. Con un precio propio calcula la ganancia y el margen real. Punto de equilibrio = inversión del lote / (precio × (1 − comisión)). Se abre sola (`maq-calculadora`) o desde el comparador, el producto de marca blanca o el pedido, con el precio y la cantidad puestos.

### Calidad

- La propuesta lleva un checklist (`criterios_calidad`: criterio y tolerancia, hasta 15). La maquila parte de los sugeridos por categoría (`criterios_calidad` en parámetros).
- La etapa `control_calidad` ya no se cierra a mano: la maquila sube un **reporte de inspección** (unidades inspeccionadas, cumple / no cumple por criterio con observación, fotos y nota) y el cliente lo **aprueba** (se cierra la etapa con sus fotos y sigue el empaque) u **objeta** con motivo (la maquila sube otra ronda). Mientras uno espera respuesta no se sube otro.
- Como las etapas van en orden, sin calidad aprobada no hay empaque ni despacho. Si el admin quita `control_calidad` de las etapas, no hay reporte. Los pedidos de antes de la fase 3 suben el reporte sin criterios.

### Reseñas y métricas (`resenas`)

- Una por pedido entregado (índice único), del cliente: general, puntualidad, calidad y comunicación (1 a 5) y comentario. Firma con la empresa o el nombre de pila.
- La maquila responde una vez. El equipo oculta (con motivo) o vuelve a mostrar; oculta no se ve ni cuenta.
- `maquiladoras.metricas` se recalcula al entregar un pedido y al cambiar una reseña: calificación promedio y por dimensión, número de reseñas, pedidos entregados y cumplimiento (% entregados con la confirmación del cliente antes de la fecha comprometida). El directorio ordena por calificación y el reparto de solicitudes abiertas la usa como desempate.

### Repetir pedido

Con el pedido entregado, el cliente elige cantidad y fecha y se crea una solicitud dirigida a la misma maquila con el mismo brief, referencias y ficha (`repite_de`). Si la original era confidencial, el acuerdo que la maquila ya aceptó sigue valiendo. Si salió de marca blanca y el producto sigue publicado, es otra vez `marca_blanca` con sus precios actuales. La maquila ve su propuesta anterior para partir de ella.

### Endpoints de la fase 3 (`/maquilas`)

| Método | Ruta | Quién |
|---|---|---|
| GET · POST | `/mi-maquiladora/productos` · PUT `/mi-maquiladora/productos/{id}` | Maquiladora |
| GET | `/catalogo?categoria=&q=&cantidad=&maquiladora=` · `/catalogo/{id}` | Cualquier rol del módulo |
| POST | `/fichas/vista-previa` | Cliente |
| POST | `/pedidos/{id}/calidad` | Maquiladora |
| POST | `/pedidos/{id}/calidad/responder` · `/resena` · `/repetir` | Cliente |
| GET | `/mi-maquiladora/resenas` · POST `/resenas/{id}/respuesta` | Maquiladora |
| GET | `/directorio/{id}/resenas` | Cualquier rol del módulo |
| GET · POST | `/admin/productos` · `/admin/productos/{id}/ocultar` · `/mostrar` | Equipo |
| GET · POST | `/admin/resenas?ocultas=&maximo=` · `/admin/resenas/{id}/ocultar` · `/mostrar` | Equipo |

Frontend: maquila `maq-catalogo` y `maq-resenas`; cliente `maq-marca-blanca[/<producto>]` y `maq-calculadora`; admin `maq-admin-moderacion`. Pruebas: `tests/test_maquilas_fase3.py`.

Las descargas de GridFS (Maquilas y Liquidaciones) mandan el nombre del archivo con `filename*` (UTF-8): un nombre con tildes rompía la cabecera.

## Operación

- Cuentas de prueba (`scripts/seed_usuarios_prueba.py`): `maquila@q8demo.com` (verificada) y `maquila2@q8demo.com` (por completar), con la contraseña de ese script.
- Pruebas: `tests/test_maquilas.py` contra el Mongo real del compose (`zarpi_maquilas_test`).
- El backup (`scripts/backup_servidor.sh`) ya hace `mongodump` de toda la instancia, así que incluye esta base.
