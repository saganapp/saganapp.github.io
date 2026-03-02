import type { MetadataEvent } from "../types";
import { makeSpotifyEvent } from "./utils";

interface PlaylistEntry {
  name: string;
  lastModifiedDate: string;
  items: unknown[];
  collaborators: string[];
  numberOfFollowers?: number;
}

interface PlaylistData {
  playlists?: PlaylistEntry[];
}

export function parsePlaylists(data: PlaylistData): MetadataEvent[] {
  const playlists = data.playlists ?? [];
  const events: MetadataEvent[] = [];

  for (const p of playlists) {
    const timestamp = new Date(p.lastModifiedDate);
    if (isNaN(timestamp.getTime())) continue;

    events.push(
      makeSpotifyEvent("profile_update", timestamp, "You", [], {
        subSource: "playlist",
        playlistName: p.name,
        trackCount: p.items.length,
        collaboratorCount: p.collaborators.length,
        followerCount: p.numberOfFollowers ?? 0,
        isCollaborative: p.collaborators.length > 0,
      }),
    );
  }

  return events;
}
