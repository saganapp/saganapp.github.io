import type { MetadataEvent } from "../types";
import { makeTikTokEvent, parseTikTokDate } from "./utils";

interface FollowingEntry {
  Date?: string;
  UserName?: string;
}

export function parseTikTokFollowing(entries: FollowingEntry[] | null | undefined): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];
  for (const entry of entries) {
    const date = parseTikTokDate(entry.Date);
    if (!date) continue;
    const userName = entry.UserName ?? "Unknown";
    events.push(
      makeTikTokEvent("contact_added", date, "You", [userName]),
    );
  }
  return events;
}
