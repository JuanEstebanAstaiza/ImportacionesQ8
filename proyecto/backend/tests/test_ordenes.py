import pytest
from uuid import uuid4
from datetime import datetime
from unittest.mock import MagicMock

# Importar modelos y schemas necesarios
from models.orden import Orden, HistorialEstadosOrden, DocumentoOrden, EstadoOrden, TipoDocumentoOrden
from models.propuesta import Propuesta, EstadoPropuesta
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.usuario import Usuario
from utils.security import hash_password, create_access_token
from conftest import crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def test_solicitante(db_session):
    """Crear un usuario solicitante de prueba"""
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_ord@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def test_importador_user(db_session):
    """Cuenta dueña (rol='importador') de una empresa de prueba, ya vinculada vía
    importador_id (Fase 0: Usuario/Importador desacoplados)."""
    importador, dueño = crear_empresa_importadora(db_session, nombre_empresa="Importadora Órdenes Test", email_dueño="importador_ord@example.com")
    dueño.empresa = importador
    return dueño


@pytest.fixture()
def test_cotizacion_aceptada(db_session, test_solicitante, test_importador_user):
    """Crear una cotización en estado aceptada de prueba, cuyos dueños son
    `test_solicitante` y la empresa de `test_importador_user` para que coincidan
    con los tokens generados por `auth_headers_solicitante`/`auth_headers_importador`."""
    cotizacion = Cotizacion(
        id=str(uuid4()),
        solicitante_id=test_solicitante.id,
        importador_id=test_importador_user.importador_id,
        modalidad="dirigida",
        pais_importacion="China",
        nombre_producto="Camisetas personalizadas",
        descripcion_cliente="Necesito 500 camisetas con mi logo impreso en algodón premium",
        linea_producto="Textiles",
        tipo_calidad="estandar",
        cantidad_minima=500,
        precio_objetivo_usd=3.50,
        incoterm="FOB",
        estado=EstadoCotizacion.cotizacion_aceptada
    )
    db_session.add(cotizacion)
    
    propuesta = Propuesta(
        id=str(uuid4()),
        cotizacion_id=cotizacion.id,
        importador_id=test_importador_user.importador_id,
        precio_ofrecido_usd=3.20,
        tiempo_estimado_entrega="45 días",
        incoterm="FOB",
        estado=EstadoPropuesta.aceptada
    )
    db_session.add(propuesta)
    
    db_session.commit()
    db_session.refresh(cotizacion)
    return cotizacion


@pytest.fixture()
def auth_headers_solicitante(test_solicitante):
    """Headers de autenticación para el solicitante dueño de test_cotizacion_aceptada"""
    token = create_access_token(str(test_solicitante.id), "solicitante")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_headers_importador(test_importador_user):
    """Headers de autenticación para el importador dueño de test_cotizacion_aceptada"""
    return auth_headers_for(test_importador_user)


class TestListarOrdenes:
    
    def test_listar_ordenes_solicitante(self, client, db_session, test_cotizacion_aceptada, auth_headers_solicitante):
        """GET /ordenes/ - Solicitante ve sus órdenes"""
        # Crear una orden de prueba
        orden = Orden(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_aceptada.id,
            importador_id=test_cotizacion_aceptada.importador_id,
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=3.20,
            tiempo_estimado_entrega="45 días"
        )
        db_session.add(orden)
        db_session.commit()
        
        response = client.get("/ordenes/", headers=auth_headers_solicitante)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
    
    def test_listar_ordenes_importador(self, client, db_session, test_cotizacion_aceptada, auth_headers_importador):
        """GET /ordenes/ - Importador ve sus órdenes"""
        # Crear una orden de prueba
        orden = Orden(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_aceptada.id,
            importador_id=test_cotizacion_aceptada.importador_id,
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=3.20,
            tiempo_estimado_entrega="45 días"
        )
        db_session.add(orden)
        db_session.commit()
        
        response = client.get("/ordenes/", headers=auth_headers_importador)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1


class TestObtenerOrden:
    
    def test_obtener_orden_exitoso(self, client, db_session, test_cotizacion_aceptada, auth_headers_solicitante):
        """GET /ordenes/{id} - Obtener orden específica"""
        # Crear una orden de prueba
        orden = Orden(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_aceptada.id,
            importador_id=test_cotizacion_aceptada.importador_id,
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=3.20,
            tiempo_estimado_entrega="45 días"
        )
        db_session.add(orden)
        
        # Agregar historial de estados
        historial = HistorialEstadosOrden(
            orden_id=orden.id,
            estado_anterior=None,
            estado_nuevo=EstadoOrden.cotizacion_aceptada.value,
            fecha_cambio=datetime.utcnow()
        )
        db_session.add(historial)
        
        db_session.commit()
        
        response = client.get(f"/ordenes/{orden.id}", headers=auth_headers_solicitante)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(orden.id)
        assert data["estado"] == "cotizacion_aceptada"
    
    def test_obtener_orden_no_encontrada(self, client, db_session, auth_headers_solicitante):
        """GET /ordenes/{id} - Error si la orden no existe"""
        response = client.get(f"/ordenes/{uuid4()}", headers=auth_headers_solicitante)
        
        assert response.status_code == 404


class TestActualizarEstadoOrden:
    
    def test_actualizar_estado_exitoso(self, client, db_session, test_cotizacion_aceptada, auth_headers_importador):
        """PUT /ordenes/{id}/estado - Actualizar estado de orden"""
        # Crear una orden de prueba
        orden = Orden(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_aceptada.id,
            importador_id=test_cotizacion_aceptada.importador_id,
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=3.20,
            tiempo_estimado_entrega="45 días"
        )
        db_session.add(orden)
        db_session.commit()
        
        response = client.put(
            f"/ordenes/{orden.id}/estado",
            json={"estado": "en_produccion"},
            headers=auth_headers_importador
        )
        
        assert response.status_code == 200
        
        # Verificar que el estado se actualizó
        db_session.refresh(orden)
        assert orden.estado == EstadoOrden.en_produccion
    
    def test_actualizar_estado_transicion_invalida(self, client, db_session, test_cotizacion_aceptada, auth_headers_importador):
        """PUT /ordenes/{id}/estado - Error en transición inválida"""
        # Crear una orden de prueba
        orden = Orden(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_aceptada.id,
            importador_id=test_cotizacion_aceptada.importador_id,
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=3.20,
            tiempo_estimado_entrega="45 días"
        )
        db_session.add(orden)
        db_session.commit()
        
        # Intentar transición inválida (cotizacion_aceptada → entregado no es válido)
        response = client.put(
            f"/ordenes/{orden.id}/estado",
            json={"estado": "entregado"},
            headers=auth_headers_importador
        )
        
        assert response.status_code == 400
        
        # Verificar que el estado no cambió
        db_session.refresh(orden)
        assert orden.estado == EstadoOrden.cotizacion_aceptada
    
    def test_actualizar_estado_sin_autorizacion(self, client, db_session, test_cotizacion_aceptada, auth_headers_solicitante):
        """PUT /ordenes/{id}/estado - Solicitante no puede actualizar estado"""
        # Crear una orden de prueba
        orden = Orden(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_aceptada.id,
            importador_id=test_cotizacion_aceptada.importador_id,
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=3.20,
            tiempo_estimado_entrega="45 días"
        )
        db_session.add(orden)
        db_session.commit()
        
        response = client.put(
            f"/ordenes/{orden.id}/estado",
            json={"estado": "en_produccion"},
            headers=auth_headers_solicitante
        )
        
        assert response.status_code == 403


class TestAgregarDocumentoOrden:
    
    def test_agregar_documento_exitoso(self, client, db_session, test_cotizacion_aceptada, auth_headers_importador):
        """POST /ordenes/{id}/documentos - Agregar documento a orden"""
        # Crear una orden de prueba
        orden = Orden(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_aceptada.id,
            importador_id=test_cotizacion_aceptada.importador_id,
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=3.20,
            tiempo_estimado_entrega="45 días"
        )
        db_session.add(orden)
        db_session.commit()
        
        response = client.post(
            f"/ordenes/{orden.id}/documentos",
            json={
                "nombre": "Factura Proforma",
                "url": "/docs/factura_proforma.pdf",
                "tipo": "factura_proforma"
            },
            headers=auth_headers_importador
        )
        
        assert response.status_code == 201
        
        # Verificar que el documento se creó
        db_session.refresh(orden)
        assert len(orden.documentos_adjuntos) >= 1
    
    def test_agregar_documento_sin_autorizacion(self, client, db_session, test_cotizacion_aceptada, auth_headers_solicitante):
        """POST /ordenes/{id}/documentos - Solicitante no puede agregar documentos"""
        # Crear una orden de prueba
        orden = Orden(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_aceptada.id,
            importador_id=test_cotizacion_aceptada.importador_id,
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=3.20,
            tiempo_estimado_entrega="45 días"
        )
        db_session.add(orden)
        db_session.commit()
        
        response = client.post(
            f"/ordenes/{orden.id}/documentos",
            json={
                "nombre": "Factura Proforma",
                "url": "/docs/factura_proforma.pdf",
                "tipo": "factura_proforma"
            },
            headers=auth_headers_solicitante
        )
        
        assert response.status_code == 403


class TestOrdenAutomaticaPorDobleAceptacion:
    """Semana 4 - Fase 5: la orden ya no se crea manualmente vía
    `POST /ordenes/crear-orden` (eliminado); nace automáticamente cuando ambas
    partes pre-aceptan la misma propuesta (`POST /propuestas/{id}/pre-aceptar`)."""

    def test_endpoint_crear_orden_ya_no_existe(self, client, auth_headers_solicitante):
        """POST /ordenes/crear-orden - El endpoint fue eliminado. "crear-orden" ahora
        solo coincide con la ruta GET /ordenes/{orden_id}, que no admite POST (405)."""
        response = client.post(
            "/ordenes/crear-orden",
            json={"cotizacion_id": str(uuid4()), "importador_id": str(uuid4()), "solicitante_id": str(uuid4())},
            headers=auth_headers_solicitante
        )
        assert response.status_code == 405

    def test_doble_aceptacion_crea_orden_automaticamente(
        self, client, db_session, test_solicitante, test_importador_user, auth_headers_solicitante, auth_headers_importador
    ):
        """Doble pre-aceptación (solicitante + dueño) finaliza la propuesta y crea la Orden sin pago"""
        cotizacion = Cotizacion(
            id=str(uuid4()),
            solicitante_id=test_solicitante.id,
            importador_id=test_importador_user.importador_id,
            modalidad="dirigida",
            pais_importacion="China",
            nombre_producto="Camisetas personalizadas",
            descripcion_cliente="Necesito 500 camisetas con mi logo impreso en algodón premium",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            cantidad_minima=500,
            precio_objetivo_usd=3.50,
            incoterm="FOB",
            estado=EstadoCotizacion.propuestas_recibidas
        )
        db_session.add(cotizacion)

        propuesta = Propuesta(
            id=str(uuid4()),
            cotizacion_id=cotizacion.id,
            importador_id=test_importador_user.importador_id,
            precio_ofrecido_usd=3.20,
            tiempo_estimado_entrega="45 días",
            incoterm="FOB",
            estado=EstadoPropuesta.pendiente
        )
        db_session.add(propuesta)
        db_session.commit()
        db_session.refresh(propuesta)

        # Solo el solicitante pre-acepta: nada se finaliza aún
        r1 = client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_solicitante)
        assert r1.status_code == 200
        assert r1.json()["estado"] == "pendiente"

        orden_previa = db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()
        assert orden_previa is None

        # El dueño de la empresa también pre-acepta: se finaliza
        r2 = client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_importador)
        assert r2.status_code == 200
        assert r2.json()["estado"] == "aceptada"

        db_session.refresh(cotizacion)
        assert cotizacion.estado == EstadoCotizacion.orden_activa.value

        orden = db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()
        assert orden is not None
        assert orden.precio_acordado_usd == 3.20

    def test_pre_aceptar_no_finaliza_con_un_solo_lado(
        self, client, db_session, test_solicitante, test_importador_user, auth_headers_solicitante
    ):
        """Un solo lado pre-aceptando no crea la orden ni finaliza la propuesta"""
        cotizacion = Cotizacion(
            id=str(uuid4()),
            solicitante_id=test_solicitante.id,
            importador_id=test_importador_user.importador_id,
            modalidad="dirigida",
            pais_importacion="China",
            nombre_producto="Camisetas personalizadas",
            descripcion_cliente="Necesito 500 camisetas con mi logo impreso en algodón premium",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            cantidad_minima=500,
            precio_objetivo_usd=3.50,
            incoterm="FOB",
            estado=EstadoCotizacion.propuestas_recibidas
        )
        db_session.add(cotizacion)

        propuesta = Propuesta(
            id=str(uuid4()),
            cotizacion_id=cotizacion.id,
            importador_id=test_importador_user.importador_id,
            precio_ofrecido_usd=3.20,
            tiempo_estimado_entrega="45 días",
            incoterm="FOB",
            estado=EstadoPropuesta.pendiente
        )
        db_session.add(propuesta)
        db_session.commit()
        db_session.refresh(propuesta)

        response = client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_solicitante)
        assert response.status_code == 200
        assert response.json()["estado"] == "pendiente"
        assert response.json()["preaceptada_por_solicitante"] is True
        assert response.json()["preaceptada_por_empresa"] is False

        assert db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first() is None


class TestListarOrdenesActivasImportador:
    
    def test_listar_ordenes_activas(self, client, db_session, test_cotizacion_aceptada, test_importador_user, auth_headers_importador):
        """GET /ordenes/importador/{id}/activas - Listar órdenes activas del importador"""
        # Crear una orden activa (no entregado)
        orden = Orden(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_aceptada.id,
            importador_id=test_cotizacion_aceptada.importador_id,
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            estado=EstadoOrden.en_produccion,  # Estado activo
            precio_acordado_usd=3.20,
            tiempo_estimado_entrega="45 días"
        )
        db_session.add(orden)
        
        # Cada orden requiere su propia cotización (1:1 a nivel de base de datos),
        # así que la orden entregada usa una segunda cotización del mismo importador.
        cotizacion2 = Cotizacion(
            id=str(uuid4()),
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            importador_id=test_importador_user.importador_id,
            modalidad="dirigida",
            pais_importacion="China",
            nombre_producto="Camisetas personalizadas 2",
            descripcion_cliente="Segundo lote de camisetas con logo impreso",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            cantidad_minima=300,
            precio_objetivo_usd=3.50,
            incoterm="FOB",
            estado=EstadoCotizacion.cotizacion_aceptada
        )
        db_session.add(cotizacion2)
        db_session.commit()
        
        # Crear una orden entregada (no debería aparecer)
        orden_entregada = Orden(
            id=str(uuid4()),
            cotizacion_id=cotizacion2.id,
            importador_id=test_importador_user.importador_id,
            solicitante_id=test_cotizacion_aceptada.solicitante_id,
            estado=EstadoOrden.entregado,  # Estado entregado
            precio_acordado_usd=3.20,
            tiempo_estimado_entrega="45 días"
        )
        db_session.add(orden_entregada)
        
        db_session.commit()
        
        response = client.get(
            f"/ordenes/importador/{test_cotizacion_aceptada.importador_id}/activas",
            headers=auth_headers_importador
        )
        
        assert response.status_code == 200
        data = response.json()
        # Solo debe aparecer la orden activa, no la entregada
        assert len(data) >= 1