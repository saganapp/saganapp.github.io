import type { MetadataEvent } from "../types";
import { makeTikTokEvent, parseTikTokDate } from "./utils";

interface LikeEntry {
  date?: string;
  Date?: string;
  link?: string;
  Link?: string;
}

export function parseTikTokLikes(entries: LikeEntry[] | null | undefined): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];
  for (const entry of entries) {
    const dateStr = entry.date ?? entry.Date;
    const date = parseTikTokDate(dateStr);
    if (!date) continue;
    events.push(
      makeTikTokEvent("reaction", date, "You", [], {
        link: entry.link ?? entry.Link ?? "",
      }),
    );
  }
  return events;
}
