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

/** Parse epoch milliseconds (e.g. activity beginTimestamp) */
export function parseEpochMs(value: number | undefined | null): Date | null {
  if (value == null || !isFinite(value)) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse Garmin [year, month, day] array format (e.g. lifestyle logging dates) */
export function parseGarminDateArray(arr: number[] | undefined | null): Date | null {
  if (!arr || !Array.isArray(arr) || arr.length < 3) return null;
  const [year, month, day] = arr;
  const d = new Date(year, month - 1, day, 12, 0, 0); // noon to avoid TZ issues
  return isNaN(d.getTime()) ? null : d;
}

/** Parse Garmin long date format (e.g. "Sun Oct 12 17:38:10 GMT 2025") */
export function parseGarminLongDate(str: string | undefined | null): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse English text dates (e.g. "March 16, 2025") */
export function parseGarminTextDate(str: string | undefined | null): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
