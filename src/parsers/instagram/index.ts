import type { MetadataEvent, DailyAggregate, ParseProgressCallback } from "../types";
import { resetIdCounter } from "./utils";
import { extractDisplayName } from "./personal-info";
import { parseInstagramMessages } from "./messages";
import { parseInstagramLikes } from "./likes";
import { streamInstagramFiles, type ExtractedFile } from "./zip-extractor";

export interface InstagramBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

/**
 * Parse an Instagram GDPR archive (ZIP containing HTML files).
 *
 * Two-pass approach:
 * 1. Stream all files, extracting personal_information.html first for display name
 * 2. Parse message and likes files using the display name for sent/received classification
 *
 * Since ZIP entries come in archive order (not guaranteed), we defer message
 * parsing until we have the display name.
 */
export async function* parseInstagramArchive(
  files: File[],
  onProgress?: ParseProgressCallback,
): AsyncGenerator<InstagramBatch> {
  resetIdCounter();
  let totalEvents = 0;

  const zips = files.filter((f) => f.name.toLowerCase().endsWith(".zip"));

  for (const zip of zips) {
    onProgress?.({
      phase: "extracting",
      progress: 0,
      eventsProcessed: totalEvents,
      currentFile: zip.name,
    });

    let displayName = "";
    const deferredFiles: ExtractedFile[] = [];

    const onChunkRead = (bytesRead: number, totalBytes: number) => {
      onProgress?.({
        phase: "extracting",
        progress: 0.5 * (bytesRead / totalBytes),
        eventsProcessed: totalEvents,
        currentFile: zip.name,
      });
    };

    // Stream and collect files
    for await (const extracted of streamInstagramFiles(zip, onChunkRead)) {
      if (extracted.name.includes("personal_information/personal_information/personal_information.html")) {
        const html = new TextDecoder().decode(extracted.data);
        const info = extractDisplayName(html);
        displayName = info.displayName ?? info.username ?? "";
      } else {
        deferredFiles.push(extracted);
      }
    }

    onProgress?.({
      phase: "parsing",
      progress: 0.5,
      eventsProcessed: totalEvents,
      currentFile: zip.name,
    });

    // Process deferred files
    const totalFiles = deferredFiles.length;
    for (let i = 0; i < totalFiles; i++) {
      const { name, data } = deferredFiles[i];
      const html = new TextDecoder().decode(data);
      let events: MetadataEvent[] = [];

      if (name.includes("/messages/") && name.includes("message_")) {
        events = parseInstagramMessages(html, displayName);
      } else if (name.includes("/likes/liked_posts.html")) {
        events = parseInstagramLikes(html);
      }

      if (events.length > 0) {
        // Yield in batches of 1000
        for (let j = 0; j < events.length; j += 1000) {
          const batch = events.slice(j, j + 1000);
          totalEvents += batch.length;
          yield { events: batch, aggregates: [] };
        }
      }

      onProgress?.({
        phase: "parsing",
        progress: 0.5 + 0.5 * ((i + 1) / totalFiles),
        eventsProcessed: totalEvents,
        currentFile: name,
      });

      // Yield to main thread
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    onProgress?.({
      phase: "parsing",
      progress: 1,
      eventsProcessed: totalEvents,
      currentFile: zip.name,
    });
  }
}
