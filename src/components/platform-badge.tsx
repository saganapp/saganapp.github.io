import type { Platform } from "@/parsers/types";
import { PLATFORM_META } from "@/utils/platform";
import { cn } from "@/lib/utils";

interface PlatformBadgeProps {
  platform: Platform;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const meta = PLATFORM_META[platform];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklch, var(${meta.cssVar}) 15%, transparent)`,
        color: `var(${meta.cssVar})`,
      }}
    >
      <Icon className="h-3 w-3" />
      {meta.name}
    </span>
  );
}
