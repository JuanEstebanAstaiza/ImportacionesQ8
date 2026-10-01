"""Restaurar una copia de seguridad desde el panel de administración.

1. `POST /admin/backup/restaurar/validar`: sube el ZIP, lo verifica y devuelve la
   vista previa sin tocar nada; rechaza ZIPs dañados o con rutas maliciosas.
2. `POST /admin/backup/restaurar/{id}`: exige escribir RESTAURAR, activa el modo
   mantenimiento, guarda el estado previo, restaura y siempre sale de mantenimiento.
3. Copias previas: listar, descargar y preparar para deshacer.
4. Reconstrucción del reparto de cotizaciones abiertas en Redis desde la base.
5. Ciclo completo real (descargar → modificar → subir → restaurar) en un proceso
   aparte con su propia base, para no vaciar la de la suite.
"""
import io
import json
import zipfile
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import status

from conftest import crear_empresa_importadora, crear_usuario_con_token


@pytest.fixture()
def admin(db_session):
    return crear_usuario_con_token(db_session, rol="admin")


@pytest.fixture()
def backups_tmp(tmp_path, monkeypatch):
    import services.backup_service as servicio
    import services.mantenimiento as mantenimiento

    monkeypatch.setattr(servicio, "BACKUPS_DIR", tmp_path / "backups")
    monkeypatch.setattr(mantenimiento, "PAUSA_ANTES_DE_RESTAURAR", 0)
    yield tmp_path / "backups"
    mantenimiento.desactivar()


def _zip_actual(client, headers) -> bytes:
    r = client.get("/admin/backup?incluir_archivos=false", headers=headers)
    assert r.status_code == 200, r.text
    return r.content


def _subir(client, headers, contenido: bytes, nombre="copia.zip"):
    return client.post(
        "/admin/backup/restaurar/validar",
        files={"archivo": (nombre, contenido, "application/zip")},
        headers=headers,
    )


class TestValidar:
    def test_vista_previa_de_un_zip_valido(self, client, admin, backups_tmp):
        usuario, headers = admin
        r = _subir(client, headers, _zip_actual(client, headers))
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["subida_id"]) == 32
        assert body["nombre_original"] == "copia.zip"
        usuarios = next(t for t in body["tablas"] if t["tabla"] == "usuarios")
        assert usuarios["en_backup"] == usuarios["actual"] > 0
        assert body["total_filas_backup"] == body["total_filas_actual"]
        assert not any("Tu cuenta no existe" in a for a in body["advertencias"])
        assert any("no incluye archivos" in a for a in body["advertencias"])
        assert (backups_tmp / "subidas" / f"{body['subida_id']}.zip").is_file()

    def test_avisa_si_el_admin_no_esta_en_la_copia(self, client, db_session, admin, backups_tmp):
        _, headers = admin
        contenido = _zip_actual(client, headers)
        _, headers_nuevo = crear_usuario_con_token(db_session, rol="admin")
        r = _subir(client, headers_nuevo, contenido)
        assert r.status_code == 200, r.text
        assert any("Tu cuenta no existe" in a for a in r.json()["advertencias"])

    def test_rechaza_un_archivo_que_no_es_zip(self, client, admin, backups_tmp):
        _, headers = admin
        r = _subir(client, headers, b"esto no es un zip")
        assert r.status_code == 400
        assert "no es una copia válida" in r.json()["detail"]
        assert not list((backups_tmp / "subidas").glob("*.zip"))

    def test_rechaza_un_zip_con_rutas_maliciosas(self, client, admin, backups_tmp):
        _, headers = admin
        original = zipfile.ZipFile(io.BytesIO(_zip_actual(client, headers)))
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as zf:
            for nombre in original.namelist():
                contenido = original.read(nombre)
                if nombre == "manifest.json":
                    manifiesto = json.loads(contenido)
                    manifiesto["archivos_copiados"] = 1
                    contenido = json.dumps(manifiesto).encode()
                zf.writestr(nombre, contenido)
            zf.writestr("archivos/uploads/../../main.py", b"print('pwned')")
        r = _subir(client, headers, buffer.getvalue())
        assert r.status_code == 400
        assert "Ruta no permitida" in r.json()["detail"]

    def test_solo_admin(self, client, db_session, backups_tmp):
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        r = _subir(client, headers, b"x")
        assert r.status_code == 403


class TestAplicar:
    def _validado(self, client, headers):
        r = _subir(client, headers, _zip_actual(client, headers))
        assert r.status_code == 200, r.text
        return r.json()["subida_id"]

    def test_exige_escribir_restaurar(self, client, admin, backups_tmp):
        _, headers = admin
        subida = self._validado(client, headers)
        r = client.post(f"/admin/backup/restaurar/{subida}", json={"confirmacion": "si"}, headers=headers)
        assert r.status_code == 400

    def test_id_desconocido_o_malformado(self, client, admin, backups_tmp):
        _, headers = admin
        for subida in (uuid4().hex, "..%2F..%2Fmain"):
            r = client.post(f"/admin/backup/restaurar/{subida}", json={"confirmacion": "RESTAURAR"}, headers=headers)
            assert r.status_code == 404

    def test_flujo_completo_sin_tocar_la_base_de_la_suite(self, client, admin, backups_tmp, monkeypatch):
        """La restauración real se prueba en un proceso aparte; aquí, el flujo."""
        import services.backup_service as servicio
        import services.mantenimiento as mantenimiento

        _, headers = admin
        subida = self._validado(client, headers)
        estados = []

        def restaurar_falso(db, ruta, *, incluir_archivos=True, **_):
            estados.append(mantenimiento.motivo_activo())
            return {"tablas_restauradas": 3, "filas_restauradas": 10, "archivos_restaurados": 0, "tablas_desconocidas": []}

        monkeypatch.setattr(servicio, "restaurar_desde_zip", restaurar_falso)
        r = client.post(
            f"/admin/backup/restaurar/{subida}",
            json={"confirmacion": "RESTAURAR", "incluir_archivos": False},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["filas_restauradas"] == 10
        assert body["sesion_vigente"] is True
        # Restauró en mantenimiento, salió de él y guardó el estado previo verificable.
        assert estados == ["restaurando una copia de seguridad"]
        assert mantenimiento.motivo_activo() is None
        previo = backups_tmp / "antes-de-restaurar" / body["backup_previo"]
        assert previo.is_file()
        servicio.verificar_backup(previo)
        assert not (backups_tmp / "subidas" / f"{subida}.zip").exists()

    def test_sale_de_mantenimiento_aunque_falle(self, client, admin, backups_tmp, monkeypatch):
        import services.backup_service as servicio
        import services.mantenimiento as mantenimiento

        _, headers = admin
        subida = self._validado(client, headers)

        def revienta(*_a, **_k):
            raise OSError("disco lleno")

        monkeypatch.setattr(servicio, "restaurar_desde_zip", revienta)
        r = client.post(f"/admin/backup/restaurar/{subida}", json={"confirmacion": "RESTAURAR"}, headers=headers)
        assert r.status_code == 500
        assert "no se modificó" in r.json()["detail"]
        assert mantenimiento.motivo_activo() is None
        # El ZIP sigue ahí para reintentar.
        assert (backups_tmp / "subidas" / f"{subida}.zip").is_file()

    def test_discrepancia_tras_cargar_no_dice_que_se_revirtio(self, client, admin, backups_tmp, monkeypatch):
        import services.backup_service as servicio

        _, headers = admin
        subida = self._validado(client, headers)

        def discrepa(*_a, **_k):
            raise RuntimeError("usuarios: esperadas 3, encontradas 2")

        monkeypatch.setattr(servicio, "restaurar_desde_zip", discrepa)
        r = client.post(f"/admin/backup/restaurar/{subida}", json={"confirmacion": "RESTAURAR"}, headers=headers)
        assert r.status_code == 500
        assert "se cargó pero la verificación" in r.json()["detail"]

    def test_no_permite_dos_restauraciones_a_la_vez(self, client, admin, backups_tmp):
        import services.mantenimiento as mantenimiento

        _, headers = admin
        subida = self._validado(client, headers)
        assert mantenimiento.activar("otra restauración")
        r = client.post(f"/admin/backup/restaurar/{subida}", json={"confirmacion": "RESTAURAR"}, headers=headers)
        assert r.status_code == 409

    def test_descartar(self, client, admin, backups_tmp):
        _, headers = admin
        subida = self._validado(client, headers)
        assert client.delete(f"/admin/backup/restaurar/{subida}", headers=headers).status_code == 204
        assert not (backups_tmp / "subidas" / f"{subida}.zip").exists()


class TestMantenimiento:
    def test_la_api_responde_503_salvo_salud_y_backup(self, client, admin, backups_tmp):
        import services.mantenimiento as mantenimiento

        _, headers = admin
        assert mantenimiento.activar("pruebas")
        try:
            r = client.get("/importadores")
            assert r.status_code == 503
            assert "mantenimiento" in r.json()["detail"]
            assert r.headers["retry-after"] == "60"
            assert client.get("/health").status_code == 200
            assert client.get("/admin/backup/resumen", headers=headers).status_code == 200
        finally:
            mantenimiento.desactivar()
        assert client.get("/importadores").status_code == 200


class TestCopiasPrevias:
    def test_listar_descargar_y_preparar(self, client, admin, backups_tmp):
        import services.backup_service as servicio

        _, headers = admin
        carpeta = backups_tmp / "antes-de-restaurar"
        carpeta.mkdir(parents=True)
        nombre = "importacionesq8-backup-20261001-120000.zip"
        (carpeta / nombre).write_bytes(_zip_actual(client, headers))

        r = client.get("/admin/backup/previos", headers=headers)
        assert [p["nombre"] for p in r.json()] == [nombre]

        r = client.get(f"/admin/backup/previos/{nombre}", headers=headers)
        assert r.status_code == 200 and r.content[:2] == b"PK"

        r = client.post(f"/admin/backup/previos/{nombre}/preparar", headers=headers)
        assert r.status_code == 200, r.text
        assert (backups_tmp / "subidas" / f"{r.json()['subida_id']}.zip").is_file()
        servicio.verificar_backup(carpeta / nombre)

    def test_no_sirve_rutas_arbitrarias(self, client, admin, backups_tmp):
        _, headers = admin
        for nombre in ("..%2F..%2Fmain.py", "otra-cosa.zip"):
            assert client.get(f"/admin/backup/previos/{nombre}", headers=headers).status_code == 404


class FakeRedis:
    """Lo justo de Redis para la reconstrucción del matching."""

    def __init__(self):
        self.datos = {}
        self.ttl = {}

    def ping(self):
        return True

    def scan_iter(self, match="*", count=None):
        import fnmatch

        return [k for k in list(self.datos) if fnmatch.fnmatch(k, match)]

    def delete(self, *claves):
        for clave in claves:
            self.datos.pop(clave, None)

    def hset(self, clave, mapping):
        self.datos.setdefault(clave, {}).update(mapping)

    def hgetall(self, clave):
        return dict(self.datos.get(clave, {}))

    def expire(self, clave, segundos):
        self.ttl[clave] = segundos

    def setex(self, clave, segundos, valor):
        self.datos[clave] = str(valor)
        self.ttl[clave] = segundos

    def sadd(self, clave, *valores):
        self.datos.setdefault(clave, set()).update(valores)

    def smembers(self, clave):
        return set(self.datos.get(clave, set()))

    def pipeline(self):
        return self

    def execute(self):
        return []


class TestReconstruirMatching:
    def test_rehace_reparto_desde_la_base(self, db_session, monkeypatch):
        import config
        from models.cotizacion import Cotizacion
        from models.propuesta import Propuesta
        from models.recepcion_cotizacion import RecepcionCotizacion
        from services.matching_service import reconstruir_matching_abiertas

        fake = FakeRedis()
        fake.datos["cotizacion_abierta:vieja-de-otros-datos"] = {"x": "pendiente"}
        monkeypatch.setattr(config, "redis_client", fake)

        a, _ = crear_empresa_importadora(db_session, nombre_empresa="A", email_dueño=f"a_{uuid4().hex[:6]}@x.co")
        b, _ = crear_empresa_importadora(db_session, nombre_empresa="B", email_dueño=f"b_{uuid4().hex[:6]}@x.co")
        solicitante, _ = crear_usuario_con_token(db_session, rol="solicitante")
        ahora = datetime.utcnow()

        def cotizacion(**extra):
            c = Cotizacion(
                id=str(uuid4()), solicitante_id=str(solicitante.id), modalidad="abierta", estado="abierta",
                pais_importacion=f"Pais-{uuid4().hex[:6]}", nombre_producto="X", descripcion_cliente="d" * 30,
                linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=1, **extra,
            )
            db_session.add(c)
            return c

        vigente = cotizacion(fecha_creacion=ahora - timedelta(hours=10))
        caducada = cotizacion(fecha_creacion=ahora - timedelta(hours=80))
        db_session.flush()
        for imp in (a, b):
            db_session.add(RecepcionCotizacion(importador_id=str(imp.id), cotizacion_id=vigente.id, modalidad="abierta"))
        db_session.add(Propuesta(
            id=str(uuid4()), cotizacion_id=vigente.id, importador_id=str(b.id), precio_ofrecido_usd=1,
            tiempo_estimado_entrega="1", incoterm="FOB", estado="pendiente",
        ))
        db_session.commit()

        assert reconstruir_matching_abiertas(db_session, ahora=ahora) >= 1

        assert "cotizacion_abierta:vieja-de-otros-datos" not in fake.datos
        assert f"cotizacion_abierta:{caducada.id}" not in fake.datos
        assert fake.hgetall(f"cotizacion_abierta:{vigente.id}") == {str(a.id): "pendiente", str(b.id): "respondido"}
        assert fake.datos[f"cotizacion_abierta:{vigente.id}:respuestas"] == "1"
        assert 61 * 3600 < fake.ttl[f"cotizacion_abierta:{vigente.id}"] <= 62 * 3600
        assert vigente.id in fake.smembers(f"indice:importador:{a.id}:abiertas")


class TestCicloRealPorElPanel:
    """Descargar → cambiar datos → subir → restaurar, contra una base propia."""

    def test_restaura_los_datos_de_la_copia(self, tmp_path):
        import os
        import subprocess
        import sys
        from pathlib import Path

        backend = Path(__file__).resolve().parent.parent
        guion = r'''
import io, sys
import models
from database import create_tables, SessionLocal
from models.importador import Importador
from models.usuario import Usuario
from utils.security import create_access_token, hash_password
create_tables()
db = SessionLocal()
db.add(Usuario(id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email="admin@x.co", password_hash=hash_password("Clave12345"),
               rol="admin", nombre="Admin", activo=True, email_verificado=True))
db.add(Importador(id="11111111-1111-1111-1111-111111111111", nombre_empresa="Original", tiempo_respuesta_promedio="24h"))
db.commit()
from fastapi.testclient import TestClient
import services.mantenimiento as mantenimiento
mantenimiento.PAUSA_ANTES_DE_RESTAURAR = 0
from main import app
c = TestClient(app)
h = {"Authorization": "Bearer " + create_access_token("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "admin")}
zip_ = c.get("/admin/backup", headers=h).content

imp = db.query(Importador).one(); imp.nombre_empresa = "CAMBIADO"
db.add(Importador(id="22222222-2222-2222-2222-222222222222", nombre_empresa="Nueva", tiempo_respuesta_promedio="1h"))
db.commit()

r = c.post("/admin/backup/restaurar/validar", files={"archivo": ("c.zip", zip_, "application/zip")}, headers=h)
assert r.status_code == 200, r.text
imp_tabla = next(t for t in r.json()["tablas"] if t["tabla"] == "importadores")
assert imp_tabla == {"tabla": "importadores", "en_backup": 1, "actual": 2}, imp_tabla
r = c.post("/admin/backup/restaurar/" + r.json()["subida_id"], json={"confirmacion": "RESTAURAR"}, headers=h)
assert r.status_code == 200, r.text
assert r.json()["sesion_vigente"] is True

db.expire_all()
print(sorted(i.nombre_empresa for i in db.query(Importador).all()))
'''
        entorno = {
            **os.environ,
            "DATABASE_URL": f"sqlite:///{tmp_path / 'panel.db'}",
            "BACKUP_DIR": str(tmp_path / "backups"),
            "APP_ENV": "test",
            "SECRET_KEY": "test-secret-key-not-for-production-use-only!!",
            "REDIS_URL": "redis://127.0.0.1:1/0",
        }
        r = subprocess.run([sys.executable, "-c", guion], cwd=backend, env=entorno, capture_output=True, text=True, timeout=300)
        assert r.returncode == 0, r.stdout + r.stderr
        assert r.stdout.strip().splitlines()[-1] == "['Original']"
        assert list((tmp_path / "backups" / "antes-de-restaurar").glob("*.zip"))
