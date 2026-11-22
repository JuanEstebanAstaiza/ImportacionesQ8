"""Parámetros del módulo: lo que el admin puede ajustar sin redesplegar.

Se guardan en la colección `configuracion` (documento `parametros`) y se mezclan
con los valores por defecto, así que un parámetro nuevo funciona aunque el
admin nunca lo haya tocado.
"""
from __future__ import annotations

import re
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List

from pymongo.database import Database

POR_DEFECTO: Dict[str, Any] = {
    # Qué se fabrica. La clave es estable (se guarda en las maquiladoras); el nombre se puede cambiar.
    "categorias": [
        {"clave": "textil", "nombre": "Textil y confección"},
        {"clave": "calzado", "nombre": "Calzado"},
        {"clave": "marroquineria", "nombre": "Marroquinería y accesorios"},
        {"clave": "cosmetica", "nombre": "Cosmética y cuidado personal"},
        {"clave": "alimentos", "nombre": "Alimentos y bebidas"},
        {"clave": "suplementos", "nombre": "Suplementos y nutrición"},
        {"clave": "aseo", "nombre": "Aseo y hogar"},
        {"clave": "empaques", "nombre": "Empaques y etiquetas"},
        {"clave": "muebles", "nombre": "Muebles y madera"},
        {"clave": "plasticos", "nombre": "Plásticos e inyección"},
        {"clave": "metalmecanica", "nombre": "Metalmecánica"},
        {"clave": "otros", "nombre": "Otros"},
    ],
    "procesos": [
        "Diseño y patronaje", "Corte", "Confección", "Estampado", "Sublimación", "Bordado", "Tejido",
        "Formulación", "Llenado y envasado", "Etiquetado", "Empaque", "Inyección", "Mecanizado",
        "Ensamble", "Control de calidad",
    ],
    "certificaciones": ["BPM", "INVIMA", "ISO 9001", "ISO 14001", "HACCP", "Orgánico"],
    "fotos_galeria_max": 12,
    "certificados_max": 10,
    "mb_max_foto": 10,
    "mb_max_documento": 15,
    "mb_max_video": 200,
    # Brief guiado: lo que se le pregunta al cliente según la categoría (además de lo común).
    # Tipos: "texto" (una línea) o "texto_largo".
    "plantillas": {
        "textil": [
            {"clave": "tallas", "etiqueta": "Tallas y curva", "tipo": "texto", "ayuda": "Ej.: S 20 %, M 40 %, L 30 %, XL 10 %"},
            {"clave": "tela", "etiqueta": "Tela o material", "tipo": "texto", "ayuda": "Ej.: algodón peinado 180 g"},
            {"clave": "colores", "etiqueta": "Colores", "tipo": "texto", "ayuda": "Nombre o código Pantone"},
            {"clave": "marcacion", "etiqueta": "Estampado, bordado o etiquetas", "tipo": "texto_largo", "ayuda": "Qué va marcado, dónde y con qué técnica"},
        ],
        "calzado": [
            {"clave": "tallas", "etiqueta": "Tallas", "tipo": "texto", "ayuda": "Ej.: 35 a 40"},
            {"clave": "materiales", "etiqueta": "Materiales", "tipo": "texto", "ayuda": "Capellada, suela, forro"},
            {"clave": "colores", "etiqueta": "Colores", "tipo": "texto"},
        ],
        "cosmetica": [
            {"clave": "tipo_producto", "etiqueta": "Tipo de producto", "tipo": "texto", "ayuda": "Ej.: crema hidratante, shampoo"},
            {"clave": "presentacion", "etiqueta": "Presentación y envase", "tipo": "texto", "ayuda": "Ej.: frasco 250 ml con dispensador"},
            {"clave": "formula", "etiqueta": "Fórmula", "tipo": "texto_largo", "ayuda": "¿Tienes fórmula propia o usas una de la maquila? Ingredientes clave"},
            {"clave": "registro_sanitario", "etiqueta": "Registro sanitario", "tipo": "texto", "ayuda": "¿Ya lo tienes o lo tramita la maquila?"},
        ],
        "alimentos": [
            {"clave": "tipo_producto", "etiqueta": "Producto", "tipo": "texto"},
            {"clave": "presentacion", "etiqueta": "Presentación y empaque", "tipo": "texto"},
            {"clave": "vida_util", "etiqueta": "Vida útil esperada", "tipo": "texto"},
            {"clave": "registro_sanitario", "etiqueta": "Registro sanitario", "tipo": "texto"},
        ],
        "otros": [
            {"clave": "materiales", "etiqueta": "Materiales", "tipo": "texto"},
            {"clave": "medidas", "etiqueta": "Medidas", "tipo": "texto"},
            {"clave": "colores", "etiqueta": "Colores y acabados", "tipo": "texto"},
        ],
    },
    # Solicitud abierta: a cuántas maquiladoras compatibles se reparte.
    "cupo_abierta": 5,
    # Pedido: etapas de producción, en orden.
    "etapas": [
        {"clave": "insumos", "nombre": "Compra de insumos"},
        {"clave": "preparacion", "nombre": "Corte o preparación"},
        {"clave": "fabricacion", "nombre": "Fabricación"},
        {"clave": "acabado", "nombre": "Acabado"},
        {"clave": "control_calidad", "nombre": "Control de calidad"},
        {"clave": "empaque", "nombre": "Empaque"},
        {"clave": "despacho", "nombre": "Despacho"},
    ],
    # Hitos de pago posibles y el reparto que se propone por defecto.
    "hitos": [
        {"clave": "anticipo", "nombre": "Anticipo"},
        {"clave": "contra_muestra", "nombre": "Contra muestra aprobada"},
        {"clave": "contra_entrega", "nombre": "Contra entrega"},
    ],
    "hitos_por_defecto": {"anticipo": 50, "contra_muestra": 0, "contra_entrega": 50},
    # Fase 3. Marca blanca: qué puede personalizar el cliente en un producto del catálogo.
    "personalizaciones": [
        {"clave": "logo", "nombre": "Logo"},
        {"clave": "etiqueta", "nombre": "Etiqueta"},
        {"clave": "empaque", "nombre": "Empaque"},
        {"clave": "color", "nombre": "Color"},
        {"clave": "aroma_sabor", "nombre": "Aroma o sabor"},
    ],
    "productos_max": 30,
    "fotos_producto_max": 6,
    # Checklist de calidad que se le sugiere a la maquila al proponer (lo puede editar).
    "criterios_calidad": {
        "textil": [
            {"criterio": "Medidas según la tabla de tallas", "tolerancia": "± 1 cm"},
            {"criterio": "Costuras firmes, sin hilos sueltos ni saltos", "tolerancia": ""},
            {"criterio": "Color igual a la muestra aprobada", "tolerancia": ""},
            {"criterio": "Estampado o bordado centrado y sin desprendimientos", "tolerancia": "± 0,5 cm"},
            {"criterio": "Etiquetas y empaque según lo acordado", "tolerancia": ""},
        ],
        "cosmetica": [
            {"criterio": "Llenado al volumen declarado", "tolerancia": "± 2 %"},
            {"criterio": "Olor, color y textura iguales a la muestra", "tolerancia": ""},
            {"criterio": "Envase sin fugas, golpes ni rayones", "tolerancia": ""},
            {"criterio": "Etiqueta con lote y fecha de vencimiento", "tolerancia": ""},
        ],
        "alimentos": [
            {"criterio": "Peso neto según lo declarado", "tolerancia": "± 2 %"},
            {"criterio": "Sabor, color y textura iguales a la muestra", "tolerancia": ""},
            {"criterio": "Empaque sellado y sin daños", "tolerancia": ""},
            {"criterio": "Etiqueta con lote, fecha de vencimiento y registro", "tolerancia": ""},
        ],
        "otros": [
            {"criterio": "Medidas y acabados según la ficha técnica", "tolerancia": ""},
            {"criterio": "Igual a la muestra aprobada", "tolerancia": ""},
            {"criterio": "Sin defectos visibles", "tolerancia": ""},
            {"criterio": "Empaque y etiquetado según lo acordado", "tolerancia": ""},
        ],
    },
    # Fase 4. Estudio de marca.
    "marcas_max": 10,
    "paleta_max": 8,
    "archivos_marca_max": 20,
    # Encargos de diseño que atiende el equipo de Diseño de Zarpi.
    "tipos_encargo": [
        {"clave": "logo", "nombre": "Logo", "descripcion": "Logotipo con sus versiones (color, una tinta, ícono) en PNG y PDF."},
        {"clave": "etiqueta", "nombre": "Etiqueta", "descripcion": "Etiqueta de marca, de composición o frontal del producto, lista para imprimir."},
        {"clave": "empaque", "nombre": "Empaque", "descripcion": "Caja, bolsa o envase con tu marca, con su troquel o arte final."},
        {"clave": "otro", "nombre": "Otra pieza", "descripcion": "Tarjeta, hang tag, sticker o lo que necesites para tu marca."},
    ],
    "versiones_max": 6,
    # Ruta legal: pasos para vender con marca propia en Colombia. `categorias` vacío = aplica a todas.
    "ruta_legal": [
        {"clave": "rut", "nombre": "RUT con la actividad económica", "categorias": [],
         "descripcion": "Inscríbete o actualiza tu RUT en la DIAN con el código CIIU de lo que vas a vender.",
         "enlace": "https://www.dian.gov.co"},
        {"clave": "registro_marca", "nombre": "Registro de marca ante la SIC", "categorias": [],
         "descripcion": "Busca que nadie tenga tu nombre y regístralo en la Superintendencia de Industria y Comercio (dura 10 años).",
         "enlace": "https://www.sic.gov.co/marcas"},
        {"clave": "facturacion", "nombre": "Facturación electrónica", "categorias": [],
         "descripcion": "Habilítate como facturador electrónico ante la DIAN antes de vender.",
         "enlace": "https://www.dian.gov.co"},
        {"clave": "invima", "nombre": "Registro o notificación sanitaria INVIMA",
         "categorias": ["cosmetica", "alimentos", "suplementos", "aseo"],
         "descripcion": "Cosméticos, alimentos, suplementos y productos de aseo necesitan notificación o registro sanitario. Pregúntale a tu maquila si lo tramita con su laboratorio.",
         "enlace": "https://www.invima.gov.co"},
        {"clave": "etiquetado", "nombre": "Etiquetado reglamentario", "categorias": [],
         "descripcion": "La etiqueta debe cumplir el reglamento de tu producto (p. ej. Res. 1950 para textiles, Res. 5109 o 810 para alimentos): composición, origen, fabricante, cuidados.",
         "enlace": "https://www.sic.gov.co/reglamentos-tecnicos"},
        {"clave": "codigo_barras", "nombre": "Códigos de barras GS1", "categorias": [],
         "descripcion": "Si vas a vender en grandes superficies o marketplaces, afíliate a GS1 Colombia y asigna un código a cada referencia.",
         "enlace": "https://www.gs1co.org"},
    ],
    # Colaboradores que puede invitar la cuenta dueña de una maquiladora.
    "colaboradores_max": 10,
}

# Lo que el admin puede cambiar desde Maquilas › Configuración, con sus límites.
RANGOS: Dict[str, tuple] = {
    "fotos_galeria_max": (1, 30),
    "certificados_max": (1, 30),
    "mb_max_foto": (1, 50),
    "mb_max_documento": (1, 100),
    "mb_max_video": (10, 1024),
    "cupo_abierta": (1, 30),
    "productos_max": (1, 200),
    "fotos_producto_max": (1, 12),
    "marcas_max": (1, 50),
    "paleta_max": (1, 20),
    "archivos_marca_max": (1, 100),
    "versiones_max": (1, 20),
    "colaboradores_max": (0, 100),
}
LISTAS_TEXTO = ("procesos", "certificaciones")
EDITABLES = tuple(RANGOS) + LISTAS_TEXTO + ("categorias", "personalizaciones", "tipos_encargo", "ruta_legal")
_CLAVE = re.compile(r"^[a-z0-9_]{2,40}$")


def leer(db: Database) -> Dict[str, Any]:
    guardado = db.configuracion.find_one({"_id": "parametros"}) or {}
    valores = deepcopy(POR_DEFECTO)
    valores.update({k: v for k, v in guardado.items() if k in POR_DEFECTO})
    return valores


def _lista_con_clave(valor: Any, nombre: str, campos: tuple, anteriores: List[Dict]) -> List[Dict]:
    """Listas de {clave, nombre, ...}: las claves no cambian ni se borran (las usan
    maquiladoras, productos y marcas); se pueden renombrar y agregar nuevas."""
    if not isinstance(valor, list) or not valor:
        raise ValueError(f"«{nombre}» no puede quedar vacío")
    salida, vistas = [], set()
    for item in valor:
        clave = str((item or {}).get("clave", "")).strip()
        texto = str((item or {}).get("nombre", "")).strip()
        if not _CLAVE.match(clave):
            raise ValueError(f"En «{nombre}», la clave «{clave}» solo puede tener minúsculas, números y _")
        if not texto or clave in vistas:
            raise ValueError(f"En «{nombre}», cada elemento necesita un nombre y una clave única")
        vistas.add(clave)
        limpio = {"clave": clave, "nombre": texto[:120]}
        for campo in campos:
            v = item.get(campo)
            limpio[campo] = [str(x).strip() for x in v if str(x).strip()] if isinstance(v, list) else str(v or "").strip()[:600]
        salida.append(limpio)
    faltan = {a["clave"] for a in anteriores} - vistas
    if faltan:
        raise ValueError(f"En «{nombre}» no se pueden quitar elementos que ya existen: {', '.join(sorted(faltan))}")
    return salida


def guardar(db: Database, cambios: Dict[str, Any], usuario_id: str) -> Dict[str, Any]:
    """Valida y guarda lo que el admin cambió. Lo no editable desde el panel se ignora."""
    actuales = leer(db)
    limpios: Dict[str, Any] = {}
    for clave, valor in cambios.items():
        if clave not in EDITABLES or valor is None:
            continue
        if clave in RANGOS:
            minimo, maximo = RANGOS[clave]
            try:
                valor = int(valor)
            except (TypeError, ValueError):
                raise ValueError(f"«{clave}» tiene que ser un número")
            if not minimo <= valor <= maximo:
                raise ValueError(f"«{clave}» debe estar entre {minimo} y {maximo}")
        elif clave in LISTAS_TEXTO:
            if not isinstance(valor, list):
                raise ValueError(f"«{clave}» tiene que ser una lista")
            valor = list(dict.fromkeys(str(v).strip()[:80] for v in valor if str(v).strip()))
            if not valor:
                raise ValueError(f"«{clave}» no puede quedar vacío")
        elif clave == "tipos_encargo":
            valor = _lista_con_clave(valor, clave, ("descripcion",), actuales[clave])
        elif clave == "ruta_legal":
            valor = _lista_con_clave(valor, clave, ("descripcion", "enlace", "categorias"), actuales[clave])
            for paso in valor:
                if paso["enlace"] and not paso["enlace"].startswith(("https://", "http://")):
                    raise ValueError(f"El enlace de «{paso['nombre']}» tiene que empezar por https://")
        else:  # categorias, personalizaciones
            valor = _lista_con_clave(valor, clave, (), actuales[clave])
        limpios[clave] = valor
    db.configuracion.update_one({"_id": "parametros"},
                                {"$set": {**limpios, "actualizado_por": usuario_id, "actualizado_en": datetime.utcnow()}},
                                upsert=True)
    return leer(db)


def ruta_para(db: Database, categoria: str | None) -> List[Dict]:
    """Pasos de la ruta legal que aplican a una categoría (sin categoría, solo los generales)."""
    return [p for p in leer(db)["ruta_legal"] if not p.get("categorias") or (categoria and categoria in p["categorias"])]


def claves_categorias(db: Database) -> set:
    return {c["clave"] for c in leer(db)["categorias"]}


def publicos(db: Database) -> Dict[str, Any]:
    """Lo que necesitan los formularios (registro y perfil), sin sesión."""
    p = leer(db)
    return {k: p[k] for k in ("categorias", "procesos", "certificaciones", "fotos_galeria_max",
                              "certificados_max", "mb_max_foto", "mb_max_documento", "mb_max_video",
                              "plantillas", "etapas", "hitos", "hitos_por_defecto", "personalizaciones",
                              "productos_max", "fotos_producto_max", "criterios_calidad", "marcas_max", "paleta_max",
                              "archivos_marca_max", "tipos_encargo", "ruta_legal")}


def plantilla(db: Database, categoria: str) -> list:
    plantillas = leer(db)["plantillas"]
    return plantillas.get(categoria) or plantillas.get("otros") or []
