#!/usr/bin/env python3
"""
Seed completo de la base de datos local de ImportacionesQ8.

Crea empresas importadoras, asesores, cursos LMS, cotizaciones, propuestas,
conversaciones de chat y notificaciones vinculadas al usuario principal
ya registrado

Uso:
    cd proyecto/backend
    python scripts/seed_full.py
"""

import sys
import os

# ---------------------------------------------------------------------------
# Asegura que el directorio raíz del backend esté en el path de importación
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from uuid import uuid4
from datetime import datetime, timedelta

from database import SessionLocal
from models.usuario import Usuario
from models.importador import Importador
from models.cotizacion import Cotizacion
from models.propuesta import Propuesta
from models.chat import ConversacionChat, MensajeChat
from models.curso import (
    Curso, ModuloCurso, LeccionCurso, RecursoLeccion, CompraCurso, ProgresoLeccion,
)
from models.notificacion import Notificacion
from utils.security import hash_password

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
MAIN_USER_EMAIL = "test@gmail.com"
TEST_PASSWORD = "TestPassword123!"

NOW = datetime.utcnow()


# ---------------------------------------------------------------------------
# Datos de las tres empresas importadoras
# ---------------------------------------------------------------------------
EMPRESAS = [
    {
        "nombre_empresa": "Logística Global S.A.",
        "especialidad_producto": ["Maquinaria Industrial", "Equipos de Construcción"],
        "paises_origen": ["China", "Alemania", "Japón"],
        "tiempo_respuesta_promedio": "12h",
        "calificacion_promedio": 4.8,
        "verificado": True,
        "dueno": {
            "email": "gerencia@logisticaglobal.com",
            "nombre": "Carlos",
            "apellido": "Mendoza",
            "telefono": "+573001234567",
        },
        "asesores": [
            {
                "email": "asesor1@logisticaglobal.com",
                "nombre": "Ana",
                "apellido": "Ruiz",
                "telefono": "+573009876543",
            }
        ],
    },
    {
        "nombre_empresa": "Asia-Latam Imports",
        "especialidad_producto": ["Textiles", "Confección", "Calzado"],
        "paises_origen": ["China", "Vietnam", "Bangladesh"],
        "tiempo_respuesta_promedio": "24h",
        "calificacion_promedio": 4.5,
        "verificado": True,
        "dueno": {
            "email": "direccion@asialatam.co",
            "nombre": "Laura",
            "apellido": "Castillo",
            "telefono": "+573115554433",
        },
        "asesores": [
            {
                "email": "comercial@asialatam.co",
                "nombre": "Diego",
                "apellido": "Vargas",
                "telefono": "+573223334455",
            }
        ],
    },
    {
        "nombre_empresa": "Aduanas & Carga Express",
        "especialidad_producto": ["Electrónica de Consumo", "Tecnología", "Componentes Eléctricos"],
        "paises_origen": ["China", "Taiwan", "Corea del Sur"],
        "tiempo_respuesta_promedio": "6h",
        "calificacion_promedio": 4.9,
        "verificado": True,
        "dueno": {
            "email": "admin@aduanasycarga.co",
            "nombre": "Roberto",
            "apellido": "Palacios",
            "telefono": "+573128889900",
        },
        "asesores": [
            {
                "email": "ventas@aduanasycarga.co",
                "nombre": "Valentina",
                "apellido": "Torres",
                "telefono": "+573204445566",
            }
        ],
    },
]

# ---------------------------------------------------------------------------
# Datos de los cursos LMS
# ---------------------------------------------------------------------------
CURSOS_DATA = [
    {
        "slug": "incoterms-2020-guia-completa",
        "titulo": "Incoterms 2020: Guía Completa para Importadores",
        "descripcion": (
            "Domina los 11 Incoterms 2020 y aprende a elegir el término correcto "
            "para cada operación de comercio exterior. Incluye casos prácticos con "
            "proveedores asiáticos y europeos."
        ),
        "portada_url": "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800",
        "precio": 149000.0,
        "nivel": "Principiante",
        "categoria": "Incoterms 2020",
        "empresa_idx": 0,  # Logística Global
        "modulos": [
            {
                "titulo": "Fundamentos del Comercio Exterior",
                "lecciones": [
                    {"titulo": "¿Qué es un Incoterm?", "duracion": "12 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "es_preview": True},
                    {"titulo": "Historia y evolución: de 1936 a 2020", "duracion": "8 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                ],
            },
            {
                "titulo": "Grupo E y F: Entrega en Origen",
                "lecciones": [
                    {"titulo": "EXW – Ex Works", "duracion": "15 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "FCA – Free Carrier", "duracion": "14 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "FOB – Free On Board", "duracion": "18 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                ],
                "recursos": [
                    {"nombre": "Tabla comparativa Grupo E-F.pdf", "url": "https://example.com/docs/incoterms-ef.pdf", "tipo": "archivo"},
                ],
            },
            {
                "titulo": "Grupo C y D: Entrega en Destino",
                "lecciones": [
                    {"titulo": "CIF – Cost Insurance Freight", "duracion": "16 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "DDP – Delivered Duty Paid", "duracion": "20 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "Ejercicio práctico: elige el Incoterm correcto", "duracion": "25 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                ],
                "recursos": [
                    {"nombre": "Checklist Incoterms 2020.pdf", "url": "https://example.com/docs/checklist-incoterms.pdf", "tipo": "checklist"},
                    {"nombre": "Plantilla de evaluación de riesgo.xlsx", "url": "https://example.com/docs/plantilla-riesgo.xlsx", "tipo": "plantilla"},
                ],
            },
        ],
        "comprado_por_main": True,
        "lecciones_completadas_main": 3,  # Completa las primeras N lecciones
    },
    {
        "slug": "logistica-maritima-internacional",
        "titulo": "Logística Marítima Internacional: Del Puerto al Almacén",
        "descripcion": (
            "Aprende cómo funciona el transporte marítimo de carga: tipos de contenedores, "
            "proceso de despacho aduanero en Colombia, documentos de embarque (BL, packing list, "
            "factura comercial) y cómo reducir costos de flete."
        ),
        "portada_url": "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=800",
        "precio": 199000.0,
        "nivel": "Avanzado",
        "categoria": "Logística Marítima",
        "empresa_idx": 2,  # Aduanas & Carga Express
        "modulos": [
            {
                "titulo": "El Sistema Portuario Global",
                "lecciones": [
                    {"titulo": "Principales puertos del mundo", "duracion": "10 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "es_preview": True},
                    {"titulo": "Puertos colombianos: Buenaventura, Cartagena, Barranquilla", "duracion": "14 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                ],
            },
            {
                "titulo": "Documentos de Embarque",
                "lecciones": [
                    {"titulo": "Bill of Lading (BL): tipos y función", "duracion": "20 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "Packing List y Factura Comercial", "duracion": "12 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "Certificado de Origen", "duracion": "9 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                ],
                "recursos": [
                    {"nombre": "Modelo de Factura Comercial.docx", "url": "https://example.com/docs/factura-comercial.docx", "tipo": "plantilla"},
                    {"nombre": "Guía de documentos de exportación.pdf", "url": "https://example.com/docs/guia-documentos.pdf", "tipo": "guia"},
                ],
            },
        ],
        "comprado_por_main": False,
    },
    {
        "slug": "importacion-china-paso-a-paso",
        "titulo": "Importar desde China: Guía Paso a Paso para Colombia",
        "descripcion": (
            "Todo lo que necesitas saber para importar exitosamente desde China: "
            "cómo encontrar proveedores verificados en Alibaba, negociar precios, "
            "calcular costos totales de importación (DAI, IVA, fletes) y evitar fraudes."
        ),
        "portada_url": "https://images.unsplash.com/photo-1547893583-1c37c31b4adb?w=800",
        "precio": 249000.0,
        "nivel": "Principiante",
        "categoria": "Comercio Exterior",
        "empresa_idx": 1,  # Asia-Latam Imports
        "modulos": [
            {
                "titulo": "Encontrar Proveedores Confiables",
                "lecciones": [
                    {"titulo": "Alibaba vs 1688 vs Made-in-China", "duracion": "18 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "es_preview": True},
                    {"titulo": "Cómo verificar un proveedor: Gold Supplier y Trade Assurance", "duracion": "22 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "Negociación de muestras y MOQ", "duracion": "15 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                ],
                "recursos": [
                    {"nombre": "Plantilla de evaluación de proveedores.xlsx", "url": "https://example.com/docs/eval-proveedores.xlsx", "tipo": "plantilla"},
                ],
            },
            {
                "titulo": "Cálculo de Costos de Importación",
                "lecciones": [
                    {"titulo": "DAI (Derecho de Aduana) y clasificación arancelaria", "duracion": "25 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "IVA de importación y retenciones", "duracion": "18 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "Simulador de costos CIF Bogotá", "duracion": "30 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                ],
                "recursos": [
                    {"nombre": "Calculadora de costos de importación.xlsx", "url": "https://example.com/docs/calculadora.xlsx", "tipo": "plantilla"},
                    {"nombre": "Guía arancelaria Colombia 2024.pdf", "url": "https://example.com/docs/arancel.pdf", "tipo": "guia"},
                ],
            },
        ],
        "comprado_por_main": False,
    },
    {
        "slug": "gestion-aduanera-colombia",
        "titulo": "Gestión Aduanera en Colombia: DIAN y Declaraciones",
        "descripcion": (
            "Curso especializado en el proceso aduanero colombiano: régimen de importación, "
            "declaración de importación (DI), roles de la agencia de aduanas, inspecciones "
            "físicas y documental, y levante automático de mercancías."
        ),
        "portada_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        "precio": 179000.0,
        "nivel": "Avanzado",
        "categoria": "Comercio Exterior",
        "empresa_idx": 0,  # Logística Global
        "modulos": [
            {
                "titulo": "El Sistema Aduanero Colombiano",
                "lecciones": [
                    {"titulo": "DIAN: estructura y funciones", "duracion": "11 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "es_preview": True},
                    {"titulo": "Regímenes de importación: ordinario, temporal, tránsito", "duracion": "19 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                ],
            },
            {
                "titulo": "Declaración de Importación",
                "lecciones": [
                    {"titulo": "Contenido y campos de la DI", "duracion": "23 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "Errores comunes y cómo evitarlos", "duracion": "17 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    {"titulo": "Levante automático vs. inspección selectiva", "duracion": "14 min", "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                ],
                "recursos": [
                    {"nombre": "Checklist Declaración de Importación.pdf", "url": "https://example.com/docs/checklist-di.pdf", "tipo": "checklist"},
                    {"nombre": "Guía de errores aduaneros.pdf", "url": "https://example.com/docs/errores-aduaneros.pdf", "tipo": "guia"},
                ],
            },
        ],
        "comprado_por_main": False,
    },
]

# ---------------------------------------------------------------------------
# Datos de cotizaciones del usuario principal
# ---------------------------------------------------------------------------
COTIZACIONES_DATA = [
    {
        "nombre_producto": "Maquinaria CNC para madera",
        "descripcion_cliente": (
            "Necesito importar 2 máquinas CNC router de 4 ejes para trabajo en madera y MDF. "
            "Potencia mínima 3kW por husillo. Incluir mesa de vacío de 1300x2500mm. "
            "Requiero soporte técnico post-venta y manuales en español."
        ),
        "pais_importacion": "China",
        "linea_producto": "Maquinaria Industrial",
        "tipo_calidad": "estandar",
        "cantidad_minima": 2,
        "precio_objetivo_usd": 8500.0,
        "incoterm": "CIF",
        "modalidad": "abierta",
        "notas_adicionales": "Entrega en Bogotá. Se requiere certificación CE.",
        "estado": "propuestas_recibidas",
        "empresa_idx": 0,  # Propuesta de Logística Global
    },
    {
        "nombre_producto": "Ropa deportiva (poliéster reciclado)",
        "descripcion_cliente": (
            "Importación de 500 docenas de ropa deportiva para mujer: leggings y tops. "
            "Tela: 80% poliéster reciclado, 20% spandex. Tallas XS-XL. "
            "Necesito muestras previas con etiquetado personalizado (marca propia)."
        ),
        "pais_importacion": "Vietnam",
        "linea_producto": "Textiles",
        "tipo_calidad": "premium",
        "cantidad_minima": 500,
        "precio_objetivo_usd": 4.5,
        "incoterm": "FOB",
        "modalidad": "abierta",
        "nivel_personalizacion": "personalizacion_marca",
        "notas_adicionales": "Colores: negro, azul marino, coral. Se acepta pedido mínimo por color.",
        "estado": "propuestas_recibidas",
        "empresa_idx": 1,  # Propuesta de Asia-Latam
    },
    {
        "nombre_producto": "Smartphones reacondicionados Android",
        "descripcion_cliente": (
            "Busco proveedor de smartphones Android reacondicionados grado A/B. "
            "Modelos: Samsung Galaxy S21/S22 o equivalente. Batería mínima 85% de salud. "
            "Lote inicial de 200 unidades con garantía de 6 meses."
        ),
        "pais_importacion": "China",
        "linea_producto": "Electrónica",
        "tipo_calidad": "estandar",
        "cantidad_minima": 200,
        "precio_objetivo_usd": 180.0,
        "incoterm": "DDP",
        "modalidad": "abierta",
        "notas_adicionales": "Requiero certificación de FCC/CE. Despacho a Medellín.",
        "estado": "propuestas_recibidas",
        "empresa_idx": 2,  # Propuesta de Aduanas & Carga
    },
    {
        "nombre_producto": "Muebles de oficina modulares",
        "descripcion_cliente": (
            "Amoblamiento completo para oficina de 40 puestos: escritorios en L, sillas ergonómicas "
            "certificadas BIFMA, divisiones modulares y archivadores metálicos. "
            "Material: melanina 18mm con cantos ABS. Color: blanco / gris oscuro."
        ),
        "pais_importacion": "China",
        "linea_producto": "Muebles y Decoración",
        "tipo_calidad": "estandar",
        "cantidad_minima": 40,
        "precio_objetivo_usd": 320.0,
        "incoterm": "CIF",
        "modalidad": "abierta",
        "notas_adicionales": "Incluir servicio de instalación en Bogotá o cotización por separado.",
        "estado": "creada",
        "empresa_idx": None,  # Sin propuesta aún
    },
]

# ---------------------------------------------------------------------------
# Mensajes de chat por cotización (índice alineado con COTIZACIONES_DATA)
# ---------------------------------------------------------------------------
CHAT_MESSAGES = [
    # Cotización 0 - Maquinaria CNC
    [
        ("asesor", "Hola Juan Samuel, recibimos tu solicitud de cotización para las máquinas CNC. Tenemos excelentes proveedores en Guangdong con experiencia en equipos para carpintería. ¿Tienes preferencia de marca?"),
        ("main", "Hola! Preferiría marcas como Biesse o Homag, pero estoy abierto a marcas chinas de calidad como BEKE o IGOLDEN si el precio lo justifica."),
        ("asesor", "Perfecto. Trabajamos con IGOLDEN y CNC-STEP, ambas con certificación CE. El tiempo de fabricación es de 45 días más 25 días de tránsito marítimo. ¿El precio objetivo de USD 8,500 es por unidad?"),
        ("main", "Sí, es por unidad incluyendo flete hasta Bogotá (CIF). ¿Es alcanzable ese precio con las especificaciones que mencioné?"),
        ("asesor", "Para el modelo que describes (4 ejes, mesa de vacío 1300x2500), el precio realista estaría entre USD 9,200 y USD 10,500 CIF Bogotá. Podemos trabajar en ajustar las especificaciones para acercarnos a tu objetivo."),
        ("main", "Entiendo. Podríamos negociar la mesa a 1200x2400 y prescindir del cuarto eje inicialmente. ¿Eso bajaría el precio?"),
        ("asesor", "Sí, con esos ajustes podemos llegar a USD 8,800 por unidad. Te envío la propuesta formal hoy."),
    ],
    # Cotización 1 - Ropa deportiva
    [
        ("asesor", "Buenos días Juan Samuel. Somos especialistas en importaciones textiles desde Vietnam y Bangladesh. Para las 500 docenas de ropa deportiva con poliéster reciclado, ¿ya tienes el diseño técnico (ficha técnica)?"),
        ("main", "Hola Diego! Tengo el diseño pero en boceto. ¿Pueden ayudarme con la ficha técnica final o necesito contratar un diseñador?"),
        ("asesor", "Nosotros coordinamos la ficha técnica con el proveedor sin costo adicional. El proceso sería: 1) Revisión de tu boceto, 2) Muestra digital (7 días), 3) Muestra física (21 días). ¿Puedes enviarme el boceto?"),
        ("main", "Claro, te lo envío por correo. Una pregunta: ¿el proveedor puede manejar empaque con mi marca (hang tags, bolsas con logo)?"),
        ("asesor", "Sí, el empaque personalizado está incluido en la propuesta. El costo adicional por hang tags y bolsas impresas es aproximadamente USD 0.15 por prenda. Te detallo todo en la propuesta."),
    ],
    # Cotización 2 - Smartphones
    [
        ("asesor", "Hola Juan Samuel, soy Valentina de Aduanas & Carga Express. Para la importación de 200 smartphones reacondicionados, necesito verificar contigo algunos puntos clave para evitar problemas en aduana."),
        ("main", "Hola Valentina, claro. ¿Qué información necesitas?"),
        ("asesor", "Primero: ¿serán para reventa o uso corporativo? Esto define el régimen aduanero y los documentos requeridos. Segundo: ¿tienes RUT activo y resolución de importación? Para la DIAN los teléfonos tienen control especial (IMEI)."),
        ("main", "Son para reventa. Tengo RUT activo pero no tengo experiencia en el registro de IMEIs. ¿Pueden asesorarme en ese proceso?"),
        ("asesor", "Por supuesto, incluimos la gestión de IMEIs ante el MINTIC como parte del servicio. El proceso toma aproximadamente 15 días hábiles adicionales. Ya incluyo eso en la propuesta con el costo desglosado."),
        ("main", "Perfecto, gracias. ¿Cuánto tiempo estiman para tener la mercancía en Medellín desde que confirme la orden?"),
        ("asesor", "Desde confirmación hasta entrega en Medellín: 35-45 días hábiles. Esto incluye fabricación/acondicionamiento, flete marítimo, desaduanamiento en Cartagena y transporte terrestre. Te doy el cronograma detallado."),
    ],
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _existe_importador(db, nombre_empresa: str) -> bool:
    return db.query(Importador).filter(Importador.nombre_empresa == nombre_empresa).first() is not None


def _existe_usuario(db, email: str) -> bool:
    return db.query(Usuario).filter(Usuario.email == email).first() is not None


def _get_usuario(db, email: str):
    return db.query(Usuario).filter(Usuario.email == email).first()


def _get_importador(db, nombre_empresa: str):
    return db.query(Importador).filter(Importador.nombre_empresa == nombre_empresa).first()


# ---------------------------------------------------------------------------
# Funciones de creación
# ---------------------------------------------------------------------------

def crear_empresas_y_asesores(db) -> list[dict]:
    """Crea o recupera las 3 empresas importadoras con sus dueños y asesores."""
    created = []
    for emp_data in EMPRESAS:
        nombre = emp_data["nombre_empresa"]

        # Empresa
        importador = _get_importador(db, nombre)
        if importador is None:
            importador = Importador(
                id=str(uuid4()),
                nombre_empresa=nombre,
                especialidad_producto=emp_data["especialidad_producto"],
                paises_origen=emp_data["paises_origen"],
                calificacion_promedio=emp_data["calificacion_promedio"],
                tiempo_respuesta_promedio=emp_data["tiempo_respuesta_promedio"],
                estado="activo",
                verificado=emp_data.get("verificado", False),
                fecha_registro=NOW - timedelta(days=180),
            )
            db.add(importador)
            db.flush()  # Obtener el ID antes de crear usuarios
            print(f"  [+] Empresa: {nombre}")
        else:
            print(f"  [~] Empresa ya existe: {nombre}")

        # Dueño de la empresa
        dueno_data = emp_data["dueno"]
        dueno = _get_usuario(db, dueno_data["email"])
        if dueno is None:
            dueno = Usuario(
                id=str(uuid4()),
                email=dueno_data["email"],
                password_hash=hash_password(TEST_PASSWORD),
                rol="importador",
                nombre=dueno_data["nombre"],
                apellido=dueno_data["apellido"],
                telefono=dueno_data.get("telefono"),
                importador_id=importador.id,
                activo=True,
                email_verificado=True,
                perfil_completo=True,
                acepto_politica_datos=True,
                fecha_aceptacion_politica=NOW - timedelta(days=180),
                creditos_balance=0,
                fecha_creacion=NOW - timedelta(days=180),
            )
            db.add(dueno)
            print(f"      [+] Dueño: {dueno_data['email']}")
        else:
            print(f"      [~] Dueño ya existe: {dueno_data['email']}")
            dueno.importador_id = importador.id

        # Asesores
        asesores = []
        for as_data in emp_data["asesores"]:
            asesor = _get_usuario(db, as_data["email"])
            if asesor is None:
                asesor = Usuario(
                    id=str(uuid4()),
                    email=as_data["email"],
                    password_hash=hash_password(TEST_PASSWORD),
                    rol="asesor",
                    nombre=as_data["nombre"],
                    apellido=as_data["apellido"],
                    telefono=as_data.get("telefono"),
                    importador_id=importador.id,
                    activo=True,
                    email_verificado=True,
                    perfil_completo=True,
                    acepto_politica_datos=True,
                    fecha_aceptacion_politica=NOW - timedelta(days=120),
                    creditos_balance=0,
                    fecha_creacion=NOW - timedelta(days=120),
                )
                db.add(asesor)
                print(f"      [+] Asesor: {as_data['email']}")
            else:
                print(f"      [~] Asesor ya existe: {as_data['email']}")
                asesor.importador_id = importador.id
            asesores.append(asesor)

        db.flush()
        created.append({
            "importador": importador,
            "dueno": dueno,
            "asesores": asesores,
        })

    return created


def crear_cursos(db, empresas_info: list[dict], main_user_id: str) -> list:
    """Crea cursos LMS, compra e inscripción del usuario principal."""
    cursos_creados = []
    for curso_data in CURSOS_DATA:
        # Comprobar si el slug ya existe
        curso_existente = db.query(Curso).filter(Curso.slug == curso_data["slug"]).first()
        if curso_existente:
            print(f"  [~] Curso ya existe: {curso_data['titulo'][:50]}")
            cursos_creados.append(curso_existente)
            continue

        empresa_info = empresas_info[curso_data["empresa_idx"]]
        importador = empresa_info["importador"]
        dueno = empresa_info["dueno"]

        curso = Curso(
            id=str(uuid4()),
            slug=curso_data["slug"],
            titulo=curso_data["titulo"],
            descripcion=curso_data["descripcion"],
            portada_url=curso_data.get("portada_url"),
            precio=curso_data["precio"],
            nivel=curso_data["nivel"],
            categoria=curso_data["categoria"],
            importador_id=importador.id,
            creado_por_usuario_id=dueno.id,
            rating=4.7,
            estudiantes_count=0,
            estado="publicado",
            fecha_creacion=NOW - timedelta(days=60),
        )
        db.add(curso)
        db.flush()

        # Módulos, lecciones y recursos
        todas_las_lecciones = []
        for mod_idx, mod_data in enumerate(curso_data["modulos"]):
            modulo = ModuloCurso(
                id=str(uuid4()),
                curso_id=curso.id,
                titulo=mod_data["titulo"],
                orden=mod_idx,
            )
            db.add(modulo)
            db.flush()

            for lec_idx, lec_data in enumerate(mod_data["lecciones"]):
                leccion = LeccionCurso(
                    id=str(uuid4()),
                    modulo_id=modulo.id,
                    curso_id=curso.id,
                    titulo=lec_data["titulo"],
                    duracion=lec_data["duracion"],
                    video_url=lec_data["video_url"],
                    orden=lec_idx,
                    es_preview=lec_data.get("es_preview", False),
                )
                db.add(leccion)
                db.flush()
                todas_las_lecciones.append(leccion)

                # Recursos de módulo (se adjuntan a la primera lección del módulo con recursos)
                for rec_data in mod_data.get("recursos", []):
                    recurso = RecursoLeccion(
                        id=str(uuid4()),
                        leccion_id=leccion.id,
                        nombre=rec_data["nombre"],
                        url=rec_data["url"],
                        tipo=rec_data["tipo"],
                    )
                    db.add(recurso)

        # Compra del usuario principal si aplica
        if curso_data.get("comprado_por_main"):
            compra_existente = db.query(CompraCurso).filter(
                CompraCurso.curso_id == curso.id,
                CompraCurso.usuario_id == main_user_id,
            ).first()
            if compra_existente is None:
                compra = CompraCurso(
                    id=str(uuid4()),
                    curso_id=curso.id,
                    usuario_id=main_user_id,
                    precio_pagado=curso_data["precio"],
                    fecha_compra=NOW - timedelta(days=15),
                )
                db.add(compra)
                print(f"      [+] Compra registrada para usuario principal")

            # Progreso parcial: marca las primeras N lecciones como completadas
            n_completadas = curso_data.get("lecciones_completadas_main", 0)
            for i, leccion in enumerate(todas_las_lecciones[:n_completadas]):
                progreso_existente = db.query(ProgresoLeccion).filter(
                    ProgresoLeccion.usuario_id == main_user_id,
                    ProgresoLeccion.leccion_id == leccion.id,
                ).first()
                if progreso_existente is None:
                    progreso = ProgresoLeccion(
                        id=str(uuid4()),
                        usuario_id=main_user_id,
                        curso_id=curso.id,
                        leccion_id=leccion.id,
                        completada=True,
                        fecha_completado=NOW - timedelta(days=14 - i),
                        fecha_ultima_vista=NOW - timedelta(days=14 - i),
                    )
                    db.add(progreso)

        print(f"  [+] Curso: {curso_data['titulo'][:60]}")
        cursos_creados.append(curso)

    db.flush()
    return cursos_creados


def crear_cotizaciones_y_propuestas(db, empresas_info: list[dict], main_user_id: str) -> list[dict]:
    """Crea cotizaciones y propuestas de las empresas."""
    cotizaciones_creadas = []

    for i, cot_data in enumerate(COTIZACIONES_DATA):
        # Verificar si ya existe una cotización con ese nombre de producto para el usuario
        existente = db.query(Cotizacion).filter(
            Cotizacion.solicitante_id == main_user_id,
            Cotizacion.nombre_producto == cot_data["nombre_producto"],
        ).first()

        if existente:
            print(f"  [~] Cotización ya existe: {cot_data['nombre_producto'][:50]}")
            cotizaciones_creadas.append({"cotizacion": existente, "empresa_idx": cot_data.get("empresa_idx")})
            continue

        cotizacion = Cotizacion(
            id=str(uuid4()),
            solicitante_id=main_user_id,
            modalidad=cot_data["modalidad"],
            pais_importacion=cot_data["pais_importacion"],
            nombre_producto=cot_data["nombre_producto"],
            descripcion_cliente=cot_data["descripcion_cliente"],
            linea_producto=cot_data["linea_producto"],
            tipo_calidad=cot_data["tipo_calidad"],
            cantidad_minima=cot_data["cantidad_minima"],
            precio_objetivo_usd=cot_data.get("precio_objetivo_usd"),
            incoterm=cot_data["incoterm"],
            nivel_personalizacion=cot_data.get("nivel_personalizacion"),
            notas_adicionales=cot_data.get("notas_adicionales"),
            estado=cot_data["estado"],
            costo_creditos=5.0,
            fecha_creacion=NOW - timedelta(days=30 - i * 5),
            fecha_actualizacion=NOW - timedelta(days=28 - i * 5),
        )

        # Asignar asesor si hay empresa designada
        empresa_idx = cot_data.get("empresa_idx")
        if empresa_idx is not None:
            empresa_info = empresas_info[empresa_idx]
            asesor = empresa_info["asesores"][0] if empresa_info["asesores"] else empresa_info["dueno"]
            cotizacion.asesor_asignado_id = asesor.id
            cotizacion.importador_id = empresa_info["importador"].id

        db.add(cotizacion)
        db.flush()
        print(f"  [+] Cotización: {cot_data['nombre_producto'][:50]}")

        # Propuesta formal de la empresa
        if empresa_idx is not None and cot_data["estado"] == "propuestas_recibidas":
            empresa_info = empresas_info[empresa_idx]
            importador = empresa_info["importador"]
            asesor = empresa_info["asesores"][0] if empresa_info["asesores"] else empresa_info["dueno"]

            precio_base = cot_data.get("precio_objetivo_usd", 500.0)
            precio_propuesto = round(precio_base * 1.08, 2)  # 8% sobre precio objetivo

            propuesta_existente = db.query(Propuesta).filter(
                Propuesta.cotizacion_id == cotizacion.id,
                Propuesta.importador_id == importador.id,
            ).first()

            if propuesta_existente is None:
                propuesta = Propuesta(
                    id=str(uuid4()),
                    cotizacion_id=cotizacion.id,
                    importador_id=importador.id,
                    precio_ofrecido_usd=precio_propuesto,
                    tiempo_estimado_entrega="45 días hábiles",
                    incoterm=cot_data["incoterm"],
                    condiciones_adicionales=(
                        f"Pago: 30% anticipo, 70% contra B/L. "
                        f"Seguro de carga incluido. Garantía de {importador.nombre_empresa}: "
                        f"12 meses por defectos de fabricación. "
                        f"Inspección de calidad pre-embarque sin costo adicional."
                    ),
                    estado="pendiente",
                    creado_por_usuario_id=asesor.id,
                    preaceptada_por_solicitante=False,
                    preaceptada_por_empresa=True,
                    fecha_envio=NOW - timedelta(days=25 - i * 5),
                )
                db.add(propuesta)
                db.flush()
                print(f"      [+] Propuesta de {importador.nombre_empresa}: USD {precio_propuesto:,.2f}")

        cotizaciones_creadas.append({"cotizacion": cotizacion, "empresa_idx": empresa_idx})

    return cotizaciones_creadas


def crear_chats(db, cotizaciones_info: list[dict], empresas_info: list[dict], main_user_id: str):
    """Crea conversaciones y mensajes de chat para las primeras 3 cotizaciones."""
    for i, cot_info in enumerate(cotizaciones_info[:3]):
        cotizacion = cot_info["cotizacion"]
        empresa_idx = cot_info["empresa_idx"]

        if empresa_idx is None:
            continue

        empresa_info = empresas_info[empresa_idx]
        asesor = empresa_info["asesores"][0] if empresa_info["asesores"] else empresa_info["dueno"]

        # Verificar si ya existe conversación
        conv_existente = db.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == cotizacion.id
        ).first()

        if conv_existente:
            print(f"  [~] Chat ya existe para: {cotizacion.nombre_producto[:40]}")
            continue

        conversacion = ConversacionChat(
            id=str(uuid4()),
            cotizacion_id=cotizacion.id,
            solicitante_id=main_user_id,
            importador_usuario_id=asesor.id,
            fecha_creacion=NOW - timedelta(days=27 - i * 5),
        )
        db.add(conversacion)
        db.flush()

        # Mensajes
        mensajes_data = CHAT_MESSAGES[i] if i < len(CHAT_MESSAGES) else []
        base_time = NOW - timedelta(days=27 - i * 5)

        for j, (remitente_key, contenido) in enumerate(mensajes_data):
            remitente_id = main_user_id if remitente_key == "main" else asesor.id
            mensaje = MensajeChat(
                id=str(uuid4()),
                conversacion_id=conversacion.id,
                remitente_id=remitente_id,
                contenido=contenido,
                tipo="texto",
                fecha_envio=base_time + timedelta(hours=j * 2),
            )
            db.add(mensaje)

        print(f"  [+] Chat ({len(mensajes_data)} mensajes): {cotizacion.nombre_producto[:40]}")

    db.flush()


def crear_notificaciones(db, main_user_id: str, cotizaciones_info: list[dict], cursos_info: list):
    """Crea notificaciones recientes no leídas para el usuario principal."""
    notifs = [
        {
            "tipo": "propuesta",
            "titulo": "Nueva propuesta recibida",
            "mensaje": "Logística Global S.A. ha enviado una propuesta para tu importación de Maquinaria CNC. Revisa los detalles y los términos de pago.",
            "data": {"cotizacion_id": cotizaciones_info[0]["cotizacion"].id if cotizaciones_info else None},
            "hace_dias": 0,
        },
        {
            "tipo": "propuesta",
            "titulo": "Propuesta lista para revisar",
            "mensaje": "Asia-Latam Imports envió su oferta para tu solicitud de ropa deportiva. Precio ofrecido: USD 4.86/prenda.",
            "data": {"cotizacion_id": cotizaciones_info[1]["cotizacion"].id if len(cotizaciones_info) > 1 else None},
            "hace_dias": 1,
        },
        {
            "tipo": "chat",
            "titulo": "Nuevo mensaje de Valentina Torres",
            "mensaje": "Valentina de Aduanas & Carga Express respondió tu consulta sobre la gestión de IMEIs. Revisa el chat.",
            "data": {"cotizacion_id": cotizaciones_info[2]["cotizacion"].id if len(cotizaciones_info) > 2 else None},
            "hace_dias": 0,
        },
        {
            "tipo": "curso",
            "titulo": "Continúa tu curso",
            "mensaje": "Retoma donde lo dejaste: 'CIF – Cost Insurance Freight' en Incoterms 2020. Llevas el 43% completado.",
            "data": {"curso_id": str(cursos_info[0].id) if cursos_info else None},
            "hace_dias": 2,
        },
        {
            "tipo": "cotizacion",
            "titulo": "Tu cotización fue publicada",
            "mensaje": "Tu solicitud de 'Muebles de oficina modulares' ya está visible para los importadores. Recibirás propuestas pronto.",
            "data": {"cotizacion_id": cotizaciones_info[3]["cotizacion"].id if len(cotizaciones_info) > 3 else None},
            "hace_dias": 3,
        },
        {
            "tipo": "sistema",
            "titulo": "Bienvenido a ImportacionesQ8",
            "mensaje": "Completa tu perfil para recibir mejores propuestas. Agrega tu documento de identidad y teléfono de contacto.",
            "data": None,
            "hace_dias": 7,
        },
    ]

    # Verificar si ya hay notificaciones para no duplicar
    conteo_existente = db.query(Notificacion).filter(Notificacion.usuario_id == main_user_id).count()
    if conteo_existente >= len(notifs):
        print(f"  [~] Notificaciones ya existen ({conteo_existente} registradas)")
        return

    for notif_data in notifs:
        notif = Notificacion(
            id=str(uuid4()),
            usuario_id=main_user_id,
            tipo=notif_data["tipo"],
            titulo=notif_data["titulo"],
            mensaje=notif_data["mensaje"],
            data=notif_data["data"],
            leida=False,
            fecha_creacion=NOW - timedelta(days=notif_data["hace_dias"]),
        )
        db.add(notif)

    print(f"  [+] {len(notifs)} notificaciones creadas")
    db.flush()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("  SEED COMPLETO - ImportacionesQ8")
    print("=" * 60)

    db = SessionLocal()
    try:
        # Verificar usuario principal
        main_user = _get_usuario(db, MAIN_USER_EMAIL)
        if main_user is None:
            print(f"\n[ERROR] El usuario principal no existe: {MAIN_USER_EMAIL}")
            print("  Ejecuta primero el registro desde la app o crea el usuario manualmente.")
            return

        print(f"\n[OK] Usuario principal encontrado: {MAIN_USER_EMAIL} (id={main_user.id})")

        # Asegurar que el usuario principal tenga email verificado y perfil completo
        if not main_user.email_verificado:
            main_user.email_verificado = True
            print("  [~] email_verificado actualizado a True")
        if not main_user.perfil_completo:
            main_user.perfil_completo = True
            print("  [~] perfil_completo actualizado a True")
        if not main_user.acepto_politica_datos:
            main_user.acepto_politica_datos = True
            main_user.fecha_aceptacion_politica = NOW
            print("  [~] acepto_politica_datos actualizado a True")

        db.flush()

        # 1. Empresas y asesores
        print("\n[1/5] Creando empresas importadoras y asesores...")
        empresas_info = crear_empresas_y_asesores(db)

        # 2. Cursos LMS
        print("\n[2/5] Creando cursos LMS...")
        cursos_info = crear_cursos(db, empresas_info, main_user.id)

        # 3. Cotizaciones y propuestas
        print("\n[3/5] Creando cotizaciones y propuestas...")
        cotizaciones_info = crear_cotizaciones_y_propuestas(db, empresas_info, main_user.id)

        # 4. Conversaciones y mensajes de chat
        print("\n[4/5] Creando chats y mensajes...")
        crear_chats(db, cotizaciones_info, empresas_info, main_user.id)

        # 5. Notificaciones
        print("\n[5/5] Creando notificaciones...")
        crear_notificaciones(db, main_user.id, cotizaciones_info, cursos_info)

        db.commit()

        # Resumen
        print("\n" + "=" * 60)
        print("  SEED COMPLETADO EXITOSAMENTE")
        print("=" * 60)
        print(f"  Usuario principal : {MAIN_USER_EMAIL}")
        print(f"  Empresas creadas  : {len(EMPRESAS)}")
        print(f"  Cursos LMS        : {len(CURSOS_DATA)}")
        print(f"  Cotizaciones      : {len(COTIZACIONES_DATA)}")
        print(f"  Contraseña tests  : {TEST_PASSWORD}")
        print("=" * 60)
        print("\nCuentas de prueba creadas:")
        for emp in EMPRESAS:
            print(f"  {emp['dueno']['email']}  /  {TEST_PASSWORD}  (importador)")
            for as_data in emp["asesores"]:
                print(f"  {as_data['email']}  /  {TEST_PASSWORD}  (asesor)")

    except Exception as exc:
        db.rollback()
        print(f"\n[ERROR] El seed falló: {exc}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
