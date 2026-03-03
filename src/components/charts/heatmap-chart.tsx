import { useState, useRef, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import type { HeatmapRow } from "@/hooks/use-dashboard-data";

interface HeatmapChartProps {
  data: HeatmapRow[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Map normalised intensity (0–1) to a Tailwind primary-color opacity class */
function cellClass(intensity: number): string {
  if (intensity < 0.02) return "bg-muted/15";
  if (intensity < 0.10) return "bg-primary/10";
  if (intensity < 0.20) return "bg-primary/15";
  if (intensity < 0.30) return "bg-primary/20";
  if (intensity < 0.40) return "bg-primary/30";
  if (intensity < 0.55) return "bg-primary/40";
  if (intensity < 0.70) return "bg-primary/55";
  if (intensity < 0.85) return "bg-primary/65";
  return "bg-primary/80";
}

export function HeatmapChart({ data }: HeatmapChartProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{
    day: string;
    hour: number;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const maxCount = Math.max(
    ...data.flatMap((row) => row.data.map((d) => d.y)),
    1,
  );

  // Find top 1-2 peak cells for star highlight
  const topKeys = useMemo(() => {
    const cells: { key: string; count: number }[] = [];
    for (const row of data) {
      for (const cell of row.data) {
        if (cell.y > 0) cells.push({ key: `${row.id}-${cell.x}`, count: cell.y });
      }
    }
    cells.sort((a, b) => b.count - a.count);
    const keys = new Set<string>();
    if (cells.length > 0) {
      keys.add(cells[0].key);
      if (cells.length > 1 && cells[1].count >= cells[0].count * 0.85) {
        keys.add(cells[1].key);
      }
    }
    return keys;
  }, [data]);

  const handleCellEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    day: string,
    hour: number,
    count: number,
  ) => {
    if (!containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    const cell = e.currentTarget.getBoundingClientRect();
    setHover({
      day,
      hour,
      count,
      x: cell.left - cr.left + cell.width / 2,
      y: cell.top - cr.top,
    });
  };

  return (
    <div ref={containerRef} className="relative h-full select-none overflow-hidden">
      <motion.div
        className="h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div
          className="grid h-full gap-[2px]"
          style={{
            gridTemplateColumns: `${isMobile ? "24px" : "36px"} repeat(24, 1fr)`,
            gridTemplateRows: `18px repeat(${data.length}, 1fr)`,
          }}
        >
          {/* Corner */}
          <div />

          {/* Hour labels */}
          {HOURS.map((h) => (
            <div
              key={`h-${h}`}
              className="flex items-end justify-center pb-0.5 text-[9px] font-mono leading-none text-muted-foreground"
            >
              {(isMobile ? h % 6 === 0 : h % 3 === 0) ? h : ""}
            </div>
          ))}

          {/* Data rows */}
          {data.map((row) => (
            <Fragment key={row.id}>
              <div
                className="flex items-center justify-end pr-1 text-[10px] text-muted-foreground"
              >
                {row.id}
              </div>
              {row.data.map((cell) => {
                const intensity = cell.y / maxCount;
                const cellKey = `${row.id}-${cell.x}`;
                const isPeak = topKeys.has(cellKey);
                return (
                  <div
                    key={cellKey}
                    className={`relative rounded-[3px] cursor-crosshair transition-transform duration-100 hover:z-10 hover:scale-[1.15] ${cellClass(intensity)}`}
                    onMouseEnter={(e) =>
                      handleCellEnter(e, row.id, Number(cell.x), cell.y)
                    }
                    onMouseLeave={() => setHover(null)}
                  >
                    {isPeak && (
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] leading-none text-primary-foreground/80 drop-shadow-sm">
                        ★
                      </span>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </motion.div>

      {/* Tooltip */}
      <AnimatePresence>
        {hover && hover.count > 0 && (
          <motion.div
            key="hm-tip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-border/50 bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur-sm"
            style={{
              left: hover.x,
              top: Math.max(hover.y - 44, 0),
              transform: "translateX(-50%)",
            }}
          >
            <p className="text-[11px] text-card-foreground">
              <span className="font-medium">{hover.day}</span>{" "}
              {t("chart.heatmap.at")}{" "}
              <span className="font-mono">
                {String(hover.hour).padStart(2, "0")}:00
              </span>
            </p>
            <p className="font-mono text-xs font-semibold text-card-foreground">
              {t("chart.events", { count: hover.count })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
