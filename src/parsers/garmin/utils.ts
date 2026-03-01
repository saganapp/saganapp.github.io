import type { MetadataEvent, EventType } from "../types";

let counter = 0;

export function makeEventId(): string {
  return `gm-${Date.now()}-${++counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

export function makeGarminEvent(
  eventType: EventType,
  timestamp: Date,
  actor: string,
  participants: string[],
  metadata: Record<string, unknown> = {},
): MetadataEvent {
  return {
    id: makeEventId(),
    source: "garmin",
    eventType,
    timestamp,
    actor,
    participants,
    metadata,
  };
}

/** Parse Garmin ISO 8601 dates — handles both "2025-10-03T14:42:34Z" and "2022-03-21T20:15:27.0" */
export function parseGarminDate(str: string | undefined | null): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
