# Zarpi Maquilas

Módulo de la suite Zarpi que conecta a **clientes** (emprendedores y marcas) con **maquiladoras** (talleres y plantas) para fabricar productos personalizados y crear su propia marca. Sigue el flujo de Importaciones (solicitud → propuestas → pedido → seguimiento) y le suma lo propio de fabricar: muestra, producción por etapas, control de calidad y herramientas de marca.

Se construye por fases. **Fase 1 (esta nota):** la cuenta de la maquiladora, su registro, su expediente y la verificación del equipo. Las fases siguientes traen el directorio, las solicitudes y los pedidos (fase 2), marca blanca, ficha técnica, calculadora, calidad y reseñas (fase 3), y estudio de marca, ruta legal y el admin completo (fase 4).

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

## Operación

- Cuentas de prueba (`scripts/seed_usuarios_prueba.py`): `maquila@q8demo.com` (verificada) y `maquila2@q8demo.com` (por completar), con la contraseña de ese script.
- Pruebas: `tests/test_maquilas.py` contra el Mongo real del compose (`zarpi_maquilas_test`).
- El backup (`scripts/backup_servidor.sh`) ya hace `mongodump` de toda la instancia, así que incluye esta base.
