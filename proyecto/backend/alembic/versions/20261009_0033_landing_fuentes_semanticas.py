"""Landing: la fuente de cada bloque sigue a la tipografía de la plataforma.

Antes un bloque guardaba "elvellon" o "avenor", pero desde que existe el gestor
de tipografía esas clases quedan pisadas por la fuente elegida en el admin:
el editor ofrecía dos fuentes y las dos se veían igual.

Ahora `fuente` es uno de:
- "titulos": la fuente de títulos de la plataforma (Elvellon en la de marca).
- "texto": la fuente de texto de la plataforma (AT Avenor en la de marca).
- "elvellon" / "avenor": la fuente de marca fija, aunque el admin elija otra.

Los bloques existentes pasan a "titulos"/"texto": así se siguen viendo igual
que hoy (con la tipografía de la plataforma).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20261009_0033"
down_revision: Union[str, None] = "20261009_0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE landing_blocks SET fuente = 'titulos' WHERE fuente = 'elvellon'")
    op.execute("UPDATE landing_blocks SET fuente = 'texto' WHERE fuente NOT IN ('titulos', 'elvellon')")


def downgrade() -> None:
    op.execute("UPDATE landing_blocks SET fuente = 'elvellon' WHERE fuente = 'titulos'")
    op.execute("UPDATE landing_blocks SET fuente = 'avenor' WHERE fuente = 'texto'")
