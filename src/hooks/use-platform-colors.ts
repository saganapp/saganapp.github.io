import { useMemo } from "react";
import type { Platform } from "@/parsers/types";
import { PLATFORMS } from "@/parsers/types";
import { useTheme } from "@/components/theme-provider";

/** Resolve a CSS custom property to an rgb() string */
function resolveColor(cssVar: string): string {
  const el = document.createElement("div");
  el.style.color = `var(${cssVar})`;
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  document.body.removeChild(el);
  return resolved;
}

export function usePlatformColors(): Record<Platform, string> {
  const { resolved } = useTheme();

  return useMemo(() => {
    const colors = {} as Record<Platform, string>;
    for (const p of PLATFORMS) {
      colors[p] = resolveColor(`--platform-${p}`);
    }
    return colors;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);
}
