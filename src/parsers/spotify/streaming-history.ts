import type { MetadataEvent } from "../types";
import { makeSpotifyEvent } from "./utils";

/** Raw Spotify extended streaming history entry */
interface SpotifyStreamEntry {
  ts: string;
  ms_played: number;
  conn_country: string;
  ip_addr: string;
  platform: string;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;
  episode_name: string | null;
  episode_show_name: string | null;
  spotify_episode_uri: string | null;
  audiobook_title: string | null;
  audiobook_chapter_title: string | null;
  audiobook_uri: string | null;
  audiobook_chapter_uri: string | null;
  reason_start: string;
  reason_end: string;
  shuffle: boolean;
  skipped: boolean;
  offline: boolean;
  offline_timestamp: number | null;
  incognito_mode: boolean;
}

/** Minimum ms_played to count as a meaningful play (skip micro-plays under 3s) */
const MIN_MS_PLAYED = 3000;

function classifyContent(entry: SpotifyStreamEntry): "track" | "podcast" | "audiobook" | "unknown" {
  if (entry.master_metadata_track_name) return "track";
  if (entry.episode_name) return "podcast";
  if (entry.audiobook_title) return "audiobook";
  return "unknown";
}

function getContentName(entry: SpotifyStreamEntry): string {
  if (entry.master_metadata_track_name) {
    const artist = entry.master_metadata_album_artist_name ?? "Unknown Artist";
    return `${entry.master_metadata_track_name} — ${artist}`;
  }
  if (entry.episode_name) {
    return entry.episode_show_name
      ? `${entry.episode_name} (${entry.episode_show_name})`
      : entry.episode_name;
  }
  if (entry.audiobook_title) {
    return entry.audiobook_chapter_title
      ? `${entry.audiobook_title}: ${entry.audiobook_chapter_title}`
      : entry.audiobook_title;
  }
  return "Unknown content";
}

/** Normalize Spotify platform string to a short device label */
function normalizeDevice(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes("ios") || p.includes("iphone") || p.includes("ipad")) return "iOS";
  if (p.includes("android")) return "Android";
  if (p.includes("windows")) return "Windows";
  if (p.includes("os x") || p.includes("macos") || p.includes("macintosh")) return "macOS";
  if (p.includes("linux")) return "Linux";
  if (p.includes("web_player") || p.includes("web player")) return "Web Player";
  if (p.includes("cast") || p.includes("chromecast")) return "Chromecast";
  if (p.includes("sonos")) return "Sonos";
  if (p.includes("alexa") || p.includes("echo")) return "Alexa";
  if (p.includes("ps4") || p.includes("ps5") || p.includes("playstation")) return "PlayStation";
  if (p.includes("xbox")) return "Xbox";
  if (p.includes("smart tv") || p.includes("tv")) return "Smart TV";
  return platform;
}

export function parseStreamingHistory(entries: SpotifyStreamEntry[]): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    // Skip very short plays (accidental clicks, previews)
    if (entry.ms_played < MIN_MS_PLAYED) continue;

    const timestamp = new Date(entry.ts);
    if (isNaN(timestamp.getTime())) continue;

    const contentType = classifyContent(entry);
    // Skip unknown content (null metadata across all types)
    if (contentType === "unknown") continue;

    const metadata: Record<string, unknown> = {
      device: normalizeDevice(entry.platform),
      deviceRaw: entry.platform,
      msPlayed: entry.ms_played,
      contentType,
      contentName: getContentName(entry),
      connCountry: entry.conn_country,
      ipAddr: entry.ip_addr,
      shuffle: entry.shuffle,
      skipped: entry.skipped,
      offline: entry.offline,
      incognitoMode: entry.incognito_mode,
      reasonStart: entry.reason_start,
      reasonEnd: entry.reason_end,
    };

    // Add track-specific metadata
    if (contentType === "track") {
      metadata.trackName = entry.master_metadata_track_name;
      metadata.artistName = entry.master_metadata_album_artist_name;
      metadata.albumName = entry.master_metadata_album_album_name;
    } else if (contentType === "podcast") {
      metadata.episodeName = entry.episode_name;
      metadata.showName = entry.episode_show_name;
    } else if (contentType === "audiobook") {
      metadata.audiobookTitle = entry.audiobook_title;
      metadata.chapterTitle = entry.audiobook_chapter_title;
    }

    events.push(
      makeSpotifyEvent("media_played", timestamp, "You", [], metadata),
    );
  }

  return events;
}
