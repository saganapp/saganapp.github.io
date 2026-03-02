import { unzip } from "fflate";
import type { MetadataEvent, DailyAggregate, ParseProgressCallback } from "../types";
import { resetIdCounter } from "./utils";
import { parseStreamingHistory } from "./streaming-history";
import { parseLibrary } from "./library";
import { parseSearchQueries } from "./search-queries";
import { parsePlaylists } from "./playlists";
import { parseFollow } from "./follow";
import { parseUserdata } from "./userdata";
import { parseMessages } from "./messages";
import { parseWrapped } from "./wrapped";
import { parseMarquee } from "./marquee";

export interface SpotifyBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

const BATCH_SIZE = 1000;

const ACCOUNT_DATA_PREFIX = "Spotify Account Data/";

/**
 * Parse a Spotify GDPR export ZIP.
 * Handles both the extended streaming history archive and the account data archive.
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
    const allEvents: MetadataEvent[] = [];

    // Helper to parse JSON from a zip entry
    const parseJson = (key: string) => {
      const entry = unzipped[key];
      if (!entry) return null;
      try {
        return JSON.parse(decoder.decode(entry));
      } catch {
        return null;
      }
    };

    // 1. Extended streaming history files (Streaming_History_Audio/Video_*)
    const historyKeys = Object.keys(unzipped).filter(
      (k) => /Streaming_History_(Audio|Video)_.*\.json$/i.test(k),
    );

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
        progress: 0.3 + 0.5 * ((fi + 1) / Math.max(totalFiles, 1)),
        eventsProcessed: totalEvents + allEvents.length,
        currentFile: key.split("/").pop() ?? key,
      });
    }

    // 2. Account data files (Spotify Account Data/*)
    // Extract username from Userdata first (needed for message direction)
    let username: string | undefined;
    const userdataKey = Object.keys(unzipped).find(
      (k) => k === `${ACCOUNT_DATA_PREFIX}Userdata.json`,
    );
    if (userdataKey) {
      const userdataJson = parseJson(userdataKey);
      if (userdataJson && typeof userdataJson === "object" && userdataJson.username) {
        username = userdataJson.username;
        allEvents.push(...parseUserdata(userdataJson));
      }
    }

    for (const key of Object.keys(unzipped)) {
      if (!key.startsWith(ACCOUNT_DATA_PREFIX)) continue;
      if (!key.endsWith(".json")) continue;

      const filename = key.slice(ACCOUNT_DATA_PREFIX.length);

      // Skip simple streaming history (duplicates extended history)
      if (/^StreamingHistory_(music|podcast)_\d+\.json$/i.test(filename)) continue;
      // Already handled above
      if (filename === "Userdata.json") continue;

      const json = parseJson(key);
      if (!json) continue;

      try {
        if (filename === "YourLibrary.json") {
          allEvents.push(...parseLibrary(json));
        } else if (filename === "SearchQueries.json" && Array.isArray(json)) {
          allEvents.push(...parseSearchQueries(json));
        } else if (filename === "Playlist1.json") {
          allEvents.push(...parsePlaylists(json));
        } else if (filename === "Follow.json") {
          allEvents.push(...parseFollow(json));
        } else if (filename === "MessageData.json") {
          allEvents.push(...parseMessages(json, username));
        } else if (/^Wrapped\d{4}\.json$/.test(filename)) {
          const year = parseInt(filename.match(/\d{4}/)![0], 10);
          allEvents.push(...parseWrapped(json, year));
        } else if (filename === "Marquee.json" && Array.isArray(json)) {
          allEvents.push(...parseMarquee(json));
        }
      } catch {
        // Skip files that fail to parse
      }
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
