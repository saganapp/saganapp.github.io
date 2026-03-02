import type { MetadataEvent } from "../types";
import { makeSpotifyEvent } from "./utils";

interface SearchQueryEntry {
  platform: string;
  searchTime: string;
  searchQuery: string;
  searchInteractionURIs: string[];
}

/** Normalize Spotify device platform string */
function normalizeDevice(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes("iphone") || p === "iphone") return "iOS";
  if (p.includes("ipad")) return "iPad";
  if (p.includes("android")) return "Android";
  if (p.includes("windows") || p === "windows") return "Windows";
  if (p.includes("os x") || p.includes("macos")) return "macOS";
  if (p.includes("linux")) return "Linux";
  if (p.includes("web")) return "Web Player";
  return platform;
}

export function parseSearchQueries(entries: SearchQueryEntry[]): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    // Strip timezone suffix like "[UTC]" before parsing
    const timeStr = entry.searchTime.replace(/\[.*\]$/, "");
    const timestamp = new Date(timeStr);
    if (isNaN(timestamp.getTime())) continue;

    events.push(
      makeSpotifyEvent("search", timestamp, "You", [], {
        subSource: "spotify_search",
        searchQuery: entry.searchQuery,
        device: normalizeDevice(entry.platform),
        hasInteraction: entry.searchInteractionURIs.length > 0,
      }),
    );
  }

  return events;
}
