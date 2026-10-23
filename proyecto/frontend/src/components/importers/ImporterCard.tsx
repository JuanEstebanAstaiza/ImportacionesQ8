import { Award, BadgeCheck, Clock, MapPin, Package2, Plus, Shield } from "lucide-react";
import { clsx } from "clsx";
import type { Importer } from "@/types/importer";
import { resolveApiUrl } from "@/services/api-client";
import { Avatar, Button } from "@/components/design-system";

export function ImporterCard({
  imp,
  onViewProfile,
  onCreateQuote,
  featured = false,
}: {
  imp: Importer;
  onViewProfile: (id: string) => void;
  onCreateQuote: (id: string) => void;
  featured?: boolean;
}) {
  const desc =
    imp.description ||
    "Esta empresa aún no ha publicado su descripción.";

  const certs =
    imp.certs && imp.certs.length > 0
      ? imp.certs
      : [];

  const platformCerts = imp.platformCerts ?? [];
  const bannerUrl = imp.bannerUrl ? resolveApiUrl(imp.bannerUrl) : "";
  const logoUrl = imp.logoUrl ? resolveApiUrl(imp.logoUrl) : "";

  return (
    <div
      className={clsx(
        "bg-white border rounded-xl p-4 flex flex-col min-h-[420px] hover:shadow-md transition-all duration-200 group",
        featured
          ? "border-primary/20 dark:border-accent/20 shadow-sm ring-1 ring-primary/20 dark:ring-accent/20 landing-glow"
          : "border-border"
      )}
    >
      {/* CONTENIDO SUPERIOR */}
      <div className="flex flex-col gap-3.5">
        {/* Banner */}
        <div className="relative">
          <div
            className={clsx(
              "h-16 rounded-lg overflow-hidden border border-border",
              bannerUrl
                ? "bg-slate-100"
                : "bg-muted"
            )}
          >
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* El logo se apoya sobre el banner y es la única marca visual de la
              empresa en el catálogo: a 40 px no se distinguía una de otra. */}
          <div className="absolute -bottom-7 left-3 w-16 h-16 rounded-xl ring-2 ring-white overflow-hidden bg-white border border-border flex items-center justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`Logo de ${imp.name}`}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <Avatar initials={imp.initials} size="lg" color={imp.color} variant="logo" />
            )}
          </div>
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 mt-5">
          <div className="w-16" />

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5 flex-wrap">
              <p className="font-semibold text-sm leading-tight">
                {imp.name}
              </p>

              {imp.verified && (
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              )}

              {featured && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-60 dark:bg-accent/20 text-amber-700 dark:text-accent rounded-full text-[10px] font-semibold">
                  <Award className="w-2.5 h-2.5" />
                  Destacada
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-0.5">
              {imp.specialty}
            </p>

            <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {imp.country}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {(platformCerts.length + certs.length) > 0 && (
              <div className="flex items-center gap-1 text-emerald-700">
                <Shield className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">
                  {platformCerts.length + certs.length}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="text-xs">{imp.responseTime}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {desc}
        </p>

        {/* Categories + certs */}
        <div className="flex flex-wrap gap-1.5">
          {imp.categories.map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 bg-muted rounded-full text-[10px] font-medium text-muted-foreground"
            >
              {c}
            </span>
          ))}

          {platformCerts.map((c) => (
            <span
              key={c.id}
              title={c.descripcion || `Respaldado por Zarpi`}
              className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-semibold text-primary flex items-center gap-1"
            >
              {c.logoUrl ? (
                <img
                  src={resolveApiUrl(c.logoUrl)}
                  alt=""
                  className="w-3 h-3 object-contain"
                />
              ) : (
                <BadgeCheck className="w-2.5 h-2.5" />
              )}

              {c.nombre}
            </span>
          ))}

          {certs.map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 bg-primary/20 dark:bg-accent/20 border border-primary/0 dark:border-accent/0 rounded-full text-[10px] font-medium text-primary dark:text-accent flex items-center gap-1"
            >
              <Shield className="w-2.5 h-2.5" />
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* CONTENIDO INFERIOR */}
      <div className="mt-auto">
        {/* Stats */}
        <div className="flex items-center gap-4 py-2.5 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Package2 className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">
              {imp.projects} proyectos
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">
              Desde {imp.memberSince}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => onViewProfile(imp.id)}
            className="hover:bg-primary dark:hover:bg-accent hover:text-white dark:hover:text-black"
          >
            Ver perfil
          </Button>

          <Button
            variant="primary"
            size="sm"
            fullWidth
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => onCreateQuote(imp.id)}
            className="dark:bg-accent dark:hover:bg-accent dark:text-black dark:hover:bg-accent/80"
          >
            Cotizar
          </Button>
        </div>
      </div>
    </div>
  );
}



