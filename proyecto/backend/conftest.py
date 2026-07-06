import sys
import os

# Crear directorio de base de datos si no existe (Windows)
DB_DIR = r"C:\Users\akali\AppData\Local\Temp"
os.makedirs(DB_DIR, exist_ok=True)

# Sobrescribir DATABASE_URL ANTES de importar cualquier módulo del proyecto
os.environ["DATABASE_URL"] = f"sqlite:///{DB_DIR}/test.db"

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
from models.cotizacion import Cotizacion
from models.asesor import Asesor

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
        perfil_completo=False,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture()
def importador_user(db_session):
    """Crear un usuario importador de prueba en la base de datos"""
    user = Usuario(
        id=str(uuid4()),  # Convertir UUID a string para SQLite
        email="importador@example.com",
        password_hash=hash_password("123456789"),
        rol="importador",
        perfil_completo=False,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

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
def auth_headers_test_user():
    """Headers de autenticación para usuario de prueba"""
    token = create_access_token(str(uuid4()), "solicitante")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture()
def auth_headers_admin():
    """Headers de autenticación para admin"""
    token = create_access_token(str(uuid4()), "admin")
    return {"Authorization": f"Bearer {token}"}

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
    
    # Sobrescribir en el módulo config
    original_redis = config.redis_client
    monkeypatch.setattr(config, 'redis_client', redis_mock)
    
    return redis_mock

# Limpiar base de datos de test después de cada test
@pytest.fixture(autouse=True)
def cleanup_test_db(db_session):
    """Limpiar la base de datos después de cada test"""
    yield
    # Eliminar todos los registros creados en el test (en orden inverso para respetar FK)
    try:
        db_session.query(Cotizacion).delete()
        db_session.query(Asesor).delete()
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
from models.cotizacion import Cotizacion
