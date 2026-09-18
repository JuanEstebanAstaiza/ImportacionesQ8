#!/usr/bin/env python3
"""Renombra la marca en el contenido YA GUARDADO en la base de datos.

    docker compose exec backend sh -c 'cd /app && PYTHONPATH=/app python scripts/renombrar_marca.py --aplicar'

Cambiar el nombre en el código solo afecta a lo que se genere a partir de
ahora. Los artículos del centro de ayuda, las notificaciones ya enviadas y los
mensajes que escribió el propio sistema conservan el texto con el que se
crearon, así que la marca antigua sigue apareciendo en pantalla aunque el
código esté limpio. Este script arregla ese resto.

Toca únicamente contenido generado por plantillas de la plataforma. Lo que
escribió una persona (reseñas, mensajes de chat de usuarios, descripciones de
empresa) NO se reescribe: son sus palabras, no un rótulo nuestro. Esas
coincidencias se listan al final para que alguien decida a mano.

Sin `--aplicar` no escribe nada: enseña lo que cambiaría.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402

from database import SessionLocal  # noqa: E402

MARCA_ANTERIOR = "ImportacionesQ8"
MARCA_NUEVA = "Zarpi"

# Contenido editorial o generado por plantilla: se renombra.
CONTENIDO_DE_PLATAFORMA = [
    ("articulos_ayuda", ("titulo", "resumen", "contenido")),
    ("categorias_ayuda", ("nombre", "descripcion")),
    ("notificaciones", ("titulo", "mensaje")),
    ("certificaciones", ("nombre", "descripcion")),
]

# Los mensajes del chat solo se tocan si los escribió el sistema: el prefijo
# "[Soporte ...]" lo pone el backend al intervenir el equipo de la plataforma.
FILTRO_MENSAJES_SISTEMA = (
    "tipo = 'sistema' OR contenido LIKE :prefijo_soporte"
)


def _columnas_de_texto(db, tabla: str) -> set[str]:
    filas = db.execute(text(f"SHOW COLUMNS FROM `{tabla}`")).fetchall()
    return {
        f[0] for f in filas
        if any(t in str(f[1]).lower() for t in ("char", "text", "json"))
    }


def _tablas(db) -> list[str]:
    return [f[0] for f in db.execute(text("SHOW TABLES")).fetchall()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--aplicar",
        action="store_true",
        help="Escribe los cambios. Sin esta bandera solo informa.",
    )
    args = parser.parse_args()

    patron = f"%{MARCA_ANTERIOR}%"
    db = SessionLocal()
    tocadas = 0
    try:
        existentes = set(_tablas(db))

        print(f"Contenido de la plataforma ({MARCA_ANTERIOR} -> {MARCA_NUEVA}):")
        for tabla, columnas in CONTENIDO_DE_PLATAFORMA:
            if tabla not in existentes:
                continue
            disponibles = _columnas_de_texto(db, tabla)
            for columna in columnas:
                if columna not in disponibles:
                    continue
                n = db.execute(
                    text(f"SELECT COUNT(*) FROM `{tabla}` WHERE `{columna}` LIKE :p"),
                    {"p": patron},
                ).scalar() or 0
                if not n:
                    continue
                print(f"  {tabla}.{columna}: {n} fila(s)")
                tocadas += n
                if args.aplicar:
                    db.execute(
                        text(
                            f"UPDATE `{tabla}` SET `{columna}` = "
                            f"REPLACE(`{columna}`, :viejo, :nuevo) WHERE `{columna}` LIKE :p"
                        ),
                        {"viejo": MARCA_ANTERIOR, "nuevo": MARCA_NUEVA, "p": patron},
                    )

        if "mensajes_chat" in existentes:
            n = db.execute(
                text(
                    "SELECT COUNT(*) FROM mensajes_chat "
                    f"WHERE contenido LIKE :p AND ({FILTRO_MENSAJES_SISTEMA})"
                ),
                {"p": patron, "prefijo_soporte": f"[Soporte {MARCA_ANTERIOR}]%"},
            ).scalar() or 0
            if n:
                print(f"  mensajes_chat.contenido (solo del sistema): {n} fila(s)")
                tocadas += n
                if args.aplicar:
                    db.execute(
                        text(
                            "UPDATE mensajes_chat SET contenido = "
                            "REPLACE(contenido, :viejo, :nuevo) "
                            f"WHERE contenido LIKE :p AND ({FILTRO_MENSAJES_SISTEMA})"
                        ),
                        {
                            "viejo": MARCA_ANTERIOR,
                            "nuevo": MARCA_NUEVA,
                            "p": patron,
                            "prefijo_soporte": f"[Soporte {MARCA_ANTERIOR}]%",
                        },
                    )

        if args.aplicar:
            db.commit()
            print(f"\nActualizadas {tocadas} fila(s).")
        else:
            print(f"\n{tocadas} fila(s) se actualizarían. Repite con --aplicar.")

        # Lo que queda es texto de personas: se informa, no se toca.
        print("\nRestos que NO se tocan (texto escrito por usuarios):")
        restos = 0
        tratadas = dict(CONTENIDO_DE_PLATAFORMA)
        for tabla in existentes:
            for columna in sorted(_columnas_de_texto(db, tabla)):
                if columna in tratadas.get(tabla, ()):
                    continue
                # Las filas del sistema ya se renombran arriba: contarlas otra
                # vez aquí haría creer que quedó marca vieja sin tocar.
                extra, parametros = "", {"p": patron}
                if tabla == "mensajes_chat" and columna == "contenido":
                    extra = f" AND NOT ({FILTRO_MENSAJES_SISTEMA})"
                    parametros["prefijo_soporte"] = f"[Soporte {MARCA_ANTERIOR}]%"
                try:
                    n = db.execute(
                        text(f"SELECT COUNT(*) FROM `{tabla}` WHERE `{columna}` LIKE :p{extra}"),
                        parametros,
                    ).scalar() or 0
                except Exception:
                    continue
                if n:
                    print(f"  {tabla}.{columna}: {n} fila(s)")
                    restos += n
        if not restos:
            print("  (ninguno)")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
