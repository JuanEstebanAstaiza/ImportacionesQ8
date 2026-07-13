"""Wallet efectivo de créditos: personal (natural) u organización (jurídica / equipo)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.usuario import Usuario
from models.organizacion import OrganizacionSolicitante
from models.credito import MovimientoCredito, TipoMovimientoCredito


@dataclass
class WalletTarget:
    kind: str  # "personal" | "organizacion"
    usuario: Usuario
    organizacion: Optional[OrganizacionSolicitante] = None

    @property
    def organizacion_id(self) -> Optional[str]:
        return self.organizacion.id if self.organizacion else None

    @property
    def balance(self) -> float:
        if self.organizacion is not None:
            return float(self.organizacion.creditos_balance or 0)
        return float(self.usuario.creditos_balance or 0)


def obtener_wallet(db: Session, usuario: Usuario) -> WalletTarget:
    if usuario.organizacion_id:
        org = db.query(OrganizacionSolicitante).filter(
            OrganizacionSolicitante.id == usuario.organizacion_id,
            OrganizacionSolicitante.activo == True,  # noqa: E712
        ).first()
        if not org:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La organización asociada no está activa o no existe",
            )
        return WalletTarget(kind="organizacion", usuario=usuario, organizacion=org)
    return WalletTarget(kind="personal", usuario=usuario)


def obtener_wallet_por_user_id(db: Session, user_id: str) -> WalletTarget:
    usuario = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return obtener_wallet(db, usuario)


def debitar_atomico(
    db: Session,
    wallet: WalletTarget,
    costo: float,
    *,
    tipo: str = TipoMovimientoCredito.consumo.value,
    cotizacion_id: Optional[str] = None,
    pago_id: Optional[str] = None,
    descripcion: Optional[str] = None,
) -> MovimientoCredito:
    """Descuenta créditos de forma atómica. Lanza 402 si no hay saldo."""
    if costo <= 0:
        raise ValueError("costo debe ser positivo")

    if wallet.organizacion is not None:
        resultado = (
            db.query(OrganizacionSolicitante)
            .filter(
                OrganizacionSolicitante.id == wallet.organizacion.id,
                OrganizacionSolicitante.creditos_balance >= costo,
            )
            .update(
                {OrganizacionSolicitante.creditos_balance: OrganizacionSolicitante.creditos_balance - costo},
                synchronize_session=False,
            )
        )
    else:
        resultado = (
            db.query(Usuario)
            .filter(
                Usuario.id == wallet.usuario.id,
                Usuario.creditos_balance >= costo,
            )
            .update(
                {Usuario.creditos_balance: Usuario.creditos_balance - costo},
                synchronize_session=False,
            )
        )

    if resultado != 1:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Créditos insuficientes para esta operación (saldo actual: {wallet.balance}). "
                "Compra más créditos e intenta de nuevo."
            ),
        )

    mov = MovimientoCredito(
        id=str(uuid4()),
        usuario_id=str(wallet.usuario.id),
        organizacion_id=wallet.organizacion_id,
        tipo=tipo,
        monto=-float(costo),
        cotizacion_id=cotizacion_id,
        pago_id=pago_id,
        descripcion=descripcion,
    )
    db.add(mov)
    return mov


def acreditar(
    db: Session,
    wallet: WalletTarget,
    monto: float,
    *,
    tipo: str,
    cotizacion_id: Optional[str] = None,
    pago_id: Optional[str] = None,
    descripcion: Optional[str] = None,
) -> MovimientoCredito:
    if monto <= 0:
        raise ValueError("monto debe ser positivo")

    if wallet.organizacion is not None:
        wallet.organizacion.creditos_balance = float(wallet.organizacion.creditos_balance or 0) + monto
    else:
        wallet.usuario.creditos_balance = float(wallet.usuario.creditos_balance or 0) + monto

    mov = MovimientoCredito(
        id=str(uuid4()),
        usuario_id=str(wallet.usuario.id),
        organizacion_id=wallet.organizacion_id,
        tipo=tipo,
        monto=float(monto),
        cotizacion_id=cotizacion_id,
        pago_id=pago_id,
        descripcion=descripcion,
    )
    db.add(mov)
    return mov
