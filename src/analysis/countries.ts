import type { MetadataEvent, Platform } from "@/parsers/types";
import { resolveIps } from "@/utils/geoip";

export interface CountryData {
  countryCode: string;      // ISO 3166-1 alpha-2 (e.g. "ES")
  count: number;
  platforms: Platform[];
}

/** Synchronous: aggregate events that already have connCountry */
export function computeCountryData(events: MetadataEvent[]): CountryData[] {
  const map = new Map<string, { count: number; platforms: Set<Platform> }>();

  for (const e of events) {
    const cc = e.metadata.connCountry;
    if (typeof cc !== "string" || cc.length !== 2) continue;
    const upper = cc.toUpperCase();
    let entry = map.get(upper);
    if (!entry) {
      entry = { count: 0, platforms: new Set() };
      map.set(upper, entry);
    }
    entry.count++;
    entry.platforms.add(e.source);
  }

  return [...map.entries()]
    .map(([countryCode, { count, platforms }]) => ({
      countryCode,
      count,
      platforms: [...platforms],
    }))
    .sort((a, b) => b.count - a.count);
}

/** Async: also resolve raw IPs for events missing connCountry */
export async function computeCountryDataWithGeoIp(events: MetadataEvent[]): Promise<CountryData[]> {
  // 1. Direct aggregation for events with connCountry
  const map = new Map<string, { count: number; platforms: Set<Platform> }>();

  const ipEvents: { ip: string; source: Platform }[] = [];

  for (const e of events) {
    const cc = e.metadata.connCountry;
    if (typeof cc === "string" && cc.length === 2) {
      const upper = cc.toUpperCase();
      let entry = map.get(upper);
      if (!entry) {
        entry = { count: 0, platforms: new Set() };
        map.set(upper, entry);
      }
      entry.count++;
      entry.platforms.add(e.source);
    } else {
      // Check for raw IP
      const ip = (e.metadata.ip ?? e.metadata.ipAddr) as string | undefined;
      if (typeof ip === "string" && ip.includes(".")) {
        ipEvents.push({ ip, source: e.source });
      }
    }
  }

  // 2. Resolve IPs for events without connCountry
  if (ipEvents.length > 0) {
    const uniqueIps = [...new Set(ipEvents.map((e) => e.ip))];
    const resolved = await resolveIps(uniqueIps);

    for (const { ip, source } of ipEvents) {
      const cc = resolved.get(ip);
      if (!cc) continue;
      let entry = map.get(cc);
      if (!entry) {
        entry = { count: 0, platforms: new Set() };
        map.set(cc, entry);
      }
      entry.count++;
      entry.platforms.add(source);
    }
  }

  return [...map.entries()]
    .map(([countryCode, { count, platforms }]) => ({
      countryCode,
      count,
      platforms: [...platforms],
    }))
    .sort((a, b) => b.count - a.count);
}
