import { unzip } from "fflate";
import type { MetadataEvent, DailyAggregate, ParseProgressCallback } from "../types";
import { resetIdCounter } from "./utils";
import { parseWatchHistory } from "./watch-history";
import { parseTikTokLikes } from "./likes";
import { parseTikTokSearches } from "./searches";
import { parseTikTokFollowing } from "./following";
import { parseOffTikTokActivity } from "./off-tiktok";

export interface TikTokBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface TikTokData {
  "Your Activity"?: {
    "Watch History"?: { VideoList?: any[] };
    Searches?: { SearchList?: any[] };
    "Off TikTok Activity"?: { OffTikTokActivityDataList?: any[] };
  };
  "Likes and Favorites"?: {
    "Like List"?: { ItemFavoriteList?: any[] };
  };
  "Profile And Settings"?: {
    Following?: { Following?: any[] };
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const BATCH_SIZE = 1000;

/**
 * Parse a TikTok GDPR export.
 * Accepts .json files (user_data_tiktok.json) or .zip files containing it.
 */
export async function* parseTikTokExport(
  files: File[],
  onProgress?: ParseProgressCallback,
): AsyncGenerator<TikTokBatch> {
  resetIdCounter();
  let totalEvents = 0;

  for (const file of files) {
    onProgress?.({
      phase: "reading",
      progress: 0,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    let jsonText: string;

    if (file.name.toLowerCase().endsWith(".json")) {
      jsonText = await file.text();
    } else if (file.name.toLowerCase().endsWith(".zip")) {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      jsonText = await new Promise<string>((resolve, reject) => {
        unzip(data, (err, unzipped) => {
          if (err) {
            reject(err);
            return;
          }
          const key = Object.keys(unzipped).find(
            (k) => k === "user_data_tiktok.json" || k.endsWith("/user_data_tiktok.json"),
          );
          if (!key) {
            reject(new Error("No user_data_tiktok.json found in ZIP"));
            return;
          }
          resolve(new TextDecoder().decode(unzipped[key]));
        });
      });
    } else {
      continue;
    }

    onProgress?.({
      phase: "parsing",
      progress: 0.3,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    const parsed: TikTokData = JSON.parse(jsonText);

    // Collect all events from each section
    const allEvents: MetadataEvent[] = [];

    const watchHistory = parsed["Your Activity"]?.["Watch History"]?.VideoList;
    allEvents.push(...parseWatchHistory(watchHistory));

    const likes = parsed["Likes and Favorites"]?.["Like List"]?.ItemFavoriteList;
    allEvents.push(...parseTikTokLikes(likes));

    const searches = parsed["Your Activity"]?.Searches?.SearchList;
    allEvents.push(...parseTikTokSearches(searches));

    const following = parsed["Profile And Settings"]?.Following?.Following;
    allEvents.push(...parseTikTokFollowing(following));

    const offTikTok = parsed["Your Activity"]?.["Off TikTok Activity"]?.OffTikTokActivityDataList;
    allEvents.push(...parseOffTikTokActivity(offTikTok));

    // Sort by timestamp
    allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Yield in batches
    for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
      const batch = allEvents.slice(i, i + BATCH_SIZE);
      totalEvents += batch.length;
      yield { events: batch, aggregates: [] };

      onProgress?.({
        phase: "parsing",
        progress: 0.3 + 0.7 * (i / allEvents.length),
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
