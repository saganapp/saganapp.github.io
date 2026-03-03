import type { MetadataEvent } from "../types";
import { makeTikTokEvent, parseTikTokDate } from "./utils";

interface LoginEntry {
  Date?: string;
  IP?: string;
  DeviceModel?: string;
  DeviceSystem?: string;
  NetworkType?: string;
  Carrier?: string;
}

/**
 * Parse TikTok Login History → login events.
 */
export function parseTikTokLoginHistory(
  entries: LoginEntry[] | null | undefined,
): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];
  for (const entry of entries) {
    const date = parseTikTokDate(entry.Date);
    if (!date) continue;

    events.push(
      makeTikTokEvent("login", date, "You", [], {
        ip: entry.IP,
        deviceModel: entry.DeviceModel,
        deviceSystem: entry.DeviceSystem,
        networkType: entry.NetworkType,
        carrier: entry.Carrier,
      }),
    );
  }
  return events;
}
