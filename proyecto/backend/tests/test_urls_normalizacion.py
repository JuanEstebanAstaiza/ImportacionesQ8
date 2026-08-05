import pytest

from utils.urls import canonicalize_resource_url

CANONICA = "/documentos/archivos/abc/descargar"


class TestCanonicalizacionRecursos:
    @pytest.mark.parametrize(
        "guardado",
        [
            CANONICA,
            "/api" + CANONICA,
            "/api/api" + CANONICA,
            "/documentos//archivos/abc/descargar",
            "/api//documentos/archivos/abc/descargar",
            "http://localhost:5173/api" + CANONICA,
            "http://127.0.0.1:5173/api" + CANONICA,
            "http://localhost:8000" + CANONICA,
            "https://ab12cd-5173.devtunnels.ms/api" + CANONICA,
        ],
    )
    def test_toda_forma_guardada_se_reduce_a_la_ruta_del_backend(self, guardado):
        assert canonicalize_resource_url(guardado) == CANONICA

    def test_conserva_query_string(self):
        assert canonicalize_resource_url("/api" + CANONICA + "?v=2") == CANONICA + "?v=2"

    def test_url_externa_se_conserva_intacta(self):
        externa = "https://cdn.ejemplo.com/portadas/curso.jpg"
        assert canonicalize_resource_url(externa) == externa

    def test_vacio_y_none_pasan_sin_cambios(self):
        assert canonicalize_resource_url(None) is None
        assert canonicalize_resource_url("") == ""

    @pytest.mark.parametrize(
        "malicioso",
        [
            "javascript:alert(1)",
            "data:text/html;base64,PHNjcmlwdD4=",
            "vbscript:msgbox(1)",
            "ftp://host/archivo",
            "//evil.com/archivo",
            "example.com/sin-esquema",
        ],
    )
    def test_esquemas_no_http_rechazados(self, malicioso):
        with pytest.raises(ValueError):
            canonicalize_resource_url(malicioso)

    @pytest.mark.parametrize(
        "youtube",
        [
            "https://www.youtube.com/embed/abc123",
            "https://youtu.be/abc123",
        ],
    )
    def test_youtube_sigue_bloqueado(self, youtube):
        with pytest.raises(ValueError):
            canonicalize_resource_url(youtube)
