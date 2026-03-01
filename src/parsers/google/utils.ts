import type { MetadataEvent, EventType } from "../types";

let counter = 0;

export function makeEventId(): string {
  return `g-${Date.now()}-${++counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

/**
 * Parse a timestamp string into a Date. Handles:
 * - ISO 8601 (from Google JSON)
 * - Unix microseconds (from some Google exports)
 * - RFC 2822 (from mbox)
 */
export function parseTimestamp(value: string | number): Date | null {
  if (typeof value === "number") {
    // Microseconds → milliseconds
    return new Date(value > 1e15 ? value / 1000 : value);
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function makeEvent(
  eventType: EventType,
  timestamp: Date,
  actor: string,
  participants: string[],
  metadata: Record<string, unknown> = {},
): MetadataEvent {
  return {
    id: makeEventId(),
    source: "google",
    eventType,
    timestamp,
    actor,
    participants,
    metadata,
  };
}

const textDecoder = new TextDecoder();

export function decodeUtf8(data: Uint8Array): string {
  return textDecoder.decode(data);
}
