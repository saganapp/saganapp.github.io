import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChartContainerProps {
  height?: number;
  mobileHeight?: number;
  loading?: boolean;
  empty?: boolean;
  label?: string;
  children: ReactNode;
}

export function ChartContainer({
  height = 300,
  mobileHeight,
  loading,
  empty,
  label,
  children,
}: ChartContainerProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const h = isMobile && mobileHeight ? mobileHeight : height;

  if (loading) {
    return (
      <div style={{ height: h }} className="flex flex-col rounded-lg bg-muted/20 p-4">
        <div className="flex items-end gap-1.5 flex-1">
          {[45, 62, 38, 70, 55, 80, 48, 65, 42, 72, 50, 58].map((pct, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${pct}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-2.5 w-8" />
          ))}
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div
        style={{ height: h }}
        className="flex items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20"
      >
        <p className="text-sm text-muted-foreground">
          {t("dashboard.empty")}
        </p>
      </div>
    );
  }

  return <div className="min-w-0 overflow-hidden" style={{ height: h }} role="img" aria-label={label}>{children}</div>;
}
