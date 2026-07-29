from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.orm import sessionmaker, declarative_base
from config import DATABASE_URL, APP_ENV
import re
import logging

logger = logging.getLogger("importacionesq8")

# pool_pre_ping evita conexiones stale tras idle/timeouts de MySQL.
# DB_POOL_SIZE / DB_MAX_OVERFLOW permiten escalar bajo alto flujo concurrente.
import os as _os
_engine_kwargs = {
    "pool_pre_ping": True,
    "pool_size": int(_os.getenv("DB_POOL_SIZE", "10")),
    "max_overflow": int(_os.getenv("DB_MAX_OVERFLOW", "20")),
    "pool_timeout": int(_os.getenv("DB_POOL_TIMEOUT", "30")),
}
if DATABASE_URL and DATABASE_URL.startswith("sqlite"):
    _engine_kwargs = {"connect_args": {"check_same_thread": False}}

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
metadata = MetaData()
Base = declarative_base(metadata=metadata)

def get_db():
    """Dependencia FastAPI para obtener una sesión de base de datos"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

_DB_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_]+$")

def create_database_if_not_exists():
    """Crea la base de datos si no existe (solo para MySQL)"""
    if not DATABASE_URL or DATABASE_URL.startswith("sqlite"):
        return

    mysql_url, db_name_raw = DATABASE_URL.rsplit("/", 1)
    db_name = db_name_raw.split("?")[0] or "importacionesq8"

    if not _DB_NAME_PATTERN.match(db_name):
        raise ValueError(
            f"Nombre de base de datos inválido en DATABASE_URL: '{db_name}'. "
            "Solo se permiten letras, números y guion bajo."
        )

    temp_engine = create_engine(mysql_url, pool_pre_ping=True)
    with temp_engine.connect() as conn:
        try:
            conn.execute(text(f"CREATE DATABASE `{db_name}`"))
            conn.commit()
            print(f"Base de datos '{db_name}' creada exitosamente")
        except Exception as e:
            if "already exists" in str(e).lower() or "exists" in str(e).lower():
                print(f"La base de datos '{db_name}' ya existe")
            else:
                # MySQL puede devolver error distinto; reintentar no es necesario si ya existe
                msg = str(e).lower()
                if "1007" not in msg:  # ER_DB_CREATE_EXISTS
                    raise
    temp_engine.dispose()

def create_tables():
    """Crea todas las tablas definidas en los modelos ORM (fallback / tests)."""
    Base.metadata.create_all(bind=engine)
    print("Tablas creadas exitosamente")

def run_migrations():
    """Aplica migraciones Alembic hasta head (MySQL/producción)."""
    from pathlib import Path
    from alembic.config import Config
    from alembic import command

    root = Path(__file__).resolve().parent
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    command.upgrade(cfg, "head")
    print("Migraciones Alembic aplicadas (head)")

def init_db():
    """
    Inicializa la base de datos:
    - MySQL: crea DB si falta + Alembic upgrade head
    - SQLite (tests): create_all (conftest ya importa modelos)

    Con varios workers Uvicorn solo un proceso ejecuta migraciones (lock Redis);
    el resto espera. Evita carreras de Alembic al arrancar (OWASP A04/A05).
    """
    create_database_if_not_exists()
    import models  # noqa: F401 — registra metadata

    if DATABASE_URL and DATABASE_URL.startswith("sqlite"):
        create_tables()
        return

    lock_key = "lock:alembic_upgrade_head"
    got_lock = False
    try:
        from config import redis_client
        if redis_client is not None:
            # nx=True: solo el primer worker obtiene el lock (TTL 3 min)
            got_lock = bool(redis_client.set(lock_key, "1", nx=True, ex=180))
            if not got_lock:
                # Esperar a que el worker líder termine migraciones
                import time
                for _ in range(90):
                    if not redis_client.exists(lock_key):
                        break
                    time.sleep(1)
                else:
                    logger.warning("Timeout esperando lock Alembic; intentando upgrade de todos modos")
                    got_lock = True
        else:
            got_lock = True
    except Exception as lock_err:
        logger.warning("No se pudo adquirir lock Redis para Alembic (%s); continuando", lock_err)
        got_lock = True

    if got_lock:
        try:
            try:
                run_migrations()
            except Exception as e:
                # Primera vez / imagen sin historial: fallback create_all + stamp
                logger.warning("Alembic upgrade falló (%s); usando create_all + stamp", e)
                create_tables()
                try:
                    from pathlib import Path
                    from alembic.config import Config
                    from alembic import command
                    root = Path(__file__).resolve().parent
                    cfg = Config(str(root / "alembic.ini"))
                    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
                    command.stamp(cfg, "head")
                except Exception as stamp_err:
                    logger.warning("No se pudo hacer alembic stamp: %s", stamp_err)
        finally:
            try:
                from config import redis_client
                if redis_client is not None:
                    redis_client.delete(lock_key)
            except Exception:
                pass

def check_database() -> bool:
    """Ping SQL para readiness."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
