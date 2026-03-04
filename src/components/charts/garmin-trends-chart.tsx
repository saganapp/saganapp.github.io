import { useState, useRef, useEffect } from "react";
import { useLocale } from "@/i18n";
import type { GarminDailyMetric } from "@/hooks/use-dashboard-data";
import { Button } from "@/components/ui/button";

interface GarminTrendsChartProps {
  data: GarminDailyMetric[];
}

type MetricKey = "steps" | "restingHr" | "avgStress" | "bodyBattery";

interface MetricConfig {
  key: MetricKey;
  labelKey: string;
  color: string;
  getValue: (d: GarminDailyMetric) => number | undefined;
  getMax?: (d: GarminDailyMetric) => number | undefined;
  getMin?: (d: GarminDailyMetric) => number | undefined;
  goalLine?: (d: GarminDailyMetric) => number | undefined;
}

const METRICS: MetricConfig[] = [
  {
    key: "steps",
    labelKey: "dashboard.garminTrends.steps",
    color: "var(--platform-garmin)",
    getValue: (d) => d.steps,
    goalLine: (d) => d.stepGoal,
  },
  {
    key: "restingHr",
    labelKey: "dashboard.garminTrends.restingHr",
    color: "#ef4444",
    getValue: (d) => d.restingHr,
  },
  {
    key: "avgStress",
    labelKey: "dashboard.garminTrends.stress",
    color: "#f59e0b",
    getValue: (d) => d.avgStress,
  },
  {
    key: "bodyBattery",
    labelKey: "dashboard.garminTrends.bodyBattery",
    color: "#22c55e",
    getValue: (d) => d.bodyBatteryHigh,
    getMin: (d) => d.bodyBatteryLow,
  },
];

export function GarminTrendsChart({ data }: GarminTrendsChartProps) {
  const { t } = useLocale();
  const [activeMetric, setActiveMetric] = useState<MetricKey>("steps");
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 200 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDims({ w: entry.contentRect.width, h: Math.min(200, entry.contentRect.width * 0.35) });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const config = METRICS.find((m) => m.key === activeMetric)!;

  // Filter data points that have values for the selected metric
  const points = data
    .map((d, i) => ({
      idx: i,
      date: d.date,
      value: config.getValue(d),
      maxVal: config.getMax?.(d),
      minVal: config.getMin?.(d),
      goal: config.goalLine?.(d),
    }))
    .filter((p) => p.value != null) as {
      idx: number;
      date: string;
      value: number;
      maxVal?: number;
      minVal?: number;
      goal?: number;
    }[];

  if (points.length === 0) {
    return (
      <div>
        <MetricTabs active={activeMetric} onChange={setActiveMetric} t={t} />
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t("dashboard.garminTrends.noData")}
        </div>
      </div>
    );
  }

  const pad = { top: 10, right: 10, bottom: 24, left: 40 };
  const chartW = dims.w - pad.left - pad.right;
  const chartH = dims.h - pad.top - pad.bottom;

  // Compute value range
  const allValues = points.flatMap((p) => [p.value, p.maxVal, p.minVal, p.goal].filter((v): v is number => v != null));
  const minV = Math.min(...allValues) * 0.9;
  const maxV = Math.max(...allValues) * 1.1;
  const rangeV = maxV - minV || 1;

  const x = (i: number) => pad.left + (i / Math.max(1, points.length - 1)) * chartW;
  const y = (v: number) => pad.top + chartH - ((v - minV) / rangeV) * chartH;

  // Build path
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");

  // Build area path for body battery range
  let areaPath = "";
  if (config.getMin) {
    const topPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
    const bottomPath = [...points].reverse().map((p, i) => {
      const px = x(points.length - 1 - i);
      const py = y(p.minVal ?? p.value);
      return `${i === 0 ? "L" : "L"}${px},${py}`;
    }).join(" ");
    areaPath = `${topPath} ${bottomPath} Z`;
  }

  // Goal line
  const goalValues = points.filter((p) => p.goal != null);
  const avgGoal = goalValues.length > 0
    ? goalValues.reduce((s, p) => s + p.goal!, 0) / goalValues.length
    : null;

  // Y-axis ticks
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount }, (_, i) => minV + (rangeV * i) / (tickCount - 1));

  // X-axis labels (first, mid, last)
  const xLabels = points.length >= 2
    ? [
        { i: 0, label: formatDateShort(points[0].date) },
        { i: Math.floor(points.length / 2), label: formatDateShort(points[Math.floor(points.length / 2)].date) },
        { i: points.length - 1, label: formatDateShort(points[points.length - 1].date) },
      ]
    : [{ i: 0, label: formatDateShort(points[0].date) }];

  return (
    <div>
      <MetricTabs active={activeMetric} onChange={setActiveMetric} t={t} />
      <div className="mt-2">
        <svg ref={svgRef} width="100%" height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`}>
          {/* Y-axis ticks */}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={dims.w - pad.right} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.08} />
              <text x={pad.left - 4} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
                {formatTickValue(v, activeMetric)}
              </text>
            </g>
          ))}

          {/* Goal line */}
          {avgGoal != null && (
            <line
              x1={pad.left}
              x2={dims.w - pad.right}
              y1={y(avgGoal)}
              y2={y(avgGoal)}
              stroke={config.color}
              strokeDasharray="4 3"
              opacity={0.4}
            />
          )}

          {/* Area fill for range metrics */}
          {areaPath && (
            <path d={areaPath} fill={config.color} opacity={0.15} />
          )}

          {/* Main line */}
          <path d={linePath} fill="none" stroke={config.color} strokeWidth={1.5} opacity={0.8} />

          {/* Dots */}
          {points.length <= 40 && points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} fill={config.color} opacity={0.8} />
          ))}

          {/* X-axis labels */}
          {xLabels.map(({ i, label }) => (
            <text key={i} x={x(i)} y={dims.h - 4} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
              {label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function MetricTabs({ active, onChange, t }: { active: MetricKey; onChange: (k: MetricKey) => void; t: (key: string) => string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {METRICS.map((m) => (
        <Button
          key={m.key}
          variant={active === m.key ? "secondary" : "ghost"}
          size="xs"
          onClick={() => onChange(m.key)}
          className="text-xs"
        >
          {t(m.labelKey)}
        </Button>
      ))}
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTickValue(v: number, metric: MetricKey): string {
  if (metric === "steps") {
    return v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v));
  }
  return String(Math.round(v));
}
