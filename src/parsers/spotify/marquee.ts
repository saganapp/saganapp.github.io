import type { MetadataEvent } from "../types";
import { makeSpotifyEvent } from "./utils";

interface MarqueeEntry {
  artistName: string;
  segment: string;
}

export function parseMarquee(entries: MarqueeEntry[]): MetadataEvent[] {
  if (entries.length === 0) return [];

  // Count artists per segment
  const segmentCounts = new Map<string, number>();
  const superListenerArtists: string[] = [];

  for (const entry of entries) {
    segmentCounts.set(entry.segment, (segmentCounts.get(entry.segment) ?? 0) + 1);
    if (entry.segment === "Super Listeners") {
      superListenerArtists.push(entry.artistName);
    }
  }

  return [
    makeSpotifyEvent("profile_update", new Date(), "You", [], {
      subSource: "marquee",
      totalArtists: entries.length,
      segmentCounts: Object.fromEntries(segmentCounts),
      superListenerArtists,
    }),
  ];
}
