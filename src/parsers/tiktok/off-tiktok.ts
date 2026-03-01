import type { MetadataEvent } from "../types";
import { makeTikTokEvent, parseTikTokDate } from "./utils";

interface OffTikTokEntry {
  TimeStamp?: string;
  Source?: string;
  Event?: string;
}

export function parseOffTikTokActivity(entries: OffTikTokEntry[] | null | undefined): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];
  for (const entry of entries) {
    const date = parseTikTokDate(entry.TimeStamp);
    if (!date) continue;
    events.push(
      makeTikTokEvent("ad_interaction", date, "You", [], {
        source: entry.Source ?? "",
        event: entry.Event ?? "",
      }),
    );
  }
  return events;
}
