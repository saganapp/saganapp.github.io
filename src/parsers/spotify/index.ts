import { unzip } from "fflate";
import type { MetadataEvent, DailyAggregate, ParseProgressCallback } from "../types";
import { resetIdCounter } from "./utils";
import { parseStreamingHistory } from "./streaming-history";

export interface SpotifyBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

const BATCH_SIZE = 1000;

/**
 * Parse a Spotify GDPR export ZIP.
 * Looks for Streaming_History_Audio_*.json and Streaming_History_Video_*.json files.
 */
export async function* parseSpotifyExport(
  files: File[],
  onProgress?: ParseProgressCallback,
): AsyncGenerator<SpotifyBatch> {
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

    const unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(data, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    onProgress?.({
      phase: "parsing",
      progress: 0.3,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    const decoder = new TextDecoder();

    // Find all streaming history files (audio + video)
    const historyKeys = Object.keys(unzipped).filter(
      (k) => /Streaming_History_(Audio|Video)_.*\.json$/i.test(k),
    );

    const allEvents: MetadataEvent[] = [];
    const totalFiles = historyKeys.length;

    for (let fi = 0; fi < totalFiles; fi++) {
      const key = historyKeys[fi];
      const entry = unzipped[key];
      if (!entry) continue;

      try {
        const json = JSON.parse(decoder.decode(entry));
        if (Array.isArray(json)) {
          allEvents.push(...parseStreamingHistory(json));
        }
      } catch {
        // Skip malformed JSON files
      }

      onProgress?.({
        phase: "parsing",
        progress: 0.3 + 0.5 * ((fi + 1) / totalFiles),
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
