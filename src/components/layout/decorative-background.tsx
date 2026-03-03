import { useState, useEffect, useMemo } from "react";

/**
 * Seeded PRNG (mulberry32) for deterministic "random" square placement.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Square path centered at (cx, cy) with half-size s */
function squarePath(cx: number, cy: number, s: number): string {
  const x = (cx - s).toFixed(2);
  const y = (cy - s).toFixed(2);
  const w = (s * 2).toFixed(2);
  return `M${x},${y}h${w}v${w}h-${w}Z`;
}

interface TileGroups {
  staticPath: string;      // all tiles, foreground stroke
  highlightedPath: string; // 6% of tiles, primary color fill+stroke
}

function gutterDensity(cx: number, cy: number, width: number, contentRatio: number): number {
  const contentHalf = (width * contentRatio) / 2;
  const padding = 60;
  const center = width / 2;
  const contentLeft = center - contentHalf - padding;
  const contentRight = center + contentHalf + padding;

  // Inside content zone — organic fade-in from edges
  if (cx >= contentLeft && cx <= contentRight) {
    const distFromLeft = cx - contentLeft;
    const distFromRight = contentRight - cx;
    const distFromEdge = Math.min(distFromLeft, distFromRight);
    // Per-row noise: use cy to create ragged boundary (~40-120px scatter zone)
    const rowNoise = Math.sin(cy * 0.47) * 0.5 + Math.sin(cy * 0.23 + 1.7) * 0.3;
    const scatterWidth = 80 + rowNoise * 40;
    if (distFromEdge > scatterWidth) return 0;
    const t = 1 - distFromEdge / scatterWidth;
    return Math.pow(t, 3) * 0.35; // cubic falloff, max 35% density at boundary
  }

  // Gutter zone — quadratic fade from outer edge
  let t: number;
  if (cx < contentLeft) {
    t = contentLeft > 0 ? cx / contentLeft : 0;
  } else {
    const gutterWidth = width - contentRight;
    t = gutterWidth > 0 ? 1 - (cx - contentRight) / gutterWidth : 0;
  }

  return Math.pow(Math.max(0, Math.min(1, t)), 2.4);
}

const VB_W = 1920;
const VB_H = 1080;
const SIZE = 7.15;
const GAP = 0;
const SEED = 42;
const MAX_CONTENT_W = 1152;

function buildTileGroups(
  width: number,
  height: number,
  seed: number,
  contentRatio: number,
): TileGroups {
  const rand = mulberry32(seed);

  const staticPaths: string[] = [];
  const highlightedPaths: string[] = [];

  const step = SIZE * 2 + GAP;
  const cols = Math.ceil(width / step) + 2;
  const rows = Math.ceil(height / step) + 2;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const cx = col * step;
      const cy = row * step;

      const density = gutterDensity(cx, cy, width, contentRatio);
      if (density === 0) continue;
      if (rand() > density) continue;

      const d = squarePath(cx, cy, SIZE);
      staticPaths.push(d);

      if (rand() < 0.06) {
        highlightedPaths.push(d);
      }
    }
  }

  return {
    staticPath: staticPaths.join(""),
    highlightedPath: highlightedPaths.join(""),
  };
}

function useContentRatio(): number {
  const [ratio, setRatio] = useState(() => {
    if (typeof window === "undefined") return MAX_CONTENT_W / VB_W;
    return Math.min(1, MAX_CONTENT_W / window.innerWidth);
  });

  useEffect(() => {
    const update = () => setRatio(Math.min(1, MAX_CONTENT_W / window.innerWidth));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return ratio;
}

export function DecorativeBackground() {
  const contentRatio = useContentRatio();

  const groups = useMemo(() => {
    if (contentRatio >= 0.95) return null;
    return buildTileGroups(VB_W, VB_H, SEED, contentRatio);
  }, [contentRatio]);

  if (!groups) return null;

  const { staticPath, highlightedPath } = groups;

  return (
    <div
      aria-hidden="true"
      className="decorative-bg print:hidden pointer-events-none fixed inset-0 z-0 text-foreground"
      style={{ contain: "strict" }}
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
        style={{ transform: "translateZ(0)" }}
      >
        {/* All tiles — static foreground stroke */}
        <path d={staticPath} fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity={0.4} />

        {/* 6% highlighted — primary color, solid fill + bolder stroke */}
        <path d={highlightedPath} fill="var(--color-primary)" fillOpacity={0.25} stroke="var(--color-primary)" strokeWidth="1" strokeOpacity={0.9} />
      </svg>
    </div>
  );
}
