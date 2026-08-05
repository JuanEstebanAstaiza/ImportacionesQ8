"""La ruta de una colección responde igual con y sin slash final.

La app corre con `redirect_slashes=False`, así que sin normalización cada ruta
solo respondería en la forma exacta con que fue registrada. Todas se registran
sin slash final y `TrailingSlashNormalizationMiddleware` colapsa el que llegue.
"""
import pytest
from fastapi import status

from conftest import auth_headers_for, crear_empresa_importadora


COLECCIONES_PUBLICAS = ["/importadores"]
COLECCIONES_PROTEGIDAS = ["/cotizaciones", "/ordenes"]


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(
        db_session, nombre_empresa="Importadora Rutas", email_dueño="dueño_rutas@example.com"
    )


class TestSlashFinalEquivalente:
    @pytest.mark.parametrize("ruta", COLECCIONES_PUBLICAS)
    def test_coleccion_publica_responde_en_ambas_formas(self, client, ruta):
        sin_slash = client.get(ruta)
        con_slash = client.get(f"{ruta}/")

        assert sin_slash.status_code == status.HTTP_200_OK
        assert con_slash.status_code == status.HTTP_200_OK
        assert sin_slash.json() == con_slash.json()

    @pytest.mark.parametrize("ruta", COLECCIONES_PROTEGIDAS)
    def test_coleccion_protegida_responde_en_ambas_formas(self, client, ruta, empresa):
        _, dueño = empresa
        headers = auth_headers_for(dueño)

        sin_slash = client.get(ruta, headers=headers)
        con_slash = client.get(f"{ruta}/", headers=headers)

        assert sin_slash.status_code == status.HTTP_200_OK
        assert con_slash.status_code == status.HTTP_200_OK
        assert sin_slash.json() == con_slash.json()

    def test_query_string_se_conserva(self, client):
        """Normalizar la ruta no debe descartar los filtros."""
        sin_slash = client.get("/importadores", params={"pais": "Colombia"})
        con_slash = client.get("/importadores/", params={"pais": "Colombia"})

        assert sin_slash.status_code == status.HTTP_200_OK
        assert con_slash.status_code == status.HTTP_200_OK
        assert sin_slash.json() == con_slash.json()

    def test_sin_redirect_intermedio(self, client):
        """La equivalencia se resuelve en el mismo request, no con un 307."""
        response = client.get("/importadores/", follow_redirects=False)

        assert response.status_code == status.HTTP_200_OK
        assert response.history == []

    def test_ruta_raiz_intacta(self, client):
        """`/` no debe quedar como cadena vacía al colapsar el slash."""
        response = client.get("/")
        assert response.status_code != status.HTTP_404_NOT_FOUND

    def test_ruta_inexistente_sigue_dando_404(self, client):
        assert client.get("/no-existe").status_code == status.HTTP_404_NOT_FOUND
        assert client.get("/no-existe/").status_code == status.HTTP_404_NOT_FOUND
