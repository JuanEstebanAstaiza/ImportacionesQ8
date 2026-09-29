"""Sincronización backend ↔ reglas de negocio de tiers, notificaciones y perfil público.

1. Tier mínimo por empresa: se persiste en la empresa y `POST /cotizaciones`
   lo hace cumplir en servidor (descuento de 1 punto auditado o 403).
2. Recálculo de tiers por umbrales, respetando `tier_manual`.
3. Notificación persistida al reclamar (con cotización y chat), `PATCH /leida`
   y emisión en tiempo real tras el commit.
4. Perfil público del cotizante calculado desde la BD.
"""
import asyncio
from datetime import datetime
from uuid import uuid4

import pytest

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.campo_personalizado import CampoPersonalizado
from models.chat import ConversacionChat
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.notificacion import Notificacion
from models.orden import Orden
from models.tier import MovimientoPuntoCotizacion, UmbralTierCotizante
from models.usuario import Usuario


def _payload(importador_id=None, **extra):
    payload = {
        "modalidad": "dirigida" if importador_id else "abierta",
        "pais_importacion": "China",
        "nombre_producto": "Camisetas personalizadas",
        "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso en algodón premium",
        "linea_producto": "Textiles",
        "tipo_calidad": "estandar",
        "cantidad_minima": 500,
        "incoterm": "FOB",
    }
    if importador_id:
        payload["importador_id"] = importador_id
    payload.update(extra)
    return payload


def _cotizante(db_session, *, tier="Bronze", puntos=0, tier_manual=False):
    usuario, headers = crear_usuario_con_token(db_session, rol="solicitante")
    usuario.tier = tier
    usuario.puntos_cotizacion = puntos
    usuario.tier_manual = tier_manual
    db_session.commit()
    return usuario, headers


def _empresa(db_session, tier="Bronze"):
    importador, dueño = crear_empresa_importadora(
        db_session,
        nombre_empresa=f"Empresa {uuid4().hex[:6]}",
        email_dueño=f"dueno_{uuid4().hex[:8]}@example.com",
    )
    importador.tier_minimo_requerido = tier
    db_session.commit()
    return importador, dueño


def _movimientos(db_session, usuario_id):
    db_session.expire_all()
    return db_session.query(MovimientoPuntoCotizacion).filter(
        MovimientoPuntoCotizacion.usuario_id == usuario_id,
    ).all()


# ==================== 1. Tier de empresa y desbloqueo server-side ====================

class TestTierEmpresaPersistencia:
    def test_put_empresa_persiste_tier_de_primer_nivel(self, client, db_session):
        importador, dueño = _empresa(db_session)
        r = client.put(f"/importadores/{importador.id}", json={"tier_minimo_requerido": "Gold"}, headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text
        assert r.json()["tier_minimo_requerido"] == "Gold"
        db_session.refresh(importador)
        assert importador.tier_minimo_requerido == "Gold"

    def test_put_empresa_acepta_tier_dentro_de_perfil_publico(self, client, db_session):
        """Es como lo manda hoy el frontend (pantalla de configuración de empresa)."""
        importador, dueño = _empresa(db_session)
        r = client.put(
            f"/importadores/{importador.id}",
            json={"perfil_publico": {"description": "Hola", "tier_minimo_requerido": "Silver"}},
            headers=auth_headers_for(dueño),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tier_minimo_requerido"] == "Silver"
        assert body["perfil_publico"]["tier_minimo_requerido"] == "Silver"

    def test_primer_nivel_manda_y_se_refleja_en_perfil_publico(self, client, db_session):
        importador, dueño = _empresa(db_session)
        r = client.put(
            f"/importadores/{importador.id}",
            json={"tier_minimo_requerido": "Élite", "perfil_publico": {"tier_minimo_requerido": "Silver"}},
            headers=auth_headers_for(dueño),
        )
        assert r.status_code == 200, r.text
        assert r.json()["tier_minimo_requerido"] == "Élite"
        assert r.json()["perfil_publico"]["tier_minimo_requerido"] == "Élite"

    @pytest.mark.parametrize("json_body", [
        {"tier_minimo_requerido": "Platino"},
        {"perfil_publico": {"tier_minimo_requerido": "Platino"}},
    ])
    def test_tier_invalido_se_rechaza(self, client, db_session, json_body):
        importador, dueño = _empresa(db_session)
        r = client.put(f"/importadores/{importador.id}", json=json_body, headers=auth_headers_for(dueño))
        assert r.status_code == 422
        db_session.refresh(importador)
        assert importador.tier_minimo_requerido == "Bronze"

    def test_listado_publico_expone_el_tier(self, client, db_session):
        importador, _ = _empresa(db_session, tier="Gold")
        _, headers = _cotizante(db_session)
        r = client.get(f"/importadores/{importador.id}", headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["tier_minimo_requerido"] == "Gold"


class TestDesbloqueoAlCrearCotizacion:
    def test_tier_suficiente_no_consume_puntos(self, client, db_session):
        importador, _ = _empresa(db_session, tier="Silver")
        usuario, headers = _cotizante(db_session, tier="Gold", puntos=3)
        r = client.post("/cotizaciones", json=_payload(importador.id), headers=headers)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["tier_minimo_requerido"] == "Silver"
        assert body["desbloqueada_por_puntos"] is False
        assert body["bloqueada"] is False
        db_session.refresh(usuario)
        assert usuario.puntos_cotizacion == 3
        assert _movimientos(db_session, usuario.id) == []

    def test_tier_inferior_con_puntos_descuenta_uno_y_audita(self, client, db_session):
        importador, _ = _empresa(db_session, tier="Gold")
        usuario, headers = _cotizante(db_session, tier="Bronze", puntos=2)
        r = client.post("/cotizaciones", json=_payload(importador.id), headers=headers)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["tier_minimo_requerido"] == "Gold"
        assert body["desbloqueada_por_puntos"] is True
        assert body["bloqueada"] is False
        assert body["solicitante_puntos_cotizacion"] == 1

        db_session.refresh(usuario)
        assert usuario.puntos_cotizacion == 1
        movimientos = _movimientos(db_session, usuario.id)
        assert len(movimientos) == 1
        mov = movimientos[0]
        assert mov.tipo == "consumo"
        assert mov.delta == -1
        assert mov.saldo_resultante == 1
        assert mov.cotizacion_id == body["id"]
        assert mov.descripcion == f"Desbloqueo de cotización ID {body['id']}"

    def test_tier_inferior_sin_puntos_da_403_y_no_crea_nada(self, client, db_session):
        importador, _ = _empresa(db_session, tier="Silver")
        usuario, headers = _cotizante(db_session, tier="Bronze", puntos=0)
        r = client.post("/cotizaciones", json=_payload(importador.id), headers=headers)
        assert r.status_code == 403
        assert r.json()["detail"] == "Nivel insuficiente y sin créditos"
        db_session.expire_all()
        assert db_session.query(Cotizacion).filter(Cotizacion.solicitante_id == usuario.id).count() == 0
        assert _movimientos(db_session, usuario.id) == []

    def test_el_tier_del_payload_no_permite_saltarse_el_bloqueo(self, client, db_session):
        """Antes el tier exigido lo mandaba el cliente: bastaba con enviar Bronze."""
        importador, _ = _empresa(db_session, tier="Élite")
        usuario, headers = _cotizante(db_session, tier="Bronze", puntos=0)
        r = client.post(
            "/cotizaciones",
            json=_payload(importador.id, tier_minimo_requerido="Bronze"),
            headers=headers,
        )
        assert r.status_code == 403

    def test_modalidad_abierta_no_exige_tier(self, client, db_session):
        usuario, headers = _cotizante(db_session, tier="Bronze", puntos=0)
        r = client.post("/cotizaciones", json=_payload(tier_minimo_requerido="Élite"), headers=headers)
        assert r.status_code == 201, r.text
        assert r.json()["tier_minimo_requerido"] == "Bronze"

    def test_desbloquear_despues_no_cobra_dos_veces(self, client, db_session):
        """El frontend llama a /desbloquear tras crear; ya no debe volver a cobrar."""
        importador, _ = _empresa(db_session, tier="Gold")
        usuario, headers = _cotizante(db_session, tier="Silver", puntos=2)
        creada = client.post("/cotizaciones", json=_payload(importador.id), headers=headers).json()
        r = client.post(f"/cotizaciones/{creada['id']}/desbloquear", headers=headers)
        assert r.status_code == 200, r.text
        db_session.refresh(usuario)
        assert usuario.puntos_cotizacion == 1
        assert len(_movimientos(db_session, usuario.id)) == 1


class TestEndpointDesbloquear:
    def _cotizacion_bloqueada(self, db_session, usuario, importador):
        cot = Cotizacion(
            id=str(uuid4()), solicitante_id=usuario.id, importador_id=importador.id, modalidad="dirigida",
            tier_minimo_requerido="Gold", pais_importacion="China", nombre_producto="X",
            descripcion_cliente="Descripción suficientemente larga", linea_producto="Textiles",
            tipo_calidad="estandar", cantidad_minima=1, incoterm="FOB", estado="dirigida",
        )
        db_session.add(cot)
        db_session.commit()
        return cot

    def test_sin_puntos_responde_403(self, client, db_session):
        importador, _ = _empresa(db_session, tier="Gold")
        usuario, headers = _cotizante(db_session, puntos=0)
        cot = self._cotizacion_bloqueada(db_session, usuario, importador)
        r = client.post(f"/cotizaciones/{cot.id}/desbloquear", headers=headers)
        assert r.status_code == 403
        assert r.json()["detail"] == "Nivel insuficiente y sin créditos"

    def test_con_puntos_desbloquea_y_audita(self, client, db_session):
        importador, _ = _empresa(db_session, tier="Gold")
        usuario, headers = _cotizante(db_session, puntos=1)
        cot = self._cotizacion_bloqueada(db_session, usuario, importador)
        r = client.post(f"/cotizaciones/{cot.id}/desbloquear", headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["bloqueada"] is False
        movimientos = _movimientos(db_session, usuario.id)
        assert [m.descripcion for m in movimientos] == [f"Desbloqueo de cotización ID {cot.id}"]


# ==================== 2. Recálculo automático de tiers ====================

@pytest.fixture()
def umbrales(db_session):
    valores = {
        "Bronze": (0, 0, 0),
        "Silver": (2, 1, 100),
        "Gold": (3, 2, 1000),
        "Élite": (50, 50, 1_000_000),
    }
    for tier, (cot, ords, valor) in valores.items():
        fila = db_session.query(UmbralTierCotizante).filter(UmbralTierCotizante.tier == tier).first()
        if not fila:
            fila = UmbralTierCotizante(tier=tier)
            db_session.add(fila)
        fila.minimo_cotizaciones, fila.minimo_ordenes, fila.minimo_valor_operaciones_usd = cot, ords, valor
    db_session.commit()
    return valores


def _historial(db_session, usuario, importador, *, cotizaciones, ordenes_usd=(), estado_orden="cotizacion_aceptada"):
    creadas = []
    for i in range(cotizaciones):
        cot = Cotizacion(
            id=str(uuid4()), solicitante_id=usuario.id, importador_id=importador.id, modalidad="dirigida",
            pais_importacion="China", nombre_producto=f"P{i}", descripcion_cliente="Descripción de prueba",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=1, incoterm="FOB",
            estado=EstadoCotizacion.orden_activa.value, precio_objetivo_usd=100.0,
        )
        db_session.add(cot)
        creadas.append(cot)
    db_session.flush()
    for cot, precio in zip(creadas, ordenes_usd):
        db_session.add(Orden(
            id=str(uuid4()), cotizacion_id=cot.id, importador_id=importador.id, solicitante_id=usuario.id,
            estado=estado_orden, precio_acordado_usd=precio,
        ))
    db_session.commit()
    return creadas


class TestServicioTiers:
    def test_nivel_mas_alto_con_los_tres_umbrales(self, db_session, umbrales):
        from services.tier_service import MetricasTier, _umbrales, tier_para_metricas

        u = _umbrales(db_session)
        assert tier_para_metricas(MetricasTier(0, 0, 0), u) == "Bronze"
        assert tier_para_metricas(MetricasTier(2, 1, 100), u) == "Silver"
        assert tier_para_metricas(MetricasTier(3, 2, 1000), u) == "Gold"
        # Cumple cotizaciones y órdenes de Gold, pero no el valor: se queda en Silver.
        assert tier_para_metricas(MetricasTier(10, 10, 999), u) == "Silver"
        # Un umbral de Silver sin cumplir bloquea también los superiores.
        assert tier_para_metricas(MetricasTier(10, 0, 10_000), u) == "Bronze"

    def test_recalculo_sube_al_cotizante_automatico(self, db_session, umbrales):
        from services.tier_service import recalcular_tier_cotizante

        importador, _ = _empresa(db_session)
        usuario, _ = _cotizante(db_session)
        _historial(db_session, usuario, importador, cotizaciones=3, ordenes_usd=(600, 600))
        assert recalcular_tier_cotizante(db_session, usuario.id) is True
        db_session.commit()
        assert usuario.tier == "Gold"

    def test_recalculo_ignora_tier_manual(self, db_session, umbrales):
        from services.tier_service import recalcular_tier_cotizante

        importador, _ = _empresa(db_session)
        usuario, _ = _cotizante(db_session, tier="Élite", tier_manual=True)
        _historial(db_session, usuario, importador, cotizaciones=1)
        assert recalcular_tier_cotizante(db_session, usuario.id) is False
        db_session.commit()
        assert usuario.tier == "Élite"

    def test_recalculo_puede_bajar_de_nivel(self, db_session, umbrales):
        from services.tier_service import recalcular_tier_cotizante

        usuario, _ = _cotizante(db_session, tier="Gold")
        recalcular_tier_cotizante(db_session, usuario.id)
        db_session.commit()
        assert usuario.tier == "Bronze"

    def test_cotizaciones_canceladas_no_cuentan(self, db_session, umbrales):
        from services.tier_service import metricas_cotizante

        importador, _ = _empresa(db_session)
        usuario, _ = _cotizante(db_session)
        creadas = _historial(db_session, usuario, importador, cotizaciones=2)
        creadas[0].estado = EstadoCotizacion.cancelada.value
        db_session.commit()
        assert metricas_cotizante(db_session, usuario.id).cotizaciones == 1

    def test_recalcular_todos(self, db_session, umbrales):
        from services.tier_service import recalcular_tiers_todos

        importador, _ = _empresa(db_session)
        auto, _ = _cotizante(db_session)
        manual, _ = _cotizante(db_session, tier="Élite", tier_manual=True)
        _historial(db_session, auto, importador, cotizaciones=2, ordenes_usd=(150,))
        _historial(db_session, manual, importador, cotizaciones=2, ordenes_usd=(150,))
        resultado = recalcular_tiers_todos(db_session)
        assert resultado["actualizados"] >= 1
        db_session.refresh(auto)
        db_session.refresh(manual)
        assert auto.tier == "Silver"
        assert manual.tier == "Élite"


class TestRecalculoPorEventos:
    def test_crear_cotizacion_recalcula(self, client, db_session, umbrales):
        importador, _ = _empresa(db_session)
        usuario, headers = _cotizante(db_session)
        _historial(db_session, usuario, importador, cotizaciones=1, ordenes_usd=(500,))
        r = client.post("/cotizaciones", json=_payload(importador.id), headers=headers)
        assert r.status_code == 201, r.text
        db_session.refresh(usuario)
        # 2 cotizaciones (la nueva cuenta), 1 orden, 500 USD → Silver.
        assert usuario.tier == "Silver"

    def test_orden_entregada_recalcula(self, client, db_session, umbrales):
        importador, dueño = _empresa(db_session)
        usuario, _ = _cotizante(db_session)
        # El historial ya alcanza Gold, pero nadie ha disparado el recálculo aún.
        _historial(db_session, usuario, importador, cotizaciones=3, ordenes_usd=(600, 600), estado_orden="bodega_local")
        assert usuario.tier == "Bronze"
        orden = db_session.query(Orden).filter(Orden.solicitante_id == usuario.id).first()

        r = client.put(f"/ordenes/{orden.id}/estado", json={"estado": "entregado"}, headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text
        db_session.refresh(usuario)
        assert usuario.tier == "Gold"


class TestAdminTiers:
    def test_endpoint_recalcular(self, client, db_session, umbrales):
        _, admin_headers = crear_usuario_con_token(db_session, rol="admin")
        importador, _ = _empresa(db_session)
        usuario, _ = _cotizante(db_session)
        _historial(db_session, usuario, importador, cotizaciones=2, ordenes_usd=(200,))
        r = client.post("/admin/cotizantes/recalcular-tiers", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["evaluados"] >= 1
        db_session.refresh(usuario)
        assert usuario.tier == "Silver"

    def test_liberar_tier_manual_vuelve_a_automatico(self, client, db_session, umbrales):
        _, admin_headers = crear_usuario_con_token(db_session, rol="admin")
        usuario, _ = _cotizante(db_session)
        r = client.put(f"/admin/cotizantes/{usuario.id}/tier", json={"tier": "Élite"}, headers=admin_headers)
        assert r.status_code == 200 and r.json()["tier_manual"] is True

        r = client.delete(f"/admin/cotizantes/{usuario.id}/tier", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["tier_manual"] is False
        assert r.json()["tier"] == "Bronze"

    def test_cambiar_umbrales_recalcula(self, client, db_session, umbrales):
        _, admin_headers = crear_usuario_con_token(db_session, rol="admin")
        importador, _ = _empresa(db_session)
        usuario, _ = _cotizante(db_session)
        _historial(db_session, usuario, importador, cotizaciones=1)
        nuevos = [
            {"tier": "Bronze", "minimo_cotizaciones": 0, "minimo_ordenes": 0, "minimo_valor_operaciones_usd": 0},
            {"tier": "Silver", "minimo_cotizaciones": 1, "minimo_ordenes": 0, "minimo_valor_operaciones_usd": 0},
            {"tier": "Gold", "minimo_cotizaciones": 99, "minimo_ordenes": 99, "minimo_valor_operaciones_usd": 99},
            {"tier": "Élite", "minimo_cotizaciones": 999, "minimo_ordenes": 999, "minimo_valor_operaciones_usd": 999},
        ]
        r = client.put("/admin/cotizantes/tier-umbrales", json={"umbrales": nuevos}, headers=admin_headers)
        assert r.status_code == 200, r.text
        db_session.refresh(usuario)
        assert usuario.tier == "Silver"

    def test_solo_admin(self, client, db_session):
        _, headers = _cotizante(db_session)
        assert client.post("/admin/cotizantes/recalcular-tiers", headers=headers).status_code == 403


# ==================== 3. Notificaciones ====================

class TestNotificacionAlReclamar:
    def test_reclamar_persiste_notificacion_con_cotizacion_y_chat(self, client, db_session):
        importador, dueño = _empresa(db_session)
        usuario, headers = _cotizante(db_session)
        creada = client.post("/cotizaciones", json=_payload(importador.id), headers=headers).json()

        r = client.post(f"/cotizaciones/{creada['id']}/reclamar", headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text

        db_session.expire_all()
        conversacion = db_session.query(ConversacionChat).filter(ConversacionChat.cotizacion_id == creada["id"]).one()
        notif = db_session.query(Notificacion).filter(
            Notificacion.usuario_id == usuario.id,
            Notificacion.cotizacion_id == creada["id"],
        ).one()
        assert notif.conversacion_id == str(conversacion.id)
        assert notif.data["conversacion_id"] == str(conversacion.id)
        assert notif.leida is False

        listado = client.get("/notificaciones", headers=headers).json()
        item = next(n for n in listado["items"] if n["id"] == notif.id)
        assert item["cotizacion_id"] == creada["id"]
        assert item["conversacion_id"] == str(conversacion.id)
        assert item["cuerpo"] == item["mensaje"]

    def test_reclamar_emite_en_tiempo_real_tras_commit(self, client, db_session, monkeypatch):
        import services.notificaciones_tiempo_real as tiempo_real

        emitidas = []
        monkeypatch.setattr(tiempo_real, "publicar", lambda uid, payload: emitidas.append((uid, payload)))

        importador, dueño = _empresa(db_session)
        usuario, headers = _cotizante(db_session)
        creada = client.post("/cotizaciones", json=_payload(importador.id), headers=headers).json()
        emitidas.clear()

        r = client.post(f"/cotizaciones/{creada['id']}/reclamar", headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text
        propias = [p for uid, p in emitidas if uid == usuario.id]
        assert len(propias) == 1
        assert propias[0]["cotizacion_id"] == creada["id"]
        assert propias[0]["conversacion_id"]
        assert propias[0]["titulo"] == "Un asesor tomó tu cotización"


class TestPatchLeida:
    def _notif(self, db_session, usuario_id):
        from services.notificacion_service import crear_notificacion

        return crear_notificacion(
            db_session, usuario_id=usuario_id, tipo="sistema", titulo="Hola", mensaje="Cuerpo", commit=True,
        )

    def test_patch_marca_leida(self, client, db_session):
        usuario, headers = _cotizante(db_session)
        notif = self._notif(db_session, usuario.id)
        r = client.patch(f"/notificaciones/{notif.id}/leida", headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["leida"] is True
        assert r.json()["fecha_lectura"] is not None
        # Idempotente.
        assert client.patch(f"/notificaciones/{notif.id}/leida", headers=headers).status_code == 200

    def test_patch_notificacion_ajena_da_404(self, client, db_session):
        dueño_notif, _ = _cotizante(db_session)
        _, otros_headers = _cotizante(db_session)
        notif = self._notif(db_session, dueño_notif.id)
        assert client.patch(f"/notificaciones/{notif.id}/leida", headers=otros_headers).status_code == 404
        db_session.refresh(notif)
        assert notif.leida is False


class TestTiempoReal:
    def test_rollback_no_emite(self, db_session, monkeypatch):
        import services.notificaciones_tiempo_real as tiempo_real
        from services.notificacion_service import crear_notificacion

        emitidas = []
        monkeypatch.setattr(tiempo_real, "publicar", lambda uid, payload: emitidas.append(uid))
        usuario, _ = _cotizante(db_session)
        crear_notificacion(db_session, usuario_id=usuario.id, tipo="sistema", titulo="X")
        db_session.rollback()
        db_session.commit()
        assert emitidas == []

    def test_broker_en_memoria_entrega_al_suscriptor(self):
        import services.notificaciones_tiempo_real as tiempo_real

        async def escenario():
            cola = tiempo_real.suscribir("usuario-x")
            try:
                tiempo_real._publicar_en_memoria("usuario-x", '{"ok": true}')
                tiempo_real._publicar_en_memoria("otro", '{"ok": false}')
                return await asyncio.wait_for(cola.get(), timeout=1)
            finally:
                tiempo_real.desuscribir("usuario-x", cola)

        assert asyncio.run(escenario()) == '{"ok": true}'
        assert "usuario-x" not in tiempo_real._suscriptores

    def test_stream_exige_autenticacion(self, client):
        assert client.get("/notificaciones/stream").status_code == 401
        assert client.get("/notificaciones/stream?ticket=inventado").status_code == 401

    def test_ticket_de_chat_no_abre_el_stream(self, client, db_session):
        from services.token_revocation import crear_ticket_ws

        usuario, _ = _cotizante(db_session)
        ticket = crear_ticket_ws(usuario.id, str(uuid4()))
        assert client.get(f"/notificaciones/stream?ticket={ticket}").status_code == 401

    def test_stream_ticket_se_emite(self, client, db_session):
        _, headers = _cotizante(db_session)
        r = client.post("/notificaciones/stream-ticket", headers=headers)
        assert r.status_code == 200
        assert r.json()["ticket"]


# ==================== 4. Perfil público dinámico ====================

class TestPerfilPublico:
    def test_metricas_calculadas_desde_bd(self, client, db_session):
        importador, dueño = _empresa(db_session)
        usuario, headers = _cotizante(db_session, tier="Silver")
        usuario.importaciones_fuera_plataforma = 4
        campo_peso = CampoPersonalizado(
            id=str(uuid4()), importador_id=importador.id, etiqueta="Peso total (kg)", tipo="numero",
        )
        campo_vol = CampoPersonalizado(
            id=str(uuid4()), importador_id=importador.id, etiqueta="Volumen CBM", tipo="numero",
        )
        db_session.add_all([campo_peso, campo_vol])
        db_session.commit()

        cotizaciones = _historial(db_session, usuario, importador, cotizaciones=4)
        # Respuestas del formulario guardadas por ID de campo, como en producción.
        cotizaciones[0].campos_personalizados_valores = {campo_peso.id: "120 kg", campo_vol.id: "2,5"}
        cotizaciones[1].campos_personalizados_valores = {campo_peso.id: 80, "contenedores": 1}
        cotizaciones[2].campos_personalizados_valores = {campo_peso.id: 1000}  # orden no finalizada
        cotizaciones[3].precio_objetivo_usd = 300.0
        cotizaciones[3].moneda_precio_objetivo = "COP"  # no entra en el promedio USD
        db_session.add_all([
            Orden(id=str(uuid4()), cotizacion_id=cotizaciones[0].id, importador_id=importador.id,
                  solicitante_id=usuario.id, estado="entregado", precio_acordado_usd=1000),
            Orden(id=str(uuid4()), cotizacion_id=cotizaciones[1].id, importador_id=importador.id,
                  solicitante_id=usuario.id, estado="entregado", precio_acordado_usd=2000),
            Orden(id=str(uuid4()), cotizacion_id=cotizaciones[2].id, importador_id=importador.id,
                  solicitante_id=usuario.id, estado="en_produccion", precio_acordado_usd=3000),
        ])
        db_session.commit()

        r = client.get(f"/cotizantes/{usuario.id}/perfil-publico", headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tier"] == "Silver"
        assert body["volumen_total_importaciones"] == {
            "peso_total_kg": 200.0, "volumen_total_m3": 2.5, "contenedores_total": 1,
        }
        assert body["cantidad_importaciones"] == {
            "total": 7, "dentro_plataforma": 3, "fuera_plataforma": 4, "finalizadas": 2,
        }
        actividad = body["actividad_plataforma"]
        assert actividad["cotizaciones_solicitadas"] == 4
        assert actividad["ordenes_generadas"] == 3
        assert actividad["valor_promedio_ordenes_usd"] == 2000.0
        assert actividad["valor_promedio_cotizaciones_usd"] == 100.0
        assert body["valor_promedio_importacion_usd"] == 2000.0

        # La ruta histórica devuelve lo mismo.
        legacy = client.get(f"/usuarios/{usuario.id}/perfil-publico", headers=auth_headers_for(dueño))
        assert legacy.json() == body

    def test_cotizante_sin_actividad(self, client, db_session):
        _, dueño = _empresa(db_session)
        usuario, _ = _cotizante(db_session)
        body = client.get(f"/cotizantes/{usuario.id}/perfil-publico", headers=auth_headers_for(dueño)).json()
        assert body["cantidad_importaciones"]["total"] == 0
        assert body["volumen_total_importaciones"]["peso_total_kg"] == 0
        assert body["actividad_plataforma"]["valor_promedio_cotizaciones_usd"] == 0

    def test_valor_negativo_no_rompe_el_perfil(self, client, db_session):
        importador, dueño = _empresa(db_session)
        usuario, _ = _cotizante(db_session)
        cot = _historial(db_session, usuario, importador, cotizaciones=1)[0]
        cot.campos_personalizados_valores = {"peso": "-50"}
        db_session.add(Orden(id=str(uuid4()), cotizacion_id=cot.id, importador_id=importador.id,
                             solicitante_id=usuario.id, estado="entregado", precio_acordado_usd=10))
        db_session.commit()
        r = client.get(f"/cotizantes/{usuario.id}/perfil-publico", headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text
        assert r.json()["volumen_total_importaciones"]["peso_total_kg"] == 0

    def test_cotizante_ve_el_suyo_pero_no_el_ajeno(self, client, db_session):
        usuario, headers = _cotizante(db_session)
        otro, _ = _cotizante(db_session)
        assert client.get(f"/cotizantes/{usuario.id}/perfil-publico", headers=headers).status_code == 200
        assert client.get(f"/cotizantes/{otro.id}/perfil-publico", headers=headers).status_code == 403

    def test_inexistente_da_404(self, client, db_session):
        _, dueño = _empresa(db_session)
        r = client.get(f"/cotizantes/{uuid4()}/perfil-publico", headers=auth_headers_for(dueño))
        assert r.status_code == 404

    def test_cotizante_declara_importaciones_externas(self, client, db_session):
        usuario, headers = _cotizante(db_session)
        r = client.put("/usuarios/me", json={"importaciones_fuera_plataforma": 6}, headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["importaciones_fuera_plataforma"] == 6
        assert client.put("/usuarios/me", json={"importaciones_fuera_plataforma": -1}, headers=headers).status_code == 422
        r = client.put("/usuarios/me", json={"importaciones_fuera_plataforma": None}, headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["importaciones_fuera_plataforma"] == 6
