# Zarpi · Textos públicos del sitio (home, Quiénes somos, Cómo funciona, Planes)

Versión 1 · 12 de octubre de 2026 · Para Juan Esteban. Todo lo que está entre llaves `{ }` es un dato dinámico que sale del admin.

---

## 0. Instrucciones de implementación

**Qué se reemplaza**
- Home completo (hero, bloques, cómo funciona corto, planes, empresas importadoras, FAQ corta, cierre, pie).
- Página "Quiénes somos" completa.
- Página "Cómo funciona" (8 pasos + dos bloques + FAQ completa).

**Qué se elimina**
- Los dos recuadros de precios de "Cómo funciona" ("Para compradores" con $40.000 y "Para nacionalizadoras" con el 5 %). Los precios de las importadoras no se publican en ningún lugar del sitio.
- "dirigida o abierta" en el paso 2.
- "con el asesor asignado" en el paso 4.
- "la plataforma crea la orden automáticamente" en el paso 5.

**Cambios globales de vocabulario (buscar y reemplazar en todo el sitio, incluida la app)**
- "nacionalizadora(s)" → "empresa(s) importadora(s)"
- "solicitante" → "comprador" en la app; en los textos públicos se habla de "tú"
- "ZARPI" → "Zarpi" (la marca se escribe como el logo, salvo en el nombre legal "ZARPI S.A.S." del pie)
- "orden" → "operación"
- "asesor" no se usa en ningún texto público

**Planes en el home**
- Los valores, las inclusiones y los cupos salen de la tabla de planes del admin (módulo de Planes con pago manual). No se queman en el código.
- Cada tarjeta lleva al flujo de inscripción de ese plan: `/planes/inscripcion?plan=importador` y `/planes/inscripcion?plan=vip`.
- "Quedan {cupos} cupos" muestra el número real; cuando llegue a cero, el botón pasa a "Lista de espera".
- Mostrar el precio como "$500.000 + IVA" y debajo, en pequeño, el total con IVA ("$595.000 con IVA"). Si el abogado pide mostrar solo el total, se invierte el orden.

**Enlaces del menú**
Inicio · Quiénes somos · Cómo funciona · Planes · Tendencias · Reto · Novedades y aliados · Contacto · [Iniciar sesión] · [Solicitar acceso]
"Solicitar acceso" lleva a la sección de planes del home (`/#planes`).

---

## 1. HOME

### Hero

**Eyebrow:** Importaciones desde China

**H1:** Tú dices qué importar. Zarpi encuentra quién lo trae.

**Texto:** Publica lo que quieres importar y recibe propuestas de empresas importadoras verificadas, con precio final puesto en Colombia. Compara, elige y sigue todo el proceso en un solo lugar.

**Botones:** [Solicitar acceso] [Cómo funciona]

**Línea debajo de los botones (pequeña, en cursiva):** Para comerciantes, emprendedores y empresas que quieren importar con más información y menos incertidumbre.

### Tres bloques

**Precio final en Colombia**
Cada propuesta llega con el valor puesto en tu bodega y con lo que incluye y lo que no, por escrito.

**Empresas con trayectoria**
Antes de elegir sabes quién es cada empresa importadora: años importando, operaciones realizadas y cumplimiento.

**Todo queda registrado**
Propuestas, acuerdos, documentos y avances de cada etapa, en un solo lugar.

### Cómo funciona (versión corta del home)

**H2:** De lo que quieres importar a una propuesta en firme.

**1. Publica.** Cuéntanos qué producto buscas, la cantidad, las especificaciones y, si tienes, el enlace o la referencia.

**2. Recibe propuestas.** Empresas importadoras verificadas te envían precio final en Colombia, tiempos y condiciones.

**3. Elige.** Resuelve tus dudas por la plataforma, conoce a cada empresa y decide con quién trabajar. La operación se hace directamente con la empresa que elijas.

**4. Haz seguimiento.** Cada etapa, de la compra en origen a la entrega, queda documentada en un solo lugar.

**Enlace:** Ver el proceso completo →

### Planes (id de sección: `planes`)

**Eyebrow:** Precio de lanzamiento

**H2:** Elige cómo entrar a Zarpi

**Texto:** Cupos limitados para los primeros compradores. El precio de lanzamiento se mantiene mientras haya cupos.

**Tarjeta 1 · Paquete Importador**
- Precio: $500.000 + IVA
- Pequeño: $595.000 con IVA
- Incluye:
  - 10 solicitudes de cotización
  - Vigencia de 12 meses
  - Propuestas de empresas importadoras verificadas, con precio final en Colombia
  - Chat, documentos y seguimiento de cada operación
- Para quién: Para quien ya sabe qué quiere traer.
- Botón: [Inscribirme]
- Debajo del botón: Quedan {cupos_importador} cupos

**Tarjeta 2 · Plan VIP** (tarjeta destacada)
- Precio: $2.000.000 + IVA
- Pequeño: $2.380.000 con IVA
- Incluye:
  - 10 solicitudes de cotización incluidas; adicionales a $25.000 + IVA
  - Vigencia de 12 meses
  - Módulo de Tendencias durante 6 meses: productos que se están moviendo, listos para cotizar
  - Sesión 1:1 con Juan Pablo Orozco para resolver tus dudas de importación
  - Sesiones de formación en vivo: costeos, modalidades y casos reales
  - Todo lo del Paquete Importador
- Para quién: Para quien quiere importar con acompañamiento.
- Botón: [Inscribirme]
- Debajo del botón: Quedan {cupos_vip} cupos

**Línea pequeña debajo de las dos tarjetas:**
Una solicitud es una publicación con producto y cantidad que llega a las empresas importadoras. Si no recibe propuestas en 72 horas, la unidad vuelve a tu saldo. Pago por transferencia; activamos tu plan en máximo 2 horas en horario de feria. [Ver condiciones de los planes]

### Para empresas importadoras

**H2:** Tu experiencia merece llegar a más compradores.

- Solicitudes de compradores verificados y comprometidos, sin ruido.
- Cotizas solo lo que te interesa. Cotizar no tiene costo.
- Un perfil con tu trayectoria y tus métricas, iguales para todas.
- Programa Fundadoras: cupos limitados.

**Botón:** [Aplicar como empresa importadora]

**Pequeño:** Cupos y beneficios sujetos a las condiciones vigentes del programa.

### Preguntas frecuentes (versión corta del home: estas tres)

**¿Zarpi importa mi producto?**
No. Las empresas importadoras importan a su nombre, nacionalizan y te facturan en Colombia como venta nacional. Zarpi conecta, ordena la información y registra el proceso.

**¿A quién le pago?**
Directamente a la empresa importadora que elegiste, a la cuenta que ves en la plataforma. Zarpi no recibe el dinero de tu importación.

**¿Cómo sé cuánto me va a costar importar?**
Cada propuesta indica el precio final puesto en Colombia, qué incluye, qué no y los tiempos estimados. Antes de aceptar, revisa el punto de entrega y los supuestos que podrían mover el precio.

**Enlace:** Todas las preguntas →

### Cierre

**H2:** Tu próxima importación empieza con una mejor decisión.

**Texto:** Publica lo que necesitas y elige la empresa importadora que mejor se ajuste a tu operación.

**Botón:** [Solicitar acceso]

**Línea:** ¿Eres una empresa importadora? [Conoce cómo vincularte]

### Pie de página

**ZARPI S.A.S.** · NIT 902.106.417-6 · Cali, Colombia

Quiénes somos · Cómo funciona · Planes · Tendencias · Contacto · Condiciones de los planes · Términos y condiciones · Política de tratamiento de datos

**Aviso legal:** Zarpi S.A.S. es una plataforma de intermediación tecnológica. No importa, no transporta, no nacionaliza ni recibe el dinero de las operaciones. Cada operación se celebra directamente entre quien importa y la empresa importadora que elige.

---

## 2. PÁGINA "QUIÉNES SOMOS"

**Eyebrow:** Quiénes somos

**H1:** Importar no debería depender de tener los contactos correctos.

Cuando empezamos a importar no sabíamos por dónde arrancar: si irnos a Buenaventura a buscar quién traía contenedores o irnos a China. Y estando en China, frente al producto, quedaban dos preguntas: cómo iba a llegar a la bodega y cuánto iba a costar realmente tenerlo en Colombia.

Con los años encontramos la respuesta: empresas importadoras que traen el producto a su nombre, lo nacionalizan y te lo entregan facturado en Colombia. Así importan desde quien hace su primer pedido hasta empresas que traen millones de dólares al mes. Algunas llevan más de treinta años yendo a China.

También entendimos que encontrar una buena empresa no debería depender de una recomendación, un contacto o una conversación por WhatsApp. Zarpi existe para que esa respuesta esté a un clic de cualquier comerciante en Colombia.

**H2:** Qué hacemos

Conectamos a personas y empresas que quieren importar con empresas importadoras verificadas, ordenamos la información para que puedas decidir y guardamos la evidencia de cada etapa.

**H2:** En qué creemos

**Las mismas reglas para todas.** Cada empresa importadora se mide con las mismas métricas. Nadie compra una mejor reputación.

**El proceso a la vista.** Cada etapa deja evidencia en la plataforma.

**Tú decides.** Zarpi te muestra quién es quién; la elección es tuya.

**H2:** Quiénes estamos detrás

Zarpi S.A.S. nació en Cali en 2026, fundada por Juan Pablo Orozco, comerciante que lleva años importando para su propia operación de comercio electrónico. Creamos Zarpi para convertir una experiencia llena de incertidumbre en un proceso claro y documentado.

**Botón:** [Solicitar acceso]

---

## 3. PÁGINA "CÓMO FUNCIONA"

**Eyebrow:** Cómo funciona

**H1:** Así se importa con Zarpi

1. **Publicas tu solicitud:** producto, cantidad, referencia o enlace.
2. **Tu solicitud llega a empresas importadoras verificadas.**
3. **Recibes propuestas** con precio final en Colombia, tiempos y condiciones.
4. **Resuelves dudas por el chat de la plataforma,** conoces la trayectoria de cada empresa y eliges.
5. **Al aceptar una propuesta, la operación queda registrada** y se abre el contacto directo con la empresa importadora.
6. **La empresa importadora actualiza cada etapa:** producción, tránsito, aduana y entrega.
7. **Cada etapa queda documentada** en la plataforma.
8. **Confirmas la entrega** y calificas la experiencia.

### Para quien importa

- Publicas una vez y recibes propuestas de varias empresas.
- Precio final puesto en Colombia, con lo que incluye y lo que no.
- Conoces a cada empresa antes de elegir: trayectoria, cumplimiento y calificaciones.
- Todo el proceso queda registrado.

**Botón:** [Ver planes]

### Para empresas importadoras

- Solicitudes de compradores verificados y comprometidos, sin ruido.
- Cotizas solo lo que te interesa. Cotizar no tiene costo.
- Un perfil con tu trayectoria y tus métricas, iguales para todas.
- Programa Fundadoras: cupos limitados.

**Botón:** [Aplicar como empresa importadora]

### Preguntas frecuentes (completas)

**¿Zarpi importa mi producto?**
No. Las empresas importadoras importan a su nombre, nacionalizan y te facturan en Colombia como venta nacional. Zarpi conecta, ordena la información y registra el proceso.

**¿Cuánto cuesta?**
Zarpi funciona con planes de acceso para quienes importan. Los ves en la sección de planes y conoces el precio y las condiciones antes de pagar.

**¿Cómo sé cuánto me va a costar importar?**
Cada propuesta indica el precio final puesto en Colombia, qué incluye, qué no y los tiempos estimados. Antes de aceptar, revisa el punto de entrega y los supuestos que podrían mover el precio.

**¿Qué significa "empresa verificada"?**
Que confirmamos su existencia legal, su actividad importadora real y sus referencias antes de que entre, y que su cumplimiento se publica con las mismas métricas que el de todas las demás.

**¿Estoy obligado a aceptar una propuesta?**
No. Revisas las propuestas y eliges solo si alguna te sirve.

**¿Y si algo sale distinto a lo acordado?**
La empresa importadora responde directamente por su servicio. Zarpi exige respuesta en plazos cortos, documenta todo y hace seguimiento hasta que haya una solución.

**¿A quién le pago?**
Directamente a la empresa importadora que elegiste, a la cuenta que ves en la plataforma. Zarpi no recibe el dinero de tu importación.

---

## 4. Referencia

Los textos legales de los planes (condiciones, checkboxes, pantallas de pago, correos) están en el documento "Textos legales y de pantalla del módulo de Planes". El eslogan, la pregunta gancho y la paleta están en el brief "Zarpi, en una página".
