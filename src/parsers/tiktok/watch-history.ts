import type { MetadataEvent } from "../types";
import { makeTikTokEvent, parseTikTokDate } from "./utils";

interface WatchHistoryEntry {
  Date?: string;
  Link?: string;
}

export function parseWatchHistory(entries: WatchHistoryEntry[] | null | undefined): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];
  for (const entry of entries) {
    const date = parseTikTokDate(entry.Date);
    if (!date) continue;
    events.push(
      makeTikTokEvent("browsing", date, "You", [], {
        link: entry.Link ?? "",
      }),
    );
  }
  return events;
}
