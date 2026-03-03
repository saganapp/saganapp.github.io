import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocale } from "@/i18n";
import { formatCompact } from "@/utils/format";
import type { ActivityBreakdownItem } from "@/hooks/use-dashboard-data";

interface ActivityBarChartProps {
  data: ActivityBreakdownItem[];
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + "\u2026";
}

export function ActivityBarChart({ data }: ActivityBarChartProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();

  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const labelW = isMobile ? 64 : 100;

  return (
    <div className="flex h-full flex-col justify-center gap-[6px]">
      {data.map((item, idx) => {
        const pct = (item.count / maxCount) * 100;
        return (
          <div key={item.label} className="group flex items-center gap-2.5">
            <span
              className="shrink-0 truncate text-right text-[11px] text-muted-foreground"
              style={{ width: labelW }}
            >
              {truncateLabel(t(item.label), isMobile ? 10 : 16)}
            </span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted/15">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-md transition-[filter] duration-200 group-hover:brightness-110"
                style={{ backgroundColor: item.color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{
                  duration: 0.9,
                  delay: idx * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            </div>
            <span className="w-11 shrink-0 text-right text-[11px] font-mono font-medium tabular-nums">
              {formatCompact(item.count)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
