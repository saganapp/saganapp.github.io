import type { MetadataEvent } from "../types";
import { makeSpotifyEvent } from "./utils";

interface LibraryTrack {
  artist: string;
  album: string;
  track: string;
  uri: string;
}

interface LibraryData {
  tracks?: LibraryTrack[];
  albums?: { artist: string; album: string; uri: string }[];
  shows?: { name: string; publisher: string; uri: string }[];
  artists?: { name: string; uri: string }[];
  bannedTracks?: LibraryTrack[];
}

export function parseLibrary(data: LibraryData): MetadataEvent[] {
  const tracks = data.tracks ?? [];
  const albums = data.albums ?? [];
  const artists = data.artists ?? [];
  const shows = data.shows ?? [];
  const bannedTracks = data.bannedTracks ?? [];

  // Compute top artists from saved tracks
  const artistCounts = new Map<string, number>();
  for (const t of tracks) {
    if (t.artist) {
      artistCounts.set(t.artist, (artistCounts.get(t.artist) ?? 0) + 1);
    }
  }
  const topArtists = [...artistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  const bannedTrackList = bannedTracks.map((t) => ({
    artist: t.artist,
    track: t.track,
  }));

  return [
    makeSpotifyEvent("profile_update", new Date(), "You", [], {
      subSource: "library",
      savedTracks: tracks.length,
      savedAlbums: albums.length,
      savedArtists: artists.length,
      savedShows: shows.length,
      bannedTracks: bannedTracks.length,
      bannedTrackList,
      topArtists,
    }),
  ];
}
