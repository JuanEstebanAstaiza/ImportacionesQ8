import { ChevronRight } from "lucide-react";
import { clsx } from "clsx";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={clsx("flex items-center gap-1 text-sm", className)}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
          <span
            onClick={item.onClick}
            className={clsx(
              index === items.length - 1 ? "text-foreground font-medium" : "text-muted-foreground",
              item.onClick && "cursor-pointer hover:text-foreground transition-colors",
            )}
          >
            {item.label}
          </span>
        </span>
      ))}
    </nav>
  );
}
