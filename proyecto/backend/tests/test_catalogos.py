"""Catálogos selectos de empresas y acceso a fotos de producto."""
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.cotizacion import Cotizacion
from models.documental import Archivo
from models.orden import Orden
from services import tendencias


def _empresa(db_session, nombre="Andes Import"):
    importador, dueno = crear_empresa_importadora(db_session, nombre_empresa=nombre)
    return importador, dueno, auth_headers_for(dueno)


def _catalogo(client, headers, **datos):
    r = client.post("/catalogos", json={"titulo": "Selección VIP", **datos}, headers=headers)
    assert r.status_code == 201, r.text
    catalogo = r.json()
    r = client.post(f"/catalogos/{catalogo['id']}/productos", json={
        "nombre": "Termo de acero 1 L", "linea_producto": "Hogar", "cantidad_minima": 500,
        "fotos": ["/documentos/archivos/22222222-2222-2222-2222-222222222222/descargar"],
    }, headers=headers)
    assert r.status_code == 201, r.text
    return catalogo, r.json()


def _cotizacion(db_session, solicitante_id, importador_id):
    cot = Cotizacion(
        id=str(uuid4()), solicitante_id=solicitante_id, importador_id=importador_id, modalidad="dirigida",
        pais_importacion="China", nombre_producto="X", descripcion_cliente="Descripción de prueba larga",
        linea_producto="Hogar", tipo_calidad="estandar", cantidad_minima=10, estado="dirigida",
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(cot)
    db_session.commit()
    return cot


def test_catalogo_manual_solo_lo_ven_los_elegidos(client, db_session):
    importador, _, empresa = _empresa(db_session)
    catalogo, producto = _catalogo(client, empresa)
    cliente, h_cliente = crear_usuario_con_token(db_session)
    _, h_otro = crear_usuario_con_token(db_session)

    assert client.get("/catalogos/disponibles", headers=h_cliente).json() == []

    # Solo se puede elegir a quien ya cotizó con la empresa.
    r = client.post(f"/catalogos/{catalogo['id']}/accesos", json={"usuario_id": cliente.id}, headers=empresa)
    assert r.status_code == 400
    _cotizacion(db_session, cliente.id, importador.id)
    assert [c["usuario_id"] for c in client.get("/catalogos/clientes", headers=empresa).json()] == [cliente.id]
    r = client.post(f"/catalogos/{catalogo['id']}/accesos", json={"usuario_id": cliente.id}, headers=empresa)
    assert r.status_code == 201, r.text

    disponibles = client.get("/catalogos/disponibles", headers=h_cliente).json()
    assert [c["id"] for c in disponibles] == [catalogo["id"]]
    assert disponibles[0]["acceso_por"] == "manual"
    assert disponibles[0]["empresa"]["nombre"] == "Andes Import"
    assert disponibles[0]["productos"][0]["id"] == producto["id"]
    assert client.get("/catalogos/disponibles", headers=h_otro).json() == []
    assert client.get(f"/catalogos/ver/{catalogo['id']}", headers=h_otro).status_code == 404

    client.delete(f"/catalogos/{catalogo['id']}/accesos/{cliente.id}", headers=empresa)
    assert client.get("/catalogos/disponibles", headers=h_cliente).json() == []


def test_criterio_por_tier(client, db_session):
    _, _, empresa = _empresa(db_session)
    catalogo, _ = _catalogo(client, empresa, criterio="tier_minimo", tier_minimo="Gold")
    _, h_bronze = crear_usuario_con_token(db_session)
    gold, h_gold = crear_usuario_con_token(db_session)
    gold.tier = "Gold"
    db_session.commit()

    assert client.get("/catalogos/disponibles", headers=h_bronze).json() == []
    disponibles = client.get("/catalogos/disponibles", headers=h_gold).json()
    assert [c["id"] for c in disponibles] == [catalogo["id"]]
    assert disponibles[0]["acceso_por"] == "criterio"


def test_criterio_tier_exige_nivel(client, db_session):
    _, _, empresa = _empresa(db_session)
    r = client.post("/catalogos", json={"titulo": "X", "criterio": "tier_minimo"}, headers=empresa)
    assert r.status_code == 422


def test_criterio_clientes_con_orden(client, db_session):
    importador, _, empresa = _empresa(db_session)
    catalogo, _ = _catalogo(client, empresa, criterio="clientes_con_orden")
    cliente, h_cliente = crear_usuario_con_token(db_session)
    assert client.get("/catalogos/disponibles", headers=h_cliente).json() == []

    cot = _cotizacion(db_session, cliente.id, importador.id)
    db_session.add(Orden(id=str(uuid4()), cotizacion_id=cot.id, importador_id=importador.id,
                         solicitante_id=cliente.id, estado="cotizacion_aceptada", precio_acordado_usd=1000))
    db_session.commit()
    assert [c["id"] for c in client.get("/catalogos/disponibles", headers=h_cliente).json()] == [catalogo["id"]]


def test_criterio_suscriptores_de_tendencias(client, db_session):
    _, _, empresa = _empresa(db_session)
    catalogo, _ = _catalogo(client, empresa, criterio="suscriptores_zarpi")
    cliente, h_cliente = crear_usuario_con_token(db_session)
    assert client.get("/catalogos/disponibles", headers=h_cliente).json() == []
    tendencias.otorgar_acceso(db_session, usuario_id=cliente.id, dias=5, origen="cortesia")
    db_session.commit()
    assert [c["id"] for c in client.get("/catalogos/disponibles", headers=h_cliente).json()] == [catalogo["id"]]


def test_solo_la_cuenta_duena_administra(client, db_session):
    importador, _, empresa = _empresa(db_session)
    _, asesor = crear_usuario_con_token(db_session, rol="asesor", importador_id=importador.id)
    _, otra_empresa = _empresa(db_session, "Otra")[1:]
    catalogo, _ = _catalogo(client, empresa)

    assert client.post("/catalogos", json={"titulo": "X"}, headers=asesor).status_code == 403
    assert len(client.get("/catalogos/mios", headers=asesor).json()) == 1
    assert client.put(f"/catalogos/{catalogo['id']}", json={"titulo": "Mío"}, headers=otra_empresa).status_code == 404


def test_solicitud_desde_catalogo_va_dirigida_a_la_empresa(client, db_session):
    importador, _, empresa = _empresa(db_session)
    otra, _, _ = _empresa(db_session, "Otra")
    catalogo, producto = _catalogo(client, empresa, criterio="tier_minimo", tier_minimo="Bronze")
    _, h_cliente = crear_usuario_con_token(db_session)
    base = {
        "pais_importacion": "China", "nombre_producto": "Termo de acero 1 L",
        "descripcion_cliente": "Termo de acero inoxidable, 1 litro, con logo.", "linea_producto": "Textiles",
        "tipo_calidad": "estandar", "cantidad_minima": 500,
        "origen": "catalogo", "catalogo_producto_id": producto["id"],
    }
    r = client.post("/cotizaciones", json={**base, "modalidad": "dirigida", "importador_id": otra.id}, headers=h_cliente)
    assert r.status_code == 400
    r = client.post("/cotizaciones", json={**base, "modalidad": "dirigida", "importador_id": importador.id}, headers=h_cliente)
    assert r.status_code == 201, r.text
    assert r.json()["origen"] == "catalogo"
    assert r.json()["catalogo_producto_id"] == producto["id"]


def _archivo(db_session, owner_id):
    archivo_id = str(uuid4())
    ruta = Path("uploads/documentos") / f"{archivo_id}_foto.png"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(b"\x89PNG\r\n\x1a\n")
    db_session.add(Archivo(
        id=archivo_id, owner_user_id=owner_id, nombre="foto.png", extension="png", mime_type="image/png",
        tipo_recurso="imagen", size_bytes=8, storage_path=str(ruta),
        storage_url=f"/documentos/archivos/{archivo_id}/descargar", origen="cotizacion",
    ))
    db_session.commit()
    return archivo_id


def test_la_empresa_ve_las_fotos_de_la_cotizacion_que_recibe(client, db_session):
    importador, _, empresa = _empresa(db_session)
    _, _, otra = _empresa(db_session, "Otra")
    cliente, h_cliente = crear_usuario_con_token(db_session)
    archivo_id = _archivo(db_session, cliente.id)
    url = f"/documentos/archivos/{archivo_id}/descargar"
    cot = _cotizacion(db_session, cliente.id, importador.id)
    cot.foto_producto = url
    cot.fotos_producto = [url]
    db_session.commit()

    assert client.get(url, headers=h_cliente).status_code == 200
    assert client.get(url, headers=empresa).status_code == 200
    assert client.get(url, headers=otra).status_code == 403
