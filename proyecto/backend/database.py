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

def create_database_if_not_exists():
    """Crea la base de datos si no existe (solo para MySQL)"""
    # Conectar a MySQL sin seleccionar base de datos
    from sqlalchemy import text
    
    # Extraer la URL sin el nombre de la base de datos
    parts = DATABASE_URL.split("/")
    mysql_url = parts[0] + "://" + "/".join(parts[1:-1])
    
    temp_engine = create_engine(mysql_url)
    with temp_engine.connect() as conn:
        # Extraer nombre de la base de datos
        db_name = parts[-1] if len(parts) > 2 else "importacionesq8"
        
        # Crear base de datos si no existe
        try:
            conn.execute(text(f"CREATE DATABASE {db_name}"))
            print(f"Base de datos '{db_name}' creada exitosamente")
        except Exception as e:
            if "already exists" in str(e).lower() or "exists" in str(e).lower():
                print(f"La base de datos '{db_name}' ya existe")
    
    temp_engine.dispose()

def create_tables():
    """Crea todas las tablas definidas en los modelos ORM"""
    Base.metadata.create_all(bind=engine)
    print("Tablas creadas exitosamente")

# Inicializar la base de datos al importar el módulo
try:
    create_database_if_not_exists()
    create_tables()
except Exception as e:
    # Si falla (ej. no hay conexión a MySQL), se manejará en main.py
    print(f"Nota: No se pudo inicializar la base de datos: {e}")