import type { MetadataEvent } from "@/parsers/types";
import type { InferenceCard, DashboardStats } from "@/hooks/use-dashboard-data";
import { getDateKey } from "@/utils/time";

/** Filter to Spotify media_played events */
function spotifyPlays(events: MetadataEvent[]): MetadataEvent[] {
  return events.filter(
    (e) => e.source === "spotify" && e.eventType === "media_played",
  );
}

/**
 * Listening Schedule: peak hours, avg hours/day, routine pattern detection.
 * Infers commute times, workout windows, and wind-down periods.
 */
export function computeListeningSchedule(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange) return null;

  const plays = spotifyPlays(events);
  if (plays.length < 50) return null;

  // Hourly distribution
  const hourlyCounts = new Array(24).fill(0);
  const hourlyMs = new Array(24).fill(0);
  const days = new Set<string>();

  for (const e of plays) {
    const hour = e.timestamp.getHours();
    hourlyCounts[hour]++;
    hourlyMs[hour] += (e.metadata.msPlayed as number) ?? 0;
    days.add(getDateKey(e.timestamp));
  }

  const peakHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));
  const totalMs = hourlyMs.reduce((a: number, b: number) => a + b, 0);
  const totalDays = Math.max(1, days.size);
  const hoursPerDay = Math.round((totalMs / totalDays / 3_600_000) * 10) / 10;

  // Detect pattern from peak hour
  let pattern: string;
  if (peakHour >= 6 && peakHour <= 9) pattern = "morning commute";
  else if (peakHour >= 10 && peakHour <= 14) pattern = "midday";
  else if (peakHour >= 15 && peakHour <= 18) pattern = "afternoon/commute";
  else if (peakHour >= 19 && peakHour <= 22) pattern = "evening wind-down";
  else pattern = "late-night";

  return {
    id: "listening-schedule",
    icon: "headphones",
    titleKey: "inference.listeningSchedule.title",
    titleParams: {
      peakHour: `${String(peakHour).padStart(2, "0")}:00`,
      hoursPerDay,
    },
    descKey: "inference.listeningSchedule.desc",
    descParams: {
      total: plays.length,
      days: totalDays,
      peakHour: `${String(peakHour).padStart(2, "0")}:00`,
      pattern,
    },
    privacyKey: "inference.listeningSchedule.privacy",
  };
}

/**
 * Skip Rate: percentage of tracks skipped and avg listen duration before skip.
 * Reveals attention span and decisiveness.
 */
export function computeSkipRate(
  events: MetadataEvent[],
): InferenceCard | null {
  const plays = spotifyPlays(events);
  if (plays.length < 50) return null;

  // Only consider music tracks for skip rate
  const tracks = plays.filter((e) => e.metadata.contentType === "track");
  if (tracks.length < 30) return null;

  const skipped = tracks.filter((e) => e.metadata.skipped === true);
  const skipPct = Math.round((skipped.length / tracks.length) * 100);

  let avgSkipMs = 0;
  if (skipped.length > 0) {
    const totalSkipMs = skipped.reduce(
      (sum, e) => sum + ((e.metadata.msPlayed as number) ?? 0), 0,
    );
    avgSkipMs = totalSkipMs / skipped.length;
  }
  const avgSkipSec = Math.round(avgSkipMs / 1000);

  if (skipPct < 5) return null; // Not interesting if barely skipping

  return {
    id: "skip-rate",
    icon: "timer",
    titleKey: "inference.skipRate.title",
    titleParams: { skipPct },
    descKey: "inference.skipRate.desc",
    descParams: { total: tracks.length, skipped: skipped.length, avgSkipSec },
    privacyKey: "inference.skipRate.privacy",
  };
}

/**
 * Incognito Listening: what percentage of plays are in private mode.
 * The act of hiding reveals something about what's being hidden.
 */
export function computeIncognitoListening(
  events: MetadataEvent[],
): InferenceCard | null {
  const plays = spotifyPlays(events);
  if (plays.length < 50) return null;

  const incognito = plays.filter((e) => e.metadata.incognitoMode === true);
  const pct = Math.round((incognito.length / plays.length) * 100);

  if (pct < 1) return null; // Not interesting if no incognito usage

  return {
    id: "incognito-listening",
    icon: "circle-dot",
    titleKey: "inference.incognitoListening.title",
    titleParams: { pct },
    descKey: "inference.incognitoListening.desc",
    descParams: { count: incognito.length, total: plays.length },
    privacyKey: "inference.incognitoListening.privacy",
  };
}

/**
 * Content Mix: music vs podcasts vs audiobooks ratio.
 * Reveals personality traits and information-seeking behavior.
 */
export function computeContentMix(
  events: MetadataEvent[],
): InferenceCard | null {
  const plays = spotifyPlays(events);
  if (plays.length < 50) return null;

  const music = plays.filter((e) => e.metadata.contentType === "track").length;
  const podcast = plays.filter((e) => e.metadata.contentType === "podcast").length;
  const audiobook = plays.filter((e) => e.metadata.contentType === "audiobook").length;

  const musicPct = Math.round((music / plays.length) * 100);
  const podcastPct = Math.round((podcast / plays.length) * 100);

  // Build extra info
  let extra = "";
  if (audiobook > 0) {
    const audiobookPct = Math.round((audiobook / plays.length) * 100);
    extra = `Plus ${audiobook} audiobook plays (${audiobookPct}%).`;
  }

  // Only show if there's a meaningful mix
  if (podcast < 5 && audiobook < 5) return null;

  return {
    id: "content-mix",
    icon: "bar-chart",
    titleKey: "inference.contentMix.title",
    titleParams: { musicPct, podcastPct },
    descKey: "inference.contentMix.desc",
    descParams: { total: plays.length, music, podcast, extra },
    privacyKey: "inference.contentMix.privacy",
  };
}

/**
 * Listening Countries: how many countries appear in conn_country.
 * IP-based location tracking across borders.
 */
export function computeListeningCountries(
  events: MetadataEvent[],
): InferenceCard | null {
  const plays = spotifyPlays(events);
  if (plays.length < 50) return null;

  const countryCounts = new Map<string, number>();
  for (const e of plays) {
    const country = e.metadata.connCountry as string | undefined;
    if (country) {
      countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
    }
  }

  if (countryCounts.size < 2) return null; // Only interesting with multiple countries

  // Sort by count descending
  const sorted = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topCountry = sorted[0][0];
  const topPct = Math.round((sorted[0][1] / plays.length) * 100);
  const countries = sorted.map(([c]) => c).join(", ");

  return {
    id: "listening-countries",
    icon: "plane",
    titleKey: "inference.listeningCountries.title",
    titleParams: { count: countryCounts.size },
    descKey: "inference.listeningCountries.desc",
    descParams: { countries, topPct, topCountry },
    privacyKey: "inference.listeningCountries.privacy",
  };
}

/**
 * Listening Intensity: total hours per week and % of waking hours.
 * Reveals how much of daily life involves headphones.
 */
export function computeListeningIntensity(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange) return null;

  const plays = spotifyPlays(events);
  if (plays.length < 50) return null;

  const totalMs = plays.reduce(
    (sum, e) => sum + ((e.metadata.msPlayed as number) ?? 0), 0,
  );
  const totalHours = Math.round(totalMs / 3_600_000);
  const rangeMs = stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime();
  const weeks = Math.max(1, rangeMs / (1000 * 60 * 60 * 24 * 7));
  const hoursPerWeek = Math.round((totalHours / weeks) * 10) / 10;

  // Assume 16 waking hours/day = 112 hours/week
  const pctAwake = Math.round((hoursPerWeek / 112) * 100);

  if (totalHours < 5) return null;

  return {
    id: "listening-intensity",
    icon: "activity",
    titleKey: "inference.listeningIntensity.title",
    titleParams: { hoursPerWeek },
    descKey: "inference.listeningIntensity.desc",
    descParams: { totalHours, weeks: Math.round(weeks), pctAwake },
    privacyKey: "inference.listeningIntensity.privacy",
  };
}
