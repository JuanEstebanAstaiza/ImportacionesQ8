"""Lista cerrada: hasta que los VIP prueben la plataforma no se abre al público.

1. `inscripciones_plan.plan_id` admite vacío: la lista de espera de la apertura
   al público no es de ningún plan. `que_importar` guarda lo que la persona
   quiere traer (se usa con las empresas importadoras).
2. `planes.enlace_pago`: enlace de pago (Wompi) que se muestra en la
   inscripción, además de la transferencia.
3. Datos de lanzamiento: se despublica el Paquete Importador, el Plan VIP queda
   con 20 cupos y se apaga el registro público (Admin › Módulos lo reabre).
"""
from datetime import datetime
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261018_0044"
down_revision: Union[str, None] = "20261014_0043"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CUPOS_VIP = 20


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade() -> None:
    columnas = _columnas("inscripciones_plan")
    op.alter_column("inscripciones_plan", "plan_id", existing_type=sa.String(length=36), nullable=True)
    if "que_importar" not in columnas:
        op.add_column("inscripciones_plan", sa.Column("que_importar", sa.Text(), nullable=True))
    if "enlace_pago" not in _columnas("planes"):
        op.add_column("planes", sa.Column("enlace_pago", sa.String(length=500), nullable=True))

    bind = op.get_bind()
    bind.execute(sa.text("UPDATE planes SET activo = :no WHERE clave = 'importador'"), {"no": False})
    bind.execute(sa.text("UPDATE planes SET cupos_totales = :cupos WHERE clave = 'vip'"), {"cupos": CUPOS_VIP})
    ahora = datetime.utcnow()
    if bind.execute(sa.text("SELECT COUNT(*) FROM configuracion_plataforma WHERE clave = 'modulos.registro'")).scalar():
        bind.execute(sa.text("UPDATE configuracion_plataforma SET valor = '0', fecha_actualizacion = :ahora "
                             "WHERE clave = 'modulos.registro'"), {"ahora": ahora})
    else:
        bind.execute(sa.text("INSERT INTO configuracion_plataforma (clave, valor, fecha_actualizacion) "
                             "VALUES ('modulos.registro', '0', :ahora)"), {"ahora": ahora})


def downgrade() -> None:
    columnas = _columnas("inscripciones_plan")
    if "que_importar" in columnas:
        op.drop_column("inscripciones_plan", "que_importar")
    if "enlace_pago" in _columnas("planes"):
        op.drop_column("planes", "enlace_pago")
    # Las de la lista de la apertura no tienen plan: sin ellas vuelve a ser obligatorio.
    op.execute("DELETE FROM inscripciones_plan WHERE plan_id IS NULL")
    op.alter_column("inscripciones_plan", "plan_id", existing_type=sa.String(length=36), nullable=False)
