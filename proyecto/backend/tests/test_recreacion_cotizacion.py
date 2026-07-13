"""Tests del flujo de recreación de cotización por error, mediado por un admin (Semana 4)."""
from uuid import uuid4
from datetime import datetime

import pytest
from fastapi import status

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.credito import MovimientoCredito
from utils.security import hash_password, create_access_token
from conftest import crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_recreacion@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        creditos_balance=50.0,
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(db_session, nombre_empresa="Empresa Recreacion")


@pytest.fixture()
def cotizacion_aceptada(db_session, solicitante, empresa):
    importador, dueño = empresa
    cotizacion = Cotizacion(
        id=str(uuid4()),
        solicitante_id=solicitante.id,
        importador_id=importador.id,
        modalidad="dirigida",
        pais_importacion="China",
        nombre_producto="Camisetas personalizadas",
        descripcion_cliente="500 camisetas con logo impreso en algodón premium",
        linea_producto="Textiles",
        tipo_calidad="estandar",
        cantidad_minima=500,
        precio_objetivo_usd=3.50,
        incoterm="FOB",
        costo_creditos=5.0,
        estado=EstadoCotizacion.cotizacion_aceptada
    )
    db_session.add(cotizacion)
    db_session.commit()
    db_session.refresh(cotizacion)
    return cotizacion


def _auth_headers(usuario, rol="solicitante"):
    token = create_access_token(str(usuario.id), rol)
    return {"Authorization": f"Bearer {token}"}


class TestSolicitarRecreacion:

    def test_solicitante_puede_solicitar_recreacion(self, client, cotizacion_aceptada, solicitante):
        response = client.post(
            f"/cotizaciones/{cotizacion_aceptada.id}/solicitar-recreacion",
            json={"motivo": "El importador cambió las condiciones acordadas por chat", "parte_atribuida_sugerida": "importador"},
            headers=_auth_headers(solicitante)
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["estado"] == "pendiente"
        assert data["cotizacion_origen_id"] == cotizacion_aceptada.id

    def test_no_puede_solicitar_recreacion_de_cotizacion_ajena(self, client, cotizacion_aceptada):
        otro_token = create_access_token(str(uuid4()), "solicitante")
        response = client.post(
            f"/cotizaciones/{cotizacion_aceptada.id}/solicitar-recreacion",
            json={"motivo": "Motivo cualquiera de más de diez caracteres", "parte_atribuida_sugerida": "solicitante"},
            headers={"Authorization": f"Bearer {otro_token}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_no_puede_solicitar_recreacion_de_cotizacion_no_aceptada(self, client, db_session, solicitante):
        cotizacion = Cotizacion(
            id=str(uuid4()),
            solicitante_id=solicitante.id,
            importador_id=None,
            modalidad="abierta",
            pais_importacion="China",
            nombre_producto="Producto",
            descripcion_cliente="Descripción de prueba con más de veinte caracteres",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            cantidad_minima=100,
            incoterm="FOB",
            estado="abierta"
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.post(
            f"/cotizaciones/{cotizacion.id}/solicitar-recreacion",
            json={"motivo": "Motivo cualquiera de más de diez caracteres", "parte_atribuida_sugerida": "solicitante"},
            headers=_auth_headers(solicitante)
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestSolicitarRecreacionAbierta:
    """En cotizaciones abiertas el importador_id puede ser NULL hasta fijarse;
    la empresa ganadora se identifica por la propuesta aceptada."""

    def test_dueño_puede_solicitar_recreacion_en_abierta_via_propuesta(
        self, client, db_session, solicitante, empresa
    ):
        from models.propuesta import Propuesta, EstadoPropuesta

        importador, dueño = empresa
        cotizacion = Cotizacion(
            id=str(uuid4()),
            solicitante_id=solicitante.id,
            importador_id=None,
            modalidad="abierta",
            pais_importacion="China",
            nombre_producto="Producto abierto aceptado",
            descripcion_cliente="Descripción de prueba con más de veinte caracteres",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            cantidad_minima=100,
            precio_objetivo_usd=2.0,
            incoterm="FOB",
            costo_creditos=5.0,
            estado=EstadoCotizacion.orden_activa.value,
        )
        db_session.add(cotizacion)
        db_session.flush()
        propuesta = Propuesta(
            id=str(uuid4()),
            cotizacion_id=cotizacion.id,
            importador_id=importador.id,
            precio_ofrecido_usd=2.0,
            tiempo_estimado_entrega="20 días",
            incoterm="FOB",
            estado=EstadoPropuesta.aceptada.value,
        )
        db_session.add(propuesta)
        db_session.commit()

        response = client.post(
            f"/cotizaciones/{cotizacion.id}/solicitar-recreacion",
            json={
                "motivo": "Error en especificaciones de la cotización abierta",
                "parte_atribuida_sugerida": "solicitante",
            },
            headers=auth_headers_for(dueño),
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["estado"] == "pendiente"

    def _crear_solicitud(self, client, cotizacion_aceptada, solicitante):
        response = client.post(
            f"/cotizaciones/{cotizacion_aceptada.id}/solicitar-recreacion",
            json={"motivo": "El importador cambió las condiciones acordadas por chat", "parte_atribuida_sugerida": "importador"},
            headers=_auth_headers(solicitante)
        )
        return response.json()["id"]

    def test_admin_aprueba_atribuyendo_a_importador_reembolsa_creditos(
        self, client, db_session, cotizacion_aceptada, solicitante
    ):
        solicitud_id = self._crear_solicitud(client, cotizacion_aceptada, solicitante)
        saldo_antes = solicitante.creditos_balance

        admin_token = create_access_token(str(uuid4()), "admin")
        response = client.put(
            f"/admin/recreaciones/{solicitud_id}/resolver",
            json={"parte_atribuida_final": "importador", "aprobado": True},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["estado"] == "aprobada"

        db_session.refresh(cotizacion_aceptada)
        assert cotizacion_aceptada.estado == EstadoCotizacion.cancelada.value
        assert cotizacion_aceptada.cancelada_por_error == "importador"

        db_session.refresh(solicitante)
        assert solicitante.creditos_balance == saldo_antes + cotizacion_aceptada.costo_creditos

        movimiento = db_session.query(MovimientoCredito).filter(
            MovimientoCredito.cotizacion_id == cotizacion_aceptada.id,
            MovimientoCredito.tipo == "reembolso"
        ).first()
        assert movimiento is not None

    def test_admin_aprueba_atribuyendo_a_solicitante_no_reembolsa(
        self, client, db_session, cotizacion_aceptada, solicitante
    ):
        solicitud_id = self._crear_solicitud(client, cotizacion_aceptada, solicitante)
        saldo_antes = solicitante.creditos_balance

        admin_token = create_access_token(str(uuid4()), "admin")
        response = client.put(
            f"/admin/recreaciones/{solicitud_id}/resolver",
            json={"parte_atribuida_final": "solicitante", "aprobado": True},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        db_session.refresh(solicitante)
        assert solicitante.creditos_balance == saldo_antes

    def test_solo_admin_puede_resolver(self, client, cotizacion_aceptada, solicitante):
        solicitud_id = self._crear_solicitud(client, cotizacion_aceptada, solicitante)

        response = client.put(
            f"/admin/recreaciones/{solicitud_id}/resolver",
            json={"parte_atribuida_final": "importador", "aprobado": True},
            headers=_auth_headers(solicitante)
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_no_se_puede_resolver_dos_veces(self, client, cotizacion_aceptada, solicitante):
        solicitud_id = self._crear_solicitud(client, cotizacion_aceptada, solicitante)
        admin_token = create_access_token(str(uuid4()), "admin")
        headers = {"Authorization": f"Bearer {admin_token}"}

        primera = client.put(
            f"/admin/recreaciones/{solicitud_id}/resolver",
            json={"parte_atribuida_final": "importador", "aprobado": True},
            headers=headers
        )
        assert primera.status_code == status.HTTP_200_OK

        segunda = client.put(
            f"/admin/recreaciones/{solicitud_id}/resolver",
            json={"parte_atribuida_final": "importador", "aprobado": True},
            headers=headers
        )
        assert segunda.status_code == status.HTTP_400_BAD_REQUEST

    def test_listar_recreaciones_admin(self, client, cotizacion_aceptada, solicitante):
        self._crear_solicitud(client, cotizacion_aceptada, solicitante)

        admin_token = create_access_token(str(uuid4()), "admin")
        response = client.get("/admin/recreaciones", headers={"Authorization": f"Bearer {admin_token}"})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) >= 1
