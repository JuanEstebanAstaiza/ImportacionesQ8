"""Tests de utilidades anti-abuso y límites de payload."""
from utils.query_safety import escape_like, like_contains_pattern, clamp_str


def test_escape_like_wildcards():
    assert escape_like("100%") == "100\\%"
    assert escape_like("a_b") == "a\\_b"
    assert escape_like("x\\y") == "x\\\\y"


def test_like_contains_pattern():
    pat = like_contains_pattern("%admin%")
    assert pat.startswith("%")
    assert pat.endswith("%")
    assert "\\%" in pat


def test_clamp_str():
    assert clamp_str("  hola  ") == "hola"
    assert clamp_str("x" * 200, 10) == "x" * 10
    assert clamp_str("   ") is None


def test_mensaje_chat_max_length(client, db_session):
    """Payload de chat > 4000 → 422 (anti-DoS de body)."""
    from uuid import uuid4
    from datetime import datetime
    from models.usuario import Usuario
    from models.chat import ConversacionChat
    from models.cotizacion import Cotizacion, EstadoCotizacion
    from utils.security import hash_password
    from conftest import auth_headers_for, crear_empresa_importadora

    sol = Usuario(
        id=str(uuid4()),
        email="flood@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        email_verificado=True,
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(sol)
    imp, dueño = crear_empresa_importadora(db_session, email_dueño="flood_dueño@example.com")
    cot = Cotizacion(
        id=str(uuid4()),
        solicitante_id=sol.id,
        importador_id=imp.id,
        modalidad="dirigida",
        pais_importacion="China",
        nombre_producto="P",
        descripcion_cliente="Descripcion suficiente para validar longitud de mensaje de chat",
        linea_producto="Textiles",
        tipo_calidad="estandar",
        cantidad_minima=1,
        precio_objetivo_usd=1.0,
        incoterm="FOB",
        estado=EstadoCotizacion.propuestas_recibidas,
    )
    db_session.add(cot)
    conv = ConversacionChat(
        id=str(uuid4()),
        cotizacion_id=cot.id,
        solicitante_id=sol.id,
        importador_usuario_id=dueño.id,
    )
    db_session.add(conv)
    db_session.commit()

    r = client.post(
        f"/chat/conversaciones/{conv.id}/mensajes",
        json={"contenido": "x" * 4001, "tipo": "texto"},
        headers=auth_headers_for(sol),
    )
    assert r.status_code == 422
