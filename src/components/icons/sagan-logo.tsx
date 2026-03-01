import type { IconProps } from "./platform-icons";
import { cn } from "@/lib/utils";

export function LensIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} style={style}>
      <path fillRule="evenodd" d="M 12 1 a 11 11 0 0 1 0 22 a 11 11 0 0 1 0 -22 Z M 12 3.5 a 8.5 8.5 0 0 0 0 17 a 8.5 8.5 0 0 0 0 -17 Z"/>
      <path opacity="0.5" d="M 12.21 8.01 L 13.66 4.17 A 8 8 0 0 1 19.94 11.03 L 15.35 9.82 Z"/>
      <path opacity="0.65" d="M 15.56 10.18 L 19.61 9.53 A 8 8 0 0 1 16.81 18.39 L 15.56 13.82 Z"/>
      <path opacity="0.5" d="M 15.35 14.18 L 17.95 17.35 A 8 8 0 0 1 8.87 19.36 L 12.21 15.99 Z"/>
      <path opacity="0.65" d="M 11.79 15.99 L 10.34 19.83 A 8 8 0 0 1 4.06 12.97 L 8.65 14.18 Z"/>
      <path opacity="0.5" d="M 8.44 13.82 L 4.39 14.47 A 8 8 0 0 1 7.19 5.61 L 8.44 10.18 Z"/>
      <path opacity="0.65" d="M 8.65 9.82 L 6.05 6.65 A 8 8 0 0 1 15.13 4.64 L 11.79 8.01 Z"/>
      <circle opacity="0.4" cx="13.5" cy="9.8" r="0.9"/>
      <circle opacity="0.5" cx="10.5" cy="13" r="0.5"/>
    </svg>
  );
}

interface SaganLogoProps {
  size?: "default" | "sm";
  className?: string;
}

export function SaganLogo({ size = "default", className }: SaganLogoProps) {
  const isSmall = size === "sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        className,
      )}
    >
      <LensIcon
        className={cn(
          "text-primary shrink-0",
          isSmall ? "h-4 w-4" : "h-6 w-6",
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
