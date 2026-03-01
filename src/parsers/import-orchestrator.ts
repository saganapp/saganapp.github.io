import type { Platform, MetadataEvent, ImportSession, DailyAggregate } from "./types";
import type { DetectedFile } from "./types";
import { parseGoogleTakeout } from "./google/index";
import { parseTwitterArchive } from "./twitter/index";
import { parseInstagramArchive } from "./instagram/index";
import { parseTelegramExport } from "./telegram/index";
import { parseTikTokExport } from "./tiktok/index";
import { parseWhatsAppExport } from "./whatsapp/index";
import { parseGarminExport } from "./garmin/index";
import { parseSpotifyExport } from "./spotify/index";
import { addEvents, addImportSession, addDailyAggregates } from "@/store/db";
import { useAppStore } from "@/store/app-store";
import { clearDemoCache } from "@/demo/load-demo";

interface ImportCallbacks {
  onProgress: (
    platform: Platform,
    phase: "reading" | "extracting" | "parsing" | "storing" | "complete" | "error",
    progress: number,
    eventsProcessed: number,
    currentFile?: string,
  ) => void;
  onComplete: (totalEvents: number) => void;
  onError: (error: string) => void;
}

interface ParseBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

/**
 * Main import entry point. Receives pre-detected files (with user-confirmed
 * platforms) and parses, stores events in IndexedDB, and updates the Zustand store.
 */
export async function importFiles(
  detected: DetectedFile[],
  callbacks: ImportCallbacks,
): Promise<void> {
  if (detected.length === 0) {
    callbacks.onError("No recognized files found.");
    return;
  }

  // Clear demo data before a real import
  const store = useAppStore.getState();
  if (store.demoMode) {
    store.setDemoMode(false);
    clearDemoCache();
  }

  // Group by platform
  const byPlatform = new Map<Platform, DetectedFile[]>();
  for (const df of detected) {
    if (df.platform === null) continue; // skip unselected — shouldn't happen if UI validates
    const existing = byPlatform.get(df.platform) ?? [];
    existing.push(df);
    byPlatform.set(df.platform, existing);
  }

  let grandTotal = 0;
  const completedPlatformCounts: Partial<Record<Platform, number>> = {};

  for (const [platform, platformFiles] of byPlatform) {
    const rawFiles = platformFiles.map((df) => df.file);

    try {
      const generator = getParserForPlatform(platform, rawFiles, (prog) => {
        callbacks.onProgress(
          platform,
          prog.phase,
          prog.progress,
          prog.eventsProcessed,
          prog.currentFile,
        );
      });

      // Track stats for ImportSession
      let minDate: Date | null = null;
      let maxDate: Date | null = null;
      let platformEventCount = 0;
      let totalAggregateCount = 0;

      // Consume batches from the async generator
      for await (const batch of generator) {
        callbacks.onProgress(
          platform,
          "storing",
          0,
          platformEventCount,
        );

        // Store events
        if (batch.events.length > 0) {
          await addEvents(batch.events);
          platformEventCount += batch.events.length;

          // Track date range
          for (const event of batch.events) {
            if (!minDate || event.timestamp < minDate) minDate = event.timestamp;
            if (!maxDate || event.timestamp > maxDate) maxDate = event.timestamp;
          }
        }

        // Store aggregates
        if (batch.aggregates.length > 0) {
          await addDailyAggregates(batch.aggregates);
          for (const agg of batch.aggregates) {
            totalAggregateCount += agg.count;
            const aggDate = new Date(agg.date);
            if (!minDate || aggDate < minDate) minDate = aggDate;
            if (!maxDate || aggDate > maxDate) maxDate = aggDate;
          }
        }

        callbacks.onProgress(
          platform,
          "storing",
          1,
          platformEventCount,
        );
      }

      grandTotal += platformEventCount + totalAggregateCount;
      completedPlatformCounts[platform] = platformEventCount + totalAggregateCount;

      // Create ImportSession
      if (platformEventCount > 0 || totalAggregateCount > 0) {
        const session: ImportSession = {
          id: `import-${platform}-${Date.now()}`,
          platform,
          importedAt: new Date(),
          dateRange:
            minDate && maxDate ? { start: minDate, end: maxDate } : null,
          eventCount: platformEventCount + totalAggregateCount,
          filenames: rawFiles.map((f) => f.name),
        };
        await addImportSession(session);
      }

      callbacks.onProgress(platform, "complete", 1, platformEventCount);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown import error";
      callbacks.onProgress(platform, "error", 0, 0);
      callbacks.onError(`${platform}: ${message}`);
    }
  }

  // Update Zustand store
  store.setDataSummary({
    totalEvents: grandTotal,
    platformCounts: completedPlatformCounts,
  });
  store.bumpDataVersion();

  callbacks.onComplete(grandTotal);
}

function getParserForPlatform(
  platform: Platform,
  files: File[],
  onProgress: (prog: {
    phase: "reading" | "extracting" | "parsing" | "storing";
    progress: number;
    eventsProcessed: number;
    currentFile?: string;
  }) => void,
): AsyncGenerator<ParseBatch> {
  switch (platform) {
    case "google":
      return parseGoogleTakeout(files, onProgress);
    case "twitter":
      return parseTwitterArchive(files, onProgress);
    case "instagram":
      return parseInstagramArchive(files, onProgress);
    case "telegram":
      return parseTelegramExport(files, onProgress);
    case "tiktok":
      return parseTikTokExport(files, onProgress);
    case "whatsapp":
      return parseWhatsAppExport(files, onProgress);
    case "garmin":
      return parseGarminExport(files, onProgress);
    case "spotify":
      return parseSpotifyExport(files, onProgress);
    default:
      // Return empty generator for unsupported platforms
      return (async function* () {})();
  }
}
