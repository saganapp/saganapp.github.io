import type { MetadataEvent, EventType } from "../types";
import { makeGarminEvent, parseGarminDate } from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface GarminRawEvent {
  eventType?: string;
  eventDateTime?: string;
  platformId?: string;
  sourceSystem?: string;
  locationCountry?: string;
  userAgent?: string;
  eventData?: Record<string, any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Event types to skip — device-sync or auto-generated, not user-triggered */
const SKIP_EVENT_TYPES = new Set([
  "CONNECT_USER_PREFERENCE",
  "IT_SSO_ACCOUNT_CREATION",
]);

/** Map Garmin event types to our EventType */
function mapEventType(garminType: string): EventType | null {
  // Skip non-user-triggered events
  if (SKIP_EVENT_TYPES.has(garminType)) return null;
  if (garminType.startsWith("CONNECT_DEVICE_SETTINGS_")) return null;

  // Wellness / fitness
  if (garminType === "CONNECT_HYDRATION") return "wellness_log";
  if (garminType === "CONNECT_WELLNESS_GOAL") return "wellness_log";
  if (garminType === "CONNECT_WORKOUT") return "wellness_log";
  if (garminType === "CONNECT_PROFILE_WEIGHT") return "wellness_log";

  // Social
  if (garminType === "CONNECT_CONVERSATION_COMMENT") return "message_sent";
  if (garminType === "CONNECT_CONVERSATION_LIKE") return "reaction";
  if (garminType === "CONNECT_CONNECTION_REQUEST") return "contact_added";

  // Profile
  if (garminType === "CONNECT_GEAR") return "profile_update";
  if (garminType === "CONNECT_PRIVACY_SETTINGS") return "profile_update";
  if (garminType.startsWith("CONNECT_PROFILE_")) return "profile_update";

  // Auth
  if (garminType === "IT_SSO_LOGIN") return "login";

  // Fallback — remaining CONNECT_ events that aren't skipped
  return "other";
}

export function parseGarminEvents(entries: GarminRawEvent[] | null | undefined): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const garminType = entry.eventType;
    if (!garminType) continue;

    const eventType = mapEventType(garminType);
    if (eventType === null) continue;

    const timestamp = parseGarminDate(entry.eventDateTime);
    if (!timestamp) continue;

    events.push(
      makeGarminEvent(eventType, timestamp, "You", [], {
        garminEventType: garminType,
        platform: entry.platformId,
        device: entry.sourceSystem,
        country: entry.locationCountry,
        action: entry.eventData?.EVENT_ACTION,
      }),
    );
  }

  return events;
}
