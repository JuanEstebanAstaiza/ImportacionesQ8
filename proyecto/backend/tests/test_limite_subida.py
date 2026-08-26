"""Tope de tamaño de las peticiones y visibilidad del 413 desde el navegador.

El síntoma reportado fue un error de CORS al subir el vídeo de un curso:

    Access to fetch at '.../documentos/archivos/upload' has been blocked by CORS
    policy: No 'Access-Control-Allow-Origin' header is present

No era CORS. El tope global de body eran 2 MiB para toda la API, así que
cualquier vídeo se rechazaba con un 413; y como el middleware que lo emitía
estaba por fuera de CORS, la respuesta salía sin cabeceras y el navegador solo
podía informar de lo segundo. Aquí se fijan las dos mitades del arreglo: que la
ruta de subida tenga su propio tope, y que el 413 siga siendo legible.
"""
import io

import pytest
from fastapi import status

from utils.security_middleware import MAX_BODY_BYTES, MAX_UPLOAD_BYTES
from conftest import crear_usuario_con_token

ORIGEN_NAVEGADOR = {"Origin": "http://localhost:5173"}


@pytest.fixture()
def usuario(db_session):
    return crear_usuario_con_token(db_session, rol="solicitante")


def _subir(client, headers, tamano_bytes, nombre="clase.mp4", mime="video/mp4"):
    contenido = b"\x00" * tamano_bytes
    return client.post(
        "/documentos/archivos/upload",
        files={"archivo": (nombre, io.BytesIO(contenido), mime)},
        data={"origen": "curso"},
        headers={**headers, **ORIGEN_NAVEGADOR},
    )


class TestTopesConfigurados:
    def test_la_ruta_de_subida_admite_mucho_mas_que_el_resto(self):
        """Con el tope general no cabía ningún vídeo de curso."""
        assert MAX_UPLOAD_BYTES > MAX_BODY_BYTES
        assert MAX_UPLOAD_BYTES >= 100 * 1024 * 1024

    def test_el_frontend_puede_consultar_el_tope(self, client):
        """Así avisa antes de subir, en vez de tras transferir el archivo entero."""
        cuerpo = client.get("/configuracion-publica").json()
        assert cuerpo["max_subida_bytes"] == MAX_UPLOAD_BYTES


class TestSubidaDeArchivosGrandes:
    def test_se_admite_un_archivo_mayor_que_el_tope_general(self, client, usuario):
        _, headers = usuario
        respuesta = _subir(client, headers, MAX_BODY_BYTES + 512 * 1024)

        assert respuesta.status_code == status.HTTP_201_CREATED, respuesta.text
        assert respuesta.json()["size_bytes"] == MAX_BODY_BYTES + 512 * 1024

    def test_el_resto_de_la_api_conserva_su_tope_estrecho(self, client, usuario):
        """Relajar la subida no debe abrir la puerta a un body bomb en el JSON."""
        _, headers = usuario
        respuesta = client.post(
            "/cotizaciones",
            content=b"x" * (MAX_BODY_BYTES + 1),
            headers={**headers, "Content-Type": "application/json", **ORIGEN_NAVEGADOR},
        )
        assert respuesta.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE


class TestElRechazoEsLegibleDesdeElNavegador:
    def test_el_413_lleva_cabeceras_de_cors(self, client, usuario):
        """Sin esto el browser dice "error de CORS" y esconde el motivo real."""
        _, headers = usuario
        respuesta = client.post(
            "/cotizaciones",
            content=b"x" * (MAX_BODY_BYTES + 1),
            headers={**headers, "Content-Type": "application/json", **ORIGEN_NAVEGADOR},
        )

        assert respuesta.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        assert respuesta.headers.get("access-control-allow-origin") == "http://localhost:5173"

    def test_el_413_dice_cual_es_el_maximo(self, client, usuario):
        _, headers = usuario
        respuesta = client.post(
            "/cotizaciones",
            content=b"x" * (MAX_BODY_BYTES + 1),
            headers={**headers, "Content-Type": "application/json", **ORIGEN_NAVEGADOR},
        )

        assert "MB" in respuesta.json()["detail"]

    def test_el_preflight_de_la_subida_sigue_pasando(self, client):
        respuesta = client.options(
            "/documentos/archivos/upload",
            headers={
                **ORIGEN_NAVEGADOR,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        assert respuesta.status_code == status.HTTP_200_OK
        assert respuesta.headers.get("access-control-allow-origin") == "http://localhost:5173"
