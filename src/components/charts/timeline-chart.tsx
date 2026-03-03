import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useLocale } from "@/i18n";
import { motion, AnimatePresence } from "framer-motion";
import * as d3 from "d3";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlatformColors } from "@/hooks/use-platform-colors";
import { PLATFORM_META } from "@/utils/platform";
import { formatCompact } from "@/utils/format";
import type { TimelineSeries, TimelineAnnotation } from "@/hooks/use-dashboard-data";
import type { Platform } from "@/parsers/types";

// Map display names back to platform keys for color lookup
const nameToKey = Object.fromEntries(
  Object.entries(PLATFORM_META).map(([k, v]) => [v.name, k as Platform]),
);

interface TimelineChartProps {
  data: TimelineSeries[];
  effectiveRange?: { start: Date; end: Date } | null;
  annotations?: TimelineAnnotation[];
}

/* ─── Hook: track container dimensions via ResizeObserver ─── */
function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

/* ─── Constants ─── */
const MIN_ZOOM_SPAN = 14 * 24 * 60 * 60 * 1000; // 2 weeks in ms

/* ─── Type for the memoised computation result ─── */
interface Computed {
  stacked: d3.Series<Record<string, number | Date>, string>[];
  table: Record<string, number | Date>[];
  seriesKeys: string[];
  fullDomain: [Date, Date];
  xScale: d3.ScaleTime<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  areaGen: d3.Area<d3.SeriesPoint<Record<string, number | Date>>>;
  lineGen: d3.Line<d3.SeriesPoint<Record<string, number | Date>>>;
  xTicks: Date[];
  xFormat: (d: Date) => string;
  yTicks: number[];
  isZoomed: boolean;
}

/* ─────────────────────────────────────────────────────────── */
export function TimelineChart({ data, effectiveRange, annotations }: TimelineChartProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const colors = usePlatformColors();
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: cw, height: ch } = useContainerSize(containerRef);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [viewDomain, setViewDomain] = useState<[Date, Date] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startDomain: [Date, Date];
  } | null>(null);
  const lastPinchRef = useRef<{ dist: number; center: number } | null>(null);

  const hasAnnotations = (annotations?.length ?? 0) > 0;
  const margin = useMemo(
    () => ({ top: hasAnnotations ? 28 : 12, right: 16, bottom: 32, left: isMobile ? 36 : 50 }),
    [isMobile, hasAnnotations],
  );
  const innerW = cw - margin.left - margin.right;
  const innerH = ch - margin.top - margin.bottom;

  /* ─── Data transformation + D3 computations ─── */
  const computed = useMemo<Computed | null>(() => {
    if (innerW <= 0 || innerH <= 0 || data.length === 0) return null;

    // Collect every unique week across all series
    const weekSet = new Set<string>();
    for (const series of data) {
      for (const pt of series.data) weekSet.add(pt.x);
    }
    const weeks = [...weekSet].sort();
    if (weeks.length === 0) return null;

    // Lookup: seriesId → Map<weekStr, count>
    const lookup = new Map<string, Map<string, number>>();
    for (const series of data) {
      const m = new Map<string, number>();
      for (const pt of series.data) m.set(pt.x, pt.y);
      lookup.set(String(series.id), m);
    }

    // Sort platforms by total (largest on bottom of stack for visual stability)
    const seriesKeys = data
      .map((s) => ({
        key: String(s.id),
        total: s.data.reduce((sum, d) => sum + d.y, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .map((s) => s.key);

    // Tabular format for d3.stack()
    const table: Record<string, number | Date>[] = weeks.map((w) => {
      const row: Record<string, number | Date> = { week: new Date(w) };
      for (const key of seriesKeys) {
        row[key] = lookup.get(key)?.get(w) ?? 0;
      }
      return row;
    });

    // Custom offset: overlapping areas (each layer starts from y=0)
    const stackOffsetOverlap = (series: d3.Series<Record<string, number | Date>, string>[]) => {
      for (const s of series) {
        for (const d of s) {
          const val = d[1] - d[0];
          d[0] = 0;
          d[1] = val;
        }
      }
    };

    // Stack layout
    const stacked = d3
      .stack<Record<string, number | Date>, string>()
      .keys(seriesKeys)
      .value((d, key) => (d[key] as number) ?? 0)
      .order(d3.stackOrderNone)
      .offset(stackOffsetOverlap)(table);

    // Scales
    const fullDomain: [Date, Date] = effectiveRange
      ? [effectiveRange.start, effectiveRange.end]
      : (d3.extent(table, (d) => d.week as Date) as [Date, Date]);

    // Only use viewDomain if it overlaps with the current data range
    const hasValidZoom =
      viewDomain !== null &&
      viewDomain[0].getTime() < fullDomain[1].getTime() &&
      viewDomain[1].getTime() > fullDomain[0].getTime();

    const xDomain: [Date, Date] = hasValidZoom ? viewDomain : fullDomain;

    const xScale = d3.scaleTime().domain(xDomain).range([0, innerW]);

    const yMax =
      d3.max(stacked, (layer) =>
        d3.max(
          layer.filter((d) => {
            const date = d.data.week as Date;
            return date >= xDomain[0] && date <= xDomain[1];
          }),
          (d) => d[1],
        ),
      ) ?? 1;
    const yScale = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();

    // Path generators
    const areaGen = d3
      .area<d3.SeriesPoint<Record<string, number | Date>>>()
      .x((d) => xScale(d.data.week as Date))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    const lineGen = d3
      .line<d3.SeriesPoint<Record<string, number | Date>>>()
      .x((d) => xScale(d.data.week as Date))
      .y((d) => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    // Adaptive tick intervals
    const spanYears =
      (xDomain[1].getTime() - xDomain[0].getTime()) / (365.25 * 86_400_000);
    const spanDays = spanYears * 365.25;

    let xTicks: Date[];
    let xFormat: (d: Date) => string;
    if (spanYears >= 10) {
      xTicks = xScale.ticks(isMobile ? 3 : 5);
      xFormat = d3.timeFormat("%Y");
    } else if (spanYears >= 5) {
      xTicks = xScale.ticks(isMobile ? 4 : 6);
      xFormat = d3.timeFormat("%Y");
    } else if (spanYears >= 2) {
      xTicks = xScale.ticks(isMobile ? 4 : 8);
      xFormat = d3.timeFormat("%b '%y");
    } else if (spanDays > 60) {
      xTicks = xScale.ticks(isMobile ? 4 : 8);
      xFormat = d3.timeFormat("%b %y");
    } else {
      xTicks = xScale.ticks(isMobile ? 4 : 6);
      xFormat = d3.timeFormat("%b %d");
    }

    const yTicks = yScale.ticks(isMobile ? 3 : 5);

    return {
      stacked,
      table,
      seriesKeys,
      fullDomain,
      xScale,
      yScale,
      areaGen,
      lineGen,
      xTicks,
      xFormat,
      yTicks,
      isZoomed: hasValidZoom,
    };
  }, [data, effectiveRange, viewDomain, innerW, innerH, isMobile]);

  // Refs for wheel handler (needs non-passive native listener)
  const computedRef = useRef<Computed | null>(null);
  const viewDomainRef = useRef<[Date, Date] | null>(null);
  useEffect(() => {
    computedRef.current = computed;
    viewDomainRef.current = viewDomain;
  });

  /* ─── Mouse / touch handler: snap to nearest week ─── */
  const handlePointer = useCallback(
    (e: React.MouseEvent<SVGRectElement> | React.TouchEvent<SVGRectElement>) => {
      if (!computed || !containerRef.current || dragRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left - margin.left;

      const date = computed.xScale.invert(x);
      const bisect = d3.bisector(
        (d: Record<string, number | Date>) => d.week as Date,
      ).left;

      let idx = bisect(computed.table, date);
      if (idx > 0 && idx < computed.table.length) {
        const prev = (computed.table[idx - 1].week as Date).getTime();
        const next = (computed.table[idx].week as Date).getTime();
        if (date.getTime() - prev < next - date.getTime()) idx--;
      }
      setHoverIndex(Math.max(0, Math.min(idx, computed.table.length - 1)));
    },
    [computed, margin.left],
  );

  const clearHover = useCallback(() => setHoverIndex(null), []);

  /* ─── Wheel handler: zoom X-axis (non-passive for preventDefault) ─── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      const c = computedRef.current;
      if (!c) return;

      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - margin.left;
      const date = c.xScale.invert(x);

      const [d0, d1] = viewDomainRef.current ?? c.fullDomain;
      const span = d1.getTime() - d0.getTime();
      const factor = e.deltaY > 0 ? 1.15 : 0.85;
      const newSpan = span * factor;

      if (newSpan < MIN_ZOOM_SPAN) return;

      const frac = (date.getTime() - d0.getTime()) / span;
      let newStart = date.getTime() - frac * newSpan;
      let newEnd = date.getTime() + (1 - frac) * newSpan;

      const fullStart = c.fullDomain[0].getTime();
      const fullEnd = c.fullDomain[1].getTime();
      if (newStart < fullStart) {
        newEnd += fullStart - newStart;
        newStart = fullStart;
      }
      if (newEnd > fullEnd) {
        newStart -= newEnd - fullEnd;
        newEnd = fullEnd;
      }
      newStart = Math.max(newStart, fullStart);
      newEnd = Math.min(newEnd, fullEnd);

      if (newEnd - newStart >= fullEnd - fullStart) {
        setViewDomain(null);
      } else {
        setViewDomain([new Date(newStart), new Date(newEnd)]);
      }
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [margin.left]);

  /* ─── Drag handlers: pan X-axis ─── */
  const handleDragStart = useCallback(
    (clientX: number) => {
      if (!computed) return;
      const domain = viewDomain ?? computed.fullDomain;
      dragRef.current = {
        startX: clientX,
        startDomain: [domain[0], domain[1]],
      };
      setIsDragging(true);
      setHoverIndex(null);
    },
    [computed, viewDomain],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number) => {
      if (!dragRef.current || !computed) return;
      const domainSpan =
        dragRef.current.startDomain[1].getTime() -
        dragRef.current.startDomain[0].getTime();
      const msPerPx = domainSpan / innerW;
      const dx = clientX - dragRef.current.startX;
      const shift = -dx * msPerPx;

      let newStart = dragRef.current.startDomain[0].getTime() + shift;
      let newEnd = dragRef.current.startDomain[1].getTime() + shift;

      const fullStart = computed.fullDomain[0].getTime();
      const fullEnd = computed.fullDomain[1].getTime();
      if (newStart < fullStart) {
        newEnd += fullStart - newStart;
        newStart = fullStart;
      }
      if (newEnd > fullEnd) {
        newStart -= newEnd - fullEnd;
        newEnd = fullEnd;
      }

      setViewDomain([new Date(newStart), new Date(newEnd)]);
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) handleMove(e.touches[0].clientX);
    };
    const onEnd = () => {
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [isDragging, computed, innerW]);

  /* ─── Touch handlers: pinch-to-zoom + single-finger drag ─── */
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGRectElement>) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
        const center = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lastPinchRef.current = { dist, center };
      } else if (e.touches.length === 1 && viewDomain !== null) {
        handleDragStart(e.touches[0].clientX);
      }
    },
    [handleDragStart, viewDomain],
  );

  const handleTouchMoveZoom = useCallback(
    (e: React.TouchEvent<SVGRectElement>) => {
      if (
        e.touches.length === 2 &&
        lastPinchRef.current &&
        computed &&
        containerRef.current
      ) {
        e.preventDefault();
        const dist = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
        const center = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const scale = lastPinchRef.current.dist / dist;

        const rect = containerRef.current.getBoundingClientRect();
        const x = center - rect.left - margin.left;
        const date = computed.xScale.invert(x);

        const [d0, d1] = viewDomain ?? computed.fullDomain;
        const span = d1.getTime() - d0.getTime();
        const newSpan = span * scale;

        if (newSpan < MIN_ZOOM_SPAN) {
          lastPinchRef.current = { dist, center };
          return;
        }

        const frac = (date.getTime() - d0.getTime()) / span;
        let newStart = date.getTime() - frac * newSpan;
        let newEnd = date.getTime() + (1 - frac) * newSpan;

        const fullStart = computed.fullDomain[0].getTime();
        const fullEnd = computed.fullDomain[1].getTime();
        if (newStart < fullStart) {
          newEnd += fullStart - newStart;
          newStart = fullStart;
        }
        if (newEnd > fullEnd) {
          newStart -= newEnd - fullEnd;
          newEnd = fullEnd;
        }
        newStart = Math.max(newStart, fullStart);
        newEnd = Math.min(newEnd, fullEnd);

        if (newEnd - newStart >= fullEnd - fullStart) {
          setViewDomain(null);
        } else {
          setViewDomain([new Date(newStart), new Date(newEnd)]);
        }

        lastPinchRef.current = { dist, center };
      } else if (e.touches.length === 1 && !lastPinchRef.current) {
        handlePointer(e);
      }
    },
    [computed, viewDomain, margin.left, handlePointer],
  );

  const handleTouchEndZoom = useCallback(
    (e: React.TouchEvent<SVGRectElement>) => {
      if (e.touches.length < 2) lastPinchRef.current = null;
      if (e.touches.length === 0) clearHover();
    },
    [clearHover],
  );

  /* ─── Double-click / reset: restore full view ─── */
  const handleDoubleClick = useCallback(() => setViewDomain(null), []);

  /* ─── Render: sizing pass (before dimensions are known) ─── */
  if (!computed || cw === 0) {
    return <div ref={containerRef} className="h-full w-full" />;
  }

  const {
    stacked,
    table,
    seriesKeys,
    xScale,
    yScale,
    areaGen,
    lineGen,
    xTicks,
    xFormat,
    yTicks,
  } = computed;

  /* ─── Tooltip computation ─── */
  const tooltipData =
    hoverIndex !== null
      ? (() => {
          const row = table[hoverIndex];
          const weekDate = row.week as Date;
          const items = seriesKeys
            .map((k) => ({
              key: k,
              platform: nameToKey[k],
              value: (row[k] as number) ?? 0,
            }))
            .filter((d) => d.value > 0)
            .sort((a, b) => b.value - a.value);
          const total = items.reduce((s, d) => s + d.value, 0);
          const cx = xScale(weekDate);
          return { weekDate, items, total, cx };
        })()
      : null;

  /* ─── Gradient ID helper ─── */
  const gradId = (key: string) => `tl-grad-${key.replace(/\W/g, "")}`;
  const clipId = "timeline-chart-clip";
  const isZoomed = computed.isZoomed;

  return (
    <div ref={containerRef} className="relative h-full w-full touch-none select-none">
      {/* ─── Legend above chart ─── */}
      {hasAnnotations && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center px-2 py-px">
          <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <span className="inline-block h-[6px] w-[6px] rounded-full bg-foreground" />
            {t("chart.legend.quietDot")}
          </span>
        </div>
      )}

      {/* Chart — revealed with a left-to-right clip sweep */}
      <motion.div
        className="h-full w-full"
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      >
        <svg width={cw} height={ch}>
          {/* ─── Gradient + clip defs ─── */}
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={0} width={innerW} height={innerH} />
            </clipPath>
            {seriesKeys.map((key) => {
              const platform = nameToKey[key];
              const color = platform ? colors[platform] : "#888";
              return (
                <linearGradient
                  key={gradId(key)}
                  id={gradId(key)}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.03} />
                </linearGradient>
              );
            })}
          </defs>

          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* ─── Grid: horizontal ─── */}
            {yTicks.map((tick) => (
              <line
                key={`yg-${tick}`}
                x1={0}
                x2={innerW}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="currentColor"
                strokeOpacity={tick === 0 ? 0.12 : 0.05}
                strokeDasharray={tick === 0 ? "none" : "2 4"}
              />
            ))}

            {/* ─── Grid: vertical at x ticks (very faint) ─── */}
            {xTicks.map((tick) => (
              <line
                key={`xg-${tick.getTime()}`}
                x1={xScale(tick)}
                x2={xScale(tick)}
                y1={0}
                y2={innerH}
                stroke="currentColor"
                strokeOpacity={0.03}
              />
            ))}

            {/* ─── Clipped chart content ─── */}
            <g clipPath={`url(#${clipId})`}>
              {/* ─── Stacked area fills ─── */}
              {stacked.map((layer) => (
              <path
                key={`area-${layer.key}`}
                d={areaGen(layer) ?? ""}
                fill={`url(#${gradId(layer.key)})`}
              />
            ))}

            {/* ─── Edge lines (top of each area) ─── */}
            {stacked.map((layer) => {
              const platform = nameToKey[layer.key];
              const color = platform ? colors[platform] : "#888";
              return (
                <path
                  key={`edge-${layer.key}`}
                  d={lineGen(layer) ?? ""}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.75}
                />
              );
            })}

            {/* ─── Annotation lines (inside clip) ─── */}
            {annotations?.map((ann) => {
              const x = xScale(ann.date);
              if (x < 0 || x > innerW) return null;
              return (
                <line
                  key={`ann-${ann.date.getTime()}`}
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={innerH}
                  stroke="currentColor"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              );
            })}

            {/* ─── Hover crosshair + dots ─── */}
            {hoverIndex !== null && tooltipData && (
              <g>
                <line
                  x1={tooltipData.cx}
                  x2={tooltipData.cx}
                  y1={0}
                  y2={innerH}
                  stroke="currentColor"
                  strokeOpacity={0.15}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {stacked.map((layer) => {
                  const platform = nameToKey[layer.key];
                  const color = platform ? colors[platform] : "#888";
                  const d = layer[hoverIndex];
                  if (!d || d[1] - d[0] < 0.5) return null;
                  return (
                    <circle
                      key={`dot-${layer.key}`}
                      cx={tooltipData.cx}
                      cy={yScale(d[1])}
                      r={3.5}
                      fill={color}
                      stroke="var(--background)"
                      strokeWidth={2}
                    />
                  );
                })}
              </g>
            )}
            </g>

            {/* ─── Annotation labels / dots (outside clip, inside margin transform) ─── */}
            {(() => {
              if (!annotations || annotations.length === 0) return null;
              const MIN_LABEL_GAP = 70; // px – labels closer than this become dots
              const positioned = annotations
                .map((ann) => ({ ...ann, x: xScale(ann.date) }))
                .filter((a) => a.x >= 0 && a.x <= innerW)
                .sort((a, b) => a.x - b.x);

              // Decide label vs dot: label shown only when gap to next is ≥ MIN_LABEL_GAP
              const showLabel: boolean[] = positioned.map((_, i) => {
                if (i < positioned.length - 1 && positioned[i + 1].x - positioned[i].x < MIN_LABEL_GAP) return false;
                if (i > 0 && positioned[i].x - positioned[i - 1].x < MIN_LABEL_GAP) return false;
                return true;
              });

              return positioned.map((ann, i) =>
                showLabel[i] ? (
                  <text
                    key={`ann-label-${ann.date.getTime()}`}
                    x={ann.x}
                    y={-4}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    style={{ fontSize: 9 }}
                  >
                    {ann.label}
                  </text>
                ) : (
                  <circle
                    key={`ann-dot-${ann.date.getTime()}`}
                    cx={ann.x}
                    cy={-4}
                    r={3}
                    className="fill-foreground"
                  />
                ),
              );
            })()}

            {/* ─── X-axis labels ─── */}
            {xTicks.map((tick) => (
              <text
                key={`xt-${tick.getTime()}`}
                x={xScale(tick)}
                y={innerH + 20}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {xFormat(tick)}
              </text>
            ))}

            {/* ─── Y-axis labels ─── */}
            {yTicks.map((tick) => (
              <text
                key={`yt-${tick}`}
                x={-8}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {formatCompact(tick)}
              </text>
            ))}

            {/* ─── Invisible interaction overlay ─── */}
            <rect
              x={0}
              y={0}
              width={innerW}
              height={innerH}
              fill="transparent"
              onMouseMove={handlePointer}
              onMouseLeave={clearHover}
              onMouseDown={(e) => handleDragStart(e.clientX)}
              onDoubleClick={handleDoubleClick}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMoveZoom}
              onTouchEnd={handleTouchEndZoom}
              style={{
                cursor: isDragging
                  ? "grabbing"
                  : isZoomed
                    ? "grab"
                    : "crosshair",
              }}
            />
          </g>
        </svg>
      </motion.div>

      {/* ─── Reset zoom pill ─── */}
      <AnimatePresence>
        {isZoomed && (
          <motion.button
            key="reset-zoom"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            onClick={handleDoubleClick}
            className="absolute top-1 right-2 rounded-full border border-border/50 bg-card/90 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {t("chart.resetZoom")}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Floating tooltip ─── */}
      <AnimatePresence>
        {tooltipData && (
          <motion.div
            key="timeline-tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute z-50 min-w-[140px] rounded-lg border border-border/50 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm"
            style={{
              left:
                tooltipData.cx +
                margin.left +
                (tooltipData.cx > innerW * 0.65 ? -164 : 14),
              top: margin.top,
            }}
          >
            <p className="mb-1.5 text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
              {d3.timeFormat("%b %d, %Y")(tooltipData.weekDate)}
            </p>
            {tooltipData.items.map((item) => (
              <div key={item.key} className="flex items-center gap-2 py-px">
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{
                    background: item.platform ? colors[item.platform] : "#888",
                  }}
                />
                <span className="truncate text-[11px] text-card-foreground">
                  {item.key}
                </span>
                <span className="ml-auto pl-3 text-[11px] font-mono font-medium tabular-nums text-card-foreground">
                  {formatCompact(item.value)}
                </span>
              </div>
            ))}
            {tooltipData.items.length > 1 && (
              <div className="mt-1 flex justify-between border-t border-border/30 pt-1">
                <span className="text-[10px] text-muted-foreground">{t("chart.total")}</span>
                <span className="text-[11px] font-mono font-semibold tabular-nums">
                  {formatCompact(tooltipData.total)}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
