import type { MetadataEvent, EventType } from "../types";

let counter = 0;

export function makeEventId(): string {
  return `wa-${Date.now()}-${++counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

export function makeWhatsAppEvent(
  eventType: EventType,
  timestamp: Date,
  actor: string,
  participants: string[],
  metadata: Record<string, unknown> = {},
): MetadataEvent {
  return {
    id: makeEventId(),
    source: "whatsapp",
    eventType,
    timestamp,
    actor,
    participants,
    metadata,
  };
}

/** Convert a unix epoch (seconds) to Date, returning null for 0 or invalid values */
export function fromUnixSeconds(ts: number | undefined | null): Date | null {
  if (!ts || ts <= 0) return null;
  const d = new Date(ts * 1000);
  return isNaN(d.getTime()) ? null : d;
}
