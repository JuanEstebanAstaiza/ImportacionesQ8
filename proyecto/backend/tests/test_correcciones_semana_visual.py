"""Regresiones de las correcciones de recursos, asesores, admin y notificaciones.

Cada test fija una conducta que antes estaba rota:
- el destinatario de un adjunto de chat no podía descargarlo (403) ni verlo en
  su gestión documental,
- editar el temario de un curso borraba el progreso de todos los alumnos,
- desactivar un asesor dejaba sus chats apuntando a una cuenta sin acceso,
- el admin no tenía forma de listar las conversaciones de la plataforma,
- el módulo educativo no se podía apagar.
"""
import io
from uuid import uuid4

import pytest
from fastapi import status

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.chat import ConversacionChat
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.curso import ProgresoLeccion


CURSO_PAYLOAD_BASE = {
    "titulo": "Importar desde China sin morir en el intento",
    "descripcion": "Curso de prueba",
    "precio": 0,
    "nivel": "Principiante",
    "categoria": "Importaciones",
}


def _subir_archivo(client, headers, nombre="documento.pdf", contenido=b"%PDF-1.4 test"):
    respuesta = client.post(
        "/documentos/archivos/upload",
        files={"archivo": (nombre, io.BytesIO(contenido), "application/pdf")},
        data={"origen": "chat"},
        headers=headers,
    )
    assert respuesta.status_code in (200, 201), respuesta.text
    return respuesta.json()


@pytest.fixture()
def conversacion(db_session):
    """Conversación real entre un solicitante y el dueño de una empresa."""
    importador, dueño = crear_empresa_importadora(db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}")
    solicitante, headers_solicitante = crear_usuario_con_token(db_session, rol="solicitante")

    cotizacion = Cotizacion(
        id=str(uuid4()),
        solicitante_id=solicitante.id,
        importador_id=importador.id,
        modalidad="dirigida",
        nombre_producto="Camisetas de algodón",
        descripcion_cliente="Pedido de prueba",
        cantidad_minima=100,
        incoterm="FOB",
        pais_importacion="China",
        linea_producto="Textiles",
        tipo_calidad="estandar",
        estado=EstadoCotizacion.dirigida.value,
    )
    db_session.add(cotizacion)
    db_session.flush()

    conv = ConversacionChat(
        id=str(uuid4()),
        cotizacion_id=cotizacion.id,
        solicitante_id=solicitante.id,
        importador_usuario_id=dueño.id,
    )
    db_session.add(conv)
    db_session.commit()

    return {
        "conversacion": conv,
        "cotizacion": cotizacion,
        "importador": importador,
        "dueño": dueño,
        "solicitante": solicitante,
        "headers_solicitante": headers_solicitante,
        "headers_dueño": auth_headers_for(dueño),
    }


class TestAdjuntosDeChat:
    def test_el_destinatario_puede_descargar_el_adjunto(self, client, conversacion):
        """El clon heredaba la storage_url del original, cuyo id no está en
        MensajeAdjunto: el receptor recibía 403 al abrir el archivo."""
        archivo = _subir_archivo(client, conversacion["headers_solicitante"])

        compartir = client.post(
            "/documentos/compartir-chat",
            json={
                "archivo_ids": [archivo["id"]],
                "conversacion_ids": [conversacion["conversacion"].id],
                "mensaje": "Te comparto la ficha técnica",
            },
            headers=conversacion["headers_solicitante"],
        )
        assert compartir.status_code == 200, compartir.text

        adjuntos = client.get(
            f"/documentos/chats/{conversacion['conversacion'].id}/adjuntos",
            headers=conversacion["headers_dueño"],
        )
        assert adjuntos.status_code == 200, adjuntos.text
        items = adjuntos.json()
        assert len(items) == 1, "el receptor debe ver exactamente una tarjeta por archivo"

        descarga = client.get(items[0]["storage_url"], headers=conversacion["headers_dueño"])
        assert descarga.status_code == 200, descarga.text

    def test_el_adjunto_aparece_en_la_gestion_documental_del_receptor(self, client, conversacion):
        archivo = _subir_archivo(client, conversacion["headers_solicitante"], nombre="cotizacion.pdf")
        client.post(
            "/documentos/compartir-chat",
            json={
                "archivo_ids": [archivo["id"]],
                "conversacion_ids": [conversacion["conversacion"].id],
            },
            headers=conversacion["headers_solicitante"],
        )

        # El clon vive en la carpeta `Chats/Conversacion-xxxxxxxx` del receptor.
        raiz = client.get("/documentos/explorador", headers=conversacion["headers_dueño"])
        assert raiz.status_code == 200, raiz.text
        carpeta_chats = next(c for c in raiz.json()["carpetas"] if c["nombre"] == "Chats")

        nivel_chats = client.get(
            "/documentos/explorador",
            params={"parent_id": carpeta_chats["id"]},
            headers=conversacion["headers_dueño"],
        ).json()
        carpeta_conv = next(
            c for c in nivel_chats["carpetas"]
            if c["nombre"] == f"Conversacion-{conversacion['conversacion'].id[:8]}"
        )

        archivos = client.get(
            "/documentos/explorador",
            params={"parent_id": carpeta_conv["id"]},
            headers=conversacion["headers_dueño"],
        ).json()["archivos"]
        assert "cotizacion.pdf" in [a["nombre"] for a in archivos]

    def test_no_se_puede_adjuntar_un_archivo_ajeno(self, client, conversacion, db_session):
        """IDOR: bastaba conocer el UUID de un archivo de otro usuario para
        clonarlo dentro de la propia conversación y darse acceso."""
        ajeno, headers_ajeno = crear_usuario_con_token(db_session, rol="solicitante")
        archivo_ajeno = _subir_archivo(client, headers_ajeno, nombre="privado.pdf")

        respuesta = client.post(
            f"/chat/conversaciones/{conversacion['conversacion'].id}/mensajes",
            json={
                "contenido": "adjunto",
                "tipo": "archivo",
                "metadata": {"archivo_ids": [archivo_ajeno["id"]]},
            },
            headers=conversacion["headers_solicitante"],
        )
        assert respuesta.status_code == status.HTTP_201_CREATED

        adjuntos = client.get(
            f"/documentos/chats/{conversacion['conversacion'].id}/adjuntos",
            headers=conversacion["headers_solicitante"],
        ).json()
        assert adjuntos == [], "el archivo ajeno no debió clonarse en la conversación"


class TestEdicionDeCursoConservaProgreso:
    def test_editar_el_temario_no_borra_el_progreso_del_alumno(self, client, db_session):
        importador, dueño = crear_empresa_importadora(
            db_session, nombre_empresa=f"Academia {uuid4().hex[:6]}"
        )
        alumno, headers_alumno = crear_usuario_con_token(db_session, rol="solicitante")

        video = _subir_archivo(client, auth_headers_for(dueño), nombre="clase.mp4", contenido=b"\x00\x00\x00 ftypmp42")
        video_url = f"/documentos/archivos/{video['id']}/descargar"

        payload = {
            **CURSO_PAYLOAD_BASE,
            "portada_url": video_url,
            "modulos": [{
                "titulo": "Módulo 1",
                "lecciones": [
                    {"titulo": "Lección 1", "video_url": video_url, "duracion": "5 min"},
                    {"titulo": "Lección 2", "video_url": video_url, "duracion": "5 min"},
                ],
            }],
        }
        curso = client.post("/cursos", json=payload, headers=auth_headers_for(dueño))
        assert curso.status_code == status.HTTP_201_CREATED, curso.text
        curso = curso.json()
        leccion_id = curso["modulos"][0]["lecciones"][0]["id"]

        client.post(f"/cursos/{curso['id']}/comprar", headers=headers_alumno)
        progreso = client.post(
            f"/cursos/{curso['id']}/lecciones/{leccion_id}/progreso",
            json={"completada": True},
            headers=headers_alumno,
        )
        assert progreso.status_code == 200, progreso.text
        assert progreso.json()["progreso_pct"] == 50.0

        # El dueño corrige el título de un módulo devolviendo los ids recibidos.
        modulos_editados = [{
            "id": curso["modulos"][0]["id"],
            "titulo": "Módulo 1 (corregido)",
            "lecciones": [
                {
                    "id": leccion["id"],
                    "titulo": leccion["titulo"],
                    "video_url": video_url,
                    "duracion": leccion["duracion"],
                }
                for leccion in curso["modulos"][0]["lecciones"]
            ],
        }]
        edicion = client.put(
            f"/cursos/{curso['id']}",
            json={"modulos": modulos_editados},
            headers=auth_headers_for(dueño),
        )
        assert edicion.status_code == 200, edicion.text

        detalle = client.get(f"/cursos/{curso['id']}", headers=headers_alumno).json()
        assert detalle["progreso_pct"] == 50.0, "editar el temario no debe reiniciar el avance"
        assert leccion_id in detalle["lecciones_completadas"]

    def test_quitar_una_leccion_limpia_su_progreso(self, client, db_session):
        importador, dueño = crear_empresa_importadora(
            db_session, nombre_empresa=f"Academia {uuid4().hex[:6]}"
        )
        alumno, headers_alumno = crear_usuario_con_token(db_session, rol="solicitante")

        video = _subir_archivo(client, auth_headers_for(dueño), nombre="clase.mp4", contenido=b"\x00\x00\x00 ftypmp42")
        video_url = f"/documentos/archivos/{video['id']}/descargar"

        curso = client.post(
            "/cursos",
            json={
                **CURSO_PAYLOAD_BASE,
                "portada_url": video_url,
                "modulos": [{
                    "titulo": "Módulo 1",
                    "lecciones": [
                        {"titulo": "Lección 1", "video_url": video_url},
                        {"titulo": "Lección 2", "video_url": video_url},
                    ],
                }],
            },
            headers=auth_headers_for(dueño),
        ).json()

        leccion_a, leccion_b = curso["modulos"][0]["lecciones"]
        client.post(f"/cursos/{curso['id']}/comprar", headers=headers_alumno)
        client.post(
            f"/cursos/{curso['id']}/lecciones/{leccion_b['id']}/progreso",
            json={"completada": True},
            headers=headers_alumno,
        )

        client.put(
            f"/cursos/{curso['id']}",
            json={"modulos": [{
                "id": curso["modulos"][0]["id"],
                "titulo": "Módulo 1",
                "lecciones": [{"id": leccion_a["id"], "titulo": "Lección 1", "video_url": video_url}],
            }]},
            headers=auth_headers_for(dueño),
        )

        huerfano = db_session.query(ProgresoLeccion).filter(
            ProgresoLeccion.leccion_id == leccion_b["id"]
        ).first()
        assert huerfano is None, "el progreso de una lección eliminada no debe quedar huérfano"


class TestReasignacionDeAsesores:
    def test_desactivar_un_asesor_traspasa_su_chat_al_dueno(self, client, db_session):
        importador, dueño = crear_empresa_importadora(
            db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}"
        )
        asesor, _ = crear_usuario_con_token(
            db_session, rol="asesor", importador_id=importador.id
        )
        solicitante, _ = crear_usuario_con_token(db_session, rol="solicitante")

        cotizacion = Cotizacion(
            id=str(uuid4()),
            solicitante_id=solicitante.id,
            importador_id=importador.id,
            modalidad="dirigida",
            nombre_producto="Zapatos",
            descripcion_cliente="Pedido",
            cantidad_minima=50,
            incoterm="FOB",
            pais_importacion="China",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            estado=EstadoCotizacion.dirigida.value,
            asesor_asignado_id=asesor.id,
        )
        db_session.add(cotizacion)
        db_session.flush()
        conv = ConversacionChat(
            id=str(uuid4()),
            cotizacion_id=cotizacion.id,
            solicitante_id=solicitante.id,
            importador_usuario_id=asesor.id,
        )
        db_session.add(conv)
        db_session.commit()

        respuesta = client.put(
            f"/importadores/asesores/{asesor.id}/estado",
            json={"activo": False},
            headers=auth_headers_for(dueño),
        )
        assert respuesta.status_code == 200, respuesta.text
        cuerpo = respuesta.json()
        assert cuerpo["activo"] is False
        assert cuerpo["conversaciones_reasignadas"] == 1
        assert cuerpo["cotizaciones_reasignadas"] == 1

        db_session.refresh(conv)
        assert conv.importador_usuario_id == dueño.id

        # Y el dueño ya puede leerla.
        mensajes = client.get(
            f"/chat/conversaciones/{conv.id}/mensajes",
            headers=auth_headers_for(dueño),
        )
        assert mensajes.status_code == 200

    def test_el_dueno_puede_reasignar_una_cotizacion_a_otro_asesor(self, client, db_session):
        importador, dueño = crear_empresa_importadora(
            db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}"
        )
        asesor_a, _ = crear_usuario_con_token(db_session, rol="asesor", importador_id=importador.id)
        asesor_b, _ = crear_usuario_con_token(db_session, rol="asesor", importador_id=importador.id)
        solicitante, _ = crear_usuario_con_token(db_session, rol="solicitante")

        cotizacion = Cotizacion(
            id=str(uuid4()),
            solicitante_id=solicitante.id,
            importador_id=importador.id,
            modalidad="dirigida",
            nombre_producto="Herramientas",
            descripcion_cliente="Pedido",
            cantidad_minima=10,
            incoterm="FOB",
            pais_importacion="China",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            estado=EstadoCotizacion.dirigida.value,
            asesor_asignado_id=asesor_a.id,
        )
        db_session.add(cotizacion)
        db_session.commit()

        respuesta = client.put(
            f"/importadores/cotizaciones/{cotizacion.id}/asignar",
            json={"asesor_id": asesor_b.id},
            headers=auth_headers_for(dueño),
        )
        assert respuesta.status_code == 200, respuesta.text

        db_session.refresh(cotizacion)
        assert cotizacion.asesor_asignado_id == asesor_b.id


class TestSupervisionAdminDeChats:
    def test_admin_lista_y_lee_conversaciones(self, client, conversacion, db_session):
        admin, headers_admin = crear_usuario_con_token(db_session, rol="admin")

        client.post(
            f"/chat/conversaciones/{conversacion['conversacion'].id}/mensajes",
            json={"contenido": "Hola, ¿precio final?", "tipo": "texto"},
            headers=conversacion["headers_solicitante"],
        )

        listado = client.get("/admin/conversaciones", headers=headers_admin)
        assert listado.status_code == 200, listado.text
        cuerpo = listado.json()
        assert cuerpo["total"] >= 1
        fila = next(i for i in cuerpo["items"] if i["id"] == conversacion["conversacion"].id)
        assert fila["empresa_nombre"] == conversacion["importador"].nombre_empresa
        assert fila["total_mensajes"] >= 1

        mensajes = client.get(
            f"/admin/conversaciones/{conversacion['conversacion'].id}/mensajes",
            headers=headers_admin,
        )
        assert mensajes.status_code == 200
        assert any("precio final" in m["contenido"] for m in mensajes.json())

    def test_un_no_admin_no_puede_supervisar(self, client, conversacion):
        respuesta = client.get("/admin/conversaciones", headers=conversacion["headers_solicitante"])
        assert respuesta.status_code == status.HTTP_403_FORBIDDEN


class TestBannerDeEmpresa:
    def test_el_banner_se_sirve_sin_sesion(self, client, db_session):
        """El perfil de una empresa es público, así que su portada también.

        Si el `<img>` pidiera un archivo privado devolvería 401 y el solicitante
        vería siempre el placeholder.
        """
        importador, dueño = crear_empresa_importadora(
            db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}"
        )
        imagen = _subir_archivo(
            client,
            auth_headers_for(dueño),
            nombre="portada.png",
            contenido=b"\x89PNG\r\n\x1a\n",
        )
        banner_url = f"/documentos/archivos/{imagen['id']}/descargar"

        guardado = client.put(
            f"/importadores/{importador.id}",
            json={"perfil_publico": {"banner_url": banner_url, "certs": ["ISO 9001"]}},
            headers=auth_headers_for(dueño),
        )
        assert guardado.status_code == 200, guardado.text
        assert guardado.json()["perfil_publico"]["banner_url"] == banner_url

        # Sin cabecera Authorization, como lo pide un <img> del navegador.
        anonimo = client.get(banner_url)
        assert anonimo.status_code == 200, anonimo.text

    def test_un_archivo_privado_sigue_protegido(self, client, db_session):
        importador, dueño = crear_empresa_importadora(
            db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}"
        )
        privado = _subir_archivo(client, auth_headers_for(dueño), nombre="interno.pdf")

        anonimo = client.get(f"/documentos/archivos/{privado['id']}/descargar")
        assert anonimo.status_code == status.HTTP_401_UNAUTHORIZED


class TestCertificadoDeCurso:
    def _curso_con_una_leccion(self, client, db_session):
        importador, dueño = crear_empresa_importadora(
            db_session, nombre_empresa=f"Academia {uuid4().hex[:6]}"
        )
        video = _subir_archivo(
            client, auth_headers_for(dueño), nombre="clase.mp4", contenido=b"\x00\x00\x00 ftypmp42"
        )
        video_url = f"/documentos/archivos/{video['id']}/descargar"
        curso = client.post(
            "/cursos",
            json={
                **CURSO_PAYLOAD_BASE,
                "portada_url": video_url,
                "modulos": [{
                    "titulo": "Módulo 1",
                    "lecciones": [{"titulo": "Lección única", "video_url": video_url}],
                }],
            },
            headers=auth_headers_for(dueño),
        )
        assert curso.status_code == status.HTTP_201_CREATED, curso.text
        return curso.json()

    def test_certificado_requiere_curso_completo(self, client, db_session):
        curso = self._curso_con_una_leccion(client, db_session)
        alumno, headers_alumno = crear_usuario_con_token(db_session, rol="solicitante")
        client.post(f"/cursos/{curso['id']}/comprar", headers=headers_alumno)

        respuesta = client.get(f"/cursos/{curso['id']}/certificado", headers=headers_alumno)
        assert respuesta.status_code == status.HTTP_409_CONFLICT

    def test_certificado_se_emite_una_sola_vez(self, client, db_session):
        curso = self._curso_con_una_leccion(client, db_session)
        alumno, headers_alumno = crear_usuario_con_token(db_session, rol="solicitante")
        client.post(f"/cursos/{curso['id']}/comprar", headers=headers_alumno)
        client.post(
            f"/cursos/{curso['id']}/lecciones/{curso['modulos'][0]['lecciones'][0]['id']}/progreso",
            json={"completada": True},
            headers=headers_alumno,
        )

        primero = client.get(f"/cursos/{curso['id']}/certificado", headers=headers_alumno)
        assert primero.status_code == 200, primero.text
        segundo = client.get(f"/cursos/{curso['id']}/certificado", headers=headers_alumno)
        assert segundo.status_code == 200
        assert primero.json()["archivo_id"] == segundo.json()["archivo_id"], "el certificado debe ser idempotente"

        descarga = client.get(primero.json()["url_descarga"], headers=headers_alumno)
        assert descarga.status_code == 200

    def test_un_no_inscrito_no_obtiene_certificado(self, client, db_session):
        curso = self._curso_con_una_leccion(client, db_session)
        _, headers_extrano = crear_usuario_con_token(db_session, rol="solicitante")

        respuesta = client.get(f"/cursos/{curso['id']}/certificado", headers=headers_extrano)
        assert respuesta.status_code == status.HTTP_403_FORBIDDEN


class TestWhatsAppYFlags:
    @pytest.mark.parametrize(
        "entrada,esperado",
        [
            ("+57 300 123 4567", "573001234567"),
            ("300-123-4567", "573001234567"),
            ("573001234567", "573001234567"),
            ("", None),
            (None, None),
            ("123", None),
        ],
    )
    def test_normalizacion_de_numero(self, entrada, esperado):
        from services.whatsapp_service import normalizar_numero_whatsapp

        assert normalizar_numero_whatsapp(entrada) == esperado

    def test_sin_instancia_configurada_no_falla(self, monkeypatch):
        import config
        from services.whatsapp_service import enviar_whatsapp

        monkeypatch.setattr(config, "OPENWA_API_URL", "")
        assert enviar_whatsapp("+573001234567", "hola") is False

    def test_configuracion_publica_expone_el_flag_educativo(self, client):
        respuesta = client.get("/configuracion-publica")
        assert respuesta.status_code == 200
        assert "modulo_educativo_habilitado" in respuesta.json()

    def test_modulo_educativo_apagado_devuelve_404(self, client, monkeypatch):
        import config

        monkeypatch.setattr(config, "MODULO_EDUCATIVO_HABILITADO", False)
        assert client.get("/cursos").status_code == status.HTTP_404_NOT_FOUND
