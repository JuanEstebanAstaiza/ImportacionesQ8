"""Planes de acceso con pago manual (ver models/plan.py).

Flujo:
1. La sección «Planes» del home lee `GET /planes` (precio, IVA, lo que
   incluye y cupos restantes). Nada de eso está en el código del frontend.
2. `/planes/inscripcion?plan=…`: la persona deja sus datos, acepta las
   condiciones y sube el comprobante de la transferencia. A pagos@ le llega una
   copia con el comprobante y el concepto adjuntos; la inscripción ocupa cupo.
3. En *Admin › Planes* el equipo la activa: se crea la cuenta (o se usa la que
   ya tiene ese correo), se acreditan las solicitudes con su vigencia y, si el
   plan lo trae, los días de Tendencias. A una cuenta nueva le llega un enlace
   para crear su contraseña. O la rechaza con motivo, y el cupo se libera.
4. Sin cupos, la inscripción pasa a lista de espera (sin comprobante).
"""
from __future__ import annotations

import calendar
import logging
import secrets
from datetime import datetime, timedelta
from html import escape
from pathlib import Path
from types import SimpleNamespace
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import config
from models.plan import EstadoInscripcionPlan, InscripcionPlan, Plan
from models.tier import MovimientoPuntoCotizacion
from models.usuario import Usuario

logger = logging.getLogger("importacionesq8")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DIR_COMPROBANTES = BACKEND_ROOT / "uploads" / "planes"

# Formatos del comprobante: extensión → (MIME, firma de los primeros bytes).
FORMATOS_COMPROBANTE = {
    "pdf": ("application/pdf", (b"%PDF",)),
    "jpg": ("image/jpeg", (b"\xff\xd8\xff",)),
    "jpeg": ("image/jpeg", (b"\xff\xd8\xff",)),
    "png": ("image/png", (b"\x89PNG\r\n\x1a\n",)),
    "webp": ("image/webp", (b"RIFF",)),
}
MAX_COMPROBANTE_BYTES = 10 * 1024 * 1024

OCUPAN_CUPO = (EstadoInscripcionPlan.pendiente.value, EstadoInscripcionPlan.activa.value)
DIAS_ENLACE_BIENVENIDA = 7
ENLACE_ADMIN = "/admin/planes"


def _error(codigo: int, detalle) -> HTTPException:
    return HTTPException(status_code=codigo, detail=detalle)


# ── Precios ──────────────────────────────────────────────────────────────────

def iva_de(precio: int, pct: int) -> int:
    return int(round(precio * (pct or 0) / 100))


def con_iva(precio: Optional[int], pct: int) -> Optional[int]:
    return None if precio is None else precio + iva_de(precio, pct)


def sumar_meses(fecha: datetime, meses: int) -> datetime:
    mes = fecha.month - 1 + meses
    anio = fecha.year + mes // 12
    mes = mes % 12 + 1
    dia = min(fecha.day, calendar.monthrange(anio, mes)[1])
    return fecha.replace(year=anio, month=mes, day=dia)


def _cop(valor: Optional[int]) -> str:
    return "—" if valor is None else "$" + f"{int(valor):,}".replace(",", ".")


# ── Planes ───────────────────────────────────────────────────────────────────

def ocupados(db: Session, plan_id: str) -> int:
    return db.query(InscripcionPlan).filter(
        InscripcionPlan.plan_id == plan_id, InscripcionPlan.estado.in_(OCUPAN_CUPO)).count()


def cupos_restantes(db: Session, plan: Plan) -> Optional[int]:
    if plan.cupos_totales is None:
        return None
    return max(0, int(plan.cupos_totales) - ocupados(db, plan.id))


def a_dict(db: Session, plan: Plan, admin: bool = False, videos: Optional[Dict[str, dict]] = None) -> Dict:
    """`videos`: los de `videos_planes.videos_por_plan`, para no leerlos una vez
    por plan al listar."""
    if videos is None:
        from services.videos_planes import videos_por_plan

        videos = videos_por_plan(db)
    datos = {
        "id": plan.id,
        "clave": plan.clave,
        "nombre": plan.nombre,
        "para_quien": plan.para_quien,
        "precio_cop": plan.precio_cop,
        "iva_pct": plan.iva_pct,
        "iva_cop": iva_de(plan.precio_cop, plan.iva_pct),
        "total_cop": con_iva(plan.precio_cop, plan.iva_pct),
        "solicitudes_incluidas": plan.solicitudes_incluidas,
        "vigencia_meses": plan.vigencia_meses,
        "dias_tendencias": plan.dias_tendencias,
        "precio_solicitud_adicional_cop": plan.precio_solicitud_adicional_cop,
        "total_solicitud_adicional_cop": con_iva(plan.precio_solicitud_adicional_cop, plan.iva_pct),
        "incluye": list(plan.incluye or []),
        "cupos_totales": plan.cupos_totales,
        "cupos_restantes": cupos_restantes(db, plan),
        "destacado": bool(plan.destacado),
        "orden": plan.orden,
        # Se reproduce en la tarjeta del plan (ver services/videos_planes.py).
        "video": videos.get(str(plan.id)),
    }
    if admin:
        conteo = {e.value: 0 for e in EstadoInscripcionPlan}
        for (estado,) in db.query(InscripcionPlan.estado).filter(InscripcionPlan.plan_id == plan.id).all():
            conteo[estado] = conteo.get(estado, 0) + 1
        datos.update({"activo": bool(plan.activo), "inscripciones": conteo})
    return datos


def listar(db: Session, *, admin: bool = False) -> List[Dict]:
    consulta = db.query(Plan)
    if not admin:
        consulta = consulta.filter(Plan.activo.is_(True))
    from services.videos_planes import videos_por_plan

    videos = videos_por_plan(db)
    return [a_dict(db, p, admin, videos) for p in consulta.order_by(Plan.orden.asc(), Plan.precio_cop.asc()).all()]


def por_clave(db: Session, clave: str) -> Plan:
    plan = db.query(Plan).filter(Plan.clave == clave, Plan.activo.is_(True)).first()
    if plan is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Ese plan no existe o ya no está disponible")
    return plan


def _limpiar_incluye(valor) -> List[str]:
    return [str(x).strip()[:200] for x in (valor or []) if str(x).strip()][:12]


def crear(db: Session, datos: Dict) -> Plan:
    if db.query(Plan.id).filter(Plan.clave == datos["clave"]).first():
        raise _error(status.HTTP_409_CONFLICT, "Ya hay un plan con esa clave")
    plan = Plan(**{**datos, "incluye": _limpiar_incluye(datos.get("incluye"))})
    db.add(plan)
    db.flush()
    return plan


def actualizar(db: Session, plan_id: str, datos: Dict) -> Plan:
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if plan is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Plan no encontrado")
    if "clave" in datos and datos["clave"] != plan.clave:
        if db.query(Plan.id).filter(Plan.clave == datos["clave"]).first():
            raise _error(status.HTTP_409_CONFLICT, "Ya hay un plan con esa clave")
    if "incluye" in datos:
        datos["incluye"] = _limpiar_incluye(datos["incluye"])
    for campo, valor in datos.items():
        setattr(plan, campo, valor)
    db.flush()
    return plan


# ── Saldo del usuario ────────────────────────────────────────────────────────

def plan_del_usuario(db: Session, usuario: Usuario) -> Optional[Dict]:
    from services.tokens_cotizacion import plan_vigente

    if not usuario.plan_id:
        return None
    plan = db.query(Plan).filter(Plan.id == usuario.plan_id).first()
    vigente = plan_vigente(usuario)
    return {
        "id": usuario.plan_id,
        "nombre": plan.nombre if plan else None,
        "solicitudes": int(usuario.solicitudes_plan or 0) if vigente else 0,
        "vence_en": usuario.plan_vence_en.isoformat() + "Z" if usuario.plan_vence_en else None,
        "vigente": vigente,
    }


def precio_solicitud_adicional(db: Session, usuario: Usuario) -> Optional[int]:
    """Lo que paga (IVA incluido) por cada solicitud adicional, si su plan
    vigente tiene un precio propio (VIP). None: el precio general del token."""
    from services.tokens_cotizacion import plan_vigente

    if not usuario.plan_id or not plan_vigente(usuario):
        return None
    plan = db.query(Plan).filter(Plan.id == usuario.plan_id).first()
    if plan is None or plan.precio_solicitud_adicional_cop is None:
        return None
    return con_iva(plan.precio_solicitud_adicional_cop, plan.iva_pct)


# ── Inscripción ──────────────────────────────────────────────────────────────

def validar_comprobante(nombre: str, contenido: bytes) -> Tuple[str, str]:
    """Extensión y MIME del comprobante. Se mira la firma del archivo, no solo
    el nombre: lo sube alguien sin cuenta."""
    extension = Path(nombre or "").suffix.lower().lstrip(".")
    if extension not in FORMATOS_COMPROBANTE:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "El comprobante debe ser un PDF o una imagen (JPG, PNG o WEBP)")
    if not contenido:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "El comprobante está vacío")
    if len(contenido) > MAX_COMPROBANTE_BYTES:
        raise _error(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "El comprobante supera los 10 MB")
    mime, firmas = FORMATOS_COMPROBANTE[extension]
    if not any(contenido.startswith(f) for f in firmas) or (extension == "webp" and contenido[8:12] != b"WEBP"):
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "El archivo no parece un PDF o una imagen válida")
    return extension, mime


def _guardar_comprobante(nombre: str, contenido: bytes, extension: str) -> str:
    DIR_COMPROBANTES.mkdir(parents=True, exist_ok=True)
    ruta = DIR_COMPROBANTES / f"{uuid4()}.{extension}"
    ruta.write_bytes(contenido)
    return str(ruta.relative_to(BACKEND_ROOT))


def ruta_comprobante(ins: InscripcionPlan) -> Optional[Path]:
    if not ins.comprobante_ruta:
        return None
    ruta = (BACKEND_ROOT / ins.comprobante_ruta).resolve()
    if DIR_COMPROBANTES.resolve() not in ruta.parents or not ruta.is_file():
        return None
    return ruta


def _nombre(ins: InscripcionPlan) -> str:
    if ins.tipo_persona == "juridica":
        return ins.razon_social or ins.email
    return " ".join(x for x in (ins.nombre, ins.apellido) if x) or ins.email


def _ya_tiene(db: Session, plan_id: str, email: str, estados) -> bool:
    return db.query(InscripcionPlan.id).filter(
        InscripcionPlan.plan_id == plan_id, InscripcionPlan.email == email,
        InscripcionPlan.estado.in_(estados),
    ).first() is not None


def _cuenta_compradora(usuario: Optional[Usuario]) -> None:
    if usuario is not None and usuario.rol != "solicitante":
        raise _error(status.HTTP_403_FORBIDDEN, "Los planes son para cuentas de comprador")


def _avisar_admins(db: Session, titulo: str, mensaje: str, data: Dict) -> None:
    from services.notificacion_service import notificar

    for admin in db.query(Usuario).filter(Usuario.rol == "admin", Usuario.activo.is_(True)).all():
        notificar(db, usuario_id=admin.id, tipo="pagos", titulo=titulo, mensaje=mensaje, data=data,
                  enlace_relativo=ENLACE_ADMIN, whatsapp=False, email=False)


def inscribir(db: Session, plan: Plan, datos: Dict, *, archivo_nombre: str, archivo: bytes,
              usuario: Optional[Usuario]) -> InscripcionPlan:
    _cuenta_compradora(usuario)
    extension, mime = validar_comprobante(archivo_nombre, archivo)
    # Se bloquea la fila del plan: dos inscripciones a la vez no se quedan con el último cupo.
    db.query(Plan).filter(Plan.id == plan.id).with_for_update().first()
    restantes = cupos_restantes(db, plan)
    if restantes is not None and restantes < 1:
        raise _error(status.HTTP_409_CONFLICT, {
            "codigo": "sin_cupos",
            "mensaje": f"Se acabaron los cupos de {plan.nombre}. Puedes quedar en la lista de espera.",
        })
    if _ya_tiene(db, plan.id, datos["email"], (EstadoInscripcionPlan.pendiente.value,)):
        raise _error(status.HTTP_409_CONFLICT, "Ya recibimos tu inscripción a este plan: la estamos revisando")

    precio = plan.precio_cop
    ins = InscripcionPlan(
        **datos, plan_id=plan.id, estado=EstadoInscripcionPlan.pendiente.value,
        usuario_id=usuario.id if usuario else None,
        precio_cop=precio, iva_cop=iva_de(precio, plan.iva_pct), total_cop=con_iva(precio, plan.iva_pct),
        comprobante_ruta=_guardar_comprobante(archivo_nombre, archivo, extension),
        comprobante_nombre=Path(archivo_nombre).name[:255], comprobante_mime=mime,
        fecha_aceptacion=datetime.utcnow(),
    )
    db.add(ins)
    db.flush()
    _avisar_admins(db, "Inscripción a un plan por revisar",
                   f"{_nombre(ins)} ({ins.email}) se inscribió a {plan.nombre} y subió el comprobante.",
                   {"evento": "plan_inscripcion", "inscripcion_id": ins.id})
    _copia_a_pagos(plan, ins, archivo)
    _acuse(plan, ins)
    return ins


def lista_espera(db: Session, plan: Plan, datos: Dict, usuario: Optional[Usuario]) -> InscripcionPlan:
    _cuenta_compradora(usuario)
    if _ya_tiene(db, plan.id, datos["email"], (EstadoInscripcionPlan.lista_espera.value,)):
        raise _error(status.HTTP_409_CONFLICT, "Ya estás en la lista de espera de este plan")
    ins = InscripcionPlan(**datos, plan_id=plan.id, estado=EstadoInscripcionPlan.lista_espera.value,
                          usuario_id=usuario.id if usuario else None, fecha_aceptacion=datetime.utcnow())
    db.add(ins)
    db.flush()
    _avisar_admins(db, "Nueva persona en lista de espera",
                   f"{_nombre(ins)} ({ins.email}) quiere entrar a {plan.nombre}, que no tiene cupos.",
                   {"evento": "plan_lista_espera", "inscripcion_id": ins.id})
    _enviar(ins.email, f"Quedaste en la lista de espera de {plan.nombre}",
            [f"Hola {_nombre(ins)}.",
             f"{plan.nombre} no tiene cupos en este momento y quedaste en la lista de espera.",
             "Te escribimos apenas se abra un cupo."])
    return ins


# ── Correos ──────────────────────────────────────────────────────────────────

def _enviar(destinatario: str, titulo: str, parrafos: List[str], *, responder_a: Optional[str] = None,
            adjuntos: Optional[list] = None, destino_interno: bool = False) -> bool:
    from utils.email import construir_html_zarpi, enviar_correo

    texto = "\n\n".join(parrafos) + ("" if destino_interno else "\n\n— Zarpi")
    html = construir_html_zarpi(titulo, "".join(f"<p>{escape(p)}</p>" for p in parrafos))
    try:
        enviado = enviar_correo(destinatario, f"{titulo} — Zarpi", texto, html, buzon="pagos",
                                responder_a=responder_a, adjuntos=adjuntos)
    except Exception:
        logger.exception("Falló el correo «%s» a %s", titulo, destinatario)
        return False
    if not enviado:
        logger.error("No salió el correo «%s» a %s", titulo, destinatario)
    return enviado


def _filas(plan: Plan, ins: InscripcionPlan) -> List[Tuple[str, str]]:
    filas = [
        ("Concepto", f"Inscripción a {plan.nombre}"),
        ("Valor", f"{_cop(ins.precio_cop)} + IVA {_cop(ins.iva_cop)} = {_cop(ins.total_cop)} COP"),
        ("Nombre", _nombre(ins)),
        ("Documento", f"NIT {ins.nit}" if ins.tipo_persona == "juridica"
         else f"{ins.tipo_documento or ''} {ins.numero_documento or ''}".strip()),
        ("Correo", ins.email),
        ("Teléfono", f"{ins.indicativo_pais_telefono} {ins.telefono}"),
    ]
    if ins.ciudad:
        filas.append(("Ciudad", ins.ciudad))
    filas += [("Fecha", (ins.fecha_creacion or datetime.utcnow()).strftime("%d/%m/%Y %H:%M UTC")),
              ("Inscripción", ins.id)]
    return filas


def _copia_a_pagos(plan: Plan, ins: InscripcionPlan, archivo: bytes) -> bool:
    """A pagos@ le llega la inscripción con el comprobante y el concepto adjuntos."""
    from services.pdf_document_service import _build_simple_pdf

    filas = _filas(plan, ins)
    adjuntos = []
    if len(archivo) <= config.MAX_ADJUNTO_CORREO_BYTES:
        adjuntos.append((ins.comprobante_nombre or "comprobante", archivo, ins.comprobante_mime))
    pdf = _build_simple_pdf(["Zarpi - Concepto de pago", ""] + [f"{k}: {v}" for k, v in filas], win_ansi=True)
    adjuntos.append((f"Concepto inscripcion {ins.id[:8]}.pdf", pdf, "application/pdf"))
    parrafos = ["Llegó una inscripción a un plan con su comprobante de pago."] + [f"{k}: {v}" for k, v in filas] + [
        f"Activarla o rechazarla: {config.FRONTEND_URL}{ENLACE_ADMIN}"]
    return _enviar(config.PAGOS_EMAIL, f"Inscripción a {plan.nombre} — {ins.email}", parrafos,
                   responder_a=ins.email, adjuntos=adjuntos, destino_interno=True)


def _acuse(plan: Plan, ins: InscripcionPlan) -> bool:
    return _enviar(ins.email, f"Recibimos tu inscripción a {plan.nombre}", [
        f"Hola {_nombre(ins)}.",
        f"Recibimos tu inscripción a {plan.nombre} y el comprobante de pago por {_cop(ins.total_cop)} COP "
        "(IVA incluido).",
        "Lo verificamos y activamos tu plan en máximo 2 horas hábiles. Te escribimos a este correo apenas esté listo.",
    ])


# ── Admin: revisar ───────────────────────────────────────────────────────────

def ins_a_dict(db: Session, ins: InscripcionPlan) -> Dict:
    plan = db.query(Plan).filter(Plan.id == ins.plan_id).first()
    return {
        "id": ins.id,
        "estado": ins.estado,
        "plan": {"id": ins.plan_id, "nombre": plan.nombre if plan else None, "clave": plan.clave if plan else None},
        "usuario_id": ins.usuario_id,
        "email": ins.email,
        "nombre": _nombre(ins),
        "tipo_persona": ins.tipo_persona,
        "documento": (f"NIT {ins.nit}" if ins.tipo_persona == "juridica"
                      else f"{ins.tipo_documento or ''} {ins.numero_documento or ''}".strip()),
        "telefono": f"{ins.indicativo_pais_telefono} {ins.telefono}",
        "ciudad": ins.ciudad,
        "precio_cop": ins.precio_cop,
        "iva_cop": ins.iva_cop,
        "total_cop": ins.total_cop,
        "tiene_comprobante": bool(ins.comprobante_ruta),
        "comprobante_nombre": ins.comprobante_nombre,
        "motivo_rechazo": ins.motivo_rechazo,
        "vence_en": ins.vence_en.isoformat() + "Z" if ins.vence_en else None,
        "revisado_en": ins.revisado_en.isoformat() + "Z" if ins.revisado_en else None,
        "fecha": ins.fecha_creacion.isoformat() + "Z" if ins.fecha_creacion else None,
    }


def listar_inscripciones(db: Session, estado: Optional[str] = None) -> List[InscripcionPlan]:
    consulta = db.query(InscripcionPlan)
    if estado:
        consulta = consulta.filter(InscripcionPlan.estado == estado)
    orden = InscripcionPlan.fecha_creacion.asc() if estado in (
        EstadoInscripcionPlan.pendiente.value, EstadoInscripcionPlan.lista_espera.value,
    ) else InscripcionPlan.fecha_creacion.desc()
    return consulta.order_by(orden).limit(300).all()


def obtener_inscripcion(db: Session, inscripcion_id: str) -> InscripcionPlan:
    ins = db.query(InscripcionPlan).filter(InscripcionPlan.id == inscripcion_id).first()
    if ins is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Inscripción no encontrada")
    return ins


def _pendiente(db: Session, inscripcion_id: str) -> InscripcionPlan:
    ins = obtener_inscripcion(db, inscripcion_id)
    if ins.estado != EstadoInscripcionPlan.pendiente.value:
        raise _error(status.HTTP_409_CONFLICT, "Esta inscripción ya fue revisada")
    return ins


def _crear_cuenta(db: Session, ins: InscripcionPlan) -> Usuario:
    from services.auth_service import crear_cuenta_solicitante

    # Contraseña aleatoria que nadie conoce: la persona crea la suya con el enlace de bienvenida.
    datos = SimpleNamespace(
        email=ins.email, password=secrets.token_urlsafe(24) + "a1", tipo_persona=ins.tipo_persona,
        nombre=ins.nombre, apellido=ins.apellido, tipo_documento=ins.tipo_documento,
        numero_documento=ins.numero_documento, nit=ins.nit, razon_social=ins.razon_social,
        indicativo_pais_telefono=ins.indicativo_pais_telefono, telefono=ins.telefono,
    )
    return crear_cuenta_solicitante(db, datos, email_verificado=True, acepto_politica=bool(ins.acepto_datos))


def _enlace_bienvenida(db: Session, usuario: Usuario) -> Tuple[str, str]:
    """Enlace + código para que la persona cree su contraseña (el mismo flujo de
    «restablecer contraseña», con más días de vigencia)."""
    from models.password_reset import PasswordResetToken
    from utils.security import generar_otp, generar_token_seguro, hash_token

    otp, token = generar_otp(), generar_token_seguro()
    db.add(PasswordResetToken(
        id=str(uuid4()), usuario_id=str(usuario.id), token_hash=hash_token(token), otp_hash=hash_token(otp),
        expira_en=datetime.utcnow() + timedelta(days=DIAS_ENLACE_BIENVENIDA), usado=False,
    ))
    return f"{config.FRONTEND_URL}/restablecer-password?token={token}", otp


def activar(db: Session, inscripcion_id: str, admin: Usuario) -> InscripcionPlan:
    """Confirma el pago: crea la cuenta si hace falta y le acredita el plan."""
    from services.notificacion_service import notificar
    from services.tokens_cotizacion import solicitudes_plan_vigentes, plan_vigente

    ins = _pendiente(db, inscripcion_id)
    plan = db.query(Plan).filter(Plan.id == ins.plan_id).first()
    if plan is None:
        raise _error(status.HTTP_409_CONFLICT, "El plan de esta inscripción ya no existe: recházala")
    usuario = db.query(Usuario).filter(Usuario.id == ins.usuario_id).first() if ins.usuario_id else None
    if usuario is None:
        usuario = db.query(Usuario).filter(Usuario.email == ins.email).first()
    if usuario is not None and usuario.rol != "solicitante":
        raise _error(status.HTTP_409_CONFLICT,
                     "Ese correo es de una cuenta que no es de comprador: recházala o pídele otro correo")
    cuenta_nueva = usuario is None
    if cuenta_nueva:
        usuario = _crear_cuenta(db, ins)

    ahora = datetime.utcnow()
    # Si ya tenía un plan vigente, lo que le quedaba se suma y la vigencia corre desde su vencimiento.
    desde = usuario.plan_vence_en if plan_vigente(usuario, ahora) else ahora
    vence = sumar_meses(desde, int(plan.vigencia_meses or 12))
    usuario.solicitudes_plan = solicitudes_plan_vigentes(usuario, ahora) + int(plan.solicitudes_incluidas or 0)
    usuario.plan_id = plan.id
    usuario.plan_vence_en = vence
    db.add(MovimientoPuntoCotizacion(
        usuario_id=usuario.id, admin_id=admin.id, tipo="plan", delta=int(plan.solicitudes_incluidas or 0),
        saldo_resultante=usuario.solicitudes_plan, descripcion=f"{plan.nombre} (inscripción {ins.id[:8]})",
    ))
    if plan.dias_tendencias:
        from models.tendencias import OrigenAcceso
        from services.tendencias import otorgar_acceso

        otorgar_acceso(db, usuario_id=usuario.id, dias=int(plan.dias_tendencias), origen=OrigenAcceso.pago.value,
                       otorgado_por=admin.id, nota=f"{plan.nombre} (inscripción {ins.id[:8]})")

    ins.estado = EstadoInscripcionPlan.activa.value
    ins.usuario_id = usuario.id
    ins.revisado_por = admin.id
    ins.revisado_en = ahora
    ins.vence_en = vence
    db.flush()

    resumen = (f"Tienes {usuario.solicitudes_plan} solicitudes de cotización hasta el {vence.strftime('%d/%m/%Y')}"
               + (f" y Tendencias por {plan.dias_tendencias} días" if plan.dias_tendencias else "") + ".")
    if cuenta_nueva:
        enlace, codigo = _enlace_bienvenida(db, usuario)
        _enviar(ins.email, f"Tu plan {plan.nombre} está activo", [
            f"Hola {_nombre(ins)}. Confirmamos tu pago y activamos tu plan {plan.nombre}.",
            resumen,
            f"Tu usuario es {ins.email}. Para entrar, crea tu contraseña aquí: {enlace}",
            f"Te pedirá este código: {codigo}. El enlace vence en {DIAS_ENLACE_BIENVENIDA} días; si se vence, "
            "usa «¿Olvidaste tu contraseña?» en el inicio de sesión.",
        ])
    else:
        notificar(db, usuario_id=usuario.id, tipo="pagos", titulo=f"Tu plan {plan.nombre} está activo",
                  mensaje=f"Confirmamos tu pago. {resumen}", data={"evento": "plan_activo", "inscripcion_id": ins.id},
                  enlace_relativo="/pagos", whatsapp=False, email=True, buzon="pagos")
    return ins


def rechazar(db: Session, inscripcion_id: str, admin: Usuario, motivo: str) -> InscripcionPlan:
    ins = _pendiente(db, inscripcion_id)
    plan = db.query(Plan).filter(Plan.id == ins.plan_id).first()
    ins.estado = EstadoInscripcionPlan.rechazada.value
    ins.motivo_rechazo = motivo.strip()[:500]
    ins.revisado_por = admin.id
    ins.revisado_en = datetime.utcnow()
    db.flush()
    _enviar(ins.email, "No pudimos confirmar tu pago", [
        f"Hola {_nombre(ins)}.",
        f"Revisamos tu inscripción a {plan.nombre if plan else 'un plan'} y no pudimos confirmar el pago.",
        f"Motivo: {ins.motivo_rechazo}",
        "Si crees que es un error, responde este correo y lo revisamos.",
    ])
    return ins
