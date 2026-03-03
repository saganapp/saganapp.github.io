import type { MetadataEvent } from "../types";
import { makeTikTokEvent, parseTikTokDate } from "./utils";

interface PostEntry {
  Date?: string;
  Link?: string;
  Likes?: string;
}

/**
 * Parse TikTok Posts → media_shared events.
 */
export function parseTikTokPosts(
  entries: PostEntry[] | null | undefined,
): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];
  for (const entry of entries) {
    const date = parseTikTokDate(entry.Date);
    if (!date) continue;

    events.push(
      makeTikTokEvent("media_shared", date, "You", [], {
        link: entry.Link,
      }),
    );
  }
  return events;
}
