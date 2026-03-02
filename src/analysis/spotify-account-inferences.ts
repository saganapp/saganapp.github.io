import type { MetadataEvent } from "@/parsers/types";
import type { InferenceCard, DashboardStats } from "@/hooks/use-dashboard-data";

/** Filter to Spotify events with a specific subSource */
function spotifySub(events: MetadataEvent[], subSource: string): MetadataEvent[] {
  return events.filter(
    (e) => e.source === "spotify" && e.metadata.subSource === subSource,
  );
}

/**
 * Search Behavior: how many queries, device distribution, abandoned searches.
 * Every typo and abandoned search is logged.
 */
export function computeSearchBehavior(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange) return null;

  const searches = spotifySub(events, "spotify_search");
  if (searches.length < 10) return null;

  const abandoned = searches.filter((e) => e.metadata.hasInteraction === false).length;
  const abandonedPct = Math.round((abandoned / searches.length) * 100);

  const days = Math.max(
    1,
    (stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const perDay = Math.round((searches.length / days) * 10) / 10;

  return {
    id: "spotify-search-behavior",
    icon: "search",
    titleKey: "inference.spotifySearch.title",
    titleParams: { total: searches.length, perDay },
    descKey: "inference.spotifySearch.desc",
    descParams: { total: searches.length, abandoned, abandonedPct },
    privacyKey: "inference.spotifySearch.privacy",
  };
}

/**
 * Library Curation: saved tracks, banned tracks, top artists.
 * Banned tracks reveal what you explicitly reject.
 */
export function computeLibraryCuration(
  events: MetadataEvent[],
): InferenceCard | null {
  const libs = spotifySub(events, "library");
  if (libs.length === 0) return null;

  const lib = libs[0];
  const savedTracks = (lib.metadata.savedTracks as number) ?? 0;
  const bannedTracks = (lib.metadata.bannedTracks as number) ?? 0;
  const savedArtists = (lib.metadata.savedArtists as number) ?? 0;
  const topArtists = (lib.metadata.topArtists as string[]) ?? [];

  if (savedTracks < 5) return null;

  return {
    id: "library-curation",
    icon: "headphones",
    titleKey: "inference.libraryCuration.title",
    titleParams: { tracks: savedTracks, artists: savedArtists },
    descKey: "inference.libraryCuration.desc",
    descParams: {
      tracks: savedTracks,
      banned: bannedTracks,
      topArtists: topArtists.slice(0, 5).join(", "),
    },
    privacyKey: "inference.libraryCuration.privacy",
  };
}

/**
 * PII Exposure: how many personal data fields Spotify stores, for how long.
 */
export function computeSpotifyPiiExposure(
  events: MetadataEvent[],
): InferenceCard | null {
  const userdata = spotifySub(events, "userdata");
  if (userdata.length === 0) return null;

  const u = userdata[0];
  const piiFieldCount = (u.metadata.piiFieldCount as number) ?? 0;
  const accountAge = (u.metadata.accountAge as number) ?? 0;
  const country = (u.metadata.country as string) ?? "unknown";

  if (piiFieldCount === 0) return null;

  return {
    id: "spotify-pii-exposure",
    icon: "circle-dot",
    titleKey: "inference.spotifyPii.title",
    titleParams: { fields: piiFieldCount, years: accountAge },
    descKey: "inference.spotifyPii.desc",
    descParams: { fields: piiFieldCount, years: accountAge, country },
    privacyKey: "inference.spotifyPii.privacy",
  };
}

/**
 * Social Graph: follow/follower ratio, linking listening identity to real people.
 */
export function computeSpotifySocialGraph(
  events: MetadataEvent[],
): InferenceCard | null {
  const follows = spotifySub(events, "follow");
  if (follows.length === 0) return null;

  const f = follows[0];
  const followingCount = (f.metadata.followingCount as number) ?? 0;
  const followerCount = (f.metadata.followerCount as number) ?? 0;

  if (followingCount === 0 && followerCount === 0) return null;

  const ratio = followerCount > 0
    ? Math.round((followingCount / followerCount) * 100) / 100
    : 0;

  return {
    id: "spotify-social-graph",
    icon: "users",
    titleKey: "inference.spotifySocial.title",
    titleParams: { following: followingCount, followers: followerCount },
    descKey: "inference.spotifySocial.desc",
    descParams: { following: followingCount, followers: followerCount, ratio },
    privacyKey: "inference.spotifySocial.privacy",
  };
}

/**
 * Playlist Identity: collaborative playlists link you to social circles.
 */
export function computePlaylistIdentity(
  events: MetadataEvent[],
): InferenceCard | null {
  const playlists = spotifySub(events, "playlist");
  if (playlists.length < 2) return null;

  const totalPlaylists = playlists.length;
  const totalTracks = playlists.reduce(
    (sum, p) => sum + ((p.metadata.trackCount as number) ?? 0), 0,
  );
  const collaborative = playlists.filter(
    (p) => p.metadata.isCollaborative === true,
  ).length;

  return {
    id: "playlist-identity",
    icon: "bar-chart",
    titleKey: "inference.playlistIdentity.title",
    titleParams: { count: totalPlaylists, tracks: totalTracks },
    descKey: "inference.playlistIdentity.desc",
    descParams: {
      count: totalPlaylists,
      tracks: totalTracks,
      collaborative,
    },
    privacyKey: "inference.playlistIdentity.privacy",
  };
}

/**
 * Wrapped Profile: listening age, popularity score, and inferred personality traits.
 */
export function computeSpotifyWrappedProfile(
  events: MetadataEvent[],
): InferenceCard | null {
  const wrapped = spotifySub(events, "wrapped");
  if (wrapped.length === 0) return null;

  const w = wrapped[0];
  const year = (w.metadata.year as number) ?? 0;
  const totalMsListened = (w.metadata.totalMsListened as number) ?? 0;
  const totalHours = Math.round(totalMsListened / 3_600_000);
  const numUniqueArtists = (w.metadata.numUniqueArtists as number) ?? 0;
  const listeningAge = w.metadata.listeningAge as number | null;
  const avgPopularity = w.metadata.avgPopularity as number | null;
  const totalListeningDays = (w.metadata.totalListeningDays as number) ?? 0;

  if (totalHours < 1) return null;

  return {
    id: "spotify-wrapped-profile",
    icon: "headphones",
    titleKey: "inference.wrappedProfile.title",
    titleParams: { year, hours: totalHours },
    descKey: "inference.wrappedProfile.desc",
    descParams: {
      artists: numUniqueArtists,
      days: totalListeningDays,
      listeningAge: listeningAge ?? "N/A",
      popularity: avgPopularity != null ? Math.round(avgPopularity * 100) : "N/A",
    },
    privacyKey: "inference.wrappedProfile.privacy",
  };
}

/**
 * Marquee Segments: how Spotify categorizes you for record label marketing.
 */
export function computeSpotifyMarqueeSegments(
  events: MetadataEvent[],
): InferenceCard | null {
  const marquees = spotifySub(events, "marquee");
  if (marquees.length === 0) return null;

  const m = marquees[0];
  const totalArtists = (m.metadata.totalArtists as number) ?? 0;
  const segmentCounts = (m.metadata.segmentCounts as Record<string, number>) ?? {};
  const superListenerArtists = (m.metadata.superListenerArtists as string[]) ?? [];

  if (totalArtists < 5) return null;

  const segments = Object.entries(segmentCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name}: ${count}`)
    .join(", ");

  const superCount = superListenerArtists.length;

  return {
    id: "spotify-marquee-segments",
    icon: "trending-up",
    titleKey: "inference.marqueeSegments.title",
    titleParams: { total: totalArtists },
    descKey: "inference.marqueeSegments.desc",
    descParams: { segments, superCount },
    privacyKey: "inference.marqueeSegments.privacy",
  };
}
