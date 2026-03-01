import type { MetadataEvent } from "../types";
import { makeEvent, parseTimestamp, decodeUtf8 } from "./utils";

interface LocationRecord {
  timestampMs?: string;
  timestamp?: string;
  latitudeE7?: number;
  longitudeE7?: number;
  source?: string;
  deviceTag?: number;
}

interface LocationHistoryJson {
  locations?: LocationRecord[];
}

/**
 * Parse Google Location History JSON.
 * Emits `location` events with only timestamps — no coordinates stored (privacy).
 */
export function parseLocationHistory(
  data: Uint8Array,
): MetadataEvent[] {
  const json = decodeUtf8(data);
  let parsed: LocationHistoryJson;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  const locations = parsed.locations;
  if (!Array.isArray(locations)) return [];

  const events: MetadataEvent[] = [];

  for (const loc of locations) {
    const rawTs = loc.timestampMs ?? loc.timestamp;
    if (!rawTs) continue;

    // timestampMs is a string of milliseconds, timestamp is ISO
    const ts = loc.timestampMs
      ? parseTimestamp(Number(loc.timestampMs))
      : parseTimestamp(rawTs);
    if (!ts) continue;

    events.push(
      makeEvent("location", ts, "me", [], {
        subSource: "Location History",
        source: loc.source,
      }),
    );
  }

  return events;
}
