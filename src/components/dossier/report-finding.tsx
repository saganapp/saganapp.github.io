import { Badge } from "@/components/ui/badge";

interface ReportFindingProps {
  label?: string;
  children: React.ReactNode;
}

export function ReportFinding({ label, children }: ReportFindingProps) {
  return (
    <div className="text-sm leading-relaxed text-muted-foreground">
      {label && (
        <>
          <Badge variant="secondary" className="px-2 py-0 text-[11px] font-semibold">
            {label}
          </Badge>{" "}
        </>
      )}
      {children}
    </div>
  );
}
