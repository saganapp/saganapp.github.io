import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Each dot: cx, cy, radius, opacity
// Bars are 3 columns wide (~2u spacing), bottom-aligned at y=21
// Missing dots biased toward the top (less settled = less certain)

interface Dot {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

// Bar 1 (shortest, ~8u): fully solid, 4 rows × 3 cols
const bar1: Dot[] = [
  { cx: 2.0, cy: 13.2, r: 0.95, opacity: 0.95 },
  { cx: 4.0, cy: 13.0, r: 0.85, opacity: 0.90 },
  { cx: 6.0, cy: 13.3, r: 0.90, opacity: 0.92 },
  { cx: 2.1, cy: 15.1, r: 0.80, opacity: 0.88 },
  { cx: 4.0, cy: 15.0, r: 0.95, opacity: 0.95 },
  { cx: 5.9, cy: 15.2, r: 0.85, opacity: 0.90 },
  { cx: 2.0, cy: 17.0, r: 0.90, opacity: 0.92 },
  { cx: 4.1, cy: 17.1, r: 0.85, opacity: 0.95 },
  { cx: 6.0, cy: 16.9, r: 0.95, opacity: 0.88 },
  { cx: 1.9, cy: 19.0, r: 0.85, opacity: 0.90 },
  { cx: 4.0, cy: 19.1, r: 0.90, opacity: 0.95 },
  { cx: 6.1, cy: 19.0, r: 0.95, opacity: 0.92 },
];

// Bar 2 (~12u): mostly formed, small gaps, 6 rows × 3 cols, ~75% density
const bar2: Dot[] = [
  { cx: 9.0, cy: 9.1, r: 0.70, opacity: 0.68 },
  // gap at col 2
  { cx: 13.0, cy: 9.3, r: 0.65, opacity: 0.65 },
  { cx: 9.1, cy: 11.0, r: 0.80, opacity: 0.75 },
  { cx: 11.0, cy: 11.2, r: 0.75, opacity: 0.72 },
  { cx: 13.0, cy: 11.0, r: 0.85, opacity: 0.80 },
  { cx: 8.9, cy: 13.1, r: 0.85, opacity: 0.78 },
  { cx: 11.1, cy: 13.0, r: 0.90, opacity: 0.82 },
  // gap at col 3
  { cx: 9.0, cy: 15.0, r: 0.80, opacity: 0.80 },
  { cx: 11.0, cy: 15.1, r: 0.85, opacity: 0.85 },
  { cx: 12.9, cy: 14.9, r: 0.75, opacity: 0.78 },
  { cx: 9.1, cy: 17.0, r: 0.90, opacity: 0.82 },
  { cx: 11.0, cy: 17.1, r: 0.80, opacity: 0.85 },
  { cx: 13.0, cy: 17.0, r: 0.85, opacity: 0.80 },
  { cx: 9.0, cy: 19.0, r: 0.85, opacity: 0.85 },
  { cx: 10.9, cy: 19.1, r: 0.90, opacity: 0.82 },
  { cx: 13.1, cy: 19.0, r: 0.80, opacity: 0.78 },
];

// Bar 3 (~16u): partially dissolving, ~70% density
const bar3: Dot[] = [
  // top rows — sparser but still present
  { cx: 18.0, cy: 5.3, r: 0.60, opacity: 0.52 },
  { cx: 16.1, cy: 5.1, r: 0.50, opacity: 0.45 },
  // gap
  { cx: 17.9, cy: 7.2, r: 0.65, opacity: 0.58 },
  { cx: 20.1, cy: 7.0, r: 0.55, opacity: 0.50 },
  // gap
  { cx: 16.0, cy: 9.0, r: 0.60, opacity: 0.55 },
  { cx: 18.0, cy: 9.1, r: 0.70, opacity: 0.62 },
  { cx: 20.0, cy: 9.2, r: 0.55, opacity: 0.48 },
  { cx: 16.1, cy: 11.0, r: 0.75, opacity: 0.65 },
  { cx: 18.1, cy: 11.1, r: 0.65, opacity: 0.60 },
  { cx: 20.0, cy: 11.2, r: 0.60, opacity: 0.55 },
  { cx: 16.0, cy: 13.0, r: 0.80, opacity: 0.68 },
  { cx: 18.1, cy: 13.1, r: 0.70, opacity: 0.72 },
  { cx: 20.0, cy: 12.9, r: 0.65, opacity: 0.58 },
  { cx: 16.0, cy: 15.0, r: 0.75, opacity: 0.70 },
  { cx: 18.0, cy: 15.2, r: 0.80, opacity: 0.65 },
  { cx: 20.0, cy: 14.9, r: 0.70, opacity: 0.58 },
  { cx: 16.1, cy: 17.0, r: 0.80, opacity: 0.68 },
  { cx: 18.0, cy: 17.1, r: 0.75, opacity: 0.65 },
  { cx: 20.1, cy: 17.0, r: 0.70, opacity: 0.60 },
  { cx: 16.1, cy: 19.0, r: 0.80, opacity: 0.72 },
  { cx: 18.0, cy: 19.0, r: 0.75, opacity: 0.65 },
  { cx: 19.9, cy: 19.1, r: 0.70, opacity: 0.60 },
];

// Bar 4 (tallest, ~20u): faint but recognizable, ~45% density
const bar4: Dot[] = [
  // very top — faint dots
  { cx: 25.0, cy: 1.3, r: 0.50, opacity: 0.25 },
  { cx: 24.9, cy: 3.2, r: 0.55, opacity: 0.30 },
  { cx: 23.1, cy: 3.0, r: 0.45, opacity: 0.22 },
  // gap
  { cx: 27.1, cy: 5.1, r: 0.45, opacity: 0.25 },
  { cx: 23.0, cy: 7.0, r: 0.55, opacity: 0.32 },
  { cx: 25.0, cy: 7.1, r: 0.50, opacity: 0.28 },
  // gap
  { cx: 25.1, cy: 9.2, r: 0.50, opacity: 0.30 },
  { cx: 27.0, cy: 9.0, r: 0.45, opacity: 0.25 },
  { cx: 23.0, cy: 11.0, r: 0.55, opacity: 0.35 },
  { cx: 25.0, cy: 11.0, r: 0.50, opacity: 0.32 },
  // gap
  { cx: 23.1, cy: 13.1, r: 0.60, opacity: 0.38 },
  { cx: 25.0, cy: 13.0, r: 0.50, opacity: 0.32 },
  { cx: 27.0, cy: 13.2, r: 0.45, opacity: 0.28 },
  { cx: 27.0, cy: 15.0, r: 0.50, opacity: 0.30 },
  { cx: 23.0, cy: 15.1, r: 0.55, opacity: 0.35 },
  { cx: 23.0, cy: 17.0, r: 0.60, opacity: 0.40 },
  { cx: 25.1, cy: 17.1, r: 0.55, opacity: 0.35 },
  { cx: 27.0, cy: 17.1, r: 0.50, opacity: 0.30 },
  { cx: 23.0, cy: 19.0, r: 0.60, opacity: 0.42 },
  { cx: 25.1, cy: 19.1, r: 0.65, opacity: 0.38 },
  { cx: 27.0, cy: 19.0, r: 0.55, opacity: 0.35 },
];

const allBars = [
  { dots: bar1, delayBase: 0, stagger: 0.02, duration: 0.4 },
  { dots: bar2, delayBase: 0.15, stagger: 0.025, duration: 0.45 },
  { dots: bar3, delayBase: 0.3, stagger: 0.03, duration: 0.5 },
  { dots: bar4, delayBase: 0.5, stagger: 0.06, duration: 0.7 },
];

const allDots = allBars.flatMap(({ dots }) => dots);

function SaganIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 28 22" fill="currentColor" aria-hidden="true" className={className} style={style}>
      {allDots.map((dot, i) => (
        <circle key={i} cx={dot.cx} cy={dot.cy} r={dot.r} opacity={dot.opacity} />
      ))}
    </svg>
  );
}

function SaganIconAnimated({ className, style }: { className?: string; style?: React.CSSProperties }) {
  // Build flat list with animation params
  const animatedDots: { dot: Dot; delay: number; duration: number }[] = [];
  for (const bar of allBars) {
    bar.dots.forEach((dot, i) => {
      animatedDots.push({
        dot,
        delay: bar.delayBase + i * bar.stagger,
        duration: bar.duration,
      });
    });
  }

  return (
    <svg viewBox="0 0 28 22" fill="currentColor" aria-hidden="true" className={className} style={style}>
      {animatedDots.map(({ dot, delay, duration }, i) => (
        <motion.circle
          key={i}
          cx={dot.cx}
          r={dot.r}
          initial={{ cy: dot.cy - 4, opacity: 0 }}
          animate={{ cy: dot.cy, opacity: dot.opacity }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 25,
            delay,
            duration,
            opacity: { duration: duration * 0.6, delay },
          }}
        />
      ))}
    </svg>
  );
}

interface SaganLogoProps {
  size?: "default" | "sm";
  className?: string;
}

export function SaganLogo({ size = "default", className }: SaganLogoProps) {
  const isSmall = size === "sm";

  const Icon = isSmall ? SaganIcon : SaganIconAnimated;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        className,
      )}
    >
      <Icon
        className={cn(
          "text-primary shrink-0",
          isSmall ? "h-6 w-auto" : "h-8 w-auto",
        )}
      />
      <span
        className={cn(
          "font-semibold tracking-widest uppercase leading-none",
          isSmall ? "text-xs" : "text-sm",
        )}
      >
        <span className="text-primary">S</span>
        <span>AGAN</span>
      </span>
    </span>
  );
}
