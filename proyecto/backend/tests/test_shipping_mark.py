"""Shipping mark: prefijo de la empresa + sufijo del cliente.

La marca que va rotulada en las cajas se arma con dos piezas de dos dueños
distintos: la empresa importadora fija su prefijo ("ctl") en el perfil y el
cliente aporta el suyo ("prendas control") al pedir la cotización, dando
"ctl-prendascontrol". Sirve para distinguir la carga de cada cliente dentro del
contenedor de la importadora.

Se cubre la composición, el recorrido por la API (perfil de empresa →
cotización → orden) y el congelado de la marca al crear la orden.
"""
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import status

from models.cotizacion import Cotizacion
from models.propuesta import EstadoPropuesta
from utils.shipping_mark import componer_shipping_mark, normalizar_segmento
from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token


class TestComposicion:
    def test_el_caso_del_negocio(self):
        assert componer_shipping_mark("ctl", "prendas control") == "ctl-prendascontrol"

    @pytest.mark.parametrize(
        "entrada, esperado",
        [
            ("PRENDAS CONTROL", "prendascontrol"),
            ("Diseños Peñalosa", "disenospenalosa"),
            ("  con   espacios  ", "conespacios"),
            ("guion-bajo_y.puntos", "guionbajoypuntos"),
            ("Lote 2026", "lote2026"),
            ("", ""),
            (None, ""),
            ("///", ""),
        ],
    )
    def test_normalizacion_a_ascii(self, entrada, esperado):
        """Acaba estarcido en cartón y leído en aduanas: solo [a-z0-9]."""
        assert normalizar_segmento(entrada) == esperado

    @pytest.mark.parametrize(
        "prefijo, sufijo",
        [
            (None, "prendas control"),
            ("ctl", None),
            ("", "prendas control"),
            ("ctl", "   "),
            ("///", "prendas control"),
        ],
    )
    def test_media_marca_no_es_marca(self, prefijo, sufijo):
        """Un "ctl-" suelto en un documento de embarque es peor que nada."""
        assert componer_shipping_mark(prefijo, sufijo) is None


@pytest.fixture()
def solicitante(db_session):
    return crear_usuario_con_token(db_session, rol="solicitante")


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(
        db_session,
        nombre_empresa=f"Control Textil {uuid4().hex[:6]}",
        email_dueño=f"ctl_{uuid4().hex[:6]}@example.com",
        especialidad_producto=["Textil"],
    )


def _payload_cotizacion(**overrides):
    payload = {
        "modalidad": "abierta",
        "pais_importacion": "China",
        "nombre_producto": "Camisetas personalizadas",
        "descripcion_cliente": "500 camisetas con logo impreso en algodón premium",
        "linea_producto": "Textil",
        "tipo_calidad": "estandar",
        "cantidad_minima": 500,
        "incoterm": "FOB",
        "shipping_mark_sufijo": "prendas control",
    }
    payload.update(overrides)
    return payload


class TestPrefijoDeLaEmpresa:
    def test_la_empresa_fija_y_normaliza_su_prefijo(self, client, empresa):
        importador, dueño = empresa

        respuesta = client.put(
            f"/importadores/{importador.id}",
            json={"shipping_mark_prefijo": "  CTL "},
            headers=auth_headers_for(dueño),
        )

        assert respuesta.status_code == status.HTTP_200_OK, respuesta.text
        assert respuesta.json()["shipping_mark_prefijo"] == "ctl"

    def test_el_prefijo_es_visible_en_el_catalogo_publico(self, client, db_session, empresa):
        """El solicitante lo ve antes de cotizar: así sabe cómo quedará rotulada su carga."""
        importador, _ = empresa
        importador.shipping_mark_prefijo = "ctl"
        db_session.commit()

        fila = next(i for i in client.get("/importadores").json() if i["id"] == str(importador.id))
        assert fila["shipping_mark_prefijo"] == "ctl"

    def test_un_prefijo_sin_letras_ni_numeros_se_rechaza(self, client, empresa):
        importador, dueño = empresa

        respuesta = client.put(
            f"/importadores/{importador.id}",
            json={"shipping_mark_prefijo": "///"},
            headers=auth_headers_for(dueño),
        )
        assert respuesta.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_se_puede_quitar_el_prefijo(self, client, db_session, empresa):
        importador, dueño = empresa
        importador.shipping_mark_prefijo = "ctl"
        db_session.commit()

        respuesta = client.put(
            f"/importadores/{importador.id}",
            json={"shipping_mark_prefijo": ""},
            headers=auth_headers_for(dueño),
        )
        assert respuesta.status_code == status.HTTP_200_OK
        assert respuesta.json()["shipping_mark_prefijo"] is None


class TestSufijoDelCliente:
    def test_la_cotizacion_dirigida_devuelve_la_marca_completa(self, client, db_session, solicitante, empresa):
        _, headers = solicitante
        importador, _ = empresa
        importador.shipping_mark_prefijo = "ctl"
        db_session.commit()

        respuesta = client.post(
            "/cotizaciones",
            json=_payload_cotizacion(modalidad="dirigida", importador_id=str(importador.id)),
            headers=headers,
        )

        assert respuesta.status_code == status.HTTP_201_CREATED, respuesta.text
        cuerpo = respuesta.json()
        # El sufijo se conserva tal cual lo escribió el cliente...
        assert cuerpo["shipping_mark_sufijo"] == "prendas control"
        # ...y la marca compuesta ya viene lista para rotular.
        assert cuerpo["shipping_mark"] == "ctl-prendascontrol"

    def test_en_abierta_no_hay_marca_hasta_saber_la_empresa(self, client, solicitante):
        """Sin empresa no hay prefijo, así que la marca todavía no existe."""
        _, headers = solicitante

        respuesta = client.post("/cotizaciones", json=_payload_cotizacion(), headers=headers)

        assert respuesta.status_code == status.HTTP_201_CREATED
        assert respuesta.json()["shipping_mark_sufijo"] == "prendas control"
        assert respuesta.json()["shipping_mark"] is None

    def test_una_empresa_sin_prefijo_no_produce_marca(self, client, solicitante, empresa):
        _, headers = solicitante
        importador, _ = empresa  # sin shipping_mark_prefijo

        respuesta = client.post(
            "/cotizaciones",
            json=_payload_cotizacion(modalidad="dirigida", importador_id=str(importador.id)),
            headers=headers,
        )
        assert respuesta.status_code == status.HTTP_201_CREATED
        assert respuesta.json()["shipping_mark"] is None

    def test_el_sufijo_es_opcional(self, client, solicitante):
        _, headers = solicitante
        payload = _payload_cotizacion()
        payload.pop("shipping_mark_sufijo")

        respuesta = client.post("/cotizaciones", json=payload, headers=headers)
        assert respuesta.status_code == status.HTTP_201_CREATED
        assert respuesta.json()["shipping_mark_sufijo"] is None

    def test_un_sufijo_sin_letras_ni_numeros_se_rechaza(self, client, solicitante):
        _, headers = solicitante

        respuesta = client.post(
            "/cotizaciones",
            json=_payload_cotizacion(shipping_mark_sufijo="---"),
            headers=headers,
        )
        assert respuesta.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_un_sufijo_demasiado_largo_se_rechaza(self, client, solicitante):
        _, headers = solicitante

        respuesta = client.post(
            "/cotizaciones",
            json=_payload_cotizacion(shipping_mark_sufijo="x" * 41),
            headers=headers,
        )
        assert respuesta.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestMarcaEnLaOrden:
    def _cotizacion_dirigida(self, db_session, solicitante_id, importador_id, sufijo="prendas control"):
        cotizacion = Cotizacion(
            id=str(uuid4()),
            solicitante_id=solicitante_id,
            importador_id=importador_id,
            modalidad="dirigida",
            pais_importacion="China",
            nombre_producto="Camisetas personalizadas",
            descripcion_cliente="500 camisetas con logo impreso en algodón premium",
            linea_producto="Textil",
            tipo_calidad="estandar",
            cantidad_minima=500,
            incoterm="FOB",
            shipping_mark_sufijo=sufijo,
            estado="dirigida",
            fecha_creacion=datetime.utcnow(),
        )
        db_session.add(cotizacion)
        db_session.commit()
        db_session.refresh(cotizacion)
        return cotizacion

    def _propuesta_aceptada_por_ambos(self, client, db_session, cotizacion, dueño, headers_solicitante):
        """Recorre la doble aceptación real hasta que se crea la orden."""
        creada = client.post(
            "/propuestas",
            json={
                "cotizacion_id": str(cotizacion.id),
                "precio_ofrecido_usd": 1500.0,
                "tiempo_estimado_entrega": "45 días",
                "incoterm": "FOB",
            },
            headers=auth_headers_for(dueño),
        )
        assert creada.status_code == status.HTTP_201_CREATED, creada.text
        propuesta_id = creada.json()["id"]

        for headers in (headers_solicitante, auth_headers_for(dueño)):
            confirmada = client.post(
                f"/propuestas/{propuesta_id}/pre-aceptar",
                json={"aceptar": True},
                headers=headers,
            )
            assert confirmada.status_code == status.HTTP_200_OK, confirmada.text

        assert confirmada.json()["estado"] == EstadoPropuesta.aceptada.value
        return propuesta_id

    def test_la_orden_hereda_la_marca(self, client, db_session, solicitante, empresa):
        usuario, headers = solicitante
        importador, dueño = empresa
        importador.shipping_mark_prefijo = "ctl"
        db_session.commit()

        cotizacion = self._cotizacion_dirigida(db_session, usuario.id, str(importador.id))
        self._propuesta_aceptada_por_ambos(client, db_session, cotizacion, dueño, headers)

        ordenes = client.get("/ordenes", headers=headers).json()
        orden = next(o for o in ordenes if o["cotizacion_id"] == str(cotizacion.id))
        assert orden["shipping_mark"] == "ctl-prendascontrol"

    def test_cambiar_el_prefijo_no_reescribe_una_orden_ya_creada(self, client, db_session, solicitante, empresa):
        """Las cajas ya están rotuladas: la orden guarda su copia, no la recalcula."""
        usuario, headers = solicitante
        importador, dueño = empresa
        importador.shipping_mark_prefijo = "ctl"
        db_session.commit()

        cotizacion = self._cotizacion_dirigida(db_session, usuario.id, str(importador.id))
        self._propuesta_aceptada_por_ambos(client, db_session, cotizacion, dueño, headers)

        cambiado = client.put(
            f"/importadores/{importador.id}",
            json={"shipping_mark_prefijo": "nuevo"},
            headers=auth_headers_for(dueño),
        )
        assert cambiado.status_code == status.HTTP_200_OK

        ordenes = client.get("/ordenes", headers=headers).json()
        orden = next(o for o in ordenes if o["cotizacion_id"] == str(cotizacion.id))
        assert orden["shipping_mark"] == "ctl-prendascontrol"

    def test_sin_sufijo_la_orden_queda_sin_marca(self, client, db_session, solicitante, empresa):
        usuario, headers = solicitante
        importador, dueño = empresa
        importador.shipping_mark_prefijo = "ctl"
        db_session.commit()

        cotizacion = self._cotizacion_dirigida(db_session, usuario.id, str(importador.id), sufijo=None)
        self._propuesta_aceptada_por_ambos(client, db_session, cotizacion, dueño, headers)

        ordenes = client.get("/ordenes", headers=headers).json()
        orden = next(o for o in ordenes if o["cotizacion_id"] == str(cotizacion.id))
        assert orden["shipping_mark"] is None

    def test_dos_clientes_de_la_misma_empresa_se_distinguen(self, client, db_session, empresa):
        """El propósito del shipping mark: separar la carga de cada cliente."""
        importador, dueño = empresa
        importador.shipping_mark_prefijo = "ctl"
        db_session.commit()

        marcas = []
        for sufijo in ("prendas control", "moda andina"):
            usuario, headers = crear_usuario_con_token(db_session, rol="solicitante")
            cotizacion = self._cotizacion_dirigida(db_session, usuario.id, str(importador.id), sufijo=sufijo)
            self._propuesta_aceptada_por_ambos(client, db_session, cotizacion, dueño, headers)
            ordenes = client.get("/ordenes", headers=headers).json()
            orden = next(o for o in ordenes if o["cotizacion_id"] == str(cotizacion.id))
            marcas.append(orden["shipping_mark"])

        assert marcas == ["ctl-prendascontrol", "ctl-modaandina"]
        assert len(set(marcas)) == 2
