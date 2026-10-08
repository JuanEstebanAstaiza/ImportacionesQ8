from sqlalchemy import create_engine, inspect, MetaData, text
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

def _alembic_config():
    from pathlib import Path
    from alembic.config import Config

    root = Path(__file__).resolve().parent
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    return cfg

def run_migrations():
    """Aplica migraciones Alembic hasta head (MySQL/producción)."""
    from alembic import command

    command.upgrade(_alembic_config(), "head")
    print("Migraciones Alembic aplicadas (head)")

def _sembrar_datos_de_migraciones():
    """Filas que insertan las migraciones y `create_all` no crea: al hacer
    `stamp` esas migraciones no corren. Los umbrales de tier (0022) y el
    calendario inicial de Tendencias (0028)."""
    from models.tendencias import CierreFabricas, Temporada
    from models.tier import UmbralTierCotizante
    from services.tendencias_calculo import CIERRES_INICIALES, TEMPORADAS_INICIALES
    from services.tier_service import UMBRALES_POR_DEFECTO

    db = SessionLocal()
    try:
        for tier, (cotizaciones, ordenes, valor) in UMBRALES_POR_DEFECTO.items():
            db.add(UmbralTierCotizante(
                tier=tier,
                minimo_cotizaciones=cotizaciones,
                minimo_ordenes=ordenes,
                minimo_valor_operaciones_usd=valor,
            ))
        for nombre, fecha, ejemplos in TEMPORADAS_INICIALES:
            db.add(Temporada(nombre=nombre, fecha=fecha, ejemplos=ejemplos))
        for inicio, fin, fin_produccion_previa in CIERRES_INICIALES:
            db.add(CierreFabricas(inicio=inicio, fin=fin, fin_produccion_previa=fin_produccion_previa))
        db.commit()
    finally:
        db.close()

def bootstrap_si_vacia() -> bool:
    """BD sin tablas: crea el esquema actual desde los modelos y la marca en head.

    La cadena de migraciones no sirve para partir de cero: la 0001 hace
    `create_all` con los modelos *actuales* y las siguientes intentan volver a
    crear tablas que ya existen. Solo se usa con la BD vacía; una BD con datos
    sigue siempre el camino normal de `upgrade`. Devuelve True si hizo bootstrap.
    """
    from alembic import command
    import models  # noqa: F401 — registra metadata

    tablas = set(inspect(engine).get_table_names()) - {"alembic_version"}
    if tablas:
        return False
    create_tables()
    _sembrar_datos_de_migraciones()
    command.stamp(_alembic_config(), "head")
    print("BD vacía: esquema creado desde los modelos y marcado en head")
    return True

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
            # Nada de "create_all + stamp" ante cualquier error: sobre una BD a
            # medio migrar marcaría como aplicadas migraciones que no corrieron.
            if not bootstrap_si_vacia():
                run_migrations()
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
