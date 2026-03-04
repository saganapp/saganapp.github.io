import { motion } from "framer-motion";
import { useLocale } from "@/i18n";
import type { GarminActivityItem } from "@/hooks/use-dashboard-data";

interface GarminActivityChartProps {
  data: GarminActivityItem[];
}

function formatActivityType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function GarminActivityChart({ data }: GarminActivityChartProps) {
  const { t } = useLocale();

  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="space-y-2">
      {data.map((item, idx) => {
        const widthPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        return (
          <div key={item.type} className="flex items-center gap-2">
            <div className="w-28 shrink-0 truncate text-right text-xs text-muted-foreground">
              {formatActivityType(item.type)}
            </div>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/20">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-md"
                style={{
                  backgroundColor: "var(--platform-garmin)",
                  opacity: 0.7 - idx * 0.08,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(widthPct, 3)}%` }}
                transition={{
                  duration: 0.7,
                  delay: idx * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            </div>
            <span className="shrink-0 text-xs font-mono text-muted-foreground whitespace-nowrap">
              {item.count} {t("dashboard.garminActivity.times")} &middot; {item.totalDurationHours}h
            </span>
          </div>
        );
      })}
    </div>
  );
}
