import type { LucideIcon } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface ReportSectionProps {
  number: number;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

export function ReportSection({ number, title, icon: Icon, children }: ReportSectionProps) {
  return (
    <Card className="report-section">
      <CardHeader>
        <h2 className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </span>
          <span>
            <span className="text-primary">{number}.</span> {title}
          </span>
        </h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">{children}</div>
      </CardContent>
    </Card>
  );
}
