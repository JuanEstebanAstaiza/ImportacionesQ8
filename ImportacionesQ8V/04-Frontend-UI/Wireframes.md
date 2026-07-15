# Wireframes — ImportacionesQ8

## Descripción general

Consolidación de todos los wireframes del proyecto en un solo documento. Los bocetos (wireframes) no son diseño final, sino la referencia de estructura y contenido que el equipo de desarrollo debe respetar para no perder tiempo definiendo layout sobre la marcha.

---

## Mapa de navegación general

La plataforma tiene dos experiencias separadas que comparten el mismo motor: la del solicitante (quien pide la cotización) y la del importador (quien la responde). Ambas se autentican en la misma pantalla de acceso, pero llegan a paneles distintos según su rol.

| Rol | Punto de entrada | Navegación principal |
|-----|------------------|---------------------|
| **Solicitante** | Login → Dashboard | Cotizaciones · Órdenes · Facturación/Pagos · Chat |
| **Importador** | Login → Bandeja de solicitudes | Solicitudes recibidas · Órdenes en gestión · Chat · Perfil de empresa |
| **Equipo de la plataforma (admin)** | Login interno → Panel de administración | Cotizaciones abiertas activas · Disputas · Importadores vinculados |

---

## Inventario de pantallas — Prioridad para el MVP

**P0 = indispensable** para que el MVP funcione. **P1 = deseable** pero puede quedar simplificado o para la fase inmediatamente posterior sin bloquear el lanzamiento.

| # | Pantalla | Módulo | Prioridad |
|---|----------|--------|-----------|
| 1 | Login / Registro (solicitante e importador) | Acceso | P0 |
| 2 | Dashboard del solicitante | Cotizaciones | P0 |
| 3 | Selección de modalidad (dirigida / abierta) | Cotizaciones | P0 |
| 4 | Catálogo de importadores — tarjetas con logo, especialidad y calificación (modalidad dirigida) | Cotizaciones | P0 |
| 5 | Formulario de cotización | Cotizaciones | P0 |
| 6 | Panel de propuestas recibidas (red de importadores) | Cotizaciones | P0 |
| 7 | Checkout de pago (Wompi) | Pagos | P0 |
| 8 | Detalle de orden con línea de estados | Órdenes | P0 |
| 9 | Chat con asesor (ligado a orden/cotización) | Chat | P0 |
| 10 | Bandeja de solicitudes del importador | Panel importador | P0 |
| 11 | Formulario de respuesta a cotización (importador) | Panel importador | P0 |
| 12 | Repositorio de documentos por orden | Órdenes/Pagos | P1 |
| 13 | Perfil y configuración de empresa importadora | Panel importador | P1 |
| 14 | Panel de administración interno (disputas) | Admin | P1 |
| 15 | Historial y filtros avanzados de "Mis cotizaciones" | Cotizaciones | P1 |

> Las pantallas marcadas P1 deben construirse con la versión más simple posible (ej. una tabla plana sin filtros) si el tiempo se ajusta; lo que no puede sacrificarse son las 11 pantallas P0, porque sin ellas no existe el flujo completo de cotización → pago → orden → seguimiento.

---

## Wireframes por pantalla clave

### Pantalla 1 · Login / Registro — Un solo punto de entrada, el rol define el panel al que se llega

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

---

### Pantalla 2 · Dashboard del Solicitante — Misma estructura de tabs del sistema de referencia (Cotizaciones / Órdenes / Facturación), con el asesor visible cuando aplica

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

---

### Pantalla 3 · Selección de Modalidad — El paso que no existe en el sistema de referencia y que materializa el diferenciador del negocio

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

---

### Pantalla 4 · Catálogo de Importadores — Tarjetas con logo, nombre, especialidad, calificación y tiempo de respuesta de cada empresa, para elegir con criterio en la modalidad dirigida

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   Elige una importadora             │
│                                     │
│  Buscar por nombre o especialidad   │
│                                     │
│  Filtros: País: [China ▼] Categoría:[▼]│
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

---

### Pantalla 5 · Formulario de Cotización — Mismos campos que el pantallazo original, reutilizado para ambas modalidades

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

---

### Pantalla 6 · Panel de Propuestas Recibidas — Exclusivo de la modalidad abierta; aquí el solicitante elige con qué importador de la red conectarse

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

---

### Pantalla 7 · Checkout de Pago (Wompi) — Integración directa con la pasarela de pagos Wompi

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

---

### Pantalla 8 · Detalle de Orden — Línea de estados desde el pago hasta la entrega, con acceso directo al chat y a reportar problemas

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

---

### Pantalla 9 · Chat con Asesor — Conversaciones organizadas por orden/cotización, no solo por contacto

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

---

### Pantalla 10 · Panel del Importador — Bandeja única donde conviven solicitudes dirigidas y abiertas, distinguidas por etiqueta

```
┌─────────────────────────────────────┐
│  [Logo]          [Notificaciones]   │
├─────────────────────────────────────┤
│  Solicitudes | Órdenes Activas      │
├─────────────────────────────────────┤
│                                     │
│  Filtros: Modalidad: [Todas ▼]      │
│           Estado: [Todas ▼]         │
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

---

## Criterios de diseño transversales

- **Consistencia con el formulario de referencia:** Los nombres y el orden de los campos de cotización deben sentirse familiares para un solicitante que ya usó el sistema original, para no generar fricción de adopción.
- **Estado siempre visible:** En cualquier pantalla de orden o cotización, el usuario debe poder ver en qué punto del proceso está sin tener que preguntarle al asesor por chat.
- **Distinción visual clara entre "dirigida" y "abierta"** en todas las vistas donde ambas coexistan (bandeja del importador, historial del solicitante), usando una etiqueta de color, no solo texto.
- **Mobile-first para el formulario de cotización y el chat:** Es razonable esperar que muchos solicitantes completen la solicitud o respondan al asesor desde el celular.
- **El botón de acción principal** de cada pantalla (solicitar cotización, aceptar oferta, responder, pagar) siempre debe estar en una posición fija y predecible, para reducir curva de aprendizaje entre pantallas.

---

## Estados visuales — Guía de colores

### Estados de cotizaciones

| Estado | Color | Icono |
|--------|-------|-------|
| Cotización creada | Azul | Circulo azul |
| Dirigida | Verde | Check verde |
| Abierta / Propuestas recibidas | Amarillo | Reloj amarillo |
| Cotización aceptada | Morado | Check morado |
| Orden activa | Naranja | Flecha naranja |

### Estados de órdenes

| Estado | Icono | Color |
|--------|-------|-------|
| Cotización aceptada | [completado] | Verde |
| En producción | [completado] | Verde |
| En tránsito internacional | [actual] | Azul |
| En aduana / nacionalizacion | [pendiente] | Gris |
| En bodega local | [pendiente] | Gris |
| Entregado | [completado] | Verde |

### Etiquetas de modalidad

| Modalidad | Color | Icono |
|-----------|-------|-------|
| Dirigida | Verde | Etiqueta |
| Abierta | Amarillo | Red global |