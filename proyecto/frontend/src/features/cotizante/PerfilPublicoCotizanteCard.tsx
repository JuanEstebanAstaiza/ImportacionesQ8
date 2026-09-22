import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Boxes, ClipboardList, Container, DollarSign, Package, Scale } from "lucide-react";

import { Card } from "@/app/components/ui/card";
import {
  businessService,
  type BackendCotizantePerfilPublico,
} from "@/services/business.service";

interface PerfilPublicoCotizanteCardProps {
  solicitanteId?: string;
}

const numberFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function number(value: number): string {
  return numberFormatter.format(value || 0);
}

function currency(value: number): string {
  return currencyFormatter.format(value || 0);
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function PerfilPublicoCotizanteCard({ solicitanteId }: PerfilPublicoCotizanteCardProps) {
  const [perfil, setPerfil] = useState<BackendCotizantePerfilPublico | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!solicitanteId) return;
    let activo = true;
    setPerfil(null);
    setError(false);
    void businessService.getCotizantePublicProfile(solicitanteId)
      .then((data) => { if (activo) setPerfil(data); })
      .catch(() => { if (activo) setError(true); });
    return () => { activo = false; };
  }, [solicitanteId]);

  if (!solicitanteId || error) return null;
  if (!perfil) {
    return <Card className="animate-pulse p-6"><div className="h-4 w-48 rounded bg-muted" /><div className="mt-4 h-16 rounded bg-muted" /></Card>;
  }

  const volumen = perfil.volumen_total_importaciones;
  const cantidades = perfil.cantidad_importaciones;
  const actividad = perfil.actividad_plataforma;

  return (
    <Card className="border-border bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary dark:text-accent">Vista pública</p>
          <h3 className="mt-1 text-base font-semibold">Historial de {perfil.nombre}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Resumen operativo del cotizante</p>
        </div>
        <Package className="h-5 w-5 shrink-0 text-primary dark:text-accent" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Metric icon={<Scale className="h-4 w-4" />} label="Peso total" value={`${number(volumen.peso_total_kg)} kg`} />
        <Metric icon={<Boxes className="h-4 w-4" />} label="Volumen total" value={`${number(volumen.volumen_total_m3)} m³`} />
        <Metric icon={<Container className="h-4 w-4" />} label="Contenedores" value={number(volumen.contenedores_total)} />
        <Metric icon={<ClipboardList className="h-4 w-4" />} label="Importaciones" value={`${number(cantidades.total)} (${number(cantidades.dentro_plataforma)} en plataforma)`} />
        <Metric icon={<DollarSign className="h-4 w-4" />} label="Promedio por importación" value={currency(perfil.valor_promedio_importacion_usd)} />
        <Metric icon={<ClipboardList className="h-4 w-4" />} label="Cotizaciones solicitadas" value={number(actividad.cotizaciones_solicitadas)} />
        <Metric icon={<Package className="h-4 w-4" />} label="Órdenes generadas" value={number(actividad.ordenes_generadas)} />
        <Metric icon={<DollarSign className="h-4 w-4" />} label="Promedio en plataforma" value={currency(actividad.valor_promedio_operaciones_usd)} />
      </div>
    </Card>
  );
}