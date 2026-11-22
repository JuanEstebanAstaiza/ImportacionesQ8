# Zarpi Maquilas

Módulo de la suite Zarpi que conecta a **clientes** (emprendedores y marcas) con **maquiladoras** (talleres y plantas) para fabricar productos personalizados y crear su propia marca. Sigue el flujo de Importaciones (solicitud → propuestas → pedido → seguimiento) y le suma lo propio de fabricar: muestra, producción por etapas, control de calidad y herramientas de marca.

Se construye por fases:
- **Fase 1:** la cuenta de la maquiladora, su registro, su expediente y la verificación del equipo.
- **Fase 2:** directorio, solicitudes de fabricación (dirigidas y abiertas), confidencialidad, propuestas comparables, pedido con muestra, producción por etapas, pagos por hitos y chat.
- Siguientes: marca blanca, ficha técnica, calculadora, calidad y reseñas (fase 3); estudio de marca, ruta legal y el admin completo (fase 4).

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

## Operación

- Cuentas de prueba (`scripts/seed_usuarios_prueba.py`): `maquila@q8demo.com` (verificada) y `maquila2@q8demo.com` (por completar), con la contraseña de ese script.
- Pruebas: `tests/test_maquilas.py` contra el Mongo real del compose (`zarpi_maquilas_test`).
- El backup (`scripts/backup_servidor.sh`) ya hace `mongodump` de toda la instancia, así que incluye esta base.
