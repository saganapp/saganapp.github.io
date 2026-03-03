import type { MetadataEvent, DailyAggregate, ParseProgressCallback } from "../types";
import { extractMetadataFiles } from "./zip-extractor";
import { parseMboxStreaming } from "./mbox-stream";
import { parseMyActivity } from "./my-activity";
import { parseGoogleChat } from "./google-chat";
import { parseChromeHistory } from "./chrome-history";
import { parseCalendar } from "./calendar";
import { parseLocationHistory } from "./location-history";
import { parseGoogleMeet } from "./google-meet";
import { parseReservation } from "./purchases";
import { resetIdCounter } from "./utils";

export interface GoogleBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

interface GoogleParseContext {
  userEmail: string | null;
}

// My Activity folders that contain non-user-initiated / passive events
export const SKIP_MY_ACTIVITY = /My Activity\/(?:Discover|Takeout|Voice Match)\//;

/**
 * Route an extracted file to the appropriate sub-parser based on its path.
 */
export function routeFile(
  path: string,
  data: Uint8Array,
  ctx: GoogleParseContext,
): MetadataEvent[] {
  const normalized = path.replace(/^Takeout\//, "");

  if (SKIP_MY_ACTIVITY.test(normalized)) return [];

  if (/My Activity\/.*\.(?:json|html)$/.test(normalized)) {
    return parseMyActivity(data, normalized);
  }
  if (/Google Chat\/.*messages\.json$/.test(normalized)) {
    return parseGoogleChat(data, normalized, ctx.userEmail ?? undefined);
  }
  if (/Chrome\/(?:BrowserHistory|History)\.json$/.test(normalized)) {
    return parseChromeHistory(data);
  }
  if (/Calendar\/.*\.ics$/.test(normalized)) {
    return parseCalendar(data, normalized, ctx.userEmail ?? undefined);
  }
  if (/Location History\/.*\.json$/.test(normalized)) {
    return parseLocationHistory(data);
  }
  if (/Google Meet\/.*\.csv$/.test(normalized)) {
    return parseGoogleMeet(data);
  }
  if (/Purchases & Reservations\/.*\.json$/.test(normalized)) {
    return parseReservation(data);
  }

  return [];
}

/**
 * Parse all files from a Google Takeout export.
 * Processes MBOX files first to detect user email, then ZIP files.
 * Yields batches of { events, aggregates }.
 */
export async function* parseGoogleTakeout(
  files: File[],
  onProgress?: ParseProgressCallback,
): AsyncGenerator<GoogleBatch> {
  resetIdCounter();

  const zips = files.filter((f) => f.name.toLowerCase().endsWith(".zip"));
  const mboxFiles = files.filter((f) => f.name.toLowerCase().endsWith(".mbox"));
  let totalEvents = 0;

  const ctx: GoogleParseContext = { userEmail: null };

  // Process MBOX files FIRST to detect user email
  for (const mbox of mboxFiles) {
    onProgress?.({
      phase: "parsing",
      progress: 0,
      eventsProcessed: totalEvents,
      currentFile: mbox.name,
    });

    let detectedEmail: string | null = null;

    for await (const batch of parseMboxStreaming(mbox, (bytesRead, total) => {
      onProgress?.({
        phase: "parsing",
        progress: bytesRead / total,
        eventsProcessed: totalEvents,
        currentFile: mbox.name,
      });
    })) {
      totalEvents += batch.events.length;

      // Detect user email from the first sent event
      if (!detectedEmail) {
        for (const ev of batch.events) {
          if (ev.eventType === "message_sent" && ev.actor !== "unknown") {
            detectedEmail = ev.actor;
            ctx.userEmail = detectedEmail;
            break;
          }
        }
      }

      yield batch;
    }
  }

  // Process ZIP files
  for (let i = 0; i < zips.length; i++) {
    const zip = zips[i];
    onProgress?.({
      phase: "reading",
      progress: 0,
      eventsProcessed: totalEvents,
      currentFile: zip.name,
    });

    // Read full zip into memory
    const buffer = await zip.arrayBuffer();
    const zipData = new Uint8Array(buffer);

    onProgress?.({
      phase: "extracting",
      progress: 0.3,
      eventsProcessed: totalEvents,
      currentFile: zip.name,
    });

    // Extract metadata files
    const extracted = await extractMetadataFiles(zipData);

    onProgress?.({
      phase: "parsing",
      progress: 0.5,
      eventsProcessed: totalEvents,
      currentFile: zip.name,
    });

    // Route each extracted file to appropriate sub-parser
    const entries = Array.from(extracted.entries());

    // Skip Chrome/History.json when curated My Activity/Chrome exists
    const hasMyActivityChrome = entries.some(([p]) => /My Activity\/Chrome\//.test(p));
    const filteredEntries = hasMyActivityChrome
      ? entries.filter(([p]) => !/Chrome\/(?:BrowserHistory|History)\.json$/.test(p.replace(/^Takeout\//, "")))
      : entries;

    const batch: MetadataEvent[] = [];

    for (let j = 0; j < filteredEntries.length; j++) {
      const [path, data] = filteredEntries[j];
      const events = routeFile(path, data, ctx);
      batch.push(...events);
      totalEvents += events.length;

      // Yield in batches of ~1000
      if (batch.length >= 1000) {
        yield { events: batch.splice(0, batch.length), aggregates: [] };
        onProgress?.({
          phase: "parsing",
          progress: 0.5 + (0.4 * (j + 1)) / filteredEntries.length,
          eventsProcessed: totalEvents,
          currentFile: zip.name,
        });
        await yieldToMain();
      }
    }

    if (batch.length > 0) {
      yield { events: batch, aggregates: [] };
    }

    onProgress?.({
      phase: "parsing",
      progress: 1,
      eventsProcessed: totalEvents,
      currentFile: zip.name,
    });
  }
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
