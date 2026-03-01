import type { MetadataEvent } from "../types";
import { makeTikTokEvent, parseTikTokDate } from "./utils";

interface SearchEntry {
  Date?: string;
  SearchTerm?: string;
}

export function parseTikTokSearches(entries: SearchEntry[] | null | undefined): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];
  for (const entry of entries) {
    const date = parseTikTokDate(entry.Date);
    if (!date) continue;
    events.push(
      makeTikTokEvent("search", date, "You", [], {
        searchTerm: entry.SearchTerm ?? "",
      }),
    );
  }
  return events;
}
