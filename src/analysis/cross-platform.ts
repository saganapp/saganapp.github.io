import type { MetadataEvent, EventType, Platform } from "@/parsers/types";
import type { InferenceCard, DashboardStats } from "@/hooks/use-dashboard-data";
import { PLATFORM_META } from "@/utils/platform";
import { getDateKey } from "@/utils/time";

/**
 * Detect multi-day silences (vacations, illness, digital detox).
 * Finds 3+ day runs where daily count drops below 30% of the median.
 */
export function computeActivityGaps(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange || events.length < 50) return null;

  const dailyCounts = new Map<string, number>();
  for (const e of events) {
    const key = getDateKey(e.timestamp);
    dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }

  // Fill in missing days with 0
  const start = new Date(stats.effectiveRange.start);
  const end = new Date(stats.effectiveRange.end);
  const allDays: { key: string; count: number }[] = [];
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  while (cursor <= end) {
    const key = getDateKey(cursor);
    allDays.push({ key, count: dailyCounts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  if (allDays.length < 7) return null;

  // Compute median daily count
  const sorted = allDays.map((d) => d.count).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median === 0) return null;

  const threshold = median * 0.3;

  // Find runs of 3+ consecutive days below threshold
  interface Gap { startDate: string; endDate: string; days: number }
  const gaps: Gap[] = [];
  let gapStart = -1;

  for (let i = 0; i <= allDays.length; i++) {
    const isLow = i < allDays.length && allDays[i].count < threshold;
    if (isLow && gapStart === -1) {
      gapStart = i;
    } else if (!isLow && gapStart !== -1) {
      const length = i - gapStart;
      if (length >= 3) {
        gaps.push({
          startDate: allDays[gapStart].key,
          endDate: allDays[i - 1].key,
          days: length,
        });
      }
      gapStart = -1;
    }
  }

  if (gaps.length === 0) return null;

  // Report the longest gap
  gaps.sort((a, b) => b.days - a.days);
  const longest = gaps[0];

  return {
    id: "activity-gaps",
    icon: "plane",
    titleKey: "inference.activityGaps.title",
    titleParams: { days: longest.days },
    descKey: "inference.activityGaps.desc",
    descParams: {
      startDate: longest.startDate,
      endDate: longest.endDate,
      totalGaps: gaps.length,
    },
    privacyKey: "inference.activityGaps.privacy",
  };
}

/**
 * Detect bedtime shifting over months.
 * Computes per-month median "last activity hour" and reports if shift > 60min.
 */
export function computeSleepDrift(events: MetadataEvent[]): InferenceCard | null {
  if (events.length < 100) return null;

  // Group events by month, collect last-activity hours
  const monthlyLastHours = new Map<string, number[]>();

  // Group events by date to find last activity per day
  const dailyEvents = new Map<string, Date[]>();
  for (const e of events) {
    const key = getDateKey(e.timestamp);
    if (!dailyEvents.has(key)) dailyEvents.set(key, []);
    dailyEvents.get(key)!.push(e.timestamp);
  }

  for (const [dateKey, timestamps] of dailyEvents) {
    timestamps.sort((a, b) => a.getTime() - b.getTime());
    const last = timestamps[timestamps.length - 1];
    const monthKey = dateKey.slice(0, 7); // YYYY-MM
    // Convert hour to a "late night" scale: hours after noon map higher
    const hour = last.getHours();
    const nightHour = hour < 6 ? hour + 24 : hour; // 1am = 25, 2am = 26
    if (!monthlyLastHours.has(monthKey)) monthlyLastHours.set(monthKey, []);
    monthlyLastHours.get(monthKey)!.push(nightHour);
  }

  if (monthlyLastHours.size < 2) return null;

  // Compute per-month median last hour
  const monthMedians: { month: string; median: number }[] = [];
  for (const [month, hours] of monthlyLastHours) {
    if (hours.length < 5) continue;
    hours.sort((a, b) => a - b);
    monthMedians.push({ month, median: hours[Math.floor(hours.length / 2)] });
  }

  if (monthMedians.length < 2) return null;
  monthMedians.sort((a, b) => a.month.localeCompare(b.month));

  let earliest = monthMedians[0];
  let latest = monthMedians[0];
  for (const m of monthMedians) {
    if (m.median < earliest.median) earliest = m;
    if (m.median > latest.median) latest = m;
  }

  const shiftMinutes = Math.round((latest.median - earliest.median) * 60);
  if (shiftMinutes < 60) return null;

  // Determine direction based on chronological order
  const firstMonth = monthMedians[0];
  const lastMonth = monthMedians[monthMedians.length - 1];
  const direction = lastMonth.median > firstMonth.median ? "direction.later" : "direction.earlier";

  return {
    id: "sleep-drift",
    icon: "trending-up",
    titleKey: "inference.sleepDrift.title",
    titleParams: { minutes: shiftMinutes },
    descKey: "inference.sleepDrift.desc",
    descParams: { direction, months: monthMedians.length },
    privacyKey: "inference.sleepDrift.privacy",
  };
}

/**
 * Detect platform migration — shifting from one platform to another.
 * Compares first-half vs second-half platform share.
 */
export function computePlatformMigration(events: MetadataEvent[]): InferenceCard | null {
  if (events.length < 100) return null;

  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  function platformShares(evts: MetadataEvent[]): Map<Platform, number> {
    const counts = new Map<Platform, number>();
    for (const e of evts) counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
    const total = evts.length;
    const shares = new Map<Platform, number>();
    for (const [p, c] of counts) shares.set(p, (c / total) * 100);
    return shares;
  }

  const firstShares = platformShares(firstHalf);
  const secondShares = platformShares(secondHalf);

  let maxGrowth = 0;
  let growingPlatform: Platform | null = null;
  let maxShrink = 0;
  let shrinkingPlatform: Platform | null = null;

  const allPlatforms = new Set([...firstShares.keys(), ...secondShares.keys()]);
  for (const p of allPlatforms) {
    const first = firstShares.get(p) ?? 0;
    const second = secondShares.get(p) ?? 0;
    const diff = second - first;
    if (diff > maxGrowth) {
      maxGrowth = diff;
      growingPlatform = p;
    }
    if (-diff > maxShrink) {
      maxShrink = -diff;
      shrinkingPlatform = p;
    }
  }

  if (maxGrowth < 15 || maxShrink < 15 || !growingPlatform || !shrinkingPlatform) return null;
  if (growingPlatform === shrinkingPlatform) return null;

  return {
    id: "platform-migration",
    icon: "arrow-right-left",
    titleKey: "inference.platformMigration.title",
    titleParams: {
      from: PLATFORM_META[shrinkingPlatform].name,
      to: PLATFORM_META[growingPlatform].name,
    },
    descKey: "inference.platformMigration.desc",
    descParams: {
      from: PLATFORM_META[shrinkingPlatform].name,
      to: PLATFORM_META[growingPlatform].name,
      fromPct: Math.round(maxShrink),
      toPct: Math.round(maxGrowth),
    },
    privacyKey: "inference.platformMigration.privacy",
  };
}

/**
 * Detect a specific contact driving late-night activity increases.
 * Splits timeline in half, finds contacts whose late-night share increased 50%+.
 */
export function computeLateNightContactCorrelation(events: MetadataEvent[]): InferenceCard | null {
  if (events.length < 100) return null;

  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  function isLateNight(d: Date): boolean {
    const h = d.getHours();
    return h >= 22 || h < 4;
  }

  // Overall late-night share change
  const firstNight = firstHalf.filter((e) => isLateNight(e.timestamp)).length;
  const secondNight = secondHalf.filter((e) => isLateNight(e.timestamp)).length;
  const firstNightPct = firstHalf.length > 0 ? firstNight / firstHalf.length : 0;
  const secondNightPct = secondHalf.length > 0 ? secondNight / secondHalf.length : 0;

  // Require overall late-night increase
  if (secondNightPct <= firstNightPct * 1.2) return null;

  function contactNightShares(evts: MetadataEvent[]): Map<string, { total: number; night: number }> {
    const map = new Map<string, { total: number; night: number }>();
    for (const e of evts) {
      for (const p of e.participants) {
        if (p === "You") continue;
        if (!map.has(p)) map.set(p, { total: 0, night: 0 });
        const d = map.get(p)!;
        d.total++;
        if (isLateNight(e.timestamp)) d.night++;
      }
    }
    return map;
  }

  const firstShares = contactNightShares(firstHalf);
  const secondShares = contactNightShares(secondHalf);

  let bestContact = "";
  let bestIncrease = 0;
  let bestNightPct = 0;

  for (const [contact, second] of secondShares) {
    if (second.total < 10) continue;
    const first = firstShares.get(contact);
    const firstPct = first && first.total > 5 ? first.night / first.total : 0;
    const secondPctContact = second.night / second.total;

    // Need 50%+ increase in late-night share
    if (firstPct > 0 && secondPctContact >= firstPct * 1.5) {
      const increase = secondPctContact - firstPct;
      if (increase > bestIncrease) {
        bestContact = contact;
        bestIncrease = increase;
        bestNightPct = Math.round(secondPctContact * 100);
      }
    }
  }

  if (!bestContact) return null;

  return {
    id: "late-night-correlation",
    icon: "moon",
    titleKey: "inference.lateNightCorrelation.title",
    titleParams: { contact: bestContact },
    descKey: "inference.lateNightCorrelation.desc",
    descParams: { nightPct: bestNightPct },
    privacyKey: "inference.lateNightCorrelation.privacy",
  };
}

/**
 * Detect which platform you start and end your day on.
 * Per-day first and last event — median time + most common platform for each.
 */
export function computeFirstLastActivity(events: MetadataEvent[]): InferenceCard | null {
  if (events.length < 50) return null;

  const dailyEvents = new Map<string, MetadataEvent[]>();
  for (const e of events) {
    const key = getDateKey(e.timestamp);
    if (!dailyEvents.has(key)) dailyEvents.set(key, []);
    dailyEvents.get(key)!.push(e);
  }

  if (dailyEvents.size < 7) return null;

  const firstHours: number[] = [];
  const lastHours: number[] = [];
  const firstPlatforms = new Map<Platform, number>();
  const lastPlatforms = new Map<Platform, number>();

  for (const [, dayEvents] of dailyEvents) {
    if (dayEvents.length < 2) continue;
    dayEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const first = dayEvents[0];
    const last = dayEvents[dayEvents.length - 1];

    firstHours.push(first.timestamp.getHours() + first.timestamp.getMinutes() / 60);
    lastHours.push(last.timestamp.getHours() + last.timestamp.getMinutes() / 60);

    firstPlatforms.set(first.source, (firstPlatforms.get(first.source) ?? 0) + 1);
    lastPlatforms.set(last.source, (lastPlatforms.get(last.source) ?? 0) + 1);
  }

  if (firstHours.length < 7) return null;

  firstHours.sort((a, b) => a - b);
  lastHours.sort((a, b) => a - b);

  const medianFirst = firstHours[Math.floor(firstHours.length / 2)];
  const medianLast = lastHours[Math.floor(lastHours.length / 2)];

  const topFirst = [...firstPlatforms.entries()].sort((a, b) => b[1] - a[1])[0];
  const topLast = [...lastPlatforms.entries()].sort((a, b) => b[1] - a[1])[0];

  const formatHour = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  return {
    id: "first-last-activity",
    icon: "smartphone",
    titleKey: "inference.firstLastActivity.title",
    titleParams: {
      firstTime: formatHour(medianFirst),
      lastTime: formatHour(medianLast),
    },
    descKey: "inference.firstLastActivity.desc",
    descParams: {
      firstPlatform: PLATFORM_META[topFirst[0]].name,
      lastPlatform: PLATFORM_META[topLast[0]].name,
    },
    privacyKey: "inference.firstLastActivity.privacy",
  };
}

/**
 * Detect whether late-night screen use delays the next morning's start.
 * Groups days by whether last activity was after midnight (00:00–03:59).
 * Compares median first-activity time the next morning for each group.
 */
export function computeLateScreenEarlyStart(events: MetadataEvent[]): InferenceCard | null {
  if (events.length < 50) return null;

  // Group events by date
  const dailyEvents = new Map<string, MetadataEvent[]>();
  for (const e of events) {
    const key = getDateKey(e.timestamp);
    if (!dailyEvents.has(key)) dailyEvents.set(key, []);
    dailyEvents.get(key)!.push(e);
  }

  // For each day, find last activity timestamp and next-day first activity
  const sortedDays = [...dailyEvents.keys()].sort();

  const lateNightNextMornings: number[] = [];
  const earlyNightNextMornings: number[] = [];

  for (let i = 0; i < sortedDays.length - 1; i++) {
    const todayKey = sortedDays[i];
    const tomorrowKey = sortedDays[i + 1];

    // Check these are consecutive days
    const today = new Date(todayKey);
    const tomorrow = new Date(tomorrowKey);
    const diffMs = tomorrow.getTime() - today.getTime();
    if (diffMs > 2 * 24 * 60 * 60 * 1000) continue; // skip non-consecutive

    const todayEvts = dailyEvents.get(todayKey)!;
    const tomorrowEvts = dailyEvents.get(tomorrowKey)!;

    // Find last activity today
    const lastToday = todayEvts.reduce((latest, e) =>
      e.timestamp.getTime() > latest.getTime() ? e.timestamp : latest,
      todayEvts[0].timestamp,
    );

    // Find first activity tomorrow
    const firstTomorrow = tomorrowEvts.reduce((earliest, e) =>
      e.timestamp.getTime() < earliest.getTime() ? e.timestamp : earliest,
      tomorrowEvts[0].timestamp,
    );

    const morningHour = firstTomorrow.getHours() + firstTomorrow.getMinutes() / 60;
    // Only count morning starts between 4am and 2pm
    if (morningHour < 4 || morningHour > 14) continue;

    const lastHour = lastToday.getHours();
    // "Late night" = last activity after midnight (00:00–03:59)
    if (lastHour >= 0 && lastHour < 4) {
      lateNightNextMornings.push(morningHour);
    } else {
      earlyNightNextMornings.push(morningHour);
    }
  }

  if (lateNightNextMornings.length < 5 || earlyNightNextMornings.length < 5) return null;

  // Compute medians
  lateNightNextMornings.sort((a, b) => a - b);
  earlyNightNextMornings.sort((a, b) => a - b);

  const lateMedian = lateNightNextMornings[Math.floor(lateNightNextMornings.length / 2)];
  const normalMedian = earlyNightNextMornings[Math.floor(earlyNightNextMornings.length / 2)];

  const diffMinutes = Math.round((lateMedian - normalMedian) * 60);
  if (diffMinutes < 30) return null;

  const formatHourMin = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  return {
    id: "late-screen-early-start",
    icon: "moon",
    titleKey: "inference.lateScreen.title",
    titleParams: { minutes: diffMinutes },
    descKey: "inference.lateScreen.desc",
    descParams: {
      lateNights: lateNightNextMornings.length,
      lateStart: formatHourMin(lateMedian),
      normalStart: formatHourMin(normalMedian),
    },
    privacyKey: "inference.lateScreen.privacy",
  };
}

/**
 * Detect weekend vs weekday behavior divergence per platform.
 * Computes the ratio of weekend events to weekday events (normalized per day).
 * Fires if any platform has weekend/weekday ratio >2.0x or <0.4x.
 */
export function computeWeekendPlatformShift(events: MetadataEvent[]): InferenceCard | null {
  if (events.length < 50) return null;

  // Count weekends in the data
  const weekendDays = new Set<string>();
  const weekdayDays = new Set<string>();
  for (const e of events) {
    const dow = e.timestamp.getDay();
    const key = getDateKey(e.timestamp);
    if (dow === 0 || dow === 6) weekendDays.add(key);
    else weekdayDays.add(key);
  }

  // Need ≥4 weekends worth of weekend days (≥8 weekend days)
  if (weekendDays.size < 8) return null;

  const numWeekendDays = weekendDays.size;
  const numWeekdayDays = Math.max(1, weekdayDays.size);

  // Per-platform counts
  const platformWeekend = new Map<Platform, number>();
  const platformWeekday = new Map<Platform, number>();

  for (const e of events) {
    const dow = e.timestamp.getDay();
    if (dow === 0 || dow === 6) {
      platformWeekend.set(e.source, (platformWeekend.get(e.source) ?? 0) + 1);
    } else {
      platformWeekday.set(e.source, (platformWeekday.get(e.source) ?? 0) + 1);
    }
  }

  let bestPlatform: Platform | null = null;
  let bestRatio = 0;
  let bestDirection = "direction.higher";
  let bestWeekendAvg = 0;
  let bestWeekdayAvg = 0;

  // Also track the platform going the other direction
  let secondPlatform: Platform | null = null;
  let secondRatio = 0;

  const allPlatforms = new Set([...platformWeekend.keys(), ...platformWeekday.keys()]);
  for (const p of allPlatforms) {
    const weekendCount = platformWeekend.get(p) ?? 0;
    const weekdayCount = platformWeekday.get(p) ?? 0;

    const weekendAvg = weekendCount / numWeekendDays;
    const weekdayAvg = weekdayCount / numWeekdayDays;

    if (weekdayAvg === 0 && weekendAvg === 0) continue;

    const ratio = weekdayAvg > 0 ? weekendAvg / weekdayAvg : weekendAvg > 0 ? 10 : 1;

    if (ratio > 2.0 && ratio > bestRatio) {
      // If the previous best was also "higher", it becomes second
      if (bestPlatform && bestDirection === "direction.lower") {
        secondPlatform = bestPlatform;
        secondRatio = bestRatio;
      }
      bestPlatform = p;
      bestRatio = ratio;
      bestDirection = "direction.higher";
      bestWeekendAvg = weekendAvg;
      bestWeekdayAvg = weekdayAvg;
    } else if (ratio < 0.4 && (1 / ratio) > bestRatio) {
      if (bestPlatform && bestDirection === "direction.higher") {
        secondPlatform = bestPlatform;
        secondRatio = bestRatio;
      }
      bestPlatform = p;
      bestRatio = 1 / ratio;
      bestDirection = "direction.lower";
      bestWeekendAvg = weekendAvg;
      bestWeekdayAvg = weekdayAvg;
    } else if (ratio > 2.0 || ratio < 0.4) {
      const effectiveRatio = ratio > 1 ? ratio : 1 / ratio;
      const dir = ratio > 1 ? "direction.higher" : "direction.lower";
      if (dir !== bestDirection && effectiveRatio > secondRatio) {
        secondPlatform = p;
        secondRatio = effectiveRatio;
      }
    }
  }

  if (!bestPlatform) return null;

  const multiplier = Math.round(bestRatio * 10) / 10;

  return {
    id: "weekend-platform-shift",
    icon: "calendar",
    titleKey: "inference.weekendShift.title",
    titleParams: {
      platform: PLATFORM_META[bestPlatform].name,
      multiplier,
      direction: bestDirection,
    },
    descKey: "inference.weekendShift.desc",
    descParams: {
      weekdayAvg: Math.round(bestWeekdayAvg * 10) / 10,
      weekendAvg: Math.round(bestWeekendAvg * 10) / 10,
      secondPlatform: secondPlatform ? PLATFORM_META[secondPlatform].name : "",
    },
    privacyKey: "inference.weekendShift.privacy",
  };
}

/**
 * Detect whether nights ending with Spotify listening correlate with earlier bedtimes
 * compared to nights ending with social media. Reveals sleep rituals.
 */
export function computeMusicWindDown(events: MetadataEvent[]): InferenceCard | null {
  if (events.length < 100) return null;

  // Group events by date
  const dailyEvents = new Map<string, MetadataEvent[]>();
  for (const e of events) {
    const key = getDateKey(e.timestamp);
    if (!dailyEvents.has(key)) dailyEvents.set(key, []);
    dailyEvents.get(key)!.push(e);
  }

  const socialPlatforms: Platform[] = ["instagram", "tiktok", "twitter"];
  const spotifyBedtimes: number[] = [];
  const socialBedtimes: number[] = [];

  for (const [, dayEvents] of dailyEvents) {
    if (dayEvents.length < 2) continue;
    dayEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const last = dayEvents[dayEvents.length - 1];
    const hour = last.timestamp.getHours();
    const bedtimeMinutes = hour < 6 ? (hour + 24) * 60 + last.timestamp.getMinutes() : hour * 60 + last.timestamp.getMinutes();

    if (last.source === "spotify") {
      spotifyBedtimes.push(bedtimeMinutes);
    } else if (socialPlatforms.includes(last.source)) {
      socialBedtimes.push(bedtimeMinutes);
    }
  }

  if (spotifyBedtimes.length < 10 || socialBedtimes.length < 10) return null;

  spotifyBedtimes.sort((a, b) => a - b);
  socialBedtimes.sort((a, b) => a - b);

  const spotifyMedian = spotifyBedtimes[Math.floor(spotifyBedtimes.length / 2)];
  const socialMedian = socialBedtimes[Math.floor(socialBedtimes.length / 2)];

  const diffMinutes = socialMedian - spotifyMedian;
  if (diffMinutes < 20) return null;

  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  return {
    id: "music-wind-down",
    icon: "headphones",
    titleKey: "inference.musicWindDown.title",
    titleParams: { minutes: Math.round(diffMinutes) },
    descKey: "inference.musicWindDown.desc",
    descParams: {
      spotifyNights: spotifyBedtimes.length,
      spotifyBedtime: formatTime(spotifyMedian),
      socialNights: socialBedtimes.length,
      socialBedtime: formatTime(socialMedian),
    },
    privacyKey: "inference.musicWindDown.privacy",
  };
}

/**
 * Detect correlation between high-listening days and reduced messaging.
 * Compares messaging volume on days with many Spotify plays vs quiet days.
 */
export function computeSoundtrackToSilence(events: MetadataEvent[]): InferenceCard | null {
  if (events.length < 100) return null;

  // Group daily Spotify plays and message_sent counts
  const dailySpotify = new Map<string, number>();
  const dailyMessages = new Map<string, number>();

  for (const e of events) {
    const key = getDateKey(e.timestamp);
    if (e.source === "spotify" && e.eventType === "media_played") {
      dailySpotify.set(key, (dailySpotify.get(key) ?? 0) + 1);
    }
    if (e.eventType === "message_sent") {
      dailyMessages.set(key, (dailyMessages.get(key) ?? 0) + 1);
    }
  }

  // Only consider days that have at least some Spotify plays
  const spotifyDays = [...dailySpotify.entries()].filter(([, count]) => count > 0);
  if (spotifyDays.length < 14) return null;

  // Compute median Spotify plays to split into high/low
  const spotifyCounts = spotifyDays.map(([, c]) => c).sort((a, b) => a - b);
  const medianPlays = spotifyCounts[Math.floor(spotifyCounts.length / 2)];

  const highDayMsgs: number[] = [];
  const lowDayMsgs: number[] = [];

  for (const [day, count] of spotifyDays) {
    const msgs = dailyMessages.get(day) ?? 0;
    if (count > medianPlays) {
      highDayMsgs.push(msgs);
    } else {
      lowDayMsgs.push(msgs);
    }
  }

  if (highDayMsgs.length < 7 || lowDayMsgs.length < 7) return null;

  const highAvg = highDayMsgs.reduce((a, b) => a + b, 0) / highDayMsgs.length;
  const lowAvg = lowDayMsgs.reduce((a, b) => a + b, 0) / lowDayMsgs.length;

  if (lowAvg === 0) return null;
  const reductionPct = Math.round(((lowAvg - highAvg) / lowAvg) * 100);
  if (reductionPct < 20) return null;

  return {
    id: "soundtrack-to-silence",
    icon: "headphones",
    titleKey: "inference.soundtrackToSilence.title",
    titleParams: { reductionPct },
    descKey: "inference.soundtrackToSilence.desc",
    descParams: {
      highDays: highDayMsgs.length,
      highMsgAvg: Math.round(highAvg * 10) / 10,
      lowDays: lowDayMsgs.length,
      lowMsgAvg: Math.round(lowAvg * 10) / 10,
    },
    privacyKey: "inference.soundtrackToSilence.privacy",
  };
}

/**
 * Detect work-hours Spotify listening patterns.
 * Computes total work-listening hours and percentage of all listening.
 */
export function computeWorkListening(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange) return null;

  const spotifyPlays = events.filter(
    (e) => e.source === "spotify" && e.eventType === "media_played",
  );
  if (spotifyPlays.length < 20) return null;

  // Filter to weekday 9-17
  const workPlays = spotifyPlays.filter((e) => {
    const dow = e.timestamp.getDay();
    const hour = e.timestamp.getHours();
    return dow >= 1 && dow <= 5 && hour >= 9 && hour < 17;
  });

  if (workPlays.length < 20) return null;

  const workMs = workPlays.reduce(
    (sum, e) => sum + ((e.metadata.msPlayed as number) ?? 0), 0,
  );
  const totalMs = spotifyPlays.reduce(
    (sum, e) => sum + ((e.metadata.msPlayed as number) ?? 0), 0,
  );

  const workHours = Math.round(workMs / 3_600_000 * 10) / 10;
  const rangeMs = stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime();
  const weeks = Math.max(1, rangeMs / (1000 * 60 * 60 * 24 * 7));
  const hoursPerWeek = Math.round((workHours / weeks) * 10) / 10;

  if (hoursPerWeek < 0.5) return null;

  const workPct = totalMs > 0 ? Math.round((workMs / totalMs) * 100) : 0;

  return {
    id: "work-listening",
    icon: "headphones",
    titleKey: "inference.workListening.title",
    titleParams: { hoursPerWeek },
    descKey: "inference.workListening.desc",
    descParams: {
      totalPlays: workPlays.length,
      workHours,
      workPct,
    },
    privacyKey: "inference.workListening.privacy",
  };
}

/**
 * Classify user activity into consumption vs creation and compute the ratio.
 * Consumption: browsing, search, reaction, story_view, ad_interaction
 * Creation: message_sent, media_shared, profile_update, call_started, calendar_event, contact_added, group_created
 */
export function computeConsumptionCreationRatio(events: MetadataEvent[]): InferenceCard | null {
  if (events.length < 50) return null;

  const consumptionTypes: EventType[] = ["browsing", "search", "reaction", "story_view", "ad_interaction"];
  const creationTypes: EventType[] = ["message_sent", "media_shared", "profile_update", "call_started", "calendar_event", "contact_added", "group_created", "wellness_log"];

  let consumeCount = 0;
  let createCount = 0;

  for (const e of events) {
    if (consumptionTypes.includes(e.eventType)) consumeCount++;
    else if (creationTypes.includes(e.eventType)) createCount++;
  }

  const total = consumeCount + createCount;
  if (total < 50) return null;

  const consumePct = Math.round((consumeCount / total) * 100);
  const createPct = 100 - consumePct;

  return {
    id: "consumption-creation-ratio",
    icon: "bar-chart",
    titleKey: "inference.consumptionCreation.title",
    titleParams: { consumePct, createPct },
    descKey: "inference.consumptionCreation.desc",
    descParams: { total, consumeCount, createCount },
    privacyKey: "inference.consumptionCreation.privacy",
  };
}
