"""Ficha técnica guiada: el cliente la llena por secciones y se genera su PDF.

Se guarda estructurada en la solicitud (la maquila la ve por secciones) y el PDF
queda como la ficha técnica adjunta, igual que si el cliente lo hubiera subido.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from pymongo.database import Database

from maquilas import parametros, pdf
from maquilas.comun import ahora

SECCIONES = [
    ("medidas", "Medidas y tallas"),
    ("materiales", "Materiales"),
    ("colores", "Colores (nombre o código Pantone)"),
    ("acabados", "Acabados"),
    ("empaque", "Empaque"),
    ("etiquetado", "Etiquetado"),
    ("notas", "Notas para la maquila"),
]
ETIQUETAS = dict(SECCIONES)


def limpiar(ficha: Dict[str, str]) -> Dict[str, str]:
    return {clave: (ficha.get(clave) or "").strip() for clave, _ in SECCIONES if (ficha.get(clave) or "").strip()}


def a_lista(ficha: Optional[Dict[str, str]]) -> List[Dict]:
    return [{"clave": c, "etiqueta": e, "valor": ficha[c]} for c, e in SECCIONES if ficha and ficha.get(c)]


def generar_pdf(db: Database, ficha: Dict[str, str], *, titulo: str, categoria: str, cantidad: Optional[int] = None,
                cliente: Optional[Dict] = None, codigo: Optional[str] = None) -> bytes:
    nombres = {c["clave"]: c["nombre"] for c in parametros.leer(db)["categorias"]}
    datos = [f"Categoría: {nombres.get(categoria, categoria)}"]
    if cantidad:
        datos.append(f"Cantidad: {cantidad:,} unidades".replace(",", "."))
    if cliente and (cliente.get("empresa") or cliente.get("nombre")):
        datos.append(f"Cliente: {cliente.get('empresa') or cliente.get('nombre')}")
    if codigo:
        datos.append(f"Solicitud: {codigo}")
    datos.append(f"Fecha: {ahora().strftime('%d/%m/%Y')}")
    bloques = [("titulo", "Ficha técnica"), ("seccion", titulo), ("subtitulo", " · ".join(datos))]
    for clave, etiqueta in SECCIONES:
        if ficha.get(clave):
            bloques += [("seccion", etiqueta), ("texto", ficha[clave])]
    bloques.append(("pie", "Generada con Zarpi Maquilas. Lo que se acuerde aquí es la referencia para la muestra y la inspección de calidad."))
    return pdf.construir(bloques)
