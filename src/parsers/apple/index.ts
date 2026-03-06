import { unzip } from "fflate";
import type { MetadataEvent, DailyAggregate, ParseProgressCallback } from "../types";
import { resetIdCounter } from "./utils";
import { parseAppInstalls } from "./app-installs";
import { parseRedownloads } from "./redownloads";
import { parsePurchases } from "./purchases";
import { parseClickActivity } from "./click-activity";
import { parseReviews } from "./reviews";

export interface AppleBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

const BATCH_SIZE = 1000;

/** Unzip a Uint8Array and return filename→Uint8Array map */
function unzipData(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Parse Apple GDPR export ZIPs.
 * Handles nested zips: scans unzipped entries for .zip files and recursively extracts.
 */
export async function* parseAppleExport(
  files: File[],
  onProgress?: ParseProgressCallback,
): AsyncGenerator<AppleBatch> {
  resetIdCounter();
  let totalEvents = 0;

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".zip")) continue;

    onProgress?.({
      phase: "reading",
      progress: 0,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    onProgress?.({
      phase: "extracting",
      progress: 0.1,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    let unzipped = await unzipData(data);

    // Handle nested zips: scan for .zip entries and extract them
    const nestedZips = Object.keys(unzipped).filter((k) =>
      k.toLowerCase().endsWith(".zip"),
    );
    for (const nestedKey of nestedZips) {
      try {
        const nestedData = unzipped[nestedKey];
        const nestedUnzipped = await unzipData(nestedData);
        // Merge nested entries into the main map
        unzipped = { ...unzipped, ...nestedUnzipped };
      } catch {
        // Skip nested zips that fail to extract
      }
    }

    onProgress?.({
      phase: "parsing",
      progress: 0.3,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    const decoder = new TextDecoder();
    const allEvents: MetadataEvent[] = [];

    // Route files to sub-parsers based on filename
    const entries = Object.keys(unzipped);
    const totalEntries = entries.length;

    for (let fi = 0; fi < totalEntries; fi++) {
      const key = entries[fi];
      // Skip directories and nested zip files themselves
      if (key.endsWith("/") || key.toLowerCase().endsWith(".zip")) continue;
      // Skip non-CSV files (e.g., Review profile.json)
      if (!key.toLowerCase().endsWith(".csv")) continue;

      const lowerKey = key.toLowerCase();
      const entry = unzipped[key];
      if (!entry) continue;

      try {
        const text = decoder.decode(entry);

        if (lowerKey.includes("app install activity")) {
          allEvents.push(...parseAppInstalls(text));
        } else if (lowerKey.includes("re-download")) {
          allEvents.push(...parseRedownloads(text));
        } else if (lowerKey.includes("purchase") && lowerKey.includes("history")) {
          allEvents.push(...parsePurchases(text));
        } else if (lowerKey.includes("click activity")) {
          allEvents.push(...parseClickActivity(text));
        } else if (lowerKey.includes("reviews")) {
          allEvents.push(...parseReviews(text));
        }
      } catch {
        // Skip files that fail to parse
      }

      onProgress?.({
        phase: "parsing",
        progress: 0.3 + 0.5 * ((fi + 1) / Math.max(totalEntries, 1)),
        eventsProcessed: totalEvents + allEvents.length,
        currentFile: key.split("/").pop() ?? key,
      });
    }

    // Sort all events by timestamp
    allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Yield in batches
    for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
      const batch = allEvents.slice(i, i + BATCH_SIZE);
      totalEvents += batch.length;
      yield { events: batch, aggregates: [] };

      onProgress?.({
        phase: "parsing",
        progress: 0.8 + 0.2 * (i / allEvents.length),
        eventsProcessed: totalEvents,
        currentFile: file.name,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    onProgress?.({
      phase: "parsing",
      progress: 1,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });
  }
}
