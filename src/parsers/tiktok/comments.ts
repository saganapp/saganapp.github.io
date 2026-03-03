import type { MetadataEvent } from "../types";
import { makeTikTokEvent, parseTikTokDate } from "./utils";

interface CommentEntry {
  Date?: string;
  Comment?: string;
}

/**
 * Parse TikTok Comments → message_sent events (subSource: "comment").
 */
export function parseTikTokComments(
  entries: CommentEntry[] | null | undefined,
): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];
  for (const entry of entries) {
    const date = parseTikTokDate(entry.Date);
    if (!date) continue;

    events.push(
      makeTikTokEvent("message_sent", date, "You", [], {
        subSource: "comment",
      }),
    );
  }
  return events;
}
