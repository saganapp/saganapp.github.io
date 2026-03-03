import { useState, useEffect } from "react";

const VB_W = 1920;
const VB_H = 1080;
const SIZE = 44;
const STEP = SIZE * 2; // no gap between tiles
const ROW_STAGGER = 70;
const COL_STAGGER = 18;
const ANIM_DURATION = 350;

interface Tile {
  x: number;
  y: number;
  w: number;
  delay: number;
}

/** Build individual tiles with bottom-to-top, left-to-right staggered delays. */
function buildTiles(): Tile[] {
  const cols = Math.ceil(VB_W / STEP) + 1;
  const rows = Math.ceil(VB_H / STEP) + 1;
  const maxRow = rows - 1;
  const tiles: Tile[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tiles.push({
        x: col * STEP,
        y: row * STEP,
        w: SIZE * 2,
        delay: (maxRow - row) * ROW_STAGGER + col * COL_STAGGER,
      });
    }
  }

  return tiles;
}

const tiles = buildTiles();
const maxDelay = Math.max(...tiles.map((t) => t.delay));
const CLEANUP_TIMEOUT = maxDelay + ANIM_DURATION + 100;

let hasPlayed = false;

export function TileReveal() {
  const [visible, setVisible] = useState(() => {
    if (hasPlayed) return false;
    hasPlayed = true;
    return true;
  });

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), CLEANUP_TIMEOUT);
    return () => clearTimeout(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 overflow-hidden pointer-events-none"
      style={{ contain: "strict" }}
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
      >
        {tiles.map((t, i) => (
          <rect
            key={i}
            className="tile-reveal-tile"
            x={t.x}
            y={t.y}
            width={t.w}
            height={t.w}
            rx={4}
            fill="var(--color-background)"
            stroke="var(--color-foreground)"
            strokeWidth="0.8"
            strokeOpacity={0.12}
            style={{ animationDelay: `${t.delay}ms` }}
          />
        ))}
      </svg>
    </div>
  );
}
