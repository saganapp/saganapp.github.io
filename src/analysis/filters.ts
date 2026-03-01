import type { MetadataEvent, Platform } from "@/parsers/types";
import { USER_TRIGGERED_EVENTS } from "@/parsers/types";

export function filterUserTriggered(events: MetadataEvent[]): MetadataEvent[] {
  return events.filter((e) => USER_TRIGGERED_EVENTS.includes(e.eventType));
}

export function filterByPlatform(events: MetadataEvent[], platforms: Platform[]): MetadataEvent[] {
  return events.filter((e) => platforms.includes(e.source));
}

export function filterByDateRange(events: MetadataEvent[], start: Date, end: Date): MetadataEvent[] {
  return events.filter((e) => e.timestamp >= start && e.timestamp <= end);
}
