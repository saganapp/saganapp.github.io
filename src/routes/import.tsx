import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { usePageTitle } from "@/hooks/use-page-title";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Plus, Trash2, Database, ExternalLink, Lightbulb, Layers } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PLATFORMS } from "@/parsers/types";
import type { Platform, DetectedFile, ImportSession } from "@/parsers/types";
import { PLATFORM_META } from "@/utils/platform";
import { useLocale } from "@/i18n";
import { useAppStore } from "@/store/app-store";
import { clearAllData, getImportSessions } from "@/store/db";
import { formatDate } from "@/utils/time";
import { detectFiles } from "@/parsers/detect";
import { importFiles } from "@/parsers/import-orchestrator";
import { FileDropZone } from "@/components/import/file-drop-zone";
import { DetectedFileList } from "@/components/import/detected-file-list";
import { ImportProgress } from "@/components/import/import-progress";

type ImportState = "idle" | "files-selected" | "importing" | "complete";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const IMPORT_DISPLAY_ORDER: Platform[] = [
  "google", "spotify", "twitter", "tiktok", "instagram", "telegram", "garmin", "whatsapp",
];

function SignalBars({ level, cssVar }: { level: number; cssVar: string }) {
  return (
    <div className="flex items-end gap-[2px]" aria-label={`Signal ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`rounded-sm ${i > level ? "bg-muted-foreground/20" : ""}`}
          style={{
            width: 3,
            height: 4 + i * 2,
            backgroundColor: i <= level ? `var(${cssVar})` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export function ImportPage() {
  usePageTitle("pageTitle.import");
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const { activeImports, setImportProgress, clearImportProgress, bumpDataVersion, setDataSummary } =
    useAppStore();

  const dataVersion = useAppStore((s) => s.dataVersion);

  const [state, setState] = useState<ImportState>("idle");
  const [detectedFiles, setDetectedFiles] = useState<DetectedFile[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ImportSession[]>([]);

  useEffect(() => {
    getImportSessions().then(setSessions).catch(() => {});
  }, [dataVersion, state]);

  const handleFiles = useCallback(async (files: File[]) => {
    const detected = await detectFiles(files);
    setDetectedFiles((prev) => [...prev, ...detected]);
    setState("files-selected");
    setError(null);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setDetectedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setState("idle");
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setDetectedFiles([]);
    setState("idle");
    setError(null);
  }, []);

  const handlePlatformChange = useCallback((index: number, platform: Platform) => {
    setDetectedFiles((prev) =>
      prev.map((df, i) =>
        i === index ? { ...df, platform, confidence: "filename" as const } : df,
      ),
    );
  }, []);

  const hasUnselectedPlatform = detectedFiles.some((df) => df.platform === null);

  const handleImport = useCallback(async () => {
    setState("importing");
    setError(null);

    await importFiles(detectedFiles, {
      onProgress: (platform, phase, progress, eventsProcessed, currentFile) => {
        setImportProgress(platform, {
          phase,
          progress,
          eventsProcessed,
          currentFile,
        });
      },
      onComplete: (total) => {
        setTotalEvents(total);
        setState("complete");
      },
      onError: (msg) => {
        setError(msg);
      },
    });
  }, [detectedFiles, setImportProgress]);

  const handleReset = useCallback(() => {
    setDetectedFiles([]);
    setState("idle");
    setTotalEvents(0);
    setError(null);
    // Clear active imports from store
    for (const platform of PLATFORMS) {
      clearImportProgress(platform);
    }
  }, [clearImportProgress]);

  const handleClearAllData = useCallback(async () => {
    await clearAllData();
    setDataSummary({ totalEvents: 0, platformCounts: {} });
    bumpDataVersion();
    handleReset();
  }, [setDataSummary, bumpDataVersion, handleReset]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t("import.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("import.subtitle")}</p>
      </motion.div>

      {/* Drop zone */}
      <motion.div
        className="mt-8"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <FileDropZone
          onFiles={handleFiles}
          disabled={state === "importing"}
        />
      </motion.div>

      {/* Detected files list */}
      {detectedFiles.length > 0 && state !== "complete" && (
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DetectedFileList
            files={detectedFiles}
            onRemove={handleRemove}
            onClear={handleClear}
            onPlatformChange={handlePlatformChange}
          />

          {state === "files-selected" && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={handleImport}
                disabled={hasUnselectedPlatform}
              >
                {t("import.start")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              {hasUnselectedPlatform && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("import.files.selectRequired")}
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Import progress */}
      {state === "importing" && (
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ImportProgress activeImports={activeImports} />
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <motion.div
          className="mt-6 rounded-lg border border-destructive/50 bg-destructive/5 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-sm font-medium text-destructive">
            {t("import.error.title")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </motion.div>
      )}

      {/* Complete */}
      {state === "complete" && (
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <ImportProgress activeImports={activeImports} />

          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
            <h2 className="mt-3 text-lg font-semibold">
              {t("import.complete.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("import.complete.desc", { count: totalEvents })}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button onClick={() => navigate("/dashboard")}>
                {t("import.complete.dashboard")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <Plus className="h-4 w-4" />
                {t("import.complete.more")}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    {t("import.clear.button")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("import.clear.confirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("import.clear.confirmDesc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("import.clear.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("import.clear.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </motion.div>
      )}

      {/* Completed import sessions */}
      {sessions.length > 0 && state !== "importing" && (
        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t("import.history.title")}</h2>
            <div className="ml-auto">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 text-xs">
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("import.clear.button")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("import.clear.confirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("import.clear.confirmDesc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("import.clear.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("import.clear.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions
              .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())
              .map((session) => {
                const meta = PLATFORM_META[session.platform];
                const Icon = meta.icon;
                const range = session.dateRange
                  ? `${formatDate(new Date(session.dateRange.start), locale)} — ${formatDate(new Date(session.dateRange.end), locale)}`
                  : null;
                return (
                  <div
                    key={session.id}
                    className="relative flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3 overflow-hidden"
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ backgroundColor: `var(${meta.cssVar})` }}
                    />
                    <Icon
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: `var(${meta.cssVar})` }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{meta.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("import.history.events", { count: session.eventCount })}
                      </p>
                      {range && (
                        <p className="text-xs text-muted-foreground">{range}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {t("import.history.imported", {
                          date: formatDate(new Date(session.importedAt), locale),
                        })}
                      </p>
                    </div>
                    <CheckCircle2 className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  </div>
                );
              })}
          </div>
        </motion.div>
      )}

      {/* Unlock more insights — What's Missing guidance */}
      {(() => {
        const importedPlatforms = new Set(sessions.map((s) => s.platform));
        const missingPlatforms = IMPORT_DISPLAY_ORDER.filter((p) => !importedPlatforms.has(p));
        if (sessions.length > 0 && missingPlatforms.length > 0 && missingPlatforms.length < 6) {
          return (
            <motion.div
              className="mt-10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-xl border border-border/50 bg-muted/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold">{t("import.unlockTitle")}</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{t("import.unlockDesc")}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {missingPlatforms.map((platform) => {
                    const meta = PLATFORM_META[platform];
                    const Icon = meta.icon;
                    return (
                      <div
                        key={platform}
                        className="flex items-start gap-2.5 rounded-lg border border-border/30 bg-card/50 p-3"
                      >
                        <Icon
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: `var(${meta.cssVar})` }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{meta.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {t(`platform.${platform}.unlock`)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          );
        }
        return null;
      })()}

      {/* Supported sources header */}
      <div className="mt-10 flex items-center gap-2 mb-4">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{t("import.sources.title")}</h2>
      </div>

      {/* Platform cards */}
      <motion.div
        className="mt-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {IMPORT_DISPLAY_ORDER.map((platform) => {
          const meta = PLATFORM_META[platform];
          const Icon = meta.icon;
          return (
            <motion.div key={platform} variants={item}>
              <Card className="relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: `var(${meta.cssVar})` }}
                />
                <CardHeader className="pl-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon
                        className="h-4 w-4"
                        style={{ color: `var(${meta.cssVar})` }}
                      />
                      <CardTitle className="text-base">{meta.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <SignalBars level={meta.signalLevel} cssVar={meta.cssVar} />
                      <span className="text-xs text-muted-foreground">
                        {t(`platform.${platform}.signal`)}
                      </span>
                    </div>
                  </div>
                  <CardDescription className="mt-1">
                    {t(`platform.${platform}.desc`)}
                  </CardDescription>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t(`platform.${platform}.guide`)}
                  </p>
                  <a
                    href={meta.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("import.helpLink")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </CardHeader>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
