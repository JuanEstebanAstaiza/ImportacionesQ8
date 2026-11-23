"""PDF sencillo de varias páginas, sin dependencias externas.

Lo usa la ficha técnica guiada. Escribe texto con Helvetica (normal y negrita) en
WinAnsiEncoding, así que las tildes y la eñe salen bien; corta las líneas largas
por palabras y pasa a otra página cuando se llena.
"""
from __future__ import annotations

from typing import Iterable, List, Tuple

ANCHO, ALTO = 595, 842  # A4 en puntos
MARGEN = 50

# estilo → (fuente, tamaño, espacio antes)
ESTILOS = {
    "titulo": ("F2", 18, 0),
    "subtitulo": ("F1", 10, 4),
    "seccion": ("F2", 12, 14),
    "texto": ("F1", 10.5, 2),
    "pie": ("F1", 8, 10),
}


def _ancho_texto(texto: str, tamano: float) -> float:
    """Ancho aproximado en Helvetica (suficiente para cortar líneas sin desbordar)."""
    total = 0.0
    for c in texto:
        if c in " .,;:!|'ilIjtf()[]":
            total += 0.3
        elif c.isupper() or c in "mwMW@%":
            total += 0.72
        elif c.isdigit():
            total += 0.56
        else:
            total += 0.53
    return total * tamano


def _cortar(texto: str, tamano: float, ancho: float) -> List[str]:
    lineas: List[str] = []
    for parrafo in (texto or "").split("\n"):
        actual = ""
        for palabra in parrafo.split(" "):
            prueba = f"{actual} {palabra}".strip()
            if _ancho_texto(prueba, tamano) <= ancho or not actual:
                actual = prueba
            else:
                lineas.append(actual)
                actual = palabra
        lineas.append(actual)
    return lineas


def _escapar(texto: str) -> str:
    return texto.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def construir(bloques: Iterable[Tuple[str, str]]) -> bytes:
    """`bloques`: pares (estilo, texto). Devuelve el PDF."""
    paginas: List[List[str]] = [[]]
    y = ALTO - MARGEN
    for estilo, texto in bloques:
        fuente, tamano, antes = ESTILOS[estilo]
        interlinea = tamano * 1.35
        y -= antes
        for linea in _cortar(texto, tamano, ANCHO - 2 * MARGEN):
            if y - interlinea < MARGEN:
                paginas.append([])
                y = ALTO - MARGEN
            y -= interlinea
            paginas[-1].append(f"BT /{fuente} {tamano} Tf {MARGEN} {y:.1f} Td ({_escapar(linea)}) Tj ET")

    objetos: List[bytes] = []

    def agregar(contenido: bytes) -> int:
        objetos.append(contenido)
        return len(objetos)

    agregar(b"")  # 1: catálogo (se llena al final)
    agregar(b"")  # 2: páginas
    f1 = agregar(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    f2 = agregar(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    hijos = []
    for i, comandos in enumerate(paginas, start=1):
        pie = f"BT /F1 8 Tf {MARGEN} 25 Td ({_escapar(f'Página {i} de {len(paginas)}')}) Tj ET"
        flujo = "\n".join(comandos + [pie]).encode("cp1252", errors="replace")
        contenido = agregar(f"<< /Length {len(flujo)} >>\nstream\n".encode("ascii") + flujo + b"\nendstream")
        hijos.append(agregar(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {ANCHO} {ALTO}] "
            f"/Resources << /Font << /F1 {f1} 0 R /F2 {f2} 0 R >> >> /Contents {contenido} 0 R >>".encode("ascii")))
    objetos[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objetos[1] = f"<< /Type /Pages /Kids [{' '.join(f'{h} 0 R' for h in hijos)}] /Count {len(hijos)} >>".encode("ascii")

    salida = bytearray(b"%PDF-1.4\n")
    posiciones = []
    for numero, contenido in enumerate(objetos, start=1):
        posiciones.append(len(salida))
        salida.extend(f"{numero} 0 obj\n".encode("ascii") + contenido + b"\nendobj\n")
    xref = len(salida)
    salida.extend(f"xref\n0 {len(objetos) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for posicion in posiciones:
        salida.extend(f"{posicion:010d} 00000 n \n".encode("ascii"))
    salida.extend(f"trailer << /Size {len(objetos) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode("ascii"))
    return bytes(salida)
