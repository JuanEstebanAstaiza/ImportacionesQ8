"""Limpia datos de campañas de carga (conserva admin y estructura)."""
from sqlalchemy import text
from database import SessionLocal


TABLES = [
    "progreso_lecciones",
    "compras_curso",
    "recursos_leccion",
    "lecciones_curso",
    "modulos_curso",
    "cursos",
    "mensajes_chat",
    "conversaciones_chat",
    "notificaciones",
    "documentos_orden",
    "historial_estados_orden",
    "ordenes",
    "pagos",
    "propuestas",
    "cotizaciones",
    "movimientos_credito",
    "codigos_otp",
    "jwt_blacklist",
    "miembros_organizacion",
    "organizaciones_solicitantes",
    "referidos_uso",
    "codigos_referido",
    "evidencias_importador",
    "campos_personalizados",
    "solicitudes_recreacion",
    "disputas",
    "evidencias_disputa",
    "mensajes_disputa",
]


def main() -> None:
    db = SessionLocal()
    try:
        for t in TABLES:
            try:
                db.execute(text(f"DELETE FROM `{t}`"))
                db.commit()
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                print(f"skip {t}: {type(exc).__name__}")

        # Usuarios de carga + dueños de empresas de carga; no admin
        db.execute(
            text(
                """
                DELETE FROM usuarios
                WHERE email LIKE :p1
                   OR email LIKE :p2
                   OR email LIKE :p3
                   OR email LIKE :p4
                """
            ),
            {
                "p1": "%@load.example.com",
                "p2": "dueno_c%",
                "p3": "probe_load%",
                "p4": "dueño_%",
            },
        )
        db.commit()

        # Empresas de carga (todas salvo si hubiera seed real — en load solo hay de prueba)
        try:
            db.execute(text("DELETE FROM importadores"))
            db.commit()
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            print(f"skip importadores: {type(exc).__name__}")

        n = db.execute(text("SELECT COUNT(*) FROM usuarios")).scalar()
        print(f"cleanup OK; usuarios restantes={n}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
