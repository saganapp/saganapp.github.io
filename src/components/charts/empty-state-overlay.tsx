import type { ReactNode } from "react";
import { useLocale } from "@/i18n";

interface EmptyStateOverlayProps {
  message: string;
  yearHintYears: number[];
  children: ReactNode;
}

export function EmptyStateOverlay({ message, yearHintYears, children }: EmptyStateOverlayProps) {
  const { t } = useLocale();

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        {yearHintYears.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground/70">
            {t("dashboard.yearHint", { years: yearHintYears.join(", ") })}
          </p>
        )}
      </div>
    </div>
  );
}

interface EmptyStateMessageProps {
  message: string;
  yearHintYears?: number[];
}

export function EmptyStateMessage({ message, yearHintYears = [] }: EmptyStateMessageProps) {
  const { t } = useLocale();

  return (
    <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 gap-1">
      <p className="text-sm text-muted-foreground">{message}</p>
      {yearHintYears.length > 0 && (
        <p className="text-xs text-muted-foreground/70">
          {t("dashboard.yearHint", { years: yearHintYears.join(", ") })}
        </p>
      )}
    </div>
  );
}
