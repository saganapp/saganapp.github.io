import type { MetadataEvent } from "../types";
import { makeGarminEvent, parseGarminDate } from "./utils";

interface GarminComment {
  createDate?: string;
  body?: string;
}

export function parseGarminComments(entries: GarminComment[] | null | undefined): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const timestamp = parseGarminDate(entry.createDate);
    if (!timestamp) continue;

    events.push(
      makeGarminEvent("message_sent", timestamp, "You", [], {
        garminEventType: "CONNECT_CONVERSATION_COMMENT",
        hasBody: !!entry.body,
      }),
    );
  }

  return events;
}

export function parseGarminLikes(entries: string[] | null | undefined): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];

  for (const dateStr of entries) {
    const timestamp = parseGarminDate(dateStr);
    if (!timestamp) continue;

    events.push(
      makeGarminEvent("reaction", timestamp, "You", [], {
        garminEventType: "CONNECT_CONVERSATION_LIKE",
      }),
    );
  }

  return events;
}
