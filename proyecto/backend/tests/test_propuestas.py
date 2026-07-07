import pytest
from uuid import uuid4
from datetime import datetime
from unittest.mock import MagicMock

# Importar modelos y schemas necesarios
from models.propuesta import Propuesta, EstadoPropuesta
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.usuario import Usuario
from utils.security import hash_password, create_access_token


@pytest.fixture()
def test_solicitante(db_session):
    """Crear un usuario solicitante de prueba"""
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_test@example.com",
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
    """Crear un usuario importador de prueba"""
    user = Usuario(
        id=str(uuid4()),
        email="importador_test@example.com",
        password_hash=hash_password("123456789"),
        rol="importador",
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def test_cotizacion_abierta(db_session, test_solicitante):
    """Crear una cotización abierta de prueba, cuyo dueño es `test_solicitante`."""
    cotizacion = Cotizacion(
        id=str(uuid4()),
        solicitante_id=test_solicitante.id,
        importador_id=None,
        modalidad="abierta",
        pais_importacion="China",
        nombre_producto="Camisetas personalizadas",
        descripcion_cliente="Necesito 500 camisetas con mi logo impreso en algodón premium",
        linea_producto="Textiles",
        tipo_calidad="estandar",
        cantidad_minima=500,
        precio_objetivo_usd=3.50,
        incoterm="FOB",
        estado="abierta"
    )
    db_session.add(cotizacion)
    db_session.commit()
    db_session.refresh(cotizacion)
    return cotizacion


@pytest.fixture()
def auth_headers_solicitante(test_solicitante):
    """Headers de autenticación para el solicitante dueño de test_cotizacion_abierta"""
    token = create_access_token(str(test_solicitante.id), "solicitante")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_headers_importador(test_importador_user):
    """Headers de autenticación para el importador de prueba `test_importador_user`"""
    token = create_access_token(str(test_importador_user.id), "importador")
    return {"Authorization": f"Bearer {token}"}


class TestEnviarPropuesta:
    
    def test_enviar_propuesta_exitoso(self, client, db_session, test_cotizacion_abierta, test_importador_user, auth_headers_importador):
        """POST /propuestas - Crear propuesta exitosamente"""
        # Mock Redis para el matching: el importador autenticado SÍ está en la lista de matching
        import config
        redis_mock = MagicMock()
        redis_mock.hgetall.return_value = {str(test_importador_user.id): "pendiente"}
        original_redis = config.redis_client
        config.redis_client = redis_mock
        
        try:
            response = client.post(
                "/propuestas",
                json={
                    "cotizacion_id": str(test_cotizacion_abierta.id),
                    "precio_ofrecido_usd": 3.20,
                    "tiempo_estimado_entrega": "45 días",
                    "incoterm": "FOB",
                    "condiciones_adicionales": "Incluye embalaje especial"
                },
                headers=auth_headers_importador
            )
            
            assert response.status_code == 201
            data = response.json()
            assert data["cotizacion_id"] == str(test_cotizacion_abierta.id)
            assert data["precio_ofrecido_usd"] == 3.20
            assert data["tiempo_estimado_entrega"] == "45 días"
            assert data["incoterm"] == "FOB"
            assert data["estado"] == "pendiente"
        finally:
            config.redis_client = original_redis
    
    def test_enviar_propuesta_sin_rol_importador(self, client, db_session, test_cotizacion_abierta, auth_headers_solicitante):
        """POST /propuestas - Debe rechazar si no es importador"""
        response = client.post(
            "/propuestas",
            json={
                "cotizacion_id": str(test_cotizacion_abierta.id),
                "precio_ofrecido_usd": 3.20,
                "tiempo_estimado_entrega": "45 días",
                "incoterm": "FOB"
            },
            headers=auth_headers_solicitante
        )
        
        assert response.status_code == 403
    
    def test_enviar_propuesta_cotizacion_no_encontrada(self, client, db_session, auth_headers_importador):
        """POST /propuestas - Debe rechazar si la cotización no existe"""
        import config
        redis_mock = MagicMock()
        original_redis = config.redis_client
        config.redis_client = redis_mock
        
        try:
            response = client.post(
                "/propuestas",
                json={
                    "cotizacion_id": str(uuid4()),  # ID inválido
                    "precio_ofrecido_usd": 3.20,
                    "tiempo_estimado_entrega": "45 días",
                    "incoterm": "FOB"
                },
                headers=auth_headers_importador
            )
            
            assert response.status_code == 404
        finally:
            config.redis_client = original_redis
    
    def test_enviar_propuesta_duplicada(self, client, db_session, test_cotizacion_abierta, auth_headers_importador):
        """POST /propuestas - Debe rechazar si ya existe una propuesta del mismo importador"""
        # Crear primera propuesta
        importador_user = Usuario(
            id=str(uuid4()),
            email="importador_dup@example.com",
            password_hash=hash_password("123456789"),
            rol="importador",
            perfil_completo=True,
            fecha_creacion=datetime.utcnow()
        )
        db_session.add(importador_user)
        db_session.commit()
        
        import config
        redis_mock = MagicMock()
        redis_mock.hgetall.return_value = {str(importador_user.id): "respondido"}
        original_redis = config.redis_client
        config.redis_client = redis_mock
        
        try:
            # Crear token con el importador real (el que está en la lista de matching de Redis)
            token = create_access_token(str(importador_user.id), "importador")
            auth_headers = {"Authorization": f"Bearer {token}"}
            
            response1 = client.post(
                "/propuestas",
                json={
                    "cotizacion_id": str(test_cotizacion_abierta.id),
                    "precio_ofrecido_usd": 3.20,
                    "tiempo_estimado_entrega": "45 días",
                    "incoterm": "FOB"
                },
                headers=auth_headers
            )
            
            assert response1.status_code == 201
            
            # Segunda propuesta - debe fallar por duplicada
            response2 = client.post(
                "/propuestas",
                json={
                    "cotizacion_id": str(test_cotizacion_abierta.id),
                    "precio_ofrecido_usd": 3.50,
                    "tiempo_estimado_entrega": "40 días",
                    "incoterm": "CIF"
                },
                headers=auth_headers
            )
            
            assert response2.status_code == 400
        finally:
            config.redis_client = original_redis


class TestListarPropuestas:
    
    def test_listar_propuestas_solicitante(self, client, db_session, test_cotizacion_abierta, auth_headers_solicitante):
        """GET /cotizaciones/{id}/propuestas - Solicitante ve las propuestas"""
        # Crear una propuesta de prueba
        importador_user = Usuario(
            id=str(uuid4()),
            email="importador_list@example.com",
            password_hash=hash_password("123456789"),
            rol="importador",
            perfil_completo=True,
            fecha_creacion=datetime.utcnow()
        )
        db_session.add(importador_user)
        db_session.commit()
        
        propuesta = Propuesta(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_abierta.id,
            importador_id=importador_user.id,
            precio_ofrecido_usd=3.20,
            tiempo_estimado_entrega="45 días",
            incoterm="FOB",
            estado=EstadoPropuesta.pendiente
        )
        db_session.add(propuesta)
        db_session.commit()
        
        response = client.get(
            f"/cotizaciones/{test_cotizacion_abierta.id}/propuestas",
            headers=auth_headers_solicitante
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
    
    def test_listar_propuestas_sin_autorizacion(self, client, db_session, test_cotizacion_abierta, auth_headers_importador):
        """GET /cotizaciones/{id}/propuestas - Importador no puede ver propuestas"""
        response = client.get(
            f"/cotizaciones/{test_cotizacion_abierta.id}/propuestas",
            headers=auth_headers_importador
        )
        
        assert response.status_code == 403


class TestAceptarPropuesta:
    
    def test_aceptar_propuesta_exitoso(self, client, db_session, test_cotizacion_abierta, auth_headers_solicitante):
        """PUT /cotizaciones/{id}/propuestas/aceptar - Aceptar propuesta exitosamente"""
        # Crear una propuesta de prueba
        importador_user = Usuario(
            id=str(uuid4()),
            email="importador_acepta@example.com",
            password_hash=hash_password("123456789"),
            rol="importador",
            perfil_completo=True,
            fecha_creacion=datetime.utcnow()
        )
        db_session.add(importador_user)
        db_session.commit()
        
        # Crear primera propuesta
        propuesta = Propuesta(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_abierta.id,
            importador_id=importador_user.id,
            precio_ofrecido_usd=3.20,
            tiempo_estimado_entrega="45 días",
            incoterm="FOB",
            estado=EstadoPropuesta.pendiente
        )
        db_session.add(propuesta)
        
        # Crear segunda propuesta de otro importador
        importador_user2 = Usuario(
            id=str(uuid4()),
            email="importador_acepta2@example.com",
            password_hash=hash_password("123456789"),
            rol="importador",
            perfil_completo=True,
            fecha_creacion=datetime.utcnow()
        )
        db_session.add(importador_user2)
        
        propuesta2 = Propuesta(
            id=str(uuid4()),
            cotizacion_id=test_cotizacion_abierta.id,
            importador_id=importador_user2.id,
            precio_ofrecido_usd=3.50,
            tiempo_estimado_entrega="40 días",
            incoterm="CIF",
            estado=EstadoPropuesta.pendiente
        )
        db_session.add(propuesta2)
        
        # Actualizar cotización a "propuestas_recibidas"
        test_cotizacion_abierta.estado = EstadoCotizacion.propuestas_recibidas
        
        db_session.commit()
        
        response = client.put(
            f"/cotizaciones/{test_cotizacion_abierta.id}/propuestas/aceptar",
            json={"importador_id": str(importador_user.id)},
            headers=auth_headers_solicitante
        )
        
        assert response.status_code == 200
        
        # Verificar que la propuesta aceptada está en estado "aceptada"
        db_session.refresh(propuesta)
        assert propuesta.estado == EstadoPropuesta.aceptada
        
        # Verificar que las demás propuestas están rechazadas
        db_session.refresh(propuesta2)
        assert propuesta2.estado == EstadoPropuesta.rechazada
        
        # Verificar que la cotización cambió a "cotizacion_aceptada"
        db_session.refresh(test_cotizacion_abierta)
        assert test_cotizacion_abierta.estado == EstadoCotizacion.cotizacion_aceptada
    
    def test_aceptar_propuesta_sin_autorizacion(self, client, db_session, test_cotizacion_abierta, auth_headers_importador):
        """PUT /cotizaciones/{id}/propuestas/aceptar - Importador no puede aceptar propuestas"""
        response = client.put(
            f"/cotizaciones/{test_cotizacion_abierta.id}/propuestas/aceptar",
            json={"importador_id": str(uuid4())},
            headers=auth_headers_importador
        )
        
        assert response.status_code == 403
    
    def test_aceptar_propuesta_sin_propuestas(self, client, db_session, test_cotizacion_abierta, auth_headers_solicitante):
        """PUT /cotizaciones/{id}/propuestas/aceptar - Error si no hay propuestas pendientes"""
        response = client.put(
            f"/cotizaciones/{test_cotizacion_abierta.id}/propuestas/aceptar",
            json={"importador_id": str(uuid4())},
            headers=auth_headers_solicitante
        )
        
        assert response.status_code == 400


class TestMatchingStatus:
    """GET /cotizaciones/{id}/matching-status - Estado de difusión de una cotización abierta
    (wireframe Pantalla 6: contador 'X de Y importadores respondieron' + pendientes)."""

    def test_matching_status_exitoso(self, client, db_session, test_cotizacion_abierta, auth_headers_solicitante):
        """Devuelve conteos y datos de los importadores pendientes de responder"""
        from models.importador import Importador

        importador_pendiente = Importador(
            id=str(uuid4()),
            nombre_empresa="Importadora Pendiente SA",
            logo_url="https://example.com/logo.png",
            especialidad_producto=["Textiles"],
            paises_origen=["China"],
            calificacion_promedio=4.2,
            tiempo_respuesta_promedio="48h",
            estado="activo"
        )
        importador_respondido = Importador(
            id=str(uuid4()),
            nombre_empresa="Importadora Respondida SA",
            especialidad_producto=["Textiles"],
            paises_origen=["China"],
            calificacion_promedio=4.8,
            tiempo_respuesta_promedio="24h",
            estado="activo"
        )
        db_session.add_all([importador_pendiente, importador_respondido])
        db_session.commit()

        import config
        redis_mock = MagicMock()
        redis_mock.ping.return_value = True
        redis_mock.hgetall.return_value = {
            str(importador_pendiente.id): "pendiente",
            str(importador_respondido.id): "respondido"
        }
        original_redis = config.redis_client
        config.redis_client = redis_mock

        try:
            response = client.get(
                f"/cotizaciones/{test_cotizacion_abierta.id}/matching-status",
                headers=auth_headers_solicitante
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_matching"] == 2
            assert data["respondidos"] == 1
            assert data["pendientes"] == 1
            assert len(data["importadores_pendientes"]) == 1
            assert data["importadores_pendientes"][0]["importador_id"] == str(importador_pendiente.id)
            assert data["importadores_pendientes"][0]["nombre_empresa"] == "Importadora Pendiente SA"
        finally:
            config.redis_client = original_redis

    def test_matching_status_sin_autorizacion(self, client, db_session, test_cotizacion_abierta, auth_headers_importador):
        """Un importador no puede consultar el estado de matching de una cotización ajena"""
        response = client.get(
            f"/cotizaciones/{test_cotizacion_abierta.id}/matching-status",
            headers=auth_headers_importador
        )

        assert response.status_code == 403

    def test_matching_status_modalidad_dirigida(self, client, db_session, test_solicitante, auth_headers_solicitante):
        """No aplica a cotizaciones en modalidad dirigida"""
        cotizacion_dirigida = Cotizacion(
            id=str(uuid4()),
            solicitante_id=test_solicitante.id,
            importador_id=str(uuid4()),
            modalidad="dirigida",
            pais_importacion="China",
            nombre_producto="Zapatos",
            descripcion_cliente="Zapatos de cuero para importar en lote pequeño",
            linea_producto="Calzado",
            tipo_calidad="premium",
            cantidad_minima=100,
            incoterm="FOB",
            estado="dirigida"
        )
        db_session.add(cotizacion_dirigida)
        db_session.commit()

        response = client.get(
            f"/cotizaciones/{cotizacion_dirigida.id}/matching-status",
            headers=auth_headers_solicitante
        )

        assert response.status_code == 400

    def test_matching_status_redis_no_disponible(self, client, db_session, test_cotizacion_abierta, auth_headers_solicitante):
        """Si Redis no está disponible, responde con conteos en cero en vez de fallar (best-effort)"""
        import config
        redis_mock = MagicMock()
        redis_mock.ping.side_effect = Exception("Redis caído")
        original_redis = config.redis_client
        config.redis_client = redis_mock

        try:
            response = client.get(
                f"/cotizaciones/{test_cotizacion_abierta.id}/matching-status",
                headers=auth_headers_solicitante
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_matching"] == 0
            assert data["pendientes"] == 0
            assert data["respondidos"] == 0
            assert data["importadores_pendientes"] == []
        finally:
            config.redis_client = original_redis