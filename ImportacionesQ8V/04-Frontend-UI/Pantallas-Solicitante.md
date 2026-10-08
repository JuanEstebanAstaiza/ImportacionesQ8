# Pantallas del Solicitante — Zarpi

> **Última actualización:** 2026-10-01

## Descripción general

Documentación de las pantallas P0 y P1 para el solicitante (cliente final que solicita cotizaciones). Construidas con **Vite + React** con TypeScript. Mobile-first para el formulario de cotización y el chat.

---

## Estado actual (2026-10-03)

> Las secciones de abajo son el diseño original del MVP; la numeración "Pantalla N" es la de ese diseño. Las pantallas reales están en `src/app/App.tsx`. Rutas en [[Routing-y-Roles-Frontend]].

| Pantalla | URL | Qué permite |
|----------|-----|-------------|
| Landing | `/` | Página pública de Zarpi, editable desde el admin ([[22-Landing-CMS]]) |
| Registro / Login | `/registro`, `/login` | Registro natural/jurídica con OTP de email; login con selección de rol |
| Dashboard | `/inicio` | Resumen de cotizaciones, respuestas y órdenes |
| Cotizaciones | `/cotizaciones`, `/cotizaciones/:id` | Lista y detalle; **duplicar** una cotización. En el detalle, **comparador de propuestas** (ver abajo) |
| Nueva cotización | `/cotizaciones/nueva` | 3 pasos: modalidad (dirigida a una empresa o abierta), producto (cantidad en **unidades o m³**, precio objetivo multimoneda, DDP por defecto, shipping mark) y confirmación |
| Respuestas | `/respuestas`, `/respuestas/:id` | Propuestas recibidas, comparación y preaceptación |
| Órdenes | `/ordenes`, `/ordenes/:id` | Seguimiento del embarque; **reseñas pendientes** de órdenes entregadas |
| Ficha de empresa | `/empresas/:id` | Presentación, certificaciones, reseñas y "N proyectos" |
| Chats | `/chats` | Negociación con la empresa; recibe **tarjetas de estimación de precio** con total, rango y desglose ([[20-Calculadora-Precios-Chat]]) |
| Documentos | `/documentos` | Módulo documental tipo Drive |
| Pagos | `/pagos` | Pagos (Wompi en modo simulado; cotizar no cuesta) |
| Cursos | `/cursos` | Catálogo, reproductor, progreso y certificado |
| Perfil | `/perfil` | Datos personales y **referidos** |
| Ayuda | `/ayuda` | Centro de ayuda y apertura de tickets de soporte |

**Comparador de propuestas** (detalle de una cotización abierta con varias propuestas, desde el 2026-10-03):
- Las propuestas salen **en el orden en que llegaron**, no por precio.
- Cada fila muestra al mismo nivel:
  - empresa;
  - **precio** (USD y su equivalente en COP);
  - **tiempo**;
  - **qué incluye** (lectura del incoterm y ventajas declaradas);
  - **cumplimiento** (calificación, reseñas, pedidos entregados y en curso).
- Al **aceptar** habiendo otras propuestas, se pregunta qué decidió la elección: precio, tiempo de entrega, condiciones u otro. Eso se convierte en el motivo de pérdida que ven las demás empresas en su panel. Ver [[23-Asignacion-de-Solicitudes]].

Avisos que ve el cliente al crear una cotización dirigida:
- **Tier insuficiente:** la empresa exige un nivel mayor. Puede desbloquearla con 1 punto ([[18-Tiers-y-Perfil-Cotizante]]).
- **Cupo diario agotado:** la empresa ya no recibe más cotizaciones hoy. El aviso propone elegir otra empresa o publicarla abierta ([[19-Limite-Diario-Cotizaciones]]).

---

## Inventario de pantallas del solicitante

| # | Pantalla | Módulo | Prioridad |
|---|----------|--------|-----------|
| 1 | Login / Registro (solicitante) | Acceso | P0 |
| 2 | Dashboard del solicitante | Cotizaciones | P0 |
| 3 | Selección de modalidad (dirigida / abierta) | Cotizaciones | P0 |
| 4 | Catálogo de importadores — tarjetas con logo, especialidad y calificación | Cotizaciones | P0 |
| 5 | Formulario de cotización | Cotizaciones | P0 |
| 6 | Panel de propuestas recibidas (red de importadores) | Cotizaciones | P0 |
| 7 | Checkout de pago (Wompi) | Pagos | P0 |
| 8 | Detalle de orden con línea de estados | Órdenes | P0 |
| 9 | Chat con asesor (ligado a orden/cotización) | Chat | P0 |
| 12 | Repositorio de documentos por orden | Órdenes/Pagos | P1 |
| 15 | Historial y filtros avanzados de "Mis cotizaciones" | Cotizaciones | P1 |

---

## Pantalla 1 · Login / Registro — Solicitante

> Un solo punto de entrada, el rol define el panel al que se llega.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│         LOGO ImportacionesQ8        │
├─────────────────────────────────────┤
│                                     │
│   ┌───────────────────────────┐     │
│   │  Iniciar Sesión           │     │
│   │                           │     │
│   │  Email: [___________]     │     │
│   │  Contraseña: [______]     │     │
│   │                           │     │
│   │   ○ Solicitante           │     │
│   │   ○ Importador            │     │
│   │   ○ Admin                 │     │
│   │                           │     │
│   │   [Iniciar Sesión]        │     │
│   │                           │     │
│   │  ¿No tienes cuenta?        │     │
│   │  Registrarse              │     │
│   │  Recuperar contraseña     │     │
│   └───────────────────────────┘     │
│                                     │
├─────────────────────────────────────┤
│    © 2026 ImportacionesQ8           │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Formulario de login:** Campos email + contraseña, selector de rol
- **Enlace a registro:** Redirige al formulario de registro del solicitante
- **Enlace a recuperación de contraseña:** Modal o página para solicitar reset de contraseña
- **Logo ImportacionesQ8:** Identidad visual propia (distinta del sistema de referencia)

### Validaciones

| Campo | Regla | Mensaje de error |
|-------|-------|-----------------|
| Email | Formato email válido | "Ingresa un email válido" |
| Contraseña | Mínimo 8 caracteres | "La contraseña debe tener al menos 8 caracteres" |
| Rol | Debe seleccionar uno | "Selecciona tu tipo de cuenta" |

---

## Pantalla 2 · Dashboard del Solicitante

> Misma estructura de tabs del sistema de referencia (Cotizaciones / Órdenes / Facturación), con el asesor visible cuando aplica.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  [Logo]          [Notificaciones]   │
├─────────────────────────────────────┤
│  Cotizaciones | Órdenes | Pagos     │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────┐      │
│  │  + Nueva Cotización       │      │
│  └───────────────────────────┘      │
│                                     │
│  ── Cotizaciones Recientes ──        │
│  ┌───────────────────────────┐      │
│  │ Textiles - China          │      │
│  │ Estado: Propuestas rec.   │      │
│  │ Hace 2 horas              │      │
│  └───────────────────────────┘      │
│  ┌───────────────────────────┐      │
│  │ Electrónica - China       │      │
│  │ Estado: Orden activa      │      │
│  │ Hace 3 días               │      │
│  └───────────────────────────┘      │
│                                     │
│  ── Órdenes Activas ──              │
│  ┌───────────────────────────┐      │
│  │ Electrónica - China       │      │
│  │ Estado: En tránsito       │      │
│  │ [Ver detalle]             │      │
│  └───────────────────────────┘      │
│                                     │
│  ── Asesor Asignado ──              │
│  ┌───────────────────────────┐      │
│  │ Maria Lopez               │      │
│  │ Importadora ABC           │      │
│  │ [Chat] [WhatsApp]         │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   Mi Perfil          Cerrar Sesión  │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Tabs de navegación:** Cotizaciones | Órdenes | Pagos (cambio de vista)
- **Botón "Nueva Cotización":** Redirige a Pantalla 3 (Selección de modalidad)
- **Lista de cotizaciones recientes:** Tarjetas con nombre del producto, estado y tiempo
- **Lista de órdenes activas:** Tarjetas con nombre del producto, estado actual y botón "Ver detalle"
- **Tarjeta de asesor asignado:** Foto, nombre, empresa, botones de Chat y WhatsApp

### Estado de las cotizaciones (etiquetas de color)

| Estado | Color | Descripción |
|--------|-------|-------------|
| Cotización creada | Azul | Recién creada, sin enviar |
| Dirigida | Verde | Enviada a importador específico |
| Abierta / Propuestas recibidas | Amarillo | Respuestas de la red de importadores |
| Cotización aceptada | Morado | Aceptó oferta, pendiente de pago |
| Orden activa | Naranja | Pago confirmado, orden en curso |

---

## Pantalla 3 · Selección de Modalidad

> El paso que no existe en el sistema de referencia y que materializa el diferenciador del negocio.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   ¿Cómo quieres enviar tu solicitud?│
│                                     │
│  ┌───────────────────────────┐      │
│  │  Cotización Dirigida      │      │
│  │                           │      │
│  │  Elige un importador      │      │
│  │  específico               │      │
│  │                           │      │
│  │  Buscar importador        │      │
│  └───────────────────────────┘      │
│                                     │
│  ┌───────────────────────────┐      │
│  │  Red de Importadores      │      │
│  │                           │      │
│  │  Difunde a toda la red    │      │
│  │  y recibe múltiples       │      │
│  │  propuestas               │      │
│  │                           │      │
│  │  Difundir a la red        │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   [Continuar]                       │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Tarjeta de cotización dirigida:** Con icono, título, descripción y botón "Buscar importador"
- **Tarjeta de cotización abierta:** Con icono, título, descripción y botón "Difundir a la red"
- **Botón Continuar:** Habilitado solo cuando se selecciona una modalidad

### Comportamiento

- Al seleccionar **Cotización Dirigida** → Redirige a Pantalla 4 (Catálogo de importadores)
- Al seleccionar **Red de Importadores** → Redirige a Pantalla 5 (Formulario de cotización con modalidad="abierta")

---

## Pantalla 4 · Catálogo de Importadores

> Tarjetas con logo, nombre, especialidad, calificación y tiempo de respuesta de cada empresa, para elegir con criterio en la modalidad dirigida.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   Elige una importadora             │
│                                     │
│  Buscar por nombre o especialidad   │
│                                     │
│  Filtros:                           │
│  País: [China ▼]  Categoría: [▼]    │
│                                     │
│  ── Importadores Disponibles ──      │
│                                     │
│  ┌───────────────────────────┐      │
│  │  Importadora ABC          │      │
│  │  Textiles, Ropa           │      │
│  │  Calificacion: 4.8        │      │
│  │  Respuesta: ~24h          │      │
│  │  [Seleccionar]            │      │
│  └───────────────────────────┘      │
│                                     │
│  ┌───────────────────────────┐      │
│  │  Importadora XYZ          │      │
│  │  Electrónica, Tecnología  │      │
│  │  Calificacion: 4.5        │      │
│  │  Respuesta: ~48h          │      │
│  │  [Seleccionar]            │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   [Continuar con importador         │
│    seleccionado]                    │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Barra de búsqueda:** Filtro por nombre o especialidad del importador
- **Filtros desplegables:** País de origen y categoría de producto
- **Tarjeta de importador:** Logo, nombre, especialidad, calificación (estrellas), tiempo de respuesta, botón "Seleccionar"

### Datos de la tarjeta de importador

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| Nombre empresa | string | "Importadora ABC" |
| Especialidad | array | ["Textiles", "Ropa"] |
| Calificación | float (1-5) | 4.8 |
| Tiempo respuesta | string | "~24h" |

### Comportamiento

- Al seleccionar un importador → Redirige a Pantalla 5 (Formulario de cotización con modalidad="dirigida" e importador_id preseleccionado)

---

## Pantalla 5 · Formulario de Cotización

> Mismos campos que el pantallazo original, reutilizado para ambas modalidades.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   Nueva Cotización                  │
│   Modalidad: [Dirigida | Abierta]   │
│   Importador: Importadora ABC       │
│                                     │
│  ── Foto del Producto ──            │
│  ┌───────────────────────────┐      │
│  │  Cargar imagen del producto│      │
│  │                           │      │
│  └───────────────────────────┘      │
│                                     │
│  ── Información del Producto ──      │
│                                     │
│  País de importación: [China ▼]     │
│  Nivel de personalización:          │
│    ○ Estándar                       │
│    ○ Personalización de marca       │
│    ○ Personalización de diseño comp.│
│                                     │
│  Nombre del producto:               │
│  [______________________________]   │
│                                     │
│  Descripción del cliente:           │
│  ┌───────────────────────────┐      │
│  │ Tamaño, material, colores, │      │
│  │ usos, variantes...         │      │
│  └───────────────────────────┘      │
│                                     │
│  Link / Enlace de referencia:       │
│  [https://www.alibaba.com/...]      │
│                                     │
│  Línea de producto: [Textiles ▼]    │
│  Tipo de calidad:                   │
│    ○ Económica                      │
│    ○ Estándar                       │
│    ○ Premium                        │
│                                     │
│  ── Sección Importación ──          │
│                                     │
│  Modalidad: [Ecommerce | Corporativo]│
│  Cantidad mínima: [___]             │
│  Precio objetivo (USD): [$___]      │
│  Incoterm: [FOB ▼]                  │
│  Notas adicionales:                 │
│  ┌───────────────────────────┐      │
│  │ Notas opcionales...        │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   [Enviar Cotización]               │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Zona de carga de imagen:** Drag & drop con preview de la imagen
- **Selector de país:** Dropdown con lista de países
- **Radio buttons:** Nivel de personalización, tipo de calidad
- **Text inputs:** Nombre del producto, descripción, enlace de referencia, notas adicionales
- **Selector de línea de producto:** Dropdown con categorías predefinidas
- **Toggle:** Modalidad Ecommerce / Corporativo
- **Number inputs:** Cantidad mínima, precio objetivo

### Validaciones

| Campo | Regla | Mensaje de error |
|-------|-------|-----------------|
| País de importación | Requerido | "Selecciona el país de origen" |
| Nombre del producto | Requerido, máx. 255 caracteres | "Ingresa un nombre para el producto" |
| Descripción del cliente | Requerida, mín. 10 caracteres | "Describe tu producto con más detalle" |
| Línea de producto | Requerida | "Selecciona la línea de producto" |
| Tipo de calidad | Requerido | "Selecciona el tipo de calidad" |
| Cantidad mínima | Requerido, mínimo 1 | "Ingresa una cantidad válida" |
| Precio objetivo | Opcional, debe ser positivo si se ingresa | "El precio debe ser un número positivo" |

### Comportamiento

- Al enviar → Si modalidad="dirigida", la solicitud llega solo al importador seleccionado. Si modalidad="abierta", la plataforma distribuye a todos los importadores matching.
- Redirige al Dashboard del solicitante con notificación de envío exitoso.

---

## Pantalla 6 · Panel de Propuestas Recibidas

> Exclusivo de la modalidad abierta; aquí el solicitante elige con qué importador de la red conectarse.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   Propuestas Recibidas              │
│   Textiles - China                  │
│   [3 de 5 importadores respondieron] │
│                                     │
│  ── Propuestas Activas ──           │
│                                     │
│  ┌───────────────────────────┐      │
│  │  Importadora ABC          │      │
│  │  Precio: $150.00 USD      │      │
│  │  Tiempo estimado: 30 días │      │
│  │  Incoterm: FOB            │      │
│  │  Condiciones: Garantía    │      │
│  │  [Conectar con este       │      │
│  │   importador]             │      │
│  └───────────────────────────┘      │
│                                     │
│  ┌───────────────────────────┐      │
│  │  Importadora XYZ          │      │
│  │  Precio: $135.00 USD      │      │
│  │  Tiempo estimado: 45 días │      │
│  │  Incoterm: CIF            │      │
│  │  Condiciones: Sin garantía│      │
│  │  [Conectar con este       │      │
│  │   importador]             │      │
│  └───────────────────────────┘      │
│                                     │
│  ── Pendientes de Responder ──      │
│                                     │
│  ┌───────────────────────────┐      │
│  │  Importadora DEF          │      │
│  │  Esperando respuesta      │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   [Conectar con importador          │
│    seleccionado]                    │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Contador de propuestas:** "X de Y importadores respondieron"
- **Tarjeta de propuesta activa:** Logo, nombre del importador, precio ofrecido, tiempo estimado, incoterm, condiciones, botón "Conectar con este importador"
- **Tarjeta de propuesta pendiente:** Logo, nombre del importador, indicador de espera

### Comportamiento

- Al hacer clic en "Conectar con este importador" → Redirige a Pantalla 7 (Checkout de pago Wompi)
- Las propuestas pendientes se actualizan en tiempo real vía WebSocket cuando el importador responde.

---

## Pantalla 7 · Checkout de Pago (Wompi)

> Integración directa con la pasarela de pagos Wompi para procesar el cobro del servicio de intermediación.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   Confirmar Pago                    │
│                                     │
│  ── Resumen del Pedido ──           │
│                                     │
│  Importador: Importadora ABC        │
│  Producto: Textiles - China         │
│  Precio acordado: $150.00 USD       │
│  Servicio de intermediación: $15.00 │
│                                     │
│  ── Método de Pago ──               │
│                                     │
│  [Tarjeta de crédito/débito]        │
│  [PSE - Transferencia bancaria]     │
│  [Efectivo - Puntos de pago]        │
│                                     │
│  ┌───────────────────────────┐      │
│  │  Procesado por Wompi       │      │
│  │  Pago seguro               │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   [Pagar $15.00 USD]                │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Resumen del pedido:** Importador, producto, precio acordado, costo de servicio
- **Selector de método de pago:** Tarjeta, PSE, efectivo (según opciones disponibles en Wompi)
- **Botón de pago:** Redirige al checkout de Wompi para completar el pago

### Comportamiento

- Al hacer clic en "Pagar" → Se redirige a la URL de checkout de Wompi
- Tras completar el pago, Wompi envía un webhook a nuestra API que actualiza el estado de la cotización a "orden_activa"
- Redirige al detalle de la orden (Pantalla 8)

---

## Pantalla 8 · Detalle de Orden

> Línea de estados desde el pago hasta la entrega, con acceso directo al chat y a reportar problemas.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   Orden #ORD-001                    │
│   Electrónica - China               │
│                                     │
│  ── Estado Actual: En Tránsito ──    │
│                                     │
│  Cotización aceptada     [completado]│
│  En producción             [completado]│
│  En tránsito internacional  [actual] │
│  En aduana / nacionalizacion   [pendiente]│
│  En bodega local               [pendiente]│
│  Entregado                     [pendiente]│
│                                     │
│  ── Información de la Orden ──       │
│                                     │
│  Importador: Importadora ABC        │
│  Asesor: Maria Lopez                │
│  Precio acordado: $150.00 USD       │
│  Tiempo estimado: 30 días           │
│                                     │
│  ── Historial de Estados ──         │
│                                     │
│  [completado] Cotización aceptada - 05/07│
│  [completado] En producción - 08/07   │
│  [actual] En tránsito internacional - 12/07│
│                                     │
│  ── Documentos Adjuntos ──          │
│                                     │
│  Factura Proforma                   │
│  Packing List                       │
│                                     │
├─────────────────────────────────────┤
│   [Chat con Asesor]  [Reportar      │
│                       Problema]     │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Linea de estados visual:** Timeline horizontal con indicadores ([completado], [actual], [pendiente])
- **Información general:** Importador, asesor, precio, tiempo estimado
- **Historial de estados:** Lista cronológica con fecha y hora de cada cambio de estado
- **Sección de documentos:** Lista de archivos adjuntos con enlaces de descarga
- **Botones de acción:** Chat con asesor, Reportar problema

### Estados de la orden (iconos)

| Estado | Icono | Color |
|--------|-------|-------|
| Cotización aceptada | [completado] | Verde |
| En producción | [completado] | Verde |
| En tránsito internacional | [actual] | Azul |
| En aduana / nacionalizacion | [pendiente] | Gris |
| En bodega local | [pendiente] | Gris |
| Entregado | [completado] | Verde |

---

## Pantalla 9 · Chat con Asesor

> Conversaciones organizadas por orden/cotización, no solo por contacto.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│  ── Conversaciones ──               │
│                                     │
│  ┌───────────────────────────┐      │
│  │  Electrónica - China        │      │
│  │ Importadora ABC           │      │
│  │ Última: Maria Lopez:      │      │
│  │   "Tu pedido está en      │      │
│  │    tránsito"              │      │
│  │ Hace 2 horas        [3]   │      │
│  └───────────────────────────┘      │
│                                     │
│  ┌───────────────────────────┐      │
│  │ Textiles - China          │      │
│  │ Importadora XYZ           │      │
│  │ Última: Tú:               │      │
│  │   "Gracias por la info"   │      │
│  │ Hace 1 día            [0] │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   [Nueva Cotización]                │
└─────────────────────────────────────┘
```

### Vista de conversación individual

```
┌─────────────────────────────────────┐
│  ← Volver    Electrónica - China    │
├─────────────────────────────────────┤
│                                     │
│  ── Chat con Maria Lopez            │
│     Importadora ABC · En línea      │
│                                     │
│  [05/07]                            │
│                                     │
│  Maria: Hola, tu pedido está en     │
│         tránsito internacional      │
│  ──────────────────────────────     │
│                                     │
│  Tú: Perfecto, ¿cuándo llega?       │
│  ──────────────────────────────     │
│                                     │
│  Maria: Estimado para el viernes    │
│         ─────────────────────────── │
│                                     │
│  [Adjuntar]  [Escribe un mensaje]   │
├─────────────────────────────────────┤
│   [Enviar]                          │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Panel lateral izquierdo:** Lista de conversaciones (por orden/cotización) con último mensaje y hora
- **Área principal de chat:** Mensajes en tiempo real, burbujas de mensajes (izquierda = importador, derecha = solicitante)
- **Indicador "en línea":** Indicador de estado junto al nombre del importador cuando está conectado
- **Campo de texto:** Input para escribir mensajes con botón de adjuntar archivos
- **Botón enviar:** Envía el mensaje vía WebSocket

---

## Pantalla 12 · Repositorio de Documentos (P1)

> Acceso a todos los documentos asociados a una orden.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   Documentos - Orden #ORD-001       │
│                                     │
│  ── Facturas ──                     │
│  Factura Proforma                   │
│     Importadora ABC · 05/07         │
│     [Descargar]                     │
│                                     │
│  Comprobante de Pago                │
│     Wompi · 05/07                   │
│     [Descargar]                     │
│                                     │
│  ── Documentos del Proveedor ──      │
│  Packing List                       │
│     Importadora ABC · 12/07         │
│     [Descargar]                     │
│                                     │
├─────────────────────────────────────┤
└─────────────────────────────────────┘
```

---

## Pantalla 15 · Historial y Filtros Avanzados (P1)

> Vista completa de todas las cotizaciones con filtros avanzados.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   Mis Cotizaciones                  │
│                                     │
│  Filtros:                           │
│  Estado: [Todas ▼]  Modalidad:      │
│  [Todas ▼]  País: [Todos ▼]        │
│  Línea de producto: [Todas ▼]       │
│                                     │
│  ── Todas las Cotizaciones (12) ──   │
│                                     │
│  Textiles - China                   │
│     Dirigida · Propuestas rec.      │
│     Hace 2 horas                    │
│                                     │
│  Electrónica - China                │
│     Abierta · Orden activa          │
│     Hace 3 días                     │
│                                     │
│  ...                                │
│                                     │
├─────────────────────────────────────┤
│   [1] [2] [3]                       │
└─────────────────────────────────────┘
```

---

## Criterios de diseno transversales para el solicitante

- **Consistencia con el formulario de referencia:** Los nombres y el orden de los campos de cotización deben sentirse familiares para un solicitante que ya usó el sistema original.
- **Estado siempre visible:** En cualquier pantalla de orden o cotización, el usuario debe poder ver en qué punto del proceso está sin tener que preguntarle al asesor por chat.
- **Distinción visual clara entre "dirigida" y "abierta":** Usar una etiqueta de color, no solo texto.
- **Mobile-first para el formulario de cotización y el chat:** Es razonable esperar que muchos solicitantes completen la solicitud o respondan al asesor desde el celular.
- **El botón de acción principal** de cada pantalla siempre debe estar en una posición fija y predecible.