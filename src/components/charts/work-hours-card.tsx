import { motion } from "framer-motion";
import { useLocale } from "@/i18n";
import { PLATFORM_META } from "@/utils/platform";
import type { WorkHoursAnalysis } from "@/analysis";
import type { Platform } from "@/parsers/types";
import { PLATFORMS } from "@/parsers/types";

interface WorkHoursCardProps {
  analysis: WorkHoursAnalysis | null;
}

export function WorkHoursCard({ analysis }: WorkHoursCardProps) {
  const { t } = useLocale();

  if (!analysis || analysis.totalSeconds === 0) {
    return null;
  }

  const totalHours = (analysis.totalSeconds / 3600).toFixed(1);

  const platformEntries = PLATFORMS
    .filter((p) => (analysis.byPlatform[p] ?? 0) > 0)
    .map((p) => ({
      platform: p,
      seconds: analysis.byPlatform[p] ?? 0,
    }))
    .sort((a, b) => b.seconds - a.seconds);

  const maxSeconds = platformEntries.length > 0 ? platformEntries[0].seconds : 1;

  const stats = [
    {
      value: t("dashboard.workHours.weekly", { minutes: analysis.weeklyMinutes }),
      label: t("dashboard.workHours.weeklyLabel"),
    },
    {
      value: t("dashboard.workHours.total", { hours: totalHours }),
      label: t("dashboard.workHours.totalLabel"),
    },
    {
      value: t("dashboard.workHours.percent", { pct: analysis.percentOfWorkHours }),
      label: t("dashboard.workHours.percentLabel"),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            className="rounded-lg bg-muted/30 px-2 py-2.5 text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.08 }}
          >
            <p className="text-base font-bold font-mono tracking-tight">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Platform breakdown bars */}
      <div className="space-y-2.5">
        {platformEntries.map(({ platform, seconds }, idx) => {
          const meta = PLATFORM_META[platform as Platform];
          const pct = Math.round((seconds / maxSeconds) * 100);
          const minutes = Math.round(seconds / 60);
          return (
            <div key={platform} className="flex items-center gap-2.5">
              <div className="flex w-20 shrink-0 items-center gap-1.5">
                <meta.icon
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: `var(--platform-${platform})` }}
                />
                <span className="truncate text-xs">{meta.name}</span>
              </div>
              <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/20">
                <motion.div
                  className="h-full rounded-md"
                  style={{ backgroundColor: `var(--platform-${platform})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{
                    duration: 0.8,
                    delay: 0.2 + idx * 0.08,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-[11px] font-mono tabular-nums text-muted-foreground">
                {minutes}m
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
