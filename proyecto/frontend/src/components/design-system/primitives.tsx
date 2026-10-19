
import React from "react";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type {
  BadgeVariant,
  BtnProps,
  InputProps,
  SelectProps,
  TextareaProps,
} from "@/types/design-system";

export const BADGE_MAP: Record<
  BadgeVariant,
  { label: string; cls: string; dot: string }
> = {
  open: {
    label: "Abierta",
    cls: "bg-accent/15 text-emerald-800 border border-accent/40 dark:bg-accent/20 dark:text-accent dark:border-accent/50",
    dot: "bg-emerald-600 dark:bg-accent",
  },
  "active-order": {
    label: "Operación activa",
    cls: "bg-primary/15 text-primary border border-primary/40 dark:bg-accent/20 dark:text-accent dark:border-accent/60 dark:shadow-[0_0_8px_rgba(16,185,129,0.2)]",
    dot: "bg-primary dark:bg-accent",
  },
  directed: {
    label: "Dirigida",
    cls: "bg-primary/10 text-primary border border-primary/30 dark:bg-primary/20 dark:text-purple-300 dark:border-primary/50",
    dot: "bg-primary dark:bg-purple-300",
  },
  created: {
    label: "Creada",
    cls: "bg-slate-500/10 text-slate-700 border border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/40",
    dot: "bg-slate-500 dark:bg-slate-300",
  },
  accepted: {
    label: "Aceptada",
    cls: "bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40",
    dot: "bg-emerald-600 dark:bg-emerald-400",
  },
  "rejected-importer": {
    label: "Rechazada por importadora",
    cls: "bg-rose-500/10 text-rose-800 border border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/40",
    dot: "bg-rose-600 dark:bg-rose-400",
  },
  neutral: {
    label: "",
    cls: "bg-slate-500/10 text-slate-700 border border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/40",
    dot: "bg-slate-500 dark:bg-slate-300",
  },
  "resp-nueva": {
    label: "Nueva",
    cls: "bg-accent/15 text-emerald-800 border border-accent/40 dark:bg-accent/20 dark:text-accent dark:border-accent/50",
    dot: "bg-emerald-600 dark:bg-accent",
  },
  "resp-vista": {
    label: "Vista",
    cls: "bg-primary/10 text-primary border border-primary/30 dark:bg-primary/20 dark:text-purple-300 dark:border-primary/50",
    dot: "bg-primary dark:bg-purple-300",
  },
  "resp-aceptada": {
    label: "Aceptada",
    cls: "bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40",
    dot: "bg-emerald-600 dark:bg-emerald-400",
  },
  "resp-rechazada": {
    label: "Rechazada",
    cls: "bg-rose-500/10 text-rose-800 border border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/40",
    dot: "bg-rose-600 dark:bg-rose-400",
  },
  info: {
    label: "",
    cls: "bg-sky-500/10 text-sky-800 border border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/40",
    dot: "bg-sky-600 dark:bg-sky-400",
  },
  warning: {
    label: "",
    cls: "bg-amber-500/10 text-amber-800 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40",
    dot: "bg-amber-600 dark:bg-amber-400",
  },
  success: {
    label: "",
    cls: "bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40",
    dot: "bg-emerald-600 dark:bg-emerald-400",
  },
};

export function Badge({
  variant,
  label,
  className,
}: {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}) {
  const config = BADGE_MAP[variant];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        config.cls,
        className
      )}
    >
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          config.dot
        )}
      />
      {label ?? config.label}
    </span>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  ...props
}: BtnProps) {
  const variants = {
    primary:
      "bg-primary text-primary-foreground hover:bg-[#3f05bc] active:bg-[#2e038a] shadow-sm",
    secondary:
      "bg-muted text-foreground border border-border hover:bg-accent hover:text-accent-foreground hover:border-accent active:bg-accent active:text-accent-foreground shadow-sm",
    danger: "bg-destructive text-white hover:bg-red-700 shadow-sm",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-10 px-5 text-sm",
  };

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        icon
      )}
      {children}
      {!loading && iconRight}
    </button>
  );
}

const fieldId = (
  id: string | undefined,
  label: string | undefined
) => id || label?.toLowerCase().replace(/\s+/g, "-");

export function Input({
  label,
  error,
  hint,
  prefix,
  suffix,
  rightLabel,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = fieldId(id, label);

  return (
    <div className="flex flex-col gap-1.5">
      {(label || rightLabel) && (
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={inputId}
              className="text-sm font-medium text-foreground"
            >
              {label}
            </label>
          )}
          {rightLabel}
        </div>
      )}

      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-muted-foreground flex items-center pointer-events-none">
            {prefix}
          </span>
        )}

        <input
          id={inputId}
          className={clsx(
            "w-full h-10 bg-white border rounded-lg text-sm text-foreground placeholder:text-slate-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
            error ? "border-destructive" : "border-border",
            prefix ? "pl-9" : "pl-3",
            suffix ? "pr-10" : "pr-3",
            className
          )}
          {...props}
        />

        {suffix && (
          <span className="absolute right-3 text-muted-foreground flex items-center">
            {suffix}
          </span>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}

      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function Textarea({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: TextareaProps) {
  const inputId = fieldId(id, label);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}

      <textarea
        id={inputId}
        className={clsx(
          "w-full bg-white border rounded-lg text-sm text-foreground placeholder:text-slate-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none px-3 py-2.5",
          error ? "border-destructive" : "border-border",
          className
        )}
        {...props}
      />

      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}

      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function Select({
  label,
  children,
  className,
  id,
  ...props
}: SelectProps) {
  const inputId = fieldId(id, label);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <select
          id={inputId}
          className={clsx(
            "w-full h-10 pl-3 pr-8 bg-white border border-border rounded-lg text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer",
            className
          )}
          {...props}
        >
          {children}
        </select>

        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

export function Card({
  children,
  className,
  padding = "md",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}) {
  const paddingClass = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      className={clsx(
        "bg-white border border-border rounded-xl shadow-sm",
        paddingClass[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Avatar({
  initials,
  size = "md",
  color = "bg-primary",
  src,
  variant = "avatar",
}: {
  initials: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  color?: string;
  src?: string;
  variant?: "avatar" | "logo";
}) {
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-10 h-10 text-sm",
    xl: "w-12 h-12 text-base",
    "2xl": "w-20 h-20 text-2xl",
    "3xl": "w-28 h-28 text-3xl",
  };

  const isLogo = variant === "logo";

  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        className={clsx(
          "flex-shrink-0 border border-border",
          isLogo
            ? "rounded-xl object-contain bg-white p-1"
            : "rounded-full object-cover",
          sizes[size]
        )}
      />
    );
  }

  return (
    <div
      className={clsx(
        "flex items-center justify-center font-semibold text-white flex-shrink-0",
        isLogo ? "rounded-xl" : "rounded-full",
        color,
        sizes[size]
      )}
    >
      {initials}
    </div>
  );
}
