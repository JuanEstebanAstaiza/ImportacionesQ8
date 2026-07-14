"""OTP auth features: email verification + late login challenge.

Revision ID: 20260713_0003
Revises: 20260713_0002
Create Date: 2026-07-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0003"
down_revision: Union[str, None] = "20260713_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("email_verificado", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column("usuarios", sa.Column("ultimo_login_at", sa.DateTime(), nullable=True))

    op.create_table(
        "codigos_otp",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("proposito", sa.String(30), nullable=False),
        sa.Column("otp_hash", sa.String(64), nullable=False),
        sa.Column("challenge_token_hash", sa.String(64), nullable=True),
        sa.Column("expira_en", sa.DateTime(), nullable=False),
        sa.Column("usado", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_codigos_otp_usuario_id", "codigos_otp", ["usuario_id"])
    op.create_index("ix_codigos_otp_proposito", "codigos_otp", ["proposito"])
    op.create_index("ix_codigos_otp_challenge_token_hash", "codigos_otp", ["challenge_token_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_codigos_otp_challenge_token_hash", table_name="codigos_otp")
    op.drop_index("ix_codigos_otp_proposito", table_name="codigos_otp")
    op.drop_index("ix_codigos_otp_usuario_id", table_name="codigos_otp")
    op.drop_table("codigos_otp")
    op.drop_column("usuarios", "ultimo_login_at")
    op.drop_column("usuarios", "email_verificado")
