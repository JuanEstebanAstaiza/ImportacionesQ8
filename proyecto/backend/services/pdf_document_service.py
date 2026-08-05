from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from models.cotizacion import Cotizacion
from models.documental import OrdenDocumento
from models.orden import DocumentoOrden, Orden, TipoDocumentoOrden
from models.propuesta import Propuesta
from services.documental_service import create_document_file, ensure_generated_docs_dir


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(lines: Iterable[str]) -> bytes:
    content_lines = ["BT", "/F1 11 Tf", "40 790 Td", "14 TL"]
    first = True
    for line in lines:
        safe = _escape_pdf_text(str(line))
        if first:
            content_lines.append(f"({safe}) Tj")
            first = False
        else:
            content_lines.append("T*")
            content_lines.append(f"({safe}) Tj")
    content_lines.append("ET")
    content = "\n".join(content_lines).encode("latin-1", errors="replace")

    objects = []
    objects.append(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
    objects.append(b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n")
    objects.append(
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
    )
    objects.append(b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")
    objects.append(
        f"5 0 obj << /Length {len(content)} >> stream\n".encode("ascii")
        + content
        + b"\nendstream endobj\n"
    )

    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(output))
        output.extend(obj)

    xref_pos = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.extend(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF".encode("ascii")
    )
    return bytes(output)


def _write_pdf_file(base_name: str, lines: Iterable[str]) -> Path:
    folder = ensure_generated_docs_dir()
    filename = f"{base_name}_{uuid4().hex[:8]}.pdf"
    target = folder / filename
    target.write_bytes(_build_simple_pdf(lines))
    return target


def _persist_pdf_as_file(
    db: Session,
    *,
    owner_user_id: str,
    nombre: str,
    origen: str,
    path: Path,
) -> str:
    archivo = create_document_file(
        db,
        owner_user_id=owner_user_id,
        nombre=nombre,
        carpeta_id=None,
        extension="pdf",
        mime_type="application/pdf",
        size_bytes=path.stat().st_size,
        storage_url=None,
        storage_path=str(path),
        origen=origen,
    )
    return archivo.id


def generate_order_documents(
    db: Session,
    *,
    orden: Orden,
    cotizacion: Cotizacion,
    propuesta: Optional[Propuesta],
) -> None:
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    cot_lines = [
        "Resumen de Cotizacion",
        f"Fecha: {now}",
        f"Cotizacion ID: {cotizacion.id}",
        f"Producto: {cotizacion.nombre_producto}",
        f"Pais importacion: {cotizacion.pais_importacion}",
        f"Incoterm: {cotizacion.incoterm}",
        f"Cantidad minima: {cotizacion.cantidad_minima}",
        f"Precio objetivo USD: {cotizacion.precio_objetivo_usd}",
    ]
    prop_lines = [
        "Resumen de Propuesta",
        f"Fecha: {now}",
        f"Propuesta ID: {propuesta.id if propuesta else 'N/A'}",
        f"Importador ID: {propuesta.importador_id if propuesta else orden.importador_id}",
        f"Precio ofrecido USD: {propuesta.precio_ofrecido_usd if propuesta else orden.precio_acordado_usd}",
        f"Tiempo estimado entrega: {propuesta.tiempo_estimado_entrega if propuesta else orden.tiempo_estimado_entrega}",
        f"Incoterm: {propuesta.incoterm if propuesta else cotizacion.incoterm}",
    ]
    ord_lines = [
        "Orden de Compra",
        f"Fecha: {now}",
        f"Orden ID: {orden.id}",
        f"Cotizacion ID: {orden.cotizacion_id}",
        f"Solicitante ID: {orden.solicitante_id}",
        f"Importador ID: {orden.importador_id}",
        f"Precio acordado USD: {orden.precio_acordado_usd}",
        f"Estado: {orden.estado.value if hasattr(orden.estado, 'value') else orden.estado}",
    ]

    generated = [
        ("cotizacion", _write_pdf_file(f"cotizacion_{cotizacion.id[:8]}", cot_lines), TipoDocumentoOrden.factura_proforma.value),
        ("propuesta", _write_pdf_file(f"propuesta_{orden.id[:8]}", prop_lines), TipoDocumentoOrden.packing_list.value),
        ("orden", _write_pdf_file(f"orden_{orden.id[:8]}", ord_lines), TipoDocumentoOrden.factura_comercial.value),
    ]

    for doc_kind, path, legacy_type in generated:
        archivo_id = _persist_pdf_as_file(
            db,
            owner_user_id=orden.solicitante_id,
            nombre=path.name,
            origen="orden",
            path=path,
        )

        db.add(
            OrdenDocumento(
                id=str(uuid4()),
                orden_id=orden.id,
                archivo_id=archivo_id,
                tipo=doc_kind,
            )
        )
        db.add(
            DocumentoOrden(
                id=str(uuid4()),
                orden_id=orden.id,
                nombre=path.name,
                url=f"/documentos/archivos/{archivo_id}/descargar",
                tipo=legacy_type,
            )
        )
