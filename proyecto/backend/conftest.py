import sys
import os

# Crear directorio de base de datos si no existe (compatible con Windows y Linux/Docker)
if os.name == 'nt':  # Windows
    DB_DIR = r"C:\Users\akali\AppData\Local\Temp"
else:  # Linux/Mac/Docker
    DB_DIR = "/tmp"

os.makedirs(DB_DIR, exist_ok=True)

# Sobrescribir DATABASE_URL ANTES de importar cualquier módulo del proyecto
os.environ["DATABASE_URL"] = f"sqlite:///{DB_DIR}/test.db"
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-use-only!!")

# Secreto de eventos de Wompi usado en tests para firmar webhooks simulados
os.environ.setdefault("WOMPI_EVENTS_SECRET", "test_events_secret_for_ci")
# Límites de rate limiting altos en tests para no interferir con corridas repetidas de login/register
os.environ.setdefault("RATE_LIMIT_LOGIN", "1000/minute")
os.environ.setdefault("RATE_LIMIT_REGISTER", "1000/minute")
os.environ.setdefault("RATE_LIMIT_FORGOT_PASSWORD", "1000/minute")
os.environ.setdefault("RATE_LIMIT_OTP", "1000/minute")
os.environ.setdefault("LOGIN_TARDIO_HORAS", "72")
os.environ.setdefault("OTP_EXPIRE_MINUTES", "15")

import pytest
from uuid import uuid4
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Text, Integer, Float, JSON
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock

# Agregar el directorio del proyecto al path para imports
sys.path.insert(0, os.path.dirname(__file__))

from utils.security import hash_password, create_access_token

# Usar SQLite para tests (más rápido y no requiere MySQL)
# Nota: Usamos un archivo temporal en Windows porque /tmp no existe
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_DIR}/test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Sobrescribir la función get_db de database.py para usar SQLite en lugar de MySQL
def override_get_db():
    """Sobrescribe la dependencia get_db para usar SQLite"""
    try:
        yield TestingSessionLocal()
    finally:
        pass

# Importar Base desde database (después de sobrescribir DATABASE_URL)
from database import Base, get_db as _get_db

# Sobrescribir la dependencia get_db globalmente
import utils.dependencies as deps
deps.get_db = override_get_db

# Importar modelos ANTES de crear las tablas
from models.usuario import Usuario
from models.importador import Importador
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.orden import Orden, HistorialEstadosOrden, DocumentoOrden, EstadoOrden
from models.pago import Pago, EstadoPago
from models.campo_personalizado import CampoPersonalizado
from models.chat import ConversacionChat, MensajeChat
from models.password_reset import PasswordResetToken
from models.credito import MovimientoCredito
from models.solicitud_recreacion import SolicitudRecreacion
from models.jwt_blacklist import JwtBlacklist  # noqa: F401 — registra metadata
from models.otp import CodigoOtp  # noqa: F401
from models.curso import (  # noqa: F401 — registra metadata LMS
    Curso, ModuloCurso, LeccionCurso, RecursoLeccion, CompraCurso, ProgresoLeccion,
    CertificadoCurso,
)
from models.documental import (  # noqa: F401 — registra metadata de gestión documental
    Archivo, ArchivoEtiqueta, Carpeta, CursoRecurso, Etiqueta, Favorito,
    MensajeAdjunto, OrdenDocumento,
)
from models.certificacion import Certificacion, CertificacionImportador  # noqa: F401
from models.notificacion import Notificacion  # noqa: F401

# Crear tablas en la base de datos de test (después de importar los modelos)
Base.metadata.create_all(bind=engine)

@pytest.fixture(scope="session")
def db_session():
    """Fixture que proporciona una sesión de base de datos para tests"""
    # Eliminar tablas existentes y recrearlas limpias
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture(scope="session")
def test_user_id():
    """ID de usuario de prueba"""
    return str(uuid4())

@pytest.fixture(scope="session")
def admin_user_id():
    """ID de usuario admin de prueba"""
    return str(uuid4())

@pytest.fixture(scope="session")
def importador_user_id():
    """ID de usuario importador de prueba"""
    return str(uuid4())

@pytest.fixture(scope="session")
def importador_id():
    """ID de importador de prueba"""
    return str(uuid4())

@pytest.fixture(scope="session")
def cotizacion_id():
    """ID de cotización de prueba"""
    return str(uuid4())

@pytest.fixture()
def client(db_session):
    """Fixture que proporciona un cliente TestClient de FastAPI"""
    from fastapi.testclient import TestClient
    from main import app
    from utils.dependencies import get_db
    
    # Sobrescribir la dependencia get_db para usar la sesión de test
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    client = TestClient(app)
    
    yield client
    
    # Limpiar dependencias sobrescritas
    app.dependency_overrides.clear()

@pytest.fixture()
def test_user(db_session):
    """Crear un usuario de prueba en la base de datos"""
    user = Usuario(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        email="test@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        email_verificado=True,
        perfil_completo=False,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture()
def admin_user(db_session):
    """Crear un usuario admin de prueba en la base de datos"""
    user = Usuario(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        email="admin@example.com",
        password_hash=hash_password("123456789"),
        rol="admin",
        email_verificado=True,
        perfil_completo=False,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

def crear_empresa_importadora(db_session, nombre_empresa="Empresa Importadora Test", **kwargs):
    """
    Helper (no es un fixture) para crear en un solo paso una empresa importadora Y
    su cuenta dueña (rol="importador"), reflejando que ambas cuentas están
    desacopladas vía Usuario.importador_id (Fase 0). Úsalo en los tests que antes
    asumían que Usuario.id == Importador.id.
    """
    importador = Importador(
        id=str(uuid4()),
        nombre_empresa=nombre_empresa,
        logo_url=kwargs.get("logo_url"),
        especialidad_producto=kwargs.get("especialidad_producto", ["Textiles"]),
        paises_origen=kwargs.get("paises_origen", ["China"]),
        calificacion_promedio=kwargs.get("calificacion_promedio", 4.5),
        tiempo_respuesta_promedio=kwargs.get("tiempo_respuesta_promedio", "24h"),
        capacidad_volumen=kwargs.get("capacidad_volumen", 10000),
        solo_cotizaciones_directas=kwargs.get("solo_cotizaciones_directas", False),
        estado=kwargs.get("estado", "activo"),
        verificado=kwargs.get("verificado", False),
        fecha_registro=datetime.utcnow()
    )
    db_session.add(importador)
    db_session.commit()

    dueño = Usuario(
        id=str(uuid4()),
        email=kwargs.get("email_dueño", f"dueño_{importador.id}@example.com"),
        password_hash=hash_password("123456789"),
        rol="importador",
        importador_id=importador.id,
        nombre=kwargs.get("nombre_dueño"),
        activo=True,
        email_verificado=True,
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(dueño)
    db_session.commit()
    db_session.refresh(importador)
    db_session.refresh(dueño)
    return importador, dueño

def registro_payload(email, password="ClaveSegura1", rol="solicitante", tipo_persona="natural", **overrides):
    """
    Devuelve un payload válido para POST /auth/register (Semana 4: distingue
    persona natural/jurídica y exige aceptación de política de datos). Los tests
    que solo necesitan una cuenta "solicitante" genérica pueden llamarlo sin
    argumentos extra; `overrides` permite sobrescribir cualquier campo puntual.
    """
    payload = {
        "email": email,
        "password": password,
        "rol": rol,
        "tipo_persona": tipo_persona,
        "indicativo_pais_telefono": "+57",
        "telefono": "3001234567",
        "acepto_politica_datos": True,
    }
    if tipo_persona == "natural":
        payload.update({
            "tipo_documento": "cedula",
            "numero_documento": "1234567890",
            "nombre": "Nombre",
            "apellido": "Apellido",
        })
    else:  # juridica
        payload.update({
            "nit": "900123456-7",
            "razon_social": "Empresa de Prueba S.A.S.",
        })
    payload.update(overrides)
    return payload


def capturar_otp_envio(monkeypatch):
    """Monkeypatch del envío SMTP de OTP; retorna dict mutable con el último otp."""
    capturado = {}

    def _fake(destinatario, otp, proposito):
        capturado["email"] = destinatario
        capturado["otp"] = otp
        capturado["proposito"] = proposito
        return True

    monkeypatch.setattr("services.otp_service.enviar_correo_otp", _fake)
    return capturado


def registrar_verificado(client, monkeypatch, email, **kwargs):
    """
    Registra solicitante, captura OTP y verifica email. Devuelve el JSON de
    LoginResponse (con access_token).
    """
    capturado = capturar_otp_envio(monkeypatch)
    password = kwargs.pop("password", "ClaveSegura1")
    r = client.post("/auth/register", json=registro_payload(email, password=password, **kwargs))
    assert r.status_code == 201, r.text
    v = client.post("/auth/verificar-email", json={"email": email, "otp": capturado["otp"]})
    assert v.status_code == 200, v.text
    data = v.json()
    assert data.get("access_token")
    return data


def crear_usuario_con_token(db_session, *, rol="solicitante", email=None, **kwargs):
    """Crea Usuario en BD y devuelve (usuario, headers Authorization). Para tests que mintaban JWT huérfanos."""
    from uuid import uuid4
    email = email or f"{rol}_{uuid4().hex[:8]}@example.com"
    user = Usuario(
        id=str(uuid4()),
        email=email,
        password_hash=hash_password(kwargs.get("password", "ClaveSegura1")),
        rol=rol,
        importador_id=kwargs.get("importador_id"),
        organizacion_id=kwargs.get("organizacion_id"),
        nombre=kwargs.get("nombre", "Test"),
        activo=True,
        email_verificado=True,
        perfil_completo=True,
        creditos_balance=kwargs.get("creditos_balance", 100.0),
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user, auth_headers_for(user)


def auth_headers_for(usuario):
    """Genera headers de autenticación válidos para un Usuario de prueba, incluyendo
    el claim importador_id si la cuenta pertenece a una empresa."""
    token = create_access_token(str(usuario.id), usuario.rol, importador_id=usuario.importador_id)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture()
def empresa_con_dueño(db_session):
    """Empresa importadora + cuenta dueña de prueba, ya vinculadas."""
    importador, dueño = crear_empresa_importadora(db_session)
    return importador, dueño

@pytest.fixture()
def importador_user(db_session):
    """
    Cuenta "dueña" (rol="importador") de una empresa de prueba, ya vinculada vía
    importador_id. Se expone también `.empresa` con el Importador asociado.
    """
    importador, dueño = crear_empresa_importadora(db_session, email_dueño="importador@example.com")
    dueño.empresa = importador
    return dueño

@pytest.fixture()
def test_importador(db_session):
    """Crear un importador de prueba en la base de datos"""
    importador = Importador(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        nombre_empresa="Importadora Test",
        logo_url=None,
        especialidad_producto=["Textiles", "Ropa"],
        paises_origen=["China", "Vietnam"],
        calificacion_promedio=4.5,
        tiempo_respuesta_promedio="24h",
        capacidad_volumen=10000,
        estado="activo",
        fecha_registro=datetime.utcnow()
    )
    db_session.add(importador)
    db_session.commit()
    db_session.refresh(importador)
    return importador

@pytest.fixture()
def test_importador_china(db_session):
    """Crear un importador especializado en China"""
    importador = Importador(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        nombre_empresa="China Textiles Co.",
        logo_url=None,
        especialidad_producto=["Textiles"],
        paises_origen=["China"],
        calificacion_promedio=4.8,
        tiempo_respuesta_promedio="12h",
        capacidad_volumen=50000,
        estado="activo",
        fecha_registro=datetime.utcnow()
    )
    db_session.add(importador)
    db_session.commit()
    db_session.refresh(importador)
    return importador

@pytest.fixture()
def test_importador_vietnam(db_session):
    """Crear un importador especializado en Vietnam"""
    importador = Importador(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        nombre_empresa="Vietnam Fashion",
        logo_url=None,
        especialidad_producto=["Textiles", "Calzado"],
        paises_origen=["Vietnam"],
        calificacion_promedio=4.2,
        tiempo_respuesta_promedio="36h",
        capacidad_volumen=20000,
        estado="activo",
        fecha_registro=datetime.utcnow()
    )
    db_session.add(importador)
    db_session.commit()
    db_session.refresh(importador)
    return importador

@pytest.fixture()
def test_cotizacion(db_session):
    """Crear una cotización de prueba en la base de datos"""
    user = Usuario(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        email="cotizador@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        perfil_completo=False,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    
    cotizacion = Cotizacion(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        solicitante_id=str(user.id),  # Convertir UUID a string para SQLite
        importador_id=None,
        modalidad="abierta",
        foto_producto=None,
        pais_importacion="China",
        nivel_personalizacion="estandar",
        nombre_producto="Camisetas personalizadas",
        descripcion_cliente="Necesito 500 camisetas con mi logo impreso en algodón premium",
        link_referencia=None,
        linea_producto="Textiles",
        tipo_calidad="estandar",
        modalidad_importacion="ecommerce",
        cantidad_minima=500,
        precio_objetivo_usd=3.50,
        incoterm="FOB",
        notas_adicionales=None,
        estado="abierta",
        fecha_creacion=datetime.utcnow(),
        fecha_actualizacion=datetime.utcnow()
    )
    db_session.add(cotizacion)
    db_session.commit()
    db_session.refresh(cotizacion)
    return cotizacion

@pytest.fixture()
def test_cotizacion_dirigida(db_session):
    """Crear una cotización dirigida de prueba en la base de datos"""
    user = Usuario(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        email="cotizador2@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        perfil_completo=False,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    
    importador = Importador(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        nombre_empresa="Importadora Dirigida",
        logo_url=None,
        especialidad_producto=["Textiles"],
        paises_origen=["China"],
        calificacion_promedio=4.0,
        tiempo_respuesta_promedio="24h",
        capacidad_volumen=5000,
        estado="activo",
        fecha_registro=datetime.utcnow()
    )
    db_session.add(importador)
    db_session.commit()
    
    cotizacion = Cotizacion(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        solicitante_id=str(user.id),  # Convertir UUID a string para SQLite
        importador_id=str(importador.id),  # Convertir UUID a string para SQLite
        modalidad="dirigida",
        foto_producto=None,
        pais_importacion="China",
        nivel_personalizacion="personalizacion_marca",
        nombre_producto="Pantalones con logo",
        descripcion_cliente="Necesito 1000 pantalones con mi marca bordada",
        link_referencia=None,
        linea_producto="Textiles",
        tipo_calidad="premium",
        modalidad_importacion="corporativo",
        cantidad_minima=1000,
        precio_objetivo_usd=8.00,
        incoterm="CIF",
        notas_adicionales=None,
        estado="dirigida",
        fecha_creacion=datetime.utcnow(),
        fecha_actualizacion=datetime.utcnow()
    )
    db_session.add(cotizacion)
    db_session.commit()
    db_session.refresh(cotizacion)
    return cotizacion

@pytest.fixture()
def auth_headers_test_user(test_user):
    """Headers de autenticación para usuario de prueba (usuario real en BD)."""
    return auth_headers_for(test_user)

@pytest.fixture()
def auth_headers_admin(admin_user):
    """Headers de autenticación para admin (usuario real en BD)."""
    return auth_headers_for(admin_user)

@pytest.fixture()
def mock_redis_client(monkeypatch):
    """Mock del cliente Redis para tests"""
    import config
    from unittest.mock import MagicMock
    
    # Crear mock y sobrescribir el redis_client en el módulo config
    redis_mock = MagicMock()
    
    # Configurar comportamiento por defecto
    redis_mock.hgetall.return_value = {}
    redis_mock.get.return_value = None
    redis_mock.ttl.return_value = 259200
    redis_mock.exists.return_value = False
    redis_mock.smembers.return_value = set()
    redis_mock.ping.return_value = True
    # pipeline() encadenable para índice SET (sadd/expire/srem/execute)
    redis_mock.pipeline.return_value = redis_mock
    
    # Sobrescribir en el módulo config
    original_redis = config.redis_client
    monkeypatch.setattr(config, 'redis_client', redis_mock)
    
    return redis_mock

# Limpiar base de datos de test después de cada test
@pytest.fixture(autouse=True)
def cleanup_test_db(db_session):
    """Limpiar la base de datos después de cada test.

    El orden respeta las claves foráneas: hijos antes que padres. Las tablas del
    módulo LMS y de gestión documental tienen que estar aquí; mientras faltaron,
    un test que publicaba un curso hacía fallar el DELETE de `importadores`, y
    como todo el bloque iba en un solo `try` la limpieza entera se revertía en
    silencio y el resto de la sesión heredaba datos ajenos.
    """
    yield
    try:
        db_session.query(PasswordResetToken).delete()
        db_session.query(MensajeAdjunto).delete()
        db_session.query(MensajeChat).delete()
        db_session.query(ConversacionChat).delete()
        db_session.query(MovimientoCredito).delete()
        db_session.query(SolicitudRecreacion).delete()
        db_session.query(Pago).delete()
        db_session.query(OrdenDocumento).delete()
        db_session.query(DocumentoOrden).delete()
        db_session.query(HistorialEstadosOrden).delete()
        db_session.query(Orden).delete()
        db_session.query(Propuesta).delete()
        db_session.query(CampoPersonalizado).delete()
        db_session.query(Cotizacion).delete()

        # LMS: certificados y progreso apuntan a lecciones y cursos.
        db_session.query(CertificadoCurso).delete()
        db_session.query(ProgresoLeccion).delete()
        db_session.query(CompraCurso).delete()
        db_session.query(CursoRecurso).delete()
        db_session.query(RecursoLeccion).delete()
        db_session.query(LeccionCurso).delete()
        db_session.query(ModuloCurso).delete()
        db_session.query(Curso).delete()

        # Gestión documental: etiquetas y favoritos referencian archivos.
        db_session.query(ArchivoEtiqueta).delete()
        db_session.query(Favorito).delete()
        db_session.query(Etiqueta).delete()
        db_session.query(Archivo).delete()
        db_session.query(Carpeta).delete()

        db_session.query(Notificacion).delete()
        # Los sellos referencian empresas y admins: van antes que ambos.
        db_session.query(CertificacionImportador).delete()
        db_session.query(Certificacion).delete()
        db_session.query(Importador).delete()
        db_session.query(Usuario).delete()
        db_session.commit()
    except Exception:
        # Si las tablas no existen (ej. test falló antes de crearlas), ignorar
        try:
            db_session.rollback()
        except Exception:
            pass

# Importar modelos para usar en fixtures
from models.usuario import Usuario
from models.importador import Importador
from models.cotizacion import Cotizacion, EstadoCotizacion