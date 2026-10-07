import { EMPRESA, LEGAL_VERSION, LEGAL_VIGENTE_DESDE } from "@/features/legal/empresa";
import type { LegalDocument, LegalPage } from "@/features/legal/types";

/*
 * Texto de los documentos legales, tomado de las versiones aprobadas en docs/:
 *   - «Zarpi - Términos y Condiciones.docx»
 *   - «Zarpi - Política de Tratamiento de Datos Personales.docx»
 *   - «Zarpi - Política de Pagos, Cancelaciones y Reembolsos.docx»
 * Si cambian esos documentos, hay que actualizar aquí con el mismo texto. Los
 * datos de la empresa (razón social, NIT, dirección, teléfono, correo y
 * pasarela) salen de empresa.ts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TÉRMINOS Y CONDICIONES
// ─────────────────────────────────────────────────────────────────────────────
const TERMINOS: LegalDocument = {
  titulo: "Términos y Condiciones de Uso de Zarpi",
  version: LEGAL_VERSION,
  vigenteDesde: LEGAL_VIGENTE_DESDE,
  tituloDatos: "Datos del prestador del servicio",
  mostrarMatricula: true,
  secciones: [
    {
      titulo: "Quiénes somos y aceptación de estos términos",
      bloques: [
        `La plataforma Zarpi, disponible en ${EMPRESA.sitio} (en adelante, “Zarpi” o “la Plataforma”), es operada por ${EMPRESA.razonSocial}, identificada con NIT ${EMPRESA.nit} y matrícula mercantil ${EMPRESA.matricula} de la ${EMPRESA.camaraComercio}, con domicilio en la ${EMPRESA.domicilio}, teléfono ${EMPRESA.telefono} y correo electrónico ${EMPRESA.correo}.`,
        "Estos Términos y Condiciones regulan el acceso y el uso de la Plataforma. Al crear una cuenta, marcar la casilla de aceptación en el registro o usar cualquiera de los servicios, el usuario declara que los leyó, los entendió y los acepta, junto con la Política de Tratamiento de Datos Personales y la Política de Pagos, Cancelaciones y Reembolsos, que hacen parte integral de este documento.",
        "Si el usuario no está de acuerdo con alguno de estos términos, debe abstenerse de usar la Plataforma.",
      ],
    },
    {
      titulo: "Definiciones",
      bloques: [
        [
          "Solicitante: persona natural o jurídica que se registra para pedir cotizaciones de mercancía importada que quiere recibir nacionalizada en Colombia.",
          "Empresa importadora o nacionalizadora: empresa vinculada a Zarpi que importa la mercancía a su nombre, como importador de registro, la nacionaliza y se la vende al solicitante ya nacionalizada, con factura de venta nacional. También puede ofrecer servicios conexos, como la búsqueda de productos o proveedores en el exterior.",
          "Asesor: empleado de una empresa importadora que, con una cuenta creada por esa empresa, atiende solicitudes y conversa con los solicitantes en su nombre.",
          "Solicitud de cotización: requerimiento que publica el solicitante con la descripción del producto, cantidades, referencias y demás condiciones. Puede ser dirigida (a una empresa concreta) o abierta (asignada por Zarpi a varias empresas).",
          "Propuesta: oferta que una empresa importadora envía en respuesta a una solicitud, con el precio de la mercancía puesta en Colombia, los tiempos, el Incoterm y las demás condiciones.",
          "Operación: el negocio que celebran directamente el solicitante y la empresa importadora cuando aceptan una propuesta.",
          "Orden: registro de seguimiento que la Plataforma crea cuando el solicitante y la empresa aceptan una propuesta.",
          "Usuario: cualquier persona que use la Plataforma, con o sin cuenta.",
        ],
      ],
    },
    {
      titulo: "Naturaleza del servicio: Zarpi conecta, no importa",
      bloques: [
        "Zarpi es una plataforma tecnológica de contacto entre solicitantes y empresas importadoras, en los términos del artículo 53 de la Ley 1480 de 2011 (Estatuto del Consumidor). En consecuencia:",
        [
          "Zarpi no es importador de registro, agente de aduanas, transportador, operador logístico ni vendedor de las mercancías. No figura como importador en ninguna operación.",
          "El solicitante tampoco figura como importador: lo que adquiere es mercancía ya nacionalizada que le vende la empresa importadora.",
          "El precio, los tiempos de entrega, el Incoterm, las garantías y demás condiciones de cada operación los fija la empresa importadora en su propuesta, y el acuerdo comercial se celebra directamente entre el solicitante y esa empresa.",
          "El pago de cada operación se acuerda y se hace directamente entre el solicitante y la empresa importadora. Zarpi no recibe, retiene, custodia ni administra esos dineros.",
          "La importación, la nacionalización, el pago de tributos aduaneros, el cumplimiento de requisitos sanitarios, técnicos o de vistos buenos, la facturación de la venta y la entrega de la mercancía son responsabilidad de la empresa importadora.",
          "Zarpi no garantiza el resultado de ninguna operación. Responde por lo que está a su cargo: el funcionamiento de la Plataforma, la verificación documental de las empresas vinculadas, la trazabilidad de las solicitudes, propuestas y órdenes, la mediación en los reportes de problemas y los servicios que cobra directamente, descritos en la Política de Pagos, Cancelaciones y Reembolsos.",
        ],
        "En cumplimiento del artículo 53 de la Ley 1480 de 2011, Zarpi exige a cada empresa importadora su razón social, NIT, dirección física de notificaciones y teléfono. Un solicitante que haya contratado con una empresa a través de la Plataforma puede pedir esa información a Zarpi para presentar una queja o reclamo, y Zarpi la entregará a la autoridad competente que la solicite.",
      ],
    },
    {
      titulo: "Registro y cuentas",
      bloques: [
        [
          "Para crear una cuenta el usuario debe ser mayor de edad y tener capacidad legal para contratar. Quien se registre en nombre de una persona jurídica declara que tiene facultades para obligarla.",
          "Los solicitantes se registran por sí mismos. Las cuentas de empresas importadoras las crea Zarpi una vez la empresa se vincula y supera la revisión documental. Las cuentas de asesor las crea la empresa importadora, que responde por el uso que hagan sus asesores.",
          "El usuario debe entregar información veraz, completa y actualizada (nombre, documento de identidad o NIT, correo y teléfono) y mantenerla al día desde su perfil.",
          "La cuenta es personal e intransferible. El usuario debe guardar en reserva su contraseña y los códigos de verificación que reciba por correo, y avisar de inmediato a Zarpi si sospecha un acceso no autorizado.",
          "Por seguridad, Zarpi puede pedir un código de verificación al registrarse, al iniciar sesión después de un tiempo sin actividad o al restablecer la contraseña.",
        ],
      ],
    },
    {
      titulo: "Cómo funciona la Plataforma",
      bloques: [
        [
          "El solicitante publica su solicitud de cotización, dirigida a una empresa concreta o abierta. Las solicitudes abiertas las asigna Zarpi a un número limitado de empresas importadoras según su especialidad, el origen de las mercancías y su capacidad. Zarpi no garantiza que una solicitud reciba propuestas.",
          "Cada empresa importadora puede fijar un número máximo de solicitudes que recibe al día y un nivel mínimo de perfil de cotizante. Cuando el solicitante no cumple esas condiciones, la solicitud dirigida puede ser rechazada o la solicitud abierta asignada a otras empresas.",
          "Las empresas responden con propuestas. Cada empresa ve únicamente su propia propuesta y no las de sus competidores.",
          "El solicitante puede conversar con el asesor de la empresa por el chat de la Plataforma, comparar propuestas y negociar.",
          "Cuando el solicitante y la empresa aceptan una propuesta, la Plataforma crea una orden para hacer seguimiento a las etapas de producción, tránsito internacional, aduana, bodega y entrega, y para compartir documentos (factura proforma, factura comercial, lista de empaque, comprobantes). La orden es una herramienta de seguimiento: no sustituye el contrato entre las partes ni convierte a Zarpi en parte de él.",
          "Después de la entrega, el solicitante puede calificar a la empresa. Las reseñas deben ser veraces y referirse a la experiencia real.",
        ],
      ],
    },
    {
      titulo: "Verificación de empresas importadoras",
      bloques: [
        "Zarpi revisa la documentación de las empresas que se vinculan (existencia y representación legal, RUT y demás soportes que considere necesarios) y puede otorgar el distintivo de socio verificado.",
        "La verificación confirma que la documentación revisada era consistente en la fecha de la revisión. No es una garantía sobre el resultado de una operación concreta, la calidad de la mercancía ni la solvencia futura de la empresa. Zarpi puede suspender o retirar el distintivo si la empresa deja de cumplir los requisitos o recibe reclamos fundados.",
      ],
    },
    {
      titulo: "Obligaciones del solicitante",
      bloques: [
        [
          "Describir con veracidad el producto, las cantidades y las condiciones que necesita, y no publicar solicitudes con fines distintos a obtener cotizaciones reales.",
          "Verificar, antes de aceptar una propuesta, el precio, el Incoterm, los tiempos y las condiciones ofrecidas.",
          "Cumplir lo pactado con la empresa importadora, incluidos los pagos acordados con ella.",
          "No solicitar mercancías prohibidas o de origen ilícito, ni usar la Plataforma para evadir controles aduaneros, cambiarios o tributarios.",
        ],
      ],
    },
    {
      titulo: "Obligaciones de las empresas importadoras y sus asesores",
      bloques: [
        [
          "Contar con las habilitaciones, registros y permisos que la ley exige para la actividad que ofrecen, y mantener actualizada la información y documentación entregada a Zarpi.",
          "Ofrecer información clara, veraz, suficiente y oportuna en sus propuestas, conforme a la Ley 1480 de 2011, incluidos el precio total, los tributos y costos que asume o traslada al solicitante, los tiempos y las condiciones de garantía.",
          "Actuar como importador de registro en cada operación, responder ante las autoridades aduaneras y tributarias, y expedir al solicitante la factura de venta de la mercancía nacionalizada.",
          "Cumplir las propuestas aceptadas y actualizar con veracidad el estado de las órdenes.",
          "Responder por la calidad, idoneidad y seguridad de la mercancía y por las garantías legales frente al solicitante.",
          "Cerrar y registrar a través de la Plataforma las operaciones que se originen en solicitudes recibidas en ella, conforme a su contrato de vinculación.",
          "Usar los datos personales de los solicitantes solo para atender la solicitud y la operación correspondiente, conforme a la Ley 1581 de 2012.",
          "Responder por los actos de sus asesores dentro de la Plataforma.",
        ],
      ],
    },
    {
      titulo: "Tarifas y pagos a Zarpi",
      bloques: [
        `Algunos servicios de la Plataforma tienen costo. Las tarifas vigentes, la forma de pago, el procesamiento a través de la pasarela ${EMPRESA.pasarela} y las reglas de cancelación, retracto, reversión y reembolso se describen en la Política de Pagos, Cancelaciones y Reembolsos.`,
        "El precio que se muestra al usuario antes de confirmar un pago es el que se cobra, en pesos colombianos e incluyendo los impuestos aplicables. Zarpi puede ofrecer periodos promocionales o servicios gratuitos, que no generan derecho a mantenerlos indefinidamente.",
      ],
    },
    {
      titulo: "Conductas prohibidas",
      bloques: [
        "Está prohibido:",
        [
          "Suplantar a otra persona o empresa, o entregar documentos falsos o alterados.",
          "Publicar contenido ilegal, ofensivo, discriminatorio, engañoso o que infrinja derechos de terceros.",
          "Ofrecer o solicitar mercancías prohibidas, de contrabando, falsificadas o que infrinjan derechos de propiedad intelectual.",
          "Usar la Plataforma para lavado de activos, financiación del terrorismo u otras actividades ilícitas.",
          "Usar la Plataforma para captar dinero del público o para reunir recursos de varios usuarios con el fin de hacer una misma compra.",
          "Enviar publicidad no solicitada, extraer datos de forma automatizada o usar la información de otros usuarios con fines distintos a la operación que se negocia.",
          "Intentar acceder sin autorización a cuentas, sistemas o datos, interferir con el funcionamiento de la Plataforma o eludir sus medidas de seguridad.",
          "Manipular reseñas, calificaciones o el sistema de referidos.",
        ],
      ],
    },
    {
      titulo: "Reporte de problemas y mediación",
      bloques: [
        "Si una orden presenta un problema, el solicitante puede reportarlo desde la orden y adjuntar evidencias. Zarpi revisará el caso, pedirá información a ambas partes y propondrá una solución.",
        "La mediación de Zarpi es un mecanismo voluntario de arreglo directo. No es una decisión judicial ni arbitral, no obliga a las partes y no impide que cualquiera de ellas acuda a la Superintendencia de Industria y Comercio, a la DIAN o a los jueces competentes.",
      ],
    },
    {
      titulo: "Contenido de los usuarios",
      bloques: [
        "Los textos, fotos, documentos y mensajes que los usuarios cargan siguen siendo de quien los aporta. El usuario declara que tiene derecho a compartirlos y autoriza a Zarpi a almacenarlos, procesarlos y mostrarlos a las contrapartes de la solicitud u orden correspondiente, solo para prestar el servicio.",
        "Las empresas importadoras autorizan además a Zarpi a mostrar en la Plataforma y en su sitio público su nombre, logotipo, descripción, especialidades, calificaciones y reseñas.",
        "Zarpi puede retirar contenido que incumpla estos términos o la ley.",
      ],
    },
    {
      titulo: "Módulo educativo y programa de referidos",
      bloques: [
        "Las empresas importadoras pueden publicar cursos en la Plataforma. El contenido de cada curso es responsabilidad de la empresa que lo publica. Si un curso tiene precio, lo cobra directamente la empresa que lo publica, que informará las condiciones de pago antes de la inscripción; Zarpi no recauda ese dinero.",
        "Zarpi puede ofrecer un programa de referidos con beneficios para quien invita y para quien se registra con un código. Cada usuario puede usar un solo código, y Zarpi puede anular los beneficios obtenidos de forma fraudulenta. Las condiciones y beneficios vigentes se informan en la Plataforma.",
      ],
    },
    {
      titulo: "Propiedad intelectual",
      bloques: [
        `La marca Zarpi, sus logotipos, el diseño de la Plataforma, el software y los textos propios son de ${EMPRESA.razonSocial} o de sus licenciantes. El uso de la Plataforma no concede al usuario ningún derecho sobre ellos, más allá de usarla conforme a estos términos.`,
      ],
    },
    {
      titulo: "Responsabilidad",
      bloques: [
        "Zarpi responde por la prestación diligente de sus propios servicios. Como no es parte de los acuerdos comerciales entre solicitantes y empresas importadoras, no responde por:",
        [
          "El incumplimiento, la calidad, el estado, la legalidad o la entrega de la mercancía, ni por los pagos acordados entre las partes.",
          "Las demoras o retenciones causadas por autoridades aduaneras, transportadores, proveedores en el exterior o eventos de fuerza mayor o caso fortuito.",
          "La veracidad de la información que cada usuario publica, salvo la verificación documental de empresas descrita en estos términos.",
          "Interrupciones temporales por mantenimiento, fallas de terceros proveedores de infraestructura o causas ajenas a su control. Zarpi procurará restablecer el servicio en el menor tiempo posible.",
        ],
        "Nada de lo anterior limita los derechos que la ley reconoce a los consumidores ni la responsabilidad de Zarpi por dolo o culpa grave.",
      ],
    },
    {
      titulo: "Suspensión y terminación",
      bloques: [
        `El usuario puede dejar de usar la Plataforma y pedir la cancelación de su cuenta en cualquier momento escribiendo a ${EMPRESA.correo}.`,
        "Zarpi puede suspender o cancelar una cuenta que incumpla estos términos, entregue información falsa o ponga en riesgo a otros usuarios o a la Plataforma. Salvo urgencia o riesgo, avisará antes al usuario e indicará el motivo. La cancelación no afecta las obligaciones ya adquiridas entre las partes.",
      ],
    },
    {
      titulo: "Atención al usuario: peticiones, quejas y reclamos",
      bloques: [
        `El usuario puede presentar peticiones, quejas, reclamos o sugerencias por la sección de Ayuda y Soporte de la Plataforma o al correo ${EMPRESA.correo}. Zarpi enviará una constancia de recibo con la fecha y la hora de radicación, y responderá dentro de los quince (15) días hábiles siguientes a su recibo.`,
        "Si el usuario no queda satisfecho con la respuesta, puede acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co).",
      ],
    },
    {
      titulo: "Cambios a estos términos",
      bloques: [
        "Zarpi puede actualizar estos términos. La nueva versión se publicará en esta página con su fecha de vigencia y se avisará a los usuarios registrados por correo o dentro de la Plataforma antes de que empiece a regir. Los cambios no afectan los pagos ya realizados ni las operaciones en curso. Si el usuario continúa usando la Plataforma después de la entrada en vigencia, se entiende que acepta la nueva versión.",
      ],
    },
    {
      titulo: "Ley aplicable y solución de controversias",
      bloques: [
        "Estos términos se rigen por las leyes de la República de Colombia. Las partes intentarán resolver sus diferencias por arreglo directo. Si no lo logran, podrán acudir a las autoridades administrativas y judiciales competentes de Colombia. Los consumidores conservan siempre su derecho a acudir a la Superintendencia de Industria y Comercio.",
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES
// ─────────────────────────────────────────────────────────────────────────────
const POLITICA_DATOS: LegalDocument = {
  titulo: "Política de Tratamiento de Datos Personales",
  resumen: "Qué datos recogemos, para qué los usamos, con quién los compartimos y cómo ejercer tus derechos.",
  version: LEGAL_VERSION,
  vigenteDesde: LEGAL_VIGENTE_DESDE,
  tituloDatos: "Datos del responsable",
  secciones: [
    {
      titulo: "Responsable del tratamiento",
      bloques: [
        `El responsable del tratamiento de los datos personales recogidos a través de Zarpi es ${EMPRESA.razonSocial}, identificada con NIT ${EMPRESA.nit}, con domicilio en la ${EMPRESA.domicilio}, teléfono ${EMPRESA.telefono}, correo electrónico ${EMPRESA.correo} y sitio web ${EMPRESA.sitio}.`,
        "Esta política se expide en cumplimiento de la Ley Estatutaria 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto Único Reglamentario 1074 de 2015) y demás normas que los modifiquen o complementen.",
      ],
    },
    {
      titulo: "Datos que recogemos",
      bloques: [
        [
          "Datos de identificación y contacto: nombre, apellido, tipo y número de documento o NIT, razón social, tipo de persona, correo electrónico, teléfono, WhatsApp y foto de perfil.",
          "Datos de la actividad en la Plataforma: solicitudes de cotización (descripción, cantidades, fotos, enlaces de referencia, precio objetivo), propuestas, órdenes, documentos cargados, mensajes del chat, tickets de soporte, reseñas y calificaciones.",
          "Datos del perfil de cotizante: número de solicitudes y órdenes, valor de las operaciones cerradas, nivel asignado y la información que el usuario declare sobre compras de mercancía importada hechas por fuera de la Plataforma.",
          `Datos de pagos: referencia, valor, estado y fecha de las transacciones. Los datos de la tarjeta o de la cuenta bancaria los recibe y procesa directamente la pasarela ${EMPRESA.pasarela}; Zarpi no los almacena.`,
          "Datos técnicos y de seguridad: fecha del último inicio de sesión, códigos de verificación (guardados cifrados) y registros técnicos necesarios para proteger la Plataforma.",
          "Datos del formulario de contacto: nombre, correo, teléfono y mensaje.",
          "Datos de empresas importadoras y sus representantes: razón social, NIT, certificado de existencia y representación legal, RUT, nombre y documento del representante legal, dirección de notificaciones, teléfono, y nombre y correo de sus asesores.",
        ],
        "Zarpi no solicita datos sensibles ni datos de niñas, niños o adolescentes. La Plataforma es solo para mayores de edad. Si un usuario incluye datos sensibles en un mensaje o documento, lo hace de forma voluntaria y no es obligatorio para usar el servicio.",
      ],
    },
    {
      titulo: "Finalidades del tratamiento",
      bloques: [
        [
          "Crear y administrar la cuenta, verificar la identidad del usuario y el correo, y proteger el acceso.",
          "Prestar el servicio: publicar las solicitudes, asignarlas a empresas importadoras, permitir el envío de propuestas, el chat, el seguimiento de órdenes y la gestión documental.",
          "Construir el perfil de cotizante y el nivel del solicitante, que las empresas importadoras usan para decidir qué solicitudes atienden.",
          "Verificar la documentación de las empresas importadoras y consultar a sus representantes en listas restrictivas, para prevenir el lavado de activos y la financiación del terrorismo.",
          "Procesar pagos, expedir facturas y atender cancelaciones, reversiones y reembolsos.",
          "Atender peticiones, quejas, reclamos, reportes de problemas y solicitudes de soporte.",
          "Enviar notificaciones del servicio (nuevas propuestas, mensajes, cambios de estado de las órdenes, avisos de seguridad).",
          "Enviar información comercial sobre Zarpi, solo si el usuario lo autoriza. Puede retirar esa autorización en cualquier momento.",
          "Elaborar estadísticas agregadas para mejorar la Plataforma.",
          "Cumplir obligaciones legales, contables y tributarias, y atender requerimientos de autoridades.",
        ],
      ],
    },
    {
      titulo: "Con quién compartimos los datos",
      bloques: [
        "Por la naturaleza del servicio, algunos datos se comparten con otros usuarios y con proveedores:",
        [
          "Empresas importadoras y sus asesores: reciben los datos de las solicitudes que se les dirigen o asignan, el nombre y el perfil de cotizante del solicitante, y los datos de contacto necesarios para ejecutar la operación aceptada. Cada empresa trata esos datos como responsable independiente y debe cumplir la Ley 1581 de 2012.",
          "Solicitantes: ven el perfil público de las empresas importadoras y el nombre de los asesores que los atienden.",
          `Proveedores que actúan como encargados del tratamiento, bajo instrucciones de Zarpi: ${EMPRESA.pasarela} y las entidades financieras que procesan cada medio de pago; DigitalOcean, para el alojamiento de la Plataforma y sus copias de seguridad; Resend, para el envío de correos; Google, para el correo corporativo de Zarpi; y, cuando se activen, servicios de traducción automática de mensajes.`,
          "Autoridades administrativas o judiciales que lo requieran en ejercicio de sus funciones.",
        ],
        "Algunos de estos proveedores almacenan o procesan información en servidores ubicados fuera de Colombia, por ejemplo en Estados Unidos. Al aceptar esta política, el titular autoriza esa transmisión internacional. Zarpi solo trabaja con proveedores que ofrecen niveles adecuados de protección de datos.",
        "Zarpi no vende ni alquila datos personales.",
      ],
    },
    {
      titulo: "Otros titulares de datos",
      bloques: [
        "Zarpi también trata datos de sus contratistas, proveedores y empleados, y de los representantes y asesores de las empresas vinculadas, para gestionar la relación contractual o comercial, hacer pagos, cumplir obligaciones tributarias, contables y de seguridad social, y prevenir el lavado de activos. A estos titulares les aplican los mismos derechos y procedimientos de esta política.",
      ],
    },
    {
      titulo: "Derechos del titular",
      bloques: [
        "Como titular de los datos, el usuario tiene derecho a:",
        [
          "Conocer, actualizar y rectificar sus datos personales.",
          "Pedir prueba de la autorización otorgada a Zarpi.",
          "Ser informado sobre el uso que se ha dado a sus datos.",
          "Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley, después de haber agotado el trámite de consulta o reclamo ante Zarpi.",
          "Revocar la autorización o pedir la supresión de sus datos, cuando no exista un deber legal o contractual de conservarlos.",
          "Acceder gratuitamente a sus datos personales.",
        ],
        "Muchos datos se pueden consultar y actualizar directamente desde el perfil en la Plataforma.",
      ],
    },
    {
      titulo: "Área responsable y cómo ejercer los derechos",
      bloques: [
        `La atención de consultas y reclamos está a cargo del área de Protección de Datos Personales de ${EMPRESA.razonSocial}, bajo la dirección de su representante legal. Las solicitudes se presentan al correo ${EMPRESA.correo}, por la sección de Ayuda y Soporte de la Plataforma o por escrito en la ${EMPRESA.direccion}, ${EMPRESA.ciudad}, indicando nombre, documento de identidad, datos de contacto y la descripción de la solicitud. Si se actúa en nombre de otra persona, debe acreditarse la representación.`,
        [
          "Consultas: se responden en un máximo de diez (10) días hábiles desde su recibo. Si no es posible en ese plazo, Zarpi informará el motivo y responderá dentro de los cinco (5) días hábiles siguientes al vencimiento del primer plazo.",
          "Reclamos (corrección, actualización, supresión o incumplimiento): se responden en un máximo de quince (15) días hábiles desde su recibo, prorrogables hasta por ocho (8) días hábiles más, con aviso al titular. Si el reclamo está incompleto, Zarpi pedirá completarlo dentro de los cinco (5) días siguientes a su recibo; si pasan dos (2) meses sin que el titular lo complete, se entenderá que desistió.",
        ],
        "La supresión de datos y la revocatoria de la autorización no proceden mientras el titular tenga un deber legal o contractual de permanecer en la base de datos, por ejemplo mientras haya órdenes o reclamos en curso o datos que deban conservarse por obligaciones contables o tributarias.",
      ],
    },
    {
      titulo: "Almacenamiento local en el navegador",
      bloques: [
        "La Plataforma guarda en el navegador del usuario la información necesaria para mantener la sesión iniciada y recordar preferencias, como el tema claro u oscuro y el estado del menú lateral. No usa cookies de publicidad ni herramientas de seguimiento de terceros. El usuario puede borrar esta información desde la configuración de su navegador; si lo hace, tendrá que iniciar sesión de nuevo.",
      ],
    },
    {
      titulo: "Seguridad y conservación",
      bloques: [
        "Zarpi aplica medidas técnicas, humanas y administrativas para proteger los datos: conexiones cifradas (HTTPS), contraseñas y códigos de verificación almacenados cifrados, control de acceso por roles y copias de seguridad periódicas.",
        "Los datos se conservan mientras la cuenta esté activa y, después, durante el tiempo necesario para cumplir las finalidades descritas, atender reclamos y cumplir obligaciones legales. Las copias de seguridad se renuevan de forma periódica y las más antiguas se eliminan.",
      ],
    },
    {
      titulo: "Autorización",
      bloques: [
        "Al registrarse y marcar la casilla de aceptación, el titular autoriza de forma previa, expresa e informada el tratamiento de sus datos conforme a esta política. La autorización para recibir información comercial se pide en una casilla aparte y es opcional. Zarpi conserva el registro de la fecha y la versión de la política aceptada.",
      ],
    },
    {
      titulo: "Vigencia y cambios",
      bloques: [
        "Esta política rige desde el 5 de octubre de 2026. Los cambios sustanciales se comunicarán a los titulares por correo o dentro de la Plataforma antes de aplicarse. Las bases de datos estarán vigentes mientras Zarpi preste sus servicios.",
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// POLÍTICA DE PAGOS, CANCELACIONES Y REEMBOLSOS
// ─────────────────────────────────────────────────────────────────────────────
const POLITICA_PAGOS: LegalDocument = {
  titulo: "Política de Pagos, Cancelaciones y Reembolsos",
  resumen: `Qué cobra Zarpi, cómo se paga con ${EMPRESA.pasarela} y cuándo procede el retracto, la reversión o el reembolso.`,
  version: LEGAL_VERSION,
  vigenteDesde: LEGAL_VIGENTE_DESDE,
  tituloDatos: "Datos del prestador del servicio",
  secciones: [
    {
      titulo: "Alcance",
      bloques: [
        `Esta política aplica a los pagos que los usuarios hacen a ${EMPRESA.razonSocial} (NIT ${EMPRESA.nit}) por los servicios de la Plataforma Zarpi.`,
        "No aplica al pago de la mercancía ni de los demás conceptos de cada operación, que el solicitante acuerda y paga directamente a la empresa importadora. Zarpi no recibe esos dineros, así que las devoluciones, garantías y reclamos sobre ellos se dirigen a la empresa importadora, sin perjuicio del acompañamiento que Zarpi presta a través del reporte de problemas.",
      ],
    },
    {
      titulo: "Servicios que cobra Zarpi",
      bloques: [
        "Para solicitantes:",
        [
          "La primera solicitud de cotización de cada mes calendario es gratuita.",
          "Cada solicitud de cotización adicional dentro del mismo mes cuesta COP 40.000, IVA incluido.",
          "Quien declara en la Plataforma el cierre de una operación con una empresa importadora recibe seis (6) meses de solicitudes de cotización sin costo.",
        ],
        "Para empresas importadoras:",
        [
          "Una comisión del cinco por ciento (5 %) sobre el valor total, antes de IVA, que la empresa le factura al solicitante en cada operación cerrada a través de la Plataforma.",
          "La comisión se descuenta de un saldo prepagado (bolsa) que la empresa recarga y que solo se usa para pagar los servicios de Zarpi.",
          "Las condiciones particulares de cada empresa, incluido el Founders Program, constan en el contrato de vinculación que firma con Zarpi, que prevalece sobre esta política en lo que regule de forma distinta.",
        ],
        "Zarpi puede ofrecer periodos sin cobro o promociones. En todo caso, el valor que se muestra antes de confirmar el pago es el que se cobra.",
      ],
    },
    {
      titulo: "Medios de pago y procesamiento",
      bloques: [
        `Los pagos se procesan a través de ${EMPRESA.pasarela}, pasarela de pagos, con los medios que esta habilite (tarjetas de crédito y débito, PSE y Nequi, entre otros). Todos los valores se expresan y cobran en pesos colombianos (COP). Zarpi no cobra recargos por el medio de pago elegido.`,
        `Los datos de la tarjeta o de la cuenta bancaria los ingresa el usuario directamente en el entorno seguro de ${EMPRESA.pasarela}. Zarpi no los conoce ni los almacena.`,
        `El servicio se activa cuando ${EMPRESA.pasarela} confirma el pago aprobado. Si el pago es rechazado o queda pendiente, el servicio no se activa y el usuario puede intentarlo de nuevo.`,
        "Zarpi expedirá la factura electrónica correspondiente a cada pago, conforme a la normativa de la DIAN, y la enviará al correo registrado.",
      ],
    },
    {
      titulo: "Derecho de retracto",
      bloques: [
        "Conforme al artículo 47 de la Ley 1480 de 2011, el solicitante que paga por una solicitud de cotización puede retractarse dentro de los cinco (5) días hábiles siguientes al pago, siempre que la solicitud no se haya enviado todavía a ninguna empresa importadora.",
        "Una vez la solicitud se envía o asigna a una o más empresas, la prestación del servicio ha comenzado con el acuerdo del solicitante y, por lo tanto, no procede el retracto, según la excepción prevista en el mismo artículo.",
        `Para ejercer el retracto basta escribir a ${EMPRESA.correo} indicando la referencia del pago. Zarpi devolverá la totalidad del dinero, sin descuentos, dentro de los treinta (30) días calendario siguientes, por el mismo medio de pago cuando sea posible.`,
      ],
    },
    {
      titulo: "Reversión del pago",
      bloques: [
        "Conforme al artículo 51 de la Ley 1480 de 2011 y al Decreto 587 de 2016 (compilado en el Decreto Único Reglamentario 1074 de 2015), el usuario puede pedir la reversión del pago hecho con tarjeta de crédito, débito o cualquier instrumento de pago electrónico cuando:",
        [
          "Fue víctima de fraude.",
          "La operación no fue solicitada por él.",
          "El servicio pagado no se prestó.",
          "El servicio prestado no corresponde a lo solicitado o es defectuoso.",
        ],
        `Para ello debe presentar la queja a Zarpi, al correo ${EMPRESA.correo}, dentro de los cinco (5) días hábiles siguientes a la fecha en que tuvo noticia del fraude o de la operación no solicitada, o a la fecha en que debía prestarse el servicio, e informar en el mismo plazo a la entidad emisora de su instrumento de pago. Zarpi y la entidad emisora tramitarán la solicitud en los plazos que fija la ley.`,
      ],
    },
    {
      titulo: "Cancelaciones y reembolsos",
      bloques: [
        [
          "Error atribuible a Zarpi: si un pago se cobró dos veces, por un valor distinto al informado o por un servicio que no se activó, Zarpi devolverá la diferencia o la totalidad del pago.",
          "Error de una empresa importadora: si una solicitud pagada debe cancelarse y volver a crearse por un error que Zarpi determine atribuible a la empresa, la nueva solicitud no tendrá costo para el solicitante.",
          "Solicitudes sin propuestas: una solicitud que no recibe propuestas no da lugar a reembolso automático, porque el servicio consiste en publicarla y distribuirla a las empresas. Zarpi puede, a su criterio, conceder una nueva solicitud sin costo.",
          "Saldo prepagado de empresas importadoras: el saldo no consumido se reembolsa a la empresa cuando termina su vinculación con Zarpi, por transferencia bancaria a la cuenta que indique, dentro de los treinta (30) días calendario siguientes a la solicitud, salvo lo que disponga el contrato de vinculación.",
        ],
        "Los reembolsos se hacen por el mismo medio de pago cuando es posible, o por transferencia a una cuenta bancaria a nombre del titular del pago, y se tramitan dentro de los treinta (30) días calendario siguientes a su aprobación. El tiempo en que el dinero se ve reflejado depende de la entidad financiera.",
      ],
    },
    {
      titulo: "Cómo solicitarlo",
      bloques: [
        `Cualquier solicitud de retracto, reversión, cancelación o reembolso se presenta por la sección de Ayuda y Soporte de la Plataforma o al correo ${EMPRESA.correo}, con el nombre del titular, el correo de la cuenta, la referencia o fecha del pago y el motivo. Zarpi enviará una constancia de recibo y responderá dentro de los quince (15) días hábiles siguientes.`,
        "Si el usuario no queda satisfecho con la respuesta, puede acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co).",
      ],
    },
  ],
};

export const DOCUMENTOS_LEGALES: Record<LegalPage, LegalDocument> = {
  terms: TERMINOS,
  data: POLITICA_DATOS,
  payments: POLITICA_PAGOS,
};

/** Orden en que se enlazan los documentos entre sí y en los pies de página. */
export const ORDEN_DOCUMENTOS: LegalPage[] = ["terms", "data", "payments"];
