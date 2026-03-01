import { motion } from "framer-motion";
import { useLocale } from "@/i18n";
import { formatDays } from "@/utils/format-days";
import type { SleepingPattern } from "@/analysis";

interface SleepCardProps {
  patterns: SleepingPattern[];
}

const DAYS = [0, 1, 2, 3, 4, 5, 6]; // Sun–Sat
const AXIS_TICKS = [22, 0, 2, 4, 6, 8];

/** Convert an hour (22–8 night window) to a 0–10 position */
function hourToPosition(hour: number): number {
  if (hour >= 22) return hour - 22; // 22→0, 23→1
  return hour + 2; // 0→2, 1→3 ... 7→9, 8→10
}

type DayBar = { startHour: number; endHour: number; confidence: number };

export function SleepCard({ patterns }: SleepCardProps) {
  const { t } = useLocale();

  // Build per-day lookup (first matching pattern wins)
  const dayBars = new Map<number, DayBar>();
  for (let pi = 0; pi < patterns.length && pi < 5; pi++) {
    const pat = patterns[pi];
    for (const d of pat.daysOfWeek) {
      if (!dayBars.has(d)) {
        dayBars.set(d, {
          startHour: pat.startHour,
          endHour: pat.endHour,
          confidence: pat.confidence,
        });
      }
    }
  }

  const dayLabel = (i: number) => t(`day.short.${i}`);

  return (
    <div className="space-y-3">
      {/* Horizontal bar chart */}
      <div className="overflow-hidden">
        <div>
          {/* Time axis */}
          <div className="relative ml-8 mb-1 h-4">
            {AXIS_TICKS.map((hour) => {
              const pct = (hourToPosition(hour) / 10) * 100;
              return (
                <span
                  key={hour}
                  className="absolute text-[10px] font-mono text-muted-foreground -translate-x-1/2"
                  style={{ left: `${pct}%` }}
                >
                  {hour}
                </span>
              );
            })}
          </div>

          {/* Day rows */}
          {DAYS.map((d, rowIdx) => {
            const bar = dayBars.get(d);
            const startPos = bar ? hourToPosition(bar.startHour) : 0;
            const endPos = bar ? hourToPosition(bar.endHour) : 0;
            const leftPct = (startPos / 10) * 100;
            const widthPct = ((endPos - startPos) / 10) * 100;
            const duration = bar ? endPos - startPos : 0;
            const timeLabel = bar
              ? `${bar.startHour}:00–${String(bar.endHour).padStart(2, "0")}:00 (${duration}h)`
              : undefined;

            return (
              <div key={d} className="flex items-center gap-1.5 mb-0.5">
                <div className="w-8 text-right text-[10px] text-muted-foreground leading-6">
                  {dayLabel(d)}
                </div>
                <div className="relative h-6 flex-1 rounded-md bg-muted/20">
                  {bar && (
                    <motion.div
                      className={`absolute inset-y-0.5 rounded-md flex items-center justify-center ${
                        bar.confidence >= 0.75
                          ? "bg-primary/60"
                          : "bg-primary/30"
                      }`}
                      style={{ left: `${leftPct}%` }}
                      title={timeLabel}
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{
                        duration: 0.7,
                        delay: rowIdx * 0.04,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {duration >= 5 && (
                        <span className="text-[10px] font-mono text-primary-foreground/80">
                          {duration}h
                        </span>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary/60" />
          {t("dashboard.sleep.legendHigh")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary/30" />
          {t("dashboard.sleep.legendLow")}
        </span>
      </div>

      {/* Detected patterns list */}
      {patterns.slice(0, 5).map((pat, idx) => {
        const days = formatDays(pat.daysOfWeek, dayLabel);
        const pct = Math.round(pat.confidence * 100);
        const totalWeeks = Math.round(pat.weekCount / pat.confidence);
        return (
          <div
            key={idx}
            className="rounded-lg border border-border/50 px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("dashboard.sleep.item", {
                  days,
                  startHour: pat.startHour,
                  endHour: pat.endHour,
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("dashboard.sleep.confidence", {
                  pct,
                  weeks: pat.weekCount,
                })}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("dashboard.sleep.insight", {
                activeWeeks: pat.weekCount,
                totalWeeks,
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}
