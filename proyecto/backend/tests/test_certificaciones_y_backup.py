"""Certificaciones de plataforma y copia de seguridad descargable.

Cubre las dos capacidades que pidió el equipo de administración:
- crear sellos desde cero (logo, descripción y peso publicitario) y otorgarlos,
  comprobando que el peso realmente reordena el catálogo del solicitante,
- descargar un ZIP con base de datos y archivos para poder actualizar sin CI.
"""
import io
import json
import zipfile
from uuid import uuid4

import pytest
from fastapi import status

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token


@pytest.fixture()
def admin(db_session):
    usuario, headers = crear_usuario_con_token(db_session, rol="admin")
    return usuario, headers


def _crear_certificacion(client, headers, **overrides):
    payload = {
        "nombre": f"Sello {uuid4().hex[:6]}",
        "descripcion": "Respaldado por ImportacionesQ8",
        "peso_publicidad": 10,
        **overrides,
    }
    respuesta = client.post("/admin/certificaciones", json=payload, headers=headers)
    assert respuesta.status_code == status.HTTP_201_CREATED, respuesta.text
    return respuesta.json()


class TestCatalogoDeCertificaciones:
    def test_crear_editar_y_retirar(self, client, admin):
        _, headers = admin

        creada = _crear_certificacion(client, headers, nombre="Socio Oro", peso_publicidad=25)
        assert creada["nombre"] == "Socio Oro"
        assert creada["peso_publicidad"] == 25
        assert creada["empresas_certificadas"] == 0

        editada = client.put(
            f"/admin/certificaciones/{creada['id']}",
            json={"peso_publicidad": 40, "descripcion": "Nuevo texto"},
            headers=headers,
        )
        assert editada.status_code == 200, editada.text
        assert editada.json()["peso_publicidad"] == 40
        assert editada.json()["descripcion"] == "Nuevo texto"

        retirada = client.delete(f"/admin/certificaciones/{creada['id']}", headers=headers)
        assert retirada.status_code == 200
        assert retirada.json()["activa"] is False

    def test_no_se_repite_el_nombre(self, client, admin):
        _, headers = admin
        _crear_certificacion(client, headers, nombre="Socio Plata")

        repetida = client.post(
            "/admin/certificaciones",
            json={"nombre": "socio plata", "descripcion": "", "peso_publicidad": 1},
            headers=headers,
        )
        assert repetida.status_code == status.HTTP_409_CONFLICT

    def test_el_peso_esta_acotado(self, client, admin):
        _, headers = admin
        respuesta = client.post(
            "/admin/certificaciones",
            json={"nombre": "Sello absurdo", "descripcion": "", "peso_publicidad": 999999},
            headers=headers,
        )
        assert respuesta.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_solo_admin(self, client, db_session):
        _, headers_solicitante = crear_usuario_con_token(db_session, rol="solicitante")
        respuesta = client.post(
            "/admin/certificaciones",
            json={"nombre": "Sello pirata", "descripcion": "", "peso_publicidad": 1},
            headers=headers_solicitante,
        )
        assert respuesta.status_code == status.HTTP_403_FORBIDDEN


class TestOtorgarYOrdenarCatalogo:
    def test_otorgar_revocar_y_reflejar_en_el_catalogo(self, client, db_session, admin):
        _, headers = admin
        importador, _dueño = crear_empresa_importadora(db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}")
        certificacion = _crear_certificacion(client, headers, peso_publicidad=30)

        otorgada = client.post(
            f"/admin/importadores/{importador.id}/certificaciones",
            json={"certificacion_id": certificacion["id"], "notas": "Auditoría 2026"},
            headers=headers,
        )
        assert otorgada.status_code == status.HTTP_201_CREATED, otorgada.text
        assert otorgada.json()["puntaje_publicidad"] == 30
        assert len(otorgada.json()["certificaciones"]) == 1

        # El catálogo público ya la muestra con su sello.
        catalogo = client.get("/importadores").json()
        fila = next(item for item in catalogo if item["id"] == importador.id)
        assert fila["puntaje_publicidad"] == 30
        assert fila["certificaciones"][0]["nombre"] == certificacion["nombre"]

        revocada = client.delete(
            f"/admin/importadores/{importador.id}/certificaciones/{certificacion['id']}",
            headers=headers,
        )
        assert revocada.status_code == 200
        assert revocada.json()["puntaje_publicidad"] == 0

        catalogo = client.get("/importadores").json()
        fila = next(item for item in catalogo if item["id"] == importador.id)
        assert fila["certificaciones"] == []

    def test_no_se_otorga_dos_veces(self, client, db_session, admin):
        _, headers = admin
        importador, _ = crear_empresa_importadora(db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}")
        certificacion = _crear_certificacion(client, headers)

        cuerpo = {"certificacion_id": certificacion["id"]}
        assert client.post(f"/admin/importadores/{importador.id}/certificaciones", json=cuerpo, headers=headers).status_code == 201
        repetida = client.post(f"/admin/importadores/{importador.id}/certificaciones", json=cuerpo, headers=headers)
        assert repetida.status_code == status.HTTP_409_CONFLICT

    def test_el_peso_decide_el_orden_del_catalogo(self, client, db_session, admin):
        """Es el "algoritmo de publicidad": más peso, más arriba en el dashboard."""
        _, headers = admin
        floja, _ = crear_empresa_importadora(db_session, nombre_empresa="AAA Empresa sin sello")
        media, _ = crear_empresa_importadora(db_session, nombre_empresa="BBB Empresa con sello medio")
        fuerte, _ = crear_empresa_importadora(db_session, nombre_empresa="CCC Empresa con sello fuerte")

        sello_medio = _crear_certificacion(client, headers, peso_publicidad=5)
        sello_fuerte = _crear_certificacion(client, headers, peso_publicidad=50)

        client.post(
            f"/admin/importadores/{media.id}/certificaciones",
            json={"certificacion_id": sello_medio["id"]},
            headers=headers,
        )
        client.post(
            f"/admin/importadores/{fuerte.id}/certificaciones",
            json={"certificacion_id": sello_fuerte["id"]},
            headers=headers,
        )

        ids = [item["id"] for item in client.get("/importadores").json()]
        assert ids.index(fuerte.id) < ids.index(media.id) < ids.index(floja.id)

        # Y las destacadas de la portada siguen el mismo criterio.
        destacadas = [item["id"] for item in client.get("/importadores/destacados").json()]
        assert destacadas[0] == fuerte.id

    def test_retirar_el_sello_lo_quita_de_todas_las_empresas(self, client, db_session, admin):
        _, headers = admin
        importador, _ = crear_empresa_importadora(db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}")
        certificacion = _crear_certificacion(client, headers, peso_publicidad=20)
        client.post(
            f"/admin/importadores/{importador.id}/certificaciones",
            json={"certificacion_id": certificacion["id"]},
            headers=headers,
        )

        client.delete(f"/admin/certificaciones/{certificacion['id']}", headers=headers)

        fila = next(item for item in client.get("/importadores").json() if item["id"] == importador.id)
        assert fila["certificaciones"] == []
        assert fila["puntaje_publicidad"] == 0

    def test_el_logo_del_sello_se_sirve_sin_sesion(self, client, db_session, admin):
        """El logo se pinta en el catálogo público, que no exige sesión."""
        admin_user, headers = admin
        subida = client.post(
            "/documentos/archivos/upload",
            files={"archivo": ("sello.png", io.BytesIO(b"\x89PNG\r\n\x1a\n"), "image/png")},
            data={"origen": "certificacion"},
            headers=headers,
        )
        assert subida.status_code in (200, 201), subida.text
        logo_url = f"/documentos/archivos/{subida.json()['id']}/descargar"

        _crear_certificacion(client, headers, logo_url=logo_url)

        anonimo = client.get(logo_url)
        assert anonimo.status_code == 200, anonimo.text


class TestBackup:
    def test_resumen_lista_tablas_y_archivos(self, client, db_session, admin):
        _, headers = admin
        crear_empresa_importadora(db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}")

        respuesta = client.get("/admin/backup/resumen", headers=headers)
        assert respuesta.status_code == 200, respuesta.text
        cuerpo = respuesta.json()
        assert cuerpo["tablas"]["importadores"] >= 1
        assert cuerpo["total_filas"] >= 1

    def test_el_zip_contiene_manifiesto_y_datos(self, client, db_session, admin):
        _, headers = admin
        importador, _ = crear_empresa_importadora(db_session, nombre_empresa="Empresa Respaldada")

        respuesta = client.get("/admin/backup", headers=headers)
        assert respuesta.status_code == 200, respuesta.text
        assert respuesta.headers["content-type"] == "application/zip"

        with zipfile.ZipFile(io.BytesIO(respuesta.content)) as zf:
            nombres = zf.namelist()
            assert "manifest.json" in nombres
            assert "datos/importadores.ndjson" in nombres

            manifiesto = json.loads(zf.read("manifest.json"))
            assert manifiesto["formato"] == 1
            assert manifiesto["tablas"]["importadores"] >= 1

            filas = [
                json.loads(linea)
                for linea in zf.read("datos/importadores.ndjson").decode("utf-8").splitlines()
                if linea.strip()
            ]
            assert any(fila["nombre_empresa"] == "Empresa Respaldada" for fila in filas)
            # Las fechas se serializan como ISO para poder recargarlas después.
            assert all(isinstance(fila.get("fecha_registro"), (str, type(None))) for fila in filas)

    def test_solo_admin_puede_descargar(self, client, db_session):
        _, headers_solicitante = crear_usuario_con_token(db_session, rol="solicitante")
        assert client.get("/admin/backup", headers=headers_solicitante).status_code == status.HTTP_403_FORBIDDEN
        assert client.get("/admin/backup").status_code == status.HTTP_401_UNAUTHORIZED

    def test_las_filas_del_zip_se_pueden_reinsertar(self, client, db_session, admin):
        """El volcado tiene que poder recargarse, no solo generarse.

        En el ZIP todo viaja como JSON, así que las fechas salen como texto ISO;
        SQLAlchemy rechaza un `str` en una columna DateTime, y sin rehidratarlos
        la restauración fallaba entera al primer INSERT.
        """
        from datetime import datetime as dt

        from database import Base
        from scripts.restaurar_backup import _convertir

        _, headers = admin
        crear_empresa_importadora(db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}")

        respuesta = client.get("/admin/backup", headers=headers)
        assert respuesta.status_code == 200

        tabla = next(t for t in Base.metadata.sorted_tables if t.name == "importadores")
        columnas = {c.name: c for c in tabla.columns}

        with zipfile.ZipFile(io.BytesIO(respuesta.content)) as zf:
            filas = [
                json.loads(linea)
                for linea in zf.read("datos/importadores.ndjson").decode("utf-8").splitlines()
                if linea.strip()
            ]

        assert filas, "el backup debería traer al menos una empresa"
        for fila in filas:
            convertida = {k: _convertir(v, columnas[k]) for k, v in fila.items() if k in columnas}
            assert isinstance(convertida["fecha_registro"], dt)
            # Las columnas JSON se conservan como estructura, no como texto.
            assert isinstance(convertida["especialidad_producto"], list)
