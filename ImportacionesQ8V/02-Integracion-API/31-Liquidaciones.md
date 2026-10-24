# Zarpi Liquidaciones

Primer módulo de la suite Zarpi fuera de Importaciones. Es un marketplace B2B de **lotes completos a precio fijo y por tiempo limitado**: importadoras, distribuidores y bodegas publican lotes; comerciantes los compran para revender; el equipo de Zarpi revisa cada publicación. Zarpi **no recibe el dinero ni mueve la mercancía**: pago y entrega se cierran entre las partes, que se coordinan por el chat de la operación.

Tono del producto: se habla de **oportunidad**, nunca de «baja rotación», «sobrantes» ni «lo que no se vendió».

## Arquitectura

- **Base aparte.** Todo el módulo vive en MongoDB (`zarpi_liquidaciones`); con MySQL solo comparte el login y los usuarios (el JWT dice quién es y con qué rol). Código: paquete `proyecto/backend/liquidaciones/`.
- **Archivos en GridFS**, en dos buckets:
  - `medios`: fotos y videos de los lotes.
  - `documentos`: fichas técnicas, comprobantes de pago, facturas y RUT.
- **Lo único que escribe en MySQL:**
  - los avisos de la campana, que es común a la suite;
  - el campo `modulo` de los tickets de la mesa de ayuda, que también es una sola.
- **Cuenta del módulo:** `empresa:<importador_id>` para la cuenta dueña y sus asesores, que comparten la cuenta; `usuario:<id>` para el cotizante.
- **Parámetros** editables desde el panel admin, en la colección `configuracion`: días máximos de cierre (15), horas para confirmar (48), fotos mín./máx., videos, tamaños, categorías, motivos de rechazo y checklist de revisión.
- **Interruptor** «Zarpi Liquidaciones» en *Módulos*. Apagado, la API responde 404 y el módulo desaparece del selector y del panel.

## Ciclo de un lote

```
en_revision → publicado → reservado → vendido
     ↓            ↓            ↓
 rechazado  cerrado_sin_venta  (si la reserva se cancela o vence: vuelve a publicado)
```

1. **Activación (una vez).** La cuenta se activa con:
   - la declaración de compra comercial («no como consumidor final»);
   - el RUT;
   - los datos de contacto que verá la otra parte al reservar.
2. **Publicación.** Solo empresas. El lote lleva:
   - entre 3 y 8 fotos reales, hasta 2 videos y una ficha técnica opcional;
   - estado de la mercancía, con explicación si no es nuevo;
   - registro INVIMA si aplica;
   - cierre a ≤ 15 días de publicado.

   Entra como `en_revision`.
3. **Revisión.** El equipo (admin o soporte) recorre el checklist y **aprueba**, lo que publica el lote y fija `cierra_en`, o lo **rechaza** con motivos. Un lote rechazado se corrige y se reenvía.
4. **Reserva.** «El primero en dar clic se lo lleva»:
   - Es una actualización condicional atómica del lote, más un índice único parcial: una sola operación `activa` por lote. El segundo comprador recibe **409**.
   - Abre la operación, con los contactos visibles para las dos partes y el chat registrado.
   - El vendedor tiene **48 h** para marcar el lote como vendido.
5. **Cierre.**
   - El comprador sube el comprobante de pago y el vendedor la factura.
   - El vendedor marca el lote como vendido.
   - Cualquiera de las partes (o el equipo) puede cancelar, y el lote vuelve a estar disponible.
   - Los vencimientos (48 h y fecha de cierre) se aplican **al leer**, sin tarea programada.

## Endpoints (`/liquidaciones`)

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| GET | `/publico/lotes?limite=` | Público | Vista previa de la landing |
| GET | `/archivos/{bucket}/{id}` | Según el archivo | Descarga con `Range`. Público si el lote está publicado/reservado/vendido; comprobantes y facturas solo para las partes y el equipo; RUT solo para la cuenta y el equipo |
| POST | `/archivos/{medios\|documentos}` | Cliente (fotos/videos/ficha: empresa) | Multipart `tipo` + `archivo`. Valida extensión, firma y tamaño |
| GET | `/parametros` | Sesión | Mínimos, máximos y categorías para el formulario |
| GET/POST | `/activacion` | Cliente | Estado, prellenado y activación |
| GET | `/lotes`, `/lotes/{id}` | Sesión | Catálogo (q, categoria, ciudad, condicion, entrega) y ficha |
| POST | `/lotes/{id}/reservar` | Cliente activado | 409 si otro llegó primero; 400 si es propio |
| GET | `/operaciones?lado=comprador\|vendedor`, `/operaciones/{id}` | Partes / equipo | Lista y detalle con contactos, documentos y chat |
| POST | `/operaciones/{id}/mensajes\|cancelar\|vendido\|comprobante\|factura` | Partes | Chat y cierre |
| GET/POST/PUT | `/mis-lotes`, `/mis-lotes/{id}` | Empresa | Contadores, publicar y editar (solo en revisión o rechazado) |
| GET | `/admin/revision` | Admin, soporte | Cola, las más antiguas primero, con motivos y checklist |
| POST | `/admin/lotes/{id}/aprobar\|rechazar\|despublicar\|destacar` | Admin, soporte | Moderación |
| GET | `/admin/lotes`, `/admin/operaciones` | Admin, soporte | Listados con búsqueda y paginación (monitoreo de chats) |
| POST | `/admin/operaciones/{id}/intervenir` | Admin, soporte | Mensaje «[Soporte Zarpi] …» y aviso a las dos partes |
| GET | `/admin/metricas` | Admin | Resumen de 30 días |
| GET/PUT | `/admin/cuentas`, `/admin/cuentas/{cuenta}/suspension` | Admin | Cuentas activadas; suspender bloquea comprar y publicar |
| GET/PUT | `/admin/configuracion` | Admin | Parámetros del módulo |

## Mesa de ayuda compartida

`POST /chat/soporte` acepta `modulo` (`importaciones` | `liquidaciones`) y `referencia` (`lote:<id>`, `operacion:<id>`). La migración `20261024_0045` añade esas columnas a `conversaciones_chat`; los tickets anteriores se leen como de Importaciones. `GET /admin/conversaciones?modulo=` filtra, y la bandeja del equipo tiene chips por producto.

## Frontend

- Registro de la suite: `config/suite.ts` declara cada producto (menú por rol, inicio, grupo en el panel admin). Lo leen el selector de producto del sidebar, `getNavItems()` y los grupos del admin.
- Módulo: `features/liquidaciones/`, que agrupa pantallas, componentes, panel admin y hooks de react-query. El router es `pages/liquidaciones/LiquidacionesRouter.tsx`.
- Rutas:
  - `/liquidaciones`: landing pública.
  - `/liquidaciones/lotes[/<id>]`, `/reservas[/<id>]`, `/mis-lotes`, `/publicar[/<id>]`, `/operaciones[/<id>]`, `/activar`.
  - Panel del equipo en `/admin/liquidaciones/*`.

## Operación

- Compose:
  - servicio `mongo:7`;
  - variables `MONGO_URL` y `MONGO_DB`;
  - las pruebas usan Mongo real con `MONGO_DB=zarpi_liquidaciones_test`.
- `/health/ready` incluye `mongo`.
- `scripts/backup_servidor.sh` añade un `mongodump` de toda la instancia (`backups/mongo/`).
