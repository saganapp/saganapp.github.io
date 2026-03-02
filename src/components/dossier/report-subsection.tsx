interface ReportSubsectionProps {
  number: string; // e.g. "2.1"
  title: string;
  children: React.ReactNode;
}

export function ReportSubsection({ number, title, children }: ReportSubsectionProps) {
  return (
    <div className="report-subsection rounded-lg border-l-2 border-primary/20 bg-muted/20 py-3 pl-4 pr-3">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        <span className="text-muted-foreground">{number}</span> {title}
      </h3>
      <div className="space-y-2.5 pl-1">{children}</div>
    </div>
  );
}
