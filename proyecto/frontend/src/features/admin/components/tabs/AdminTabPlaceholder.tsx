interface AdminTabPlaceholderProps {
  title: string;
  description: string;
}

export function AdminTabPlaceholder({ title, description }: AdminTabPlaceholderProps) {
  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </section>
  );
}
