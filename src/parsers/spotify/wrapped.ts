import type { MetadataEvent } from "../types";
import { makeSpotifyEvent } from "./utils";

interface WrappedData {
  topArtists?: { numUniqueArtists?: number };
  topTracks?: { numUniqueTracks?: number };
  yearlyMetrics?: { totalMsListened?: number };
  topGenres?: { totalNumGenres?: number };
  listeningAge?: { listeningAge?: number };
  party?: {
    avgTrackPopularityScore?: number;
    percentMusicSkips?: number;
    weightedMsAvgTempo?: number;
    totalNumListeningDays?: number;
    streakNumListeningDays?: number;
    numArtistsDiscovered?: number;
  };
}

export function parseWrapped(data: WrappedData, year: number): MetadataEvent[] {
  const totalMsListened = data.yearlyMetrics?.totalMsListened ?? 0;
  const numUniqueArtists = data.topArtists?.numUniqueArtists ?? 0;
  const numUniqueTracks = data.topTracks?.numUniqueTracks ?? 0;
  const totalGenres = data.topGenres?.totalNumGenres ?? 0;
  const listeningAge = data.listeningAge?.listeningAge ?? null;
  const avgPopularity = data.party?.avgTrackPopularityScore != null
    ? Math.round(data.party.avgTrackPopularityScore * 100) / 100
    : null;
  const skipPercentage = data.party?.percentMusicSkips != null
    ? Math.round(data.party.percentMusicSkips * 10) / 10
    : null;
  const avgTempo = data.party?.weightedMsAvgTempo != null
    ? Math.round(data.party.weightedMsAvgTempo * 10) / 10
    : null;
  const totalListeningDays = data.party?.totalNumListeningDays ?? null;
  const longestStreak = data.party?.streakNumListeningDays ?? null;
  const artistsDiscovered = data.party?.numArtistsDiscovered ?? null;

  return [
    makeSpotifyEvent("profile_update", new Date(), "You", [], {
      subSource: "wrapped",
      year,
      totalMsListened,
      numUniqueArtists,
      numUniqueTracks,
      totalGenres,
      listeningAge,
      avgPopularity,
      skipPercentage,
      avgTempo,
      totalListeningDays,
      longestStreak,
      artistsDiscovered,
    }),
  ];
}
