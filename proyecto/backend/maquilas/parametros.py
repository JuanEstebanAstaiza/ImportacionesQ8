"""Parámetros del módulo: lo que el admin puede ajustar sin redesplegar.

Se guardan en la colección `configuracion` (documento `parametros`) y se mezclan
con los valores por defecto, así que un parámetro nuevo funciona aunque el
admin nunca lo haya tocado.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

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
}


def leer(db: Database) -> Dict[str, Any]:
    guardado = db.configuracion.find_one({"_id": "parametros"}) or {}
    valores = deepcopy(POR_DEFECTO)
    valores.update({k: v for k, v in guardado.items() if k in POR_DEFECTO})
    return valores


def claves_categorias(db: Database) -> set:
    return {c["clave"] for c in leer(db)["categorias"]}


def publicos(db: Database) -> Dict[str, Any]:
    """Lo que necesitan los formularios (registro y perfil), sin sesión."""
    p = leer(db)
    return {k: p[k] for k in ("categorias", "procesos", "certificaciones", "fotos_galeria_max",
                              "certificados_max", "mb_max_foto", "mb_max_documento", "mb_max_video",
                              "plantillas", "etapas", "hitos", "hitos_por_defecto", "personalizaciones",
                              "productos_max", "fotos_producto_max", "criterios_calidad")}


def plantilla(db: Database, categoria: str) -> list:
    plantillas = leer(db)["plantillas"]
    return plantillas.get(categoria) or plantillas.get("otros") or []
