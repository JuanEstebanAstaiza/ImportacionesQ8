import { useEffect, useState } from "react";

import { Button, Textarea } from "@shared/ui/design-system";
import { Modal } from "@shared/ui/kit/Modal";

/** Diálogo que pide un texto antes de confirmar (rechazar, cancelar, pedir ajustes...). */
export function MotivoModal({ abierto, titulo, descripcion, etiqueta = "Motivo", textoBoton, minimo = 5, opcional = false,
  ocupado, onCerrar, onConfirmar }: {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  etiqueta?: string;
  textoBoton: string;
  minimo?: number;
  opcional?: boolean;
  ocupado?: boolean;
  onCerrar: () => void;
  onConfirmar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  useEffect(() => { if (!abierto) setTexto(""); }, [abierto]);
  const valido = opcional || texto.trim().length >= minimo;
  return (
    <Modal open={abierto} onClose={onCerrar} title={titulo}>
      <div className="space-y-4">
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
        <Textarea label={etiqueta} rows={3} value={texto} maxLength={1000} onChange={(e) => setTexto(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button loading={ocupado} disabled={!valido} onClick={() => onConfirmar(texto.trim())}>{textoBoton}</Button>
        </div>
      </div>
    </Modal>
  );
}
