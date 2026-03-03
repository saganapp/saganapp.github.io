import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldData from "world-atlas/countries-110m.json";
import { useIsMobile } from "@/hooks/use-mobile";
import { PLATFORM_META } from "@/utils/platform";
import { ALPHA2_TO_NUMERIC } from "@/utils/country-codes";
import type { CountryData } from "@/analysis/countries";
import { formatCompact } from "@/utils/format";

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

// Build alpha-2 → numeric lookup (inverted for geo matching)
const numericToAlpha2 = new Map<string, string>();
for (const [a2, num] of Object.entries(ALPHA2_TO_NUMERIC)) {
  numericToAlpha2.set(num, a2);
}

// Country display names via Intl API
function getCountryName(code: string, locale: string): string {
  try {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

interface WorldMapChartProps {
  data: CountryData[];
  locale?: string;
}

interface TooltipState {
  x: number;
  y: number;
  countryCode: string;
  name: string;
  count: number;
  platforms: string[];
}

export function WorldMapChart({ data, locale = "en" }: WorldMapChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: cw, height: ch } = useContainerSize(containerRef);
  const isMobile = useIsMobile();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Build country lookup: numeric ID → CountryData
  const countryLookup = useMemo(() => {
    const map = new Map<string, CountryData>();
    for (const d of data) {
      const numId = ALPHA2_TO_NUMERIC[d.countryCode];
      if (numId) map.set(numId, d);
    }
    return map;
  }, [data]);

  // Convert TopoJSON to GeoJSON features
  const features = useMemo(() => {
    const topo = worldData as unknown as Topology<{ countries: GeometryCollection }>;
    return topojson.feature(topo, topo.objects.countries).features;
  }, []);

  // Compute projection + path + color scale
  const computed = useMemo(() => {
    if (cw === 0 || ch === 0) return null;

    const projection = d3.geoNaturalEarth1()
      .fitSize([cw, ch], { type: "Sphere" });

    const path = d3.geoPath(projection);

    const maxCount = Math.max(...data.map((d) => d.count), 1);
    const colorScale = d3.scaleSequentialLog(d3.interpolateBlues)
      .domain([1, maxCount]);

    return { projection, path, colorScale };
  }, [cw, ch, data]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGPathElement>, feature: d3.ExtendedFeature) => {
      const id = feature.id as string;
      const entry = countryLookup.get(id);
      if (!entry) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        countryCode: entry.countryCode,
        name: getCountryName(entry.countryCode, locale),
        count: entry.count,
        platforms: entry.platforms,
      });
    },
    [countryLookup, locale],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<SVGPathElement>, feature: d3.ExtendedFeature) => {
      handleMouseMove(e, feature);
    },
    [handleMouseMove],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (!computed || cw === 0) {
    return <div ref={containerRef} className="h-full w-full" />;
  }

  const { path, colorScale } = computed;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <motion.svg
        width={cw}
        height={ch}
        viewBox={`0 0 ${cw} ${ch}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {features.map((feature) => {
          const id = feature.id as string;
          const entry = countryLookup.get(id);
          const hasData = !!entry;

          return (
            <path
              key={id}
              d={path(feature) ?? ""}
              fill={hasData ? colorScale(entry.count) : "var(--color-muted)"}
              stroke="var(--color-border)"
              strokeWidth={0.4}
              strokeOpacity={0.4}
              className={hasData ? "cursor-pointer transition-opacity hover:opacity-80" : ""}
              onMouseEnter={hasData ? (e) => handleMouseEnter(e, feature) : undefined}
              onMouseMove={hasData ? (e) => handleMouseMove(e, feature) : undefined}
              onMouseLeave={hasData ? handleMouseLeave : undefined}
            />
          );
        })}
      </motion.svg>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && !isMobile && (
          <motion.div
            key="map-tip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-border/50 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm"
            style={{
              left: Math.min(tooltip.x + 12, cw - 180),
              top: Math.max(tooltip.y - 60, 4),
            }}
          >
            <p className="text-[11px] font-medium text-card-foreground">
              {tooltip.name}
            </p>
            <p className="font-mono text-xs font-semibold text-card-foreground">
              {formatCompact(tooltip.count)} events
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              {tooltip.platforms.map((p) => {
                const meta = PLATFORM_META[p as keyof typeof PLATFORM_META];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <Icon
                    key={p}
                    className="size-3"
                    style={{ color: `var(${meta.cssVar})` }}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
