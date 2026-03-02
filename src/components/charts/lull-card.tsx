import { Fragment } from "react";
import { useLocale } from "@/i18n";
import { formatDays } from "@/utils/format-days";
import type { RecurringLull } from "@/analysis";

interface LullCardProps {
  lulls: RecurringLull[];
}

const WAKING_START = 8;
const WAKING_END = 22;
const HOURS = Array.from(
  { length: WAKING_END - WAKING_START },
  (_, i) => i + WAKING_START,
);
const DAYS = [0, 1, 2, 3, 4, 5, 6]; // Sun–Sat

export function LullCard({ lulls }: LullCardProps) {
  const { t } = useLocale();

  // Build a lookup: (day, hour) → { index, confidence } for highlighting
  const lullCells = new Map<
    string,
    { index: number; confidence: number }
  >();
  for (let li = 0; li < lulls.length && li < 5; li++) {
    const lull = lulls[li];
    for (const d of lull.daysOfWeek) {
      for (let h = lull.startHour; h < lull.endHour; h++) {
        const key = `${d}-${h}`;
        if (!lullCells.has(key))
          lullCells.set(key, { index: li, confidence: lull.confidence });
      }
    }
  }

  const dayLabel = (i: number) => t(`day.short.${i}`);

  return (
    <div className="space-y-3">
      {/* Mini heatmap grid */}
      <div className="overflow-x-auto">
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `auto repeat(${HOURS.length}, 1fr)`,
            gridTemplateRows: `auto repeat(${DAYS.length}, 1fr)`,
            minWidth: 260,
          }}
        >
          {/* Top-left corner */}
          <div />

          {/* Hour labels */}
          {HOURS.map((h) => (
            <div
              key={`h-${h}`}
              className="text-center text-[10px] font-mono leading-tight text-muted-foreground"
            >
              {h % 3 === 0 ? h : ""}
            </div>
          ))}

          {/* Day rows */}
          {DAYS.map((d) => (
            <Fragment key={d}>
              <div
                className="pr-1.5 text-right text-[10px] leading-6 text-muted-foreground"
              >
                {t(`day.short.${d}`)}
              </div>
              {HOURS.map((h) => {
                const key = `${d}-${h}`;
                const cell = lullCells.get(key);
                const isLull = cell !== undefined;
                return (
                  <div
                    key={key}
                    className={`h-5 rounded-sm transition-transform duration-100 ${
                      isLull
                        ? "cursor-crosshair hover:z-10 hover:scale-110"
                        : ""
                    } ${
                      isLull
                        ? cell.confidence >= 0.75
                          ? "bg-destructive/60"
                          : "bg-destructive/30"
                        : "bg-muted/30"
                    }`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Heatmap legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-destructive/60" />
          {t("dashboard.lulls.legendHigh")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-destructive/30" />
          {t("dashboard.lulls.legendLow")}
        </span>
      </div>

      {/* Legend: list detected lulls */}
      {lulls.slice(0, 5).map((lull, idx) => {
        const days = formatDays(lull.daysOfWeek, dayLabel);
        const pct = Math.round(lull.confidence * 100);
        const totalWeeks = Math.round(lull.weekCount / lull.confidence);
        return (
          <div
            key={idx}
            className="rounded-lg border border-border/50 px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("dashboard.lulls.item", {
                  days,
                  startHour: lull.startHour,
                  endHour: lull.endHour,
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("dashboard.lulls.confidence", {
                  pct,
                  weeks: lull.weekCount,
                })}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("dashboard.lulls.insight", {
                activeWeeks: lull.weekCount,
                totalWeeks,
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}
