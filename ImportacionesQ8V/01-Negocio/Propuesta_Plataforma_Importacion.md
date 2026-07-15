# PROPUESTA DE DESARROLLO DE PLATAFORMA
## Conexión y Cotización de Importación de Productos

**Plataforma de networking entre importadores y clientes finales — MVP a 3 semanas**  
Documento preparado para uso interno y presentación a aliados estratégicos

---

## 1. Resumen ejecutivo

Se propone el desarrollo de una plataforma web de **networking** que conecta a clientes finales —empresas, comerciantes y también personas naturales que quieren emprender pero necesitan importar productos— ("solicitantes") con empresas importadoras que gestionan todo el proceso de cotización, compra y logística internacional, principalmente desde China.

El sistema tomará como referencia funcional el **formulario de solicitud de cotización** ya validado por una empresa del sector (evidenciado en el pantallazo de referencia), replicando su estructura de campos para no reinventar un flujo que el mercado ya reconoce y con el que los solicitantes ya están familiarizados.

El elemento diferenciador de la propuesta **no está en el formulario en sí**, sino en el **flujo de conexión** de la solicitud y en el **modelo de relación** con las empresas importadoras:

- **Cotización dirigida:** el solicitante elige una empresa importadora específica (ya vinculada a la plataforma) para enviarle su solicitud, replicando el modelo 1 a 1 actual.
- **Cotización abierta (red de importadores):** el solicitante llena el formulario una sola vez y la plataforma la difunde simultáneamente a todas las empresas importadoras vinculadas, quienes responden con su propuesta (precio, tiempo, condiciones) para que el solicitante se conecte con la que mejor se ajuste a lo que necesita.

Esta doble modalidad convierte a la plataforma en una **capa de networking y descubrimiento** que no reemplaza a las empresas importadoras existentes, sino que les da acceso a más demanda calificada. Ese es el argumento central para posicionarnos como aliados —canal adicional de clientes— y no como competencia directa frente a la empresa de referencia.

---

## 2. Contexto y oportunidad

La empresa de referencia (Asiati, según la interfaz analizada) ya opera un sistema propio de gestión de cotizaciones, órdenes y facturación para sus clientes, con un modelo de asesor asignado por cliente. Este sistema valida que el mercado necesita una herramienta digital para estructurar solicitudes de importación, pero lo hace de forma **cerrada**: un solicitante solo puede cotizar con esa empresa.

La oportunidad identificada es construir la **capa que falta en el mercado**: un punto de entrada neutral donde el solicitante decide si quiere trabajar con un importador específico o si prefiere abrir su solicitud a varios importadores de la red para conectarse con el que mejor se ajuste a lo que necesita. Para las empresas importadoras vinculadas (incluyendo potencialmente la propia empresa de referencia), esto representa un **canal adicional de generación de demanda** sin que tengan que invertir en su propio desarrollo de captación.

### ¿Por qué esto favorece una alianza y no una guerra de producto?

- No competimos por el mismo cliente final de forma exclusiva: la empresa de referencia puede seguir recibiendo cotizaciones dirigidas desde nuestra plataforma como uno más de sus canales de entrada.
- Les damos visibilidad ante solicitantes que hoy no los conocen, sin que tengan que hacer marketing propio.
- Podemos ofrecerles integrarse como "importador insignia" o partner fundador, con condiciones preferenciales (menor comisión, mejor posicionamiento dentro de la red) a cambio de ser el primer aliado estratégico.

> El mensaje de acercamiento debería presentarse como: **"construimos el canal de captación de demanda que ustedes no tienen que construir"**, no como "copiamos su formulario".

---

## 3. Propuesta de valor y diferenciadores

| Dimensión | Sistema de referencia (cerrado) | Nuestra plataforma (propuesta) |
|-----------|--------------------------------|-------------------------------|
| **Alcance de la cotización** | Un solo importador (el dueño del sistema) | El solicitante elige: un importador específico o difusión a toda la red |
| **Modelo de conexión con importadores** | No existe | El solicitante recibe propuestas de varios importadores de la red y elige con cuál conectarse en cotizaciones abiertas |
| **Relación con importadores externos** | Cerrado a un solo operador | Red abierta de importadores vinculados (multi-tenant) |
| **Seguimiento del pedido** | Chat 1 a 1 con asesor asignado | Chat 1 a 1 con asesor por cada importador con el que se interactúa, más soporte de plataforma |
| **Rol de la plataforma** | Operador único | Intermediario neutral + herramienta de gestión para ambas partes |

> Este cuadro es también el insumo central para la conversación de alianza: se puede mostrar a la empresa de referencia que no estamos duplicando su producto, sino construyendo la capa de distribución de demanda que ellos no tienen.

---

## 4. Módulos funcionales

### 4.1 Cotizaciones

Módulo central de la plataforma. Replica el formulario de referencia como base de captura de información, agregando la **selección de modalidad de envío** al inicio del flujo.

#### Paso 0 — Selección de modalidad (nuevo, no existe en el sistema de referencia)

- **Cotización dirigida:** el solicitante busca y selecciona una empresa importadora específica desde un catálogo de tarjetas (logo, nombre, especialidad de producto, calificación y tiempo de respuesta promedio).
- **Cotización abierta / red de importadores:** el solicitante marca la solicitud como "abierta" y esta se distribuye automáticamente a todas las empresas importadoras activas que cumplan criterios de categoría de producto y país de importación.

#### Campos del formulario (equivalentes al pantallazo de referencia)

- Foto del producto (carga de imagen, opcional pero recomendada)
- País de importación (selector)
- Nivel de personalización (selector: estándar, personalización de marca, personalización de diseño completo)
- Nombre del producto (texto corto)
- Descripción del cliente (texto largo: tamaño, material, colores, usos, variantes)
- Link / enlace de referencia (URL, ej. Alibaba, 1688)
- Línea de producto (selector/categoría)
- Tipo de calidad (selector: económica, estándar, premium)
- **Sección Importación:** modalidad Ecommerce / Corporativo (toggle), cantidad mínima, precio objetivo (USD), incoterm, notas adicionales

#### Comportamiento diferenciado según modalidad

- **Si es dirigida:** el formulario llega solo al importador seleccionado, con su asesor asignado visible desde el inicio (igual que en el pantallazo de referencia).
- **Si es abierta:** el solicitante ve un panel de "propuestas recibidas" donde cada importador que responde aparece con su oferta de precio, tiempo estimado y condiciones, permitiendo comparar antes de decidir con cuál conectarse.
- Al conectarse con un importador en modalidad abierta, esa cotización se convierte en una orden y la solicitud deja de estar visible para las demás empresas de la red.

---

### 4.2 Mis Órdenes

Módulo de seguimiento del ciclo de vida del pedido una vez aceptada una cotización, ya sea dirigida o proveniente de la red de importadores.

#### Estados sugeridos de una orden

| Estado | Descripción |
|--------|-------------|
| **Cotización aceptada** | El solicitante aceptó una oferta; la orden se crea automáticamente |
| **En producción** | El importador confirma que el proveedor en origen está fabricando/preparando el pedido |
| **En tránsito internacional** | Salida de fábrica/puerto de origen, con referencia de tracking si aplica |
| **En aduana / nacionalización** | Proceso de importación en el país destino |
| **En bodega local** | Producto recibido en bodega del importador (ej. "bodegas Wiilog" del ejemplo) |
| **Entregado** | Cierre de la orden |

- Vista de detalle de orden: cotización origen, importador asignado, asesor de contacto, documentos adjuntos (factura proforma, packing list si aplica), historial de estados con fecha.
- Notificaciones automáticas al solicitante en cada cambio de estado.
- Botón de acceso directo al chat con el asesor desde la orden, para reportar problemas sin salir del contexto del pedido.

---

### 4.3 Pagos y facturación

El cobro de la plataforma se hace directamente sobre la cotización: cuando un solicitante decide avanzar (ya sea aceptando una oferta en modalidad dirigida, o eligiendo con cuál importador conectarse en modalidad abierta), se genera un cobro a través de una pasarela de pago externa. Se propone integrar **Wompi**, dado que su integración es rápida y no representa un cuello de botella dentro del plazo de 3 semanas.

- Al aceptar una cotización, la plataforma genera un enlace o checkout de pago con Wompi por el valor correspondiente al servicio de intermediación/cotización.
- Una vez confirmado el pago (webhook de Wompi), la cotización pasa automáticamente a estado de orden.
- Repositorio de documentos por orden: factura proforma, factura comercial del proveedor, factura de servicios del importador, comprobante de pago generado por la pasarela.
- Estado de pago por orden: pendiente, pagado, en disputa/reembolso — reflejando directamente el estado que reporta Wompi, sin necesidad de construir lógica de cobro propia.
- No se contempla en el MVP la emisión de facturación electrónica con validez fiscal propia; el comprobante de pago de la pasarela y las facturas de los proveedores/importadores son el respaldo documental de cada orden. La facturación electrónica propia queda como posible desarrollo de fase 2 si el volumen del negocio lo justifica.

---

### 4.4 Chat con asesor 1 a 1

Componente de seguimiento personalizado, visible en el pantallazo de referencia como tarjeta de "Asesor asignado" (foto, nombre, empresa, WhatsApp).

- Cada cotización o solicitud abierta que sea aceptada por un importador asigna automáticamente un asesor de esa empresa importadora al solicitante.
- Chat en tiempo real dentro de la plataforma (no solo WhatsApp externo), para que la plataforma tenga visibilidad y trazabilidad de la conversación.
- En modalidad abierta, antes de decidir con cuál importador conectarse, el solicitante puede chatear con varios asesores en paralelo para resolver dudas.
- Rol de la plataforma como mediador: si un chat muestra señales de una queja o problema no resuelto (ej. tiempo de respuesta alto, mensajes marcados como "pedido con problema"), un panel interno permite a nuestro equipo intervenir o escalar con el importador, dado que la relación comercial pasa por nuestra plataforma.
- Historial de chat ligado a la orden, no solo al usuario, para que el contexto no se pierda si cambia el asesor.

---

## 5. Flujos de usuario clave

### 5.1 Flujo — Cotización dirigida

1. El solicitante entra a "Nueva cotización" y elige "Buscar empresa importadora".
2. Selecciona una empresa del directorio de importadores vinculados.
3. Completa el formulario estándar (igual al de referencia).
4. La solicitud llega únicamente a esa empresa; se asigna asesor y se abre el chat.
5. El importador responde con una cotización formal (precio, tiempo, condiciones).
6. El solicitante acepta o rechaza; si acepta, se genera el checkout de pago con Wompi.
7. Al confirmarse el pago, la cotización se convierte en orden.

### 5.2 Flujo — Cotización abierta (red de importadores)

1. El solicitante completa el mismo formulario y elige "Difundir a la red de importadores".
2. La plataforma envía la solicitud a todos los importadores activos que apliquen (por país, categoría de producto, capacidad).
3. Cada importador interesado responde con su propuesta dentro de una ventana de tiempo definida (ej. 48-72 horas).
4. El solicitante ve un panel con las propuestas recibidas y puede chatear con los asesores antes de decidir con cuál importador conectarse.
5. Al elegir un importador, se genera el checkout de pago con Wompi; al confirmarse el pago se crea la orden con ese importador y la solicitud deja de estar visible para el resto de la red.

### 5.3 Flujo — Empresa importadora vinculada

1. La empresa importadora se registra en la plataforma y define su perfil: países de origen que maneja, categorías de producto, capacidad de volumen.
2. Recibe notificaciones de cotizaciones dirigidas (exclusivas) y de cotizaciones abiertas que correspondan a su perfil.
3. Responde desde su panel con propuesta de precio, tiempo estimado, condiciones e incoterm.
4. Si el solicitante decide conectarse con ella, gestiona la orden desde su propio panel y mantiene el chat con el solicitante.

---

## 6. Vistas y pantallas requeridas (UX/UI) para el MVP

Esta sección define el rumbo fijo de diseño: qué pantallas son indispensables para que el MVP funcione de punta a punta en las 3 semanas, y cómo debe estar organizada cada una. Los **bocetos (wireframes)** que se muestran a continuación no son diseño final, sino la referencia de estructura y contenido que el equipo de desarrollo debe respetar para no perder tiempo definiendo layout sobre la marcha.

### 6.1 Mapa de navegación general

La plataforma tiene dos experiencias separadas que comparten el mismo motor: la del solicitante (quien pide la cotización) y la del importador (quien la responde). Ambas se autentican en la misma pantalla de acceso, pero llegan a paneles distintos según su rol.

| Rol | Punto de entrada | Navegación principal |
|-----|------------------|---------------------|
| **Solicitante** | Login → Dashboard | Cotizaciones · Órdenes · Facturación/Pagos · Chat |
| **Importador** | Login → Bandeja de solicitudes | Solicitudes recibidas · Órdenes en gestión · Chat · Perfil de empresa |
| **Equipo de la plataforma (admin)** | Login interno → Panel de administración | Cotizaciones abiertas activas · Disputas · Importadores vinculados |

### 6.2 Inventario de pantallas — prioridad para el MVP

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

### 6.3 Bocetos de referencia (wireframes) por pantalla clave

A continuación, la estructura sugerida para las pantallas P0 más críticas. El objetivo es alinear a todo el equipo (negocio y desarrollo) sobre qué información debe verse en cada una, no definir estilos visuales finales.

#### Pantalla 1 · Login / Registro
> Un solo punto de entrada, el rol define el panel al que se llega.

- Formulario de login con campos: email + contraseña
- Opción de registro diferenciado por rol (solicitante vs importador)
- Botón principal: "Iniciar sesión" o "Registrarse"
- Enlace a recuperación de contraseña

#### Pantalla 2 · Dashboard del solicitante
> Misma estructura de tabs del sistema de referencia (Cotizaciones / Órdenes / Facturación), con el asesor visible cuando aplica.

- Tabs superiores: Cotizaciones | Órdenes | Facturación/Pagos
- Botón "Nueva cotización"
- Lista de cotizaciones recientes con estado
- Lista de órdenes activas con línea de estados visual
- Tarjeta de asesor asignado (foto, nombre, empresa, contacto)

#### Pantalla 3 · Selección de modalidad
> El paso que no existe en el sistema de referencia y que materializa el diferenciador del negocio.

- Dos opciones grandes:
  - **Cotización dirigida** — "Buscar empresa importadora específica"
  - **Cotización abierta / red de importadores** — "Difundir a toda la red"
- Descripción breve de cada modalidad debajo de cada opción
- Botón principal: "Continuar"

#### Pantalla 4 · Catálogo de importadores
> Tarjetas con logo, nombre, especialidad, calificación y tiempo de respuesta de cada empresa, para elegir con criterio en la modalidad dirigida.

- Barra de búsqueda por nombre o especialidad
- Filtros por categoría de producto y país de origen
- Tarjetas de importador:
  - Logo de la empresa
  - Nombre
  - Especialidad de producto (ej. "Textiles", "Electrónica")
  - Calificación (estrellas)
  - Tiempo de respuesta promedio (ej. "24h")
- Botón en cada tarjeta: "Seleccionar"

#### Pantalla 5 · Formulario de cotización
> Mismos campos que el pantallazo original, reutilizado para ambas modalidades.

- **Foto del producto** — zona de carga de imagen (drag & drop)
- **País de importación** — selector desplegable
- **Nivel de personalización** — selector: estándar / personalización de marca / personalización de diseño completo
- **Nombre del producto** — campo de texto corto
- **Descripción del cliente** — campo de texto largo (tamaño, material, colores, usos, variantes)
- **Link / enlace de referencia** — URL (ej. Alibaba, 1688)
- **Línea de producto** — selector/categoría
- **Tipo de calidad** — selector: económica / estándar / premium
- **Sección Importación:**
  - Modalidad Ecommerce / Corporativo (toggle)
  - Cantidad mínima (número)
  - Precio objetivo en USD (número)
  - Incoterm (selector)
  - Notas adicionales (texto largo)
- Botón principal: "Enviar cotización"

#### Pantalla 6 · Panel de propuestas recibidas
> Exclusivo de la modalidad abierta; aquí el solicitante elige con qué importador de la red conectarse.

- Título: "Propuestas recibidas"
- Contador de propuestas pendientes (ej. "3 de 5 importadores respondieron")
- Tarjetas de propuesta por importador:
  - Logo y nombre del importador
  - Precio ofrecido
  - Tiempo estimado de entrega
  - Condiciones e incoterm
  - Etiqueta de modalidad (dirigida / abierta)
- Botón en cada tarjeta: "Conectar con este importador"
- Estado de espera cuando no hay propuestas aún

#### Pantalla 7 · Detalle de orden
> Línea de estados desde el pago hasta la entrega, con acceso directo al chat y a reportar problemas.

- Información general: cotización origen, importador asignado, asesor de contacto
- **Línea de estados visual** (timeline horizontal):
  - Cotización aceptada → En producción → En tránsito internacional → En aduana / nacionalización → En bodega local → Entregado
- Estado actual resaltado con color
- Historial de cambios de estado con fecha y hora
- Botones: "Chat con asesor" | "Reportar problema"
- Sección de documentos adjuntos (factura proforma, packing list)

#### Pantalla 8 · Chat con asesor
> Conversaciones organizadas por orden/cotización, no solo por contacto.

- Panel lateral izquierdo: lista de conversaciones (por orden/cotización)
- Área principal de chat: mensajes en tiempo real
- Indicador de estado del importador (en línea / desconectado)
- Botón para adjuntar archivos
- Acceso rápido a documentos de la orden desde el chat

#### Pantalla 9 · Panel del importador
> Bandeja única donde conviven solicitudes dirigidas y abiertas, distinguidas por etiqueta.

- Tabs: Solicitudes | Órdenes activas | Chat
- Filtros por modalidad (dirigida / abierta)
- Tarjetas de solicitud recibida:
  - Foto del producto
  - Nombre del producto
  - País de importación
  - Cantidad y precio objetivo
  - Etiqueta de modalidad (Dirigida / Abierta)
  - Tiempo desde recepción (ej. "Hace 2 horas")
- Botón principal: "Responder cotización"

### 6.4 Criterios de diseño transversales

- **Consistencia con el formulario de referencia:** los nombres y el orden de los campos de cotización deben sentirse familiares para un solicitante que ya usó el sistema original, para no generar fricción de adopción.
- **Estado siempre visible:** en cualquier pantalla de orden o cotización, el usuario debe poder ver en qué punto del proceso está sin tener que preguntarle al asesor por chat.
- **Distinción visual clara entre "dirigida" y "abierta"** en todas las vistas donde ambas coexistan (bandeja del importador, historial del solicitante), usando una etiqueta de color, no solo texto.
- **Mobile-first para el formulario de cotización y el chat:** es razonable esperar que muchos solicitantes completen la solicitud o respondan al asesor desde el celular.
- **El botón de acción principal** de cada pantalla (solicitar cotización, aceptar oferta, responder, pagar) siempre debe estar en una posición fija y predecible, para reducir curva de aprendizaje entre pantallas.

---

## 7. Estrategia de posicionamiento frente a la empresa de referencia

Dado que el objetivo explícito es que la empresa de referencia nos vea como aliado y no como competencia, se recomienda una secuencia de acercamiento en paralelo al desarrollo técnico:

1. Lanzar el MVP como plataforma multi-importador desde el día uno, sin mencionar a la empresa de referencia como inspiración pública del formulario.
2. Antes o inmediatamente después del lanzamiento, contactar formalmente a la empresa de referencia con una propuesta de vinculación como **"importador fundador"**, ofreciendo condiciones preferentes (comisión reducida los primeros meses, badge de "socio verificado", prioridad en cotizaciones dirigidas).
3. Enmarcar el mensaje en términos de **canal adicional de clientes**, no de herramienta competidora: se les está dando acceso a demanda de solicitantes que hoy no llegan a ellos por falta de visibilidad.
4. Si aceptan integrarse, evaluar una integración técnica más profunda a futuro (API para que sus cotizaciones y órdenes internas se sincronicen con nuestra plataforma).

> Es importante que el formulario, aunque tenga la misma estructura de campos, tenga una **identidad visual y de marca claramente distinta**, para reforzar el mensaje de "complemento", no de copia.

---

## 8. Alcance del MVP — 3 semanas

Con un plazo de 3 semanas, el alcance debe limitarse estrictamente a lo que permite validar el diferenciador (flujo dual de cotización) sin comprometer módulos regulatoriamente complejos como facturación electrónica o pasarelas de pago.

| Semana | Foco | Entregables |
|--------|------|-------------|
| **Semana 1** | Fundaciones y módulo de cotizaciones | Autenticación, perfiles (solicitante / importador), formulario de cotización, selección de modalidad dirigida vs. abierta, directorio básico de importadores |
| **Semana 2** | Red de importadores y órdenes | Distribución automática de cotizaciones abiertas, panel de propuestas recibidas, conexión con importador elegido, módulo de órdenes con estados y notificaciones |
| **Semana 3** | Chat, documentos y pulido | Chat 1 a 1 en tiempo real ligado a orden, repositorio de documentos básico (sin facturación electrónica), pruebas con importadores piloto, ajustes de UI/UX |

> **Fuera de alcance para el MVP** (recomendado para fases posteriores): facturación electrónica con validez fiscal, pasarela de pagos integrada, app móvil nativa, calificación/reputación pública de importadores, IA para sugerir automáticamente el mejor importador según historial.

---

## 9. Arquitectura y stack tecnológico

Esta sección explica qué tecnología se usará y por qué, en dos niveles: primero una lectura simple para entender el costo, la velocidad de desarrollo y el riesgo del proyecto; después el detalle técnico para el equipo que lo va a construir.

### 9.1 En palabras simples

La plataforma se divide en tres piezas que trabajan juntas: **el motor** que procesa toda la lógica del negocio (quién cotiza, quién paga, en qué estado va cada orden), **la pantalla** que ve el usuario en el navegador, y **la base** donde se guarda toda la información.

- **El motor (backend)** se construye en Python, un lenguaje maduro, con abundante talento disponible en el mercado y bajo costo de mantenimiento a futuro. Esto reduce el riesgo de depender de una sola persona que conozca la tecnología.
- **La información "pesada" del negocio** (usuarios, empresas importadoras, cotizaciones, órdenes, pagos) se guarda en una base de datos tradicional y confiable, adecuada para el volumen de operación esperado en esta etapa del negocio.
- **El chat en tiempo real** se apoya en una tecnología separada, optimizada para mensajes instantáneos, de forma que no sobrecargue ni haga más lenta la base de datos principal.
- **Los pagos** se delegan completamente a Wompi: la plataforma nunca maneja directamente los datos de la tarjeta o cuenta bancaria del solicitante, lo que reduce el riesgo y la responsabilidad legal/de seguridad del negocio.

> En resumen: se prioriza tecnología probada y económica de mantener, en lugar de herramientas de moda, porque el objetivo de las 3 semanas es velocidad de entrega y bajo costo operativo, no innovación tecnológica por sí misma.

### 9.2 Detalle técnico

| Componente | Tecnología propuesta | Justificación |
|------------|---------------------|---------------|
| **Backend / API** | Python 3 + FastAPI | Definido por el equipo. FastAPI permite construir endpoints async de forma muy rápida, con documentación automática (OpenAPI/Swagger) que facilita la integración del frontend y de Wompi en paralelo, ideal para un sprint de 3 semanas. |
| **Base de datos principal** | MySQL | Volumen y complejidad de datos moderados (usuarios, empresas, cotizaciones, órdenes, pagos). MySQL es estable, ampliamente soportado y suficiente para este nivel de flujo; evita la sobre-ingeniería de motores distribuidos que no se justifican en esta etapa. |
| **Chat en tiempo real / cache** | Redis (Pub/Sub) + WebSockets sobre FastAPI | Redis maneja los canales de mensajería en tiempo real y también puede usarse como caché de sesión y de estado de cotizaciones abiertas (ej. contador de ofertas recibidas), sin sobrecargar MySQL con escrituras de alta frecuencia. |
| **Frontend** | React (Next.js) con TypeScript | A discreción del desarrollo. Se recomienda React/Next.js por la disponibilidad de talento, el ecosistema de componentes para formularios complejos (como el de cotización) y paneles/dashboards, y porque se integra bien vía REST/WebSocket con un backend en FastAPI. |
| **Pasarela de pagos** | Wompi (Checkout + Webhooks) | Integración rápida y confiable para el mercado colombiano; delega el cumplimiento de seguridad de pagos (PCI) al proveedor, evitando que el equipo tenga que construir o certificar esa capa. |
| **Autenticación** | JWT (tokens) gestionados por FastAPI | Estándar ligero, sin dependencias pesadas, compatible con backend desacoplado del frontend. |
| **Infraestructura / despliegue** | Servidor en la nube (ej. VPS o servicio administrado tipo Railway/Render/AWS), contenedores Docker | Despliegue reproducible y portable; permite escalar el backend y la base de datos de forma independiente si el negocio crece. |

### Notas de arquitectura

- **Arquitectura multi-tenant desde el inicio:** cada importador vinculado debe ser una entidad independiente en la base de datos, con su propio equipo de asesores, para escalar sin rediseñar el modelo de datos más adelante.
- **Motor de "matching" simple** para cotizaciones abiertas: reglas por país de importación y categoría de producto son suficientes para el MVP; un modelo de recomendación más sofisticado puede quedar para fases posteriores.
- **Redis también permite implementar de forma económica la ventana de tiempo** de las cotizaciones abiertas (ej. expirar automáticamente una cotización abierta tras 48-72 horas).
- **Notificaciones:** correo electrónico y notificaciones dentro de la plataforma como mínimo viable; WhatsApp Business API puede evaluarse en fase 2, dado que el pantallazo de referencia ya usa contacto directo por WhatsApp.
- **Panel de administración interno** para el equipo de la plataforma, con visibilidad de todas las cotizaciones abiertas, chats, órdenes y pagos, para poder mediar en disputas.

---

## 10. Métricas de éxito para el MVP

- Número de cotizaciones creadas por modalidad (dirigida vs. abierta), para validar cuál flujo prefiere el mercado.
- Tasa de respuesta de importadores a cotizaciones abiertas dentro de la ventana de tiempo definida.
- Tiempo promedio entre solicitud y primera oferta recibida.
- Tasa de conversión de cotización a orden aceptada.
- Número de empresas importadoras activas vinculadas a la red al final de las 3 semanas.

---

## 11. Próximos pasos recomendados

1. Validar y priorizar el alcance del MVP con el equipo de desarrollo, confirmando que es viable en 3 semanas con los recursos disponibles.
2. Definir la identidad de marca del formulario (nombre, colores, tono) para diferenciarlo visualmente del sistema de referencia.
3. Identificar y contactar a 2-3 empresas importadoras adicionales (además de la de referencia) para tener oferta real de cotizaciones abiertas desde el lanzamiento.
4. Preparar la propuesta formal de vinculación como "importador fundador" para la empresa de referencia, en paralelo al desarrollo técnico.
5. Definir criterios mínimos de verificación para aceptar nuevas empresas importadoras en la red (evitar que actores no serios dañen la confianza de la red).

---

*Documento generado a partir de Propuesta_Plataforma_Importacion.pdf — Migrado a formato Obsidian MD como fuente única de verdad.*