import { Building2 } from "lucide-react";

import { Card } from "@/components/design-system";
import type { Importer } from "@/types/importer";

export function DatosDeContactoEmpresa({ imp }: { imp: Importer }) {
  const datos = [
    ["Sitio web", imp.website],
    ["Correo", imp.email],
    ["Teléfono", imp.phone],
    ["Dirección", imp.address],
    ["Fundada", imp.foundedYear],
  ].filter(([, value]) => value);

  if (datos.length === 0) {
    return null;
  }

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-primary" />
        Datos de contacto
      </h3>
      <div className="grid gap-2 text-sm">
        {datos.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right">{value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
