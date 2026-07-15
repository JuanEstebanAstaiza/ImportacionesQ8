# Pantallas del Importador — ImportacionesQ8

## Descripción general

Documentación de las pantallas P0 y P1 para el importador (empresa importadora vinculada a la plataforma). Construidas con **React/Next.js** con TypeScript.

---

## Inventario de pantallas del importador

| # | Pantalla | Módulo | Prioridad |
|---|----------|--------|-----------|
| 10 | Bandeja de solicitudes del importador | Panel importador | P0 |
| 11 | Formulario de respuesta a cotización (importador) | Panel importador | P0 |
| 13 | Perfil y configuración de empresa importadora | Panel importador | P1 |

---

## Pantalla 10 · Bandeja de Solicitudes del Importador

> Bandeja única donde conviven solicitudes dirigidas y abiertas, distinguidas por etiqueta.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  [Logo]          [Notificaciones]   │
├─────────────────────────────────────┤
│  Solicitudes | Órdenes Activas      │
├─────────────────────────────────────┤
│                                     │
│  Filtros:                           │
│  Modalidad: [Todas ▼]  Estado:      │
│  [Todas ▼]                          │
│                                     │
│  ── Solicitudes Recibidas (8) ──     │
│                                     │
│  ┌───────────────────────────┐      │
│  │ Textiles - China          │      │
│  │ Dirigida                  │      │
│  │ Importadora ABC           │      │
│  │ Cantidad: 500 unidades    │      │
│  │ Precio objetivo: $120 USD │      │
│  │ Hace 2 horas          [3] │      │
│  └───────────────────────────┘      │
│                                     │
│  ┌───────────────────────────┐      │
│  │ Electrónica - China       │      │
│  │ Abierta                   │      │
│  │ Importadora XYZ           │      │
│  │ Cantidad: 200 unidades    │      │
│  │ Precio objetivo: $85 USD  │      │
│  │ Hace 1 día            [0] │      │
│  └───────────────────────────┘      │
│                                     │
│  ── Órdenes Activas (3) ──          │
│                                     │
│  ┌───────────────────────────┐      │
│  │ Textiles - China          │      │
│  │ Estado: En tránsito       │      │
│  │ Solicitante: Empresa A    │      │
│  │ [Ver detalle]             │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   Mi Perfil          Cerrar Sesión  │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Tabs de navegación:** Solicitudes | Órdenes Activas (cambio de vista)
- **Filtros desplegables:** Modalidad (Dirigida/Abierta/Todas), Estado (Pendiente/Respondido/Todos)
- **Tarjeta de solicitud recibida:** Foto del producto, nombre, etiqueta de modalidad (Dirigida/Abierta), cantidad, precio objetivo, tiempo desde recepción, indicador de estado
- **Lista de órdenes activas:** Tarjetas con nombre del producto, estado actual y botón "Ver detalle"

### Etiquetas de modalidad (colores)

| Modalidad | Color | Descripción |
|-----------|-------|-------------|
| Dirigida | Verde | Solicitud exclusiva para este importador |
| Abierta | Amarillo | Solicitud compartida con la red de importadores |

### Datos de la tarjeta de solicitud

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| Nombre producto | string | "Textiles - China" |
| Modalidad | enum | "dirigida" o "abierta" |
| Cantidad | int | 500 |
| Precio objetivo | float | $120.00 USD |
| Tiempo recepción | string | "Hace 2 horas" |

### Comportamiento

- Al hacer clic en una solicitud → Redirige a Pantalla 11 (Formulario de respuesta a cotización)
- Las solicitudes dirigidas tienen prioridad visual sobre las abiertas
- El **dueño** (representante legal) y los **asesores** pueden reclamar del pool; el dueño es jefe de operadores
- Tras la doble aceptación, la cotización queda en `orden_activa` y el chat pasa al dueño
- Las órdenes activas se actualizan en tiempo real vía WebSocket cuando cambia el estado

---

## Pantalla 11 · Formulario de Respuesta a Cotización (Importador)

> El importador responde con su propuesta de precio, tiempo estimado y condiciones.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   Responder Cotización              │
│   Textiles - China                  │
│   Solicitante: Empresa A            │
│   Modalidad: Dirigida               │
│                                     │
│  ── Datos de la Solicitud ──        │
│                                     │
│  País de importación: China         │
│  Nivel de personalización:          │
│    Personalización de marca         │
│  Línea de producto: Textiles        │
│  Tipo de calidad: Estándar          │
│  Cantidad mínima: 500 unidades      │
│  Precio objetivo: $120.00 USD       │
│  Incoterm: FOB                      │
│                                     │
│  Descripción del cliente:           │
│  "Necesitamos 500 camisetas con     │
│   logo personalizado, algodón      │
│   100%, colores azul y negro"       │
│                                     │
│  Link de referencia:                │
│  https://www.alibaba.com/...        │
│                                     │
│  ── Tu Propuesta ──                 │
│                                     │
│  Precio ofrecido (USD):             │
│  [$135.00]                          │
│                                     │
│  Tiempo estimado de entrega:        │
│  [45 días]                          │
│                                     │
│  Incoterm propuesto:                │
│  [FOB ▼]                            │
│                                     │
│  Condiciones adicionales:           │
│  ┌───────────────────────────┐      │
│  │ Garantía de calidad, pago  │      │
│  │ 50% anticipo, 50% contra   │      │
│  │ entrega                    │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   [Enviar Propuesta]                │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Sección de datos de la solicitud:** Solo lectura, muestra toda la información del formulario del solicitante
- **Campo de precio ofrecido:** Number input con prefijo USD
- **Campo de tiempo estimado:** Text input (ej: "45 días")
- **Selector de incoterm:** Dropdown con opciones FOB, CIF, EXW, DDP
- **Área de texto para condiciones adicionales:** Textarea con placeholder

### Validaciones

| Campo | Regla | Mensaje de error |
|-------|-------|-----------------|
| Precio ofrecido | Requerido, debe ser positivo | "Ingresa un precio válido" |
| Tiempo estimado | Requerido, mínimo 7 días | "El tiempo mínimo es de 7 días" |
| Incoterm | Requerido | "Selecciona el incoterm" |

### Comportamiento

- Al enviar → La propuesta se guarda en la base de datos y se notifica al solicitante vía WebSocket
- Redirige a la bandeja de solicitudes con notificación de envío exitoso

---

## Pantalla 13 · Perfil y Configuración de Empresa Importadora (P1)

> Gestión del perfil de la empresa importadora: países, categorías, capacidad, asesores.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   Perfil de Empresa                 │
│                                     │
│  ── Información General ──          │
│                                     │
│  Nombre de la empresa:              │
│  [Importadora ABC]                  │
│                                     │
│  Logo:                              │
│  ┌───────────────────────────┐      │
│  │  Subir logo               │      │
│  └───────────────────────────┘      │
│                                     │
│  Paises de origen:                  │
│  [China] [+] [Vietnam] [+]         │
│                                     │
│  Categorías de producto:            │
│  [Textiles] [+] [Ropa] [+]         │
│                                     │
│  Capacidad de volumen (unidades):   │
│  [5000]                             │
│                                     │
│  Tiempo de respuesta promedio:      │
│  [24h ▼]                            │
│                                     │
│  ── Asesores ──                     │
│                                     │
│  ┌───────────────────────────┐      │
│  │ Maria Lopez               │      │
│  │ maria@importadoraabc.com  │      │
│  │ +57 300 123 4567          │      │
│  │ [Editar] [Eliminar]       │      │
│  └───────────────────────────┘      │
│                                     │
│  [+ Agregar Asesor]                 │
│                                     │
├─────────────────────────────────────┤
│   [Guardar Cambios]                 │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Formulario de perfil:** Campos editables para nombre, logo, países, categorías, capacidad
- **Tags de países y categorías:** Sistema de tags con botón "+" para agregar nuevos
- **Lista de asesores:** Tarjetas con foto, nombre, email, WhatsApp del asesor
- **Botón "Agregar Asesor":** Modal o formulario inline para agregar nuevo asesor

---

## Criterios de diseno transversales para el importador

- **Distinción visual clara entre "dirigida" y "abierta":** Usar etiquetas de color diferentes en la bandeja de solicitudes.
- **Estado siempre visible:** En cualquier pantalla, el importador debe poder ver rápidamente cuántas solicitudes tiene pendientes vs respondidas.
- **Botón de acción principal fijo:** El botón "Responder cotización" siempre debe estar en una posición predecible.
- **Mobile-first para la bandeja de solicitudes:** Es razonable esperar que muchos importadores revisen solicitudes desde el celular.