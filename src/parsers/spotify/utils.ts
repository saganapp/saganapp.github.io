import type { MetadataEvent, EventType } from "../types";

let counter = 0;

export function makeEventId(): string {
  return `sp-${Date.now()}-${++counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

export function makeSpotifyEvent(
  eventType: EventType,
  timestamp: Date,
  actor: string,
  participants: string[],
  metadata: Record<string, unknown> = {},
): MetadataEvent {
  return {
    id: makeEventId(),
    source: "spotify",
    eventType,
    timestamp,
    actor,
    participants,
    metadata,
  };
}
