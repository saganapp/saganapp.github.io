import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { PLATFORM_META } from "@/utils/platform";
import { useLocale } from "@/i18n";
import type { Platform } from "@/parsers/types";

interface PlatformProgress {
  phase: "reading" | "extracting" | "parsing" | "storing" | "complete" | "error";
  progress: number;
  eventsProcessed: number;
  currentFile?: string;
}

interface ImportProgressProps {
  activeImports: Partial<Record<Platform, PlatformProgress>>;
}

export function ImportProgress({ activeImports }: ImportProgressProps) {
  const { t } = useLocale();

  const entries = Object.entries(activeImports) as [Platform, PlatformProgress][];
  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      {entries.map(([platform, progress]) => {
        const meta = PLATFORM_META[platform];
        const Icon = meta.icon;
        const isComplete = progress.phase === "complete";
        const isError = progress.phase === "error";

        return (
          <div
            key={platform}
            className="rounded-lg border border-border/50 bg-card p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon
                className="h-4 w-4"
                style={{ color: `var(${meta.cssVar})` }}
              />
              <span className="text-sm font-medium">{meta.name}</span>
              {isComplete && (
                <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
              )}
              {isError && (
                <AlertCircle className="ml-auto h-4 w-4 text-destructive" />
              )}
              {!isComplete && !isError && (
                <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round(progress.progress * 100)}%`,
                  backgroundColor: isError
                    ? "var(--destructive)"
                    : isComplete
                      ? "var(--color-green-500, #22c55e)"
                      : `var(${meta.cssVar})`,
                }}
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t(`import.progress.${progress.phase}`)}
                {progress.currentFile && !isComplete && !isError
                  ? ` — ${progress.currentFile}`
                  : ""}
              </span>
              <span>
                {t("import.progress.events", {
                  count: progress.eventsProcessed,
                })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
