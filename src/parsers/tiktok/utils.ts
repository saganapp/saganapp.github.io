import type { MetadataEvent, EventType } from "../types";

let counter = 0;

export function makeEventId(): string {
  return `tk-${Date.now()}-${++counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

export function makeTikTokEvent(
  eventType: EventType,
  timestamp: Date,
  actor: string,
  participants: string[],
  metadata: Record<string, unknown> = {},
): MetadataEvent {
  return {
    id: makeEventId(),
    source: "tiktok",
    eventType,
    timestamp,
    actor,
    participants,
    metadata,
  };
}

/** Parse TikTok date format "YYYY-MM-DD HH:MM:SS" → Date | null */
export function parseTikTokDate(str: string | undefined | null): Date | null {
  if (!str) return null;
  const d = new Date(str.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? null : d;
}
