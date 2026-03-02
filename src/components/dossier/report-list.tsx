interface ReportListProps {
  items: React.ReactNode[];
}

export function ReportList({ items }: ReportListProps) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-2 border-l border-border/60 pl-4 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <li key={i} className="relative flex items-baseline gap-2.5">
          <span className="absolute -left-[1.1875rem] top-[0.4375rem] h-2 w-2 shrink-0 rounded-full border-2 border-primary/40 bg-card" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}
