from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker, declarative_base
from config import DATABASE_URL

# Crear el motor de la base de datos
engine = create_engine(DATABASE_URL)

# Crear la sesión
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Crear la base de metadatos
metadata = MetaData()

# Crear la base declarativa para los modelos ORM
Base = declarative_base(metadata=metadata)

def get_db():
    """Dependencia FastAPI para obtener una sesión de base de datos"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

import re

# Un nombre de base de datos MySQL válido: solo letras, números y guion bajo.
# Esto es una defensa en profundidad: DATABASE_URL viene de una variable de entorno
# de confianza (no de input de usuarios finales), pero igual no se interpola libremente
# en SQL sin validar, para descartar por completo la clase de vulnerabilidad de inyección SQL.
_DB_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_]+$")

def create_database_if_not_exists():
    """Crea la base de datos si no existe (solo para MySQL)"""
    # No aplica a SQLite (usado en tests) - SQLite crea el archivo automáticamente
    if DATABASE_URL.startswith("sqlite"):
        return

    from sqlalchemy import text

    # URL sin el nombre de la DB: mysql+pymysql://user:pass@host/dbname -> ...@host
    # (NO usar split("/") + reensamblar: produce 'mysql+pymysql::///user:pass@host')
    mysql_url, db_name_raw = DATABASE_URL.rsplit("/", 1)
    db_name = db_name_raw.split("?")[0] or "importacionesq8"

    if not _DB_NAME_PATTERN.match(db_name):
        raise ValueError(
            f"Nombre de base de datos inválido en DATABASE_URL: '{db_name}'. "
            "Solo se permiten letras, números y guion bajo."
        )

    temp_engine = create_engine(mysql_url)
    with temp_engine.connect() as conn:
        # Crear base de datos si no existe. db_name ya fue validado contra un
        # allowlist estricto arriba, por lo que es seguro interpolarlo aquí:
        # MySQL no soporta parámetros ligados para nombres de identificadores (CREATE DATABASE).
        try:
            conn.execute(text(f"CREATE DATABASE `{db_name}`"))
            print(f"Base de datos '{db_name}' creada exitosamente")
        except Exception as e:
            if "already exists" in str(e).lower() or "exists" in str(e).lower():
                print(f"La base de datos '{db_name}' ya existe")

    temp_engine.dispose()

def create_tables():
    """Crea todas las tablas definidas en los modelos ORM"""
    Base.metadata.create_all(bind=engine)
    print("Tablas creadas exitosamente")

def init_db():
    """
    Crea la base (si aplica) y las tablas.

    Debe llamarse DESPUÉS de importar los modelos ORM; de lo contrario
    `Base.metadata` está vacío y `create_all` no crea ninguna tabla.
    """
    create_database_if_not_exists()
    import models  # noqa: F401
    create_tables()

# No inicializar al importar: en ese momento los modelos aún no están
# registrados y create_all dejaría MySQL sin tablas (bug enmascarado por tests
# con SQLite que importan modelos antes de create_all en conftest).
