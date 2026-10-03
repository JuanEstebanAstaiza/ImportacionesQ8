"""Migración 0025: crea la bitácora y la rellena con lo que ya pasó.

Se ejecuta sobre una base SQLite aparte con el esquema actual sin la tabla
`eventos`, como estaría una base de producción justo antes de migrar.
"""
import importlib.util
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext

from database import Base

RUTA = Path(__file__).resolve().parent.parent / "alembic" / "versions" / "20261003_0025_eventos_asignacion_trm.py"


def _migracion():
    spec = importlib.util.spec_from_file_location("migracion_0025", RUTA)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def test_rellena_la_bitacora_con_el_historico(tmp_path):
    import models  # noqa: F401 — registra todas las tablas

    engine = sa.create_engine(f"sqlite:///{tmp_path / 'previa.db'}")
    Base.metadata.create_all(engine)
    t0 = datetime(2026, 9, 1, 10, 0, 0)
    cot, prop_a, prop_b, orden = (str(uuid4()) for _ in range(4))
    emp_a, emp_b, solicitante = (str(uuid4()) for _ in range(3))

    with engine.begin() as c:
        c.execute(sa.text("DROP TABLE eventos"))
        c.execute(sa.text(
            "INSERT INTO cotizaciones (id, solicitante_id, modalidad, pais_importacion, nombre_producto, "
            "descripcion_cliente, linea_producto, tipo_calidad, cantidad_minima, unidad_cantidad, precio_objetivo_usd, "
            "moneda_precio_objetivo, incoterm, estado, tier_minimo_requerido, desbloqueada_por_puntos, fecha_creacion, "
            "fecha_actualizacion) VALUES (:id, :sol, 'abierta', 'China', 'Camisetas', 'desc', 'Textiles', 'estandar', "
            "500, 'unidades', 1000, 'USD', 'FOB', 'orden_activa', 'Bronze', 0, :f, :f)"
        ), {"id": cot, "sol": solicitante, "f": t0})
        for emp in (emp_a, emp_b):
            c.execute(sa.text(
                "INSERT INTO recepciones_cotizacion (id, importador_id, cotizacion_id, modalidad, entregada, fecha_recepcion) "
                "VALUES (:id, :emp, :cot, 'abierta', 1, :f)"
            ), {"id": str(uuid4()), "emp": emp, "cot": cot, "f": t0 + timedelta(seconds=1)})
        for pid, emp, precio, estado in ((prop_a, emp_a, 2000, "aceptada"), (prop_b, emp_b, 2600, "rechazada")):
            c.execute(sa.text(
                "INSERT INTO propuestas (id, cotizacion_id, importador_id, precio_ofrecido_usd, tiempo_estimado_entrega, "
                "incoterm, estado, fecha_envio, preaceptada_por_solicitante, preaceptada_por_empresa) "
                "VALUES (:id, :cot, :emp, :p, '45 días', 'FOB', :e, :f, 1, 1)"
            ), {"id": pid, "cot": cot, "emp": emp, "p": precio, "e": estado, "f": t0 + timedelta(hours=2)})
        c.execute(sa.text(
            "INSERT INTO ordenes (id, cotizacion_id, importador_id, solicitante_id, estado, precio_acordado_usd, "
            "en_disputa, fecha_creacion, fecha_actualizacion) VALUES (:id, :cot, :emp, :sol, 'en_produccion', 2000, 0, :f, :f)"
        ), {"id": orden, "cot": cot, "emp": emp_a, "sol": solicitante, "f": t0 + timedelta(days=1)})
        for anterior, nuevo, dias in ((None, "cotizacion_aceptada", 1), ("cotizacion_aceptada", "en_produccion", 3)):
            c.execute(sa.text(
                "INSERT INTO historial_estados_orden (id, orden_id, estado_anterior, estado_nuevo, fecha_cambio) "
                "VALUES (:id, :o, :a, :n, :f)"
            ), {"id": str(uuid4()), "o": orden, "a": anterior, "n": nuevo, "f": t0 + timedelta(days=dias)})
        c.execute(sa.text("UPDATE recepciones_cotizacion SET origen = NULL"))

    with engine.begin() as c:
        with Operations.context(MigrationContext.configure(c)):
            _migracion().upgrade()

    with engine.connect() as c:
        filas = c.execute(sa.text(
            "SELECT tipo, importador_id, propuesta_id, estado_nuevo, monto_usd, cantidad, unidad, trm, datos "
            "FROM eventos ORDER BY fecha, tipo"
        )).mappings().all()
        origenes = {r[0] for r in c.execute(sa.text("SELECT origen FROM recepciones_cotizacion"))}

    tipos = [f["tipo"] for f in filas]
    assert tipos.count("solicitud_creada") == 1
    assert tipos.count("solicitud_asignada") == 2
    assert tipos.count("propuesta_enviada") == 2
    assert tipos.count("propuesta_aceptada") == 1
    assert tipos.count("propuesta_descartada") == 1
    assert [f["estado_nuevo"] for f in filas if f["tipo"] == "pedido_hito"] == ["cotizacion_aceptada", "en_produccion"]
    assert all(f["trm"] is None for f in filas)  # la TRM de entonces no se guardó
    assert all('"historico"' in f["datos"] for f in filas)
    aceptada = next(f for f in filas if f["tipo"] == "propuesta_aceptada")
    assert aceptada["propuesta_id"] == prop_a and aceptada["monto_usd"] == 2000
    assert aceptada["cantidad"] == 500 and aceptada["unidad"] == "unidades"
    assert origenes == {"automatica"}

    # Idempotente: si la tabla ya existe no vuelve a rellenar.
    with engine.begin() as c:
        with Operations.context(MigrationContext.configure(c)):
            _migracion().upgrade()
    with engine.connect() as c:
        assert c.execute(sa.text("SELECT COUNT(*) FROM eventos")).scalar() == len(filas)
