import type { MetadataEvent, Platform } from "@/parsers/types";
import { estimateEventDuration } from "./duration";
import { PLATFORM_META } from "@/utils/platform";
import type { InferenceCard, DashboardStats } from "@/hooks/use-dashboard-data";
import { filterUserTriggered } from "./filters";
import { extractDevices } from "./devices";
import { detectMacroEvents } from "./macro-events";
import { detectRecurringLulls } from "./lulls";
import { detectSleepingPatterns } from "./sleep";
import {
  computeActivityGaps,
  computeSleepDrift,
  computePlatformMigration,
  computeLateNightContactCorrelation,
  computeFirstLastActivity,
  computeLateScreenEarlyStart,
  computeWeekendPlatformShift,
  computeConsumptionCreationRatio,
  computeMusicWindDown,
  computeSoundtrackToSilence,
  computeWorkListening,
  computeQuietPeriodsInference,
} from "./cross-platform";
import {
  computeReciprocityInference,
  computeRelationshipTrendInference,
  computeResponseLatencyInference,
  computeSocialCirclesInference,
} from "./relationship-inferences";
import { rankContacts } from "./contacts";
import { computeHydrationConsistency } from "./garmin-inferences";
import {
  computeListeningSchedule,
  computeSkipRate,
  computeIncognitoListening,
  computeContentMix,
  computeListeningCountries,
  computeListeningIntensity,
} from "./spotify-inferences";
import {
  computeSearchBehavior,
  computeLibraryCuration,
  computeSpotifyPiiExposure,
  computeSpotifySocialGraph,
  computePlaylistIdentity,
  computeSpotifyWrappedProfile,
  computeSpotifyMarqueeSegments,
} from "./spotify-account-inferences";

function computeWorkHoursLost(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange) return null;

  const workEvents = events.filter((e) => {
    const day = e.timestamp.getDay();
    const hour = e.timestamp.getHours();
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  });

  if (workEvents.length < 10) return null;

  let workSeconds = 0;
  for (const e of workEvents) {
    workSeconds += estimateEventDuration(e);
  }

  const totalMs = stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime();
  const totalWeeks = Math.max(1, totalMs / (1000 * 60 * 60 * 24 * 7));
  const weeklySeconds = workSeconds / totalWeeks;
  const weeklyMinutes = Math.round(weeklySeconds / 60);
  const totalHours = (workSeconds / 3600).toFixed(1);

  return {
    id: "work-hours-lost",
    icon: "briefcase",
    titleKey: "inference.workHours.title",
    titleParams: { minutes: weeklyMinutes },
    descKey: "inference.workHours.desc",
    descParams: { count: workEvents.length, hours: totalHours },
    privacyKey: "inference.workHours.privacy",
  };
}

function computeLullDetection(events: MetadataEvent[]): InferenceCard | null {
  const lulls = detectRecurringLulls(events);
  if (lulls.length === 0) return null;

  const best = lulls[0];
  return {
    id: "lull-detection",
    icon: "pause",
    titleKey: "inference.lull.title",
    titleParams: {
      daysOfWeek: best.daysOfWeek.join(","),
      startHour: best.startHour,
      endHour: best.endHour,
    },
    descKey: "inference.lull.desc",
    privacyKey: "inference.lull.privacy",
  };
}

function computeChattiestRelationship(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange) return null;

  const contactCounts = new Map<string, number>();
  for (const e of events) {
    for (const p of e.participants) {
      if (p !== "You") contactCounts.set(p, (contactCounts.get(p) ?? 0) + 1);
    }
  }

  if (contactCounts.size === 0) return null;

  let topContact = "";
  let topCount = 0;
  for (const [name, count] of contactCounts) {
    if (count > topCount) {
      topContact = name;
      topCount = count;
    }
  }

  const totalMs = stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime();
  const totalWeeks = Math.max(1, totalMs / (1000 * 60 * 60 * 24 * 7));
  const perWeek = (topCount / totalWeeks).toFixed(1);

  return {
    id: "chattiest-relationship",
    icon: "message-circle",
    titleKey: "inference.chattiest.title",
    titleParams: { contact: topContact },
    descKey: "inference.chattiest.desc",
    descParams: { count: topCount, perWeek },
    privacyKey: "inference.chattiest.privacy",
  };
}

function computeAsyncRelationship(events: MetadataEvent[]): InferenceCard | null {
  const contactCounts = new Map<string, number>();
  for (const e of events) {
    for (const p of e.participants) {
      if (p !== "You") contactCounts.set(p, (contactCounts.get(p) ?? 0) + 1);
    }
  }

  const top10 = [...contactCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .filter(([, count]) => count >= 15);

  if (top10.length === 0) return null;

  let bestContact = "";
  let bestMedianGap = 0;

  for (const [contact] of top10) {
    const timestamps = events
      .filter((e) => e.participants.includes(contact))
      .map((e) => e.timestamp.getTime())
      .sort((a, b) => a - b);

    if (timestamps.length < 2) continue;

    const gaps: number[] = [];
    for (let i = 0; i < timestamps.length - 1; i++) {
      gaps.push(timestamps[i + 1] - timestamps[i]);
    }
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    const threeHoursMs = 3 * 60 * 60 * 1000;

    if (median > threeHoursMs && median > bestMedianGap) {
      bestContact = contact;
      bestMedianGap = median;
    }
  }

  if (!bestContact) return null;

  return {
    id: "async-relationship",
    icon: "hourglass",
    titleKey: "inference.async.title",
    titleParams: { contact: bestContact },
    descKey: "inference.async.desc",
    privacyKey: "inference.async.privacy",
  };
}

function computeTimeByPlatform(events: MetadataEvent[]): InferenceCard | null {
  if (events.length === 0) return null;

  const platformCounts = new Map<Platform, number>();
  for (const e of events) {
    platformCounts.set(e.source, (platformCounts.get(e.source) ?? 0) + 1);
  }

  let topPlatform: Platform = "whatsapp";
  let topCount = 0;
  for (const [p, c] of platformCounts) {
    if (c > topCount) {
      topPlatform = p;
      topCount = c;
    }
  }

  let topSeconds = 0;
  let totalSeconds = 0;
  for (const e of events) {
    const dur = estimateEventDuration(e);
    totalSeconds += dur;
    if (e.source === topPlatform) topSeconds += dur;
  }

  const topHours = (topSeconds / 3600).toFixed(1);
  const totalHours = (totalSeconds / 3600).toFixed(1);
  const pct = totalSeconds > 0 ? Math.round((topSeconds / totalSeconds) * 100) : 0;

  return {
    id: "time-by-platform",
    icon: "clock",
    titleKey: "inference.timeByPlatform.title",
    titleParams: { platform: PLATFORM_META[topPlatform].name, hours: topHours },
    descKey: "inference.timeByPlatform.desc",
    descParams: { totalHours, platform: PLATFORM_META[topPlatform].name, pct },
    privacyKey: "inference.timeByPlatform.privacy",
  };
}

function computeEmailResponseTime(events: MetadataEvent[]): InferenceCard | null {
  const receivedByMsgId = new Map<string, number>();
  const sentReplies: { inReplyTo: string; timestamp: number }[] = [];

  for (const e of events) {
    if (e.source !== "google") continue;
    const msgId = e.metadata.messageId as string | undefined;
    const inReplyTo = e.metadata.inReplyTo as string | undefined;

    if (e.eventType === "message_received" && msgId) {
      receivedByMsgId.set(msgId, e.timestamp.getTime());
    }
    if (e.eventType === "message_sent" && inReplyTo) {
      sentReplies.push({ inReplyTo, timestamp: e.timestamp.getTime() });
    }
  }

  const responseTimes: number[] = [];
  for (const reply of sentReplies) {
    const receivedTime = receivedByMsgId.get(reply.inReplyTo);
    if (receivedTime && reply.timestamp > receivedTime) {
      const diff = reply.timestamp - receivedTime;
      if (diff < 7 * 24 * 60 * 60 * 1000) {
        responseTimes.push(diff);
      }
    }
  }

  if (responseTimes.length < 5) return null;

  responseTimes.sort((a, b) => a - b);
  const medianMs = responseTimes[Math.floor(responseTimes.length / 2)];
  const medianHours = (medianMs / (1000 * 60 * 60)).toFixed(1);

  return {
    id: "email-response-time",
    icon: "mail",
    titleKey: "inference.emailResponse.title",
    titleParams: { hours: medianHours },
    descKey: "inference.emailResponse.desc",
    descParams: { count: responseTimes.length, hours: medianHours },
    privacyKey: "inference.emailResponse.privacy",
  };
}

function computeEmailVolumePattern(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange) return null;

  const sentEmails = events.filter(
    (e) => e.source === "google" && e.eventType === "message_sent" && e.metadata.subSource === "Gmail",
  );

  if (sentEmails.length < 10) return null;

  const hourlyCounts = new Array(24).fill(0);
  for (const e of sentEmails) {
    hourlyCounts[e.timestamp.getHours()]++;
  }

  const peakHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));
  const weeks = Math.max(
    1,
    (stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime()) / (1000 * 60 * 60 * 24 * 7),
  );
  const emailsPerWeek = Math.round(sentEmails.length / weeks);

  return {
    id: "email-volume",
    icon: "mail",
    titleKey: "inference.emailVolume.title",
    titleParams: { perWeek: emailsPerWeek, peakHour: `${String(peakHour).padStart(2, "0")}:00` },
    descKey: "inference.emailVolume.desc",
    descParams: { total: sentEmails.length, perWeek: emailsPerWeek },
    privacyKey: "inference.emailVolume.privacy",
  };
}

function computeSearchPatterns(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange) return null;

  const searches = events.filter((e) => e.eventType === "search");
  if (searches.length < 10) return null;

  const hourlyCounts = new Array(24).fill(0);
  for (const e of searches) {
    hourlyCounts[e.timestamp.getHours()]++;
  }

  const peakHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));
  const totalDays = Math.max(
    1,
    (stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const searchesPerDay = Math.round(searches.length / totalDays);

  return {
    id: "search-patterns",
    icon: "search",
    titleKey: "inference.searchPatterns.title",
    titleParams: { perDay: searchesPerDay, peakHour: `${String(peakHour).padStart(2, "0")}:00` },
    descKey: "inference.searchPatterns.desc",
    descParams: { total: searches.length, perDay: searchesPerDay },
    privacyKey: "inference.searchPatterns.privacy",
  };
}

function computeCalendarLoad(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange) return null;

  const calEvents = events.filter((e) => e.eventType === "calendar_event");
  if (calEvents.length < 5) return null;

  const weeks = Math.max(
    1,
    (stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime()) / (1000 * 60 * 60 * 24 * 7),
  );
  const meetingsPerWeek = Math.round((calEvents.length / weeks) * 10) / 10;

  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  let totalAttendees = 0;
  for (const e of calEvents) {
    dowCounts[e.timestamp.getDay()]++;
    totalAttendees += (e.metadata.attendeeCount as number) ?? 0;
  }
  const busiestDow = dowCounts.indexOf(Math.max(...dowCounts));
  const avgAttendees = calEvents.length > 0
    ? Math.round((totalAttendees / calEvents.length) * 10) / 10
    : 0;

  return {
    id: "calendar-load",
    icon: "calendar",
    titleKey: "inference.calendarLoad.title",
    titleParams: { perWeek: meetingsPerWeek },
    descKey: "inference.calendarLoad.desc",
    descParams: { dayIndex: busiestDow, avgAttendees },
    privacyKey: "inference.calendarLoad.privacy",
  };
}

function computeDeviceSwitch(events: MetadataEvent[]): InferenceCard | null {
  const devices = extractDevices(events);
  if (devices.length < 2) return null;

  // Find two devices where one ends and another begins around the same time
  for (let i = 0; i < devices.length - 1; i++) {
    const current = devices[i];
    const next = devices[i + 1];

    // Check if there's a transition (current lastSeen near next firstSeen)
    const gapMs = next.firstSeen.getTime() - current.lastSeen.getTime();
    const overlapMs = current.lastSeen.getTime() - next.firstSeen.getTime();

    // Allow up to 30 days gap or some overlap
    if (gapMs < 30 * 24 * 60 * 60 * 1000 && overlapMs < 60 * 24 * 60 * 60 * 1000) {
      const switchDate = new Date((current.lastSeen.getTime() + next.firstSeen.getTime()) / 2);
      const monthStr = `${switchDate.getFullYear()}-${String(switchDate.getMonth() + 1).padStart(2, "0")}`;

      return {
        id: "device-switch",
        icon: "activity",
        titleKey: "inference.deviceSwitch.title",
        descKey: "inference.deviceSwitch.desc",
        descParams: {
          oldDevice: current.device.model ?? current.device.raw,
          newDevice: next.device.model ?? next.device.raw,
          date: monthStr,
        },
        privacyKey: "inference.deviceSwitch.privacy",
      };
    }
  }

  return null;
}

function computeBurstCommunicator(events: MetadataEvent[]): InferenceCard | null {
  const userTriggered = filterUserTriggered(events);
  const macros = detectMacroEvents(userTriggered);
  if (macros.length === 0) return null;

  // Find the contact with the most macro events
  const contactBursts = new Map<string, number>();
  for (const m of macros) {
    contactBursts.set(m.contact, (contactBursts.get(m.contact) ?? 0) + 1);
  }

  let topContact = "";
  let topBursts = 0;
  for (const [contact, count] of contactBursts) {
    if (count > topBursts) {
      topContact = contact;
      topBursts = count;
    }
  }

  if (topBursts < 2) return null;

  // Average burst size for this contact
  const contactMacros = macros.filter((m) => m.contact === topContact);
  const avgSize = Math.round(contactMacros.reduce((s, m) => s + m.eventCount, 0) / contactMacros.length);

  return {
    id: "burst-communicator",
    icon: "bar-chart",
    titleKey: "inference.burstCommunicator.title",
    titleParams: { contact: topContact },
    descKey: "inference.burstCommunicator.desc",
    descParams: { bursts: topBursts, avgMessages: avgSize },
    privacyKey: "inference.burstCommunicator.privacy",
  };
}

export function computeInferences(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard[] {
  if (events.length === 0) return [];

  // Separate user-triggered events for behavior-based inferences
  // (passive events like message_received, notification, ad_interaction shouldn't
  //  count as user activity — a notification at 3am ≠ user awake)
  const userTriggered = filterUserTriggered(events);
  if (userTriggered.length === 0) return [];

  // Night owl vs early bird (user behavior only)
  let nightCount = 0;
  let morningCount = 0;

  for (const e of userTriggered) {
    const h = e.timestamp.getHours();
    if (h >= 22 || h < 4) nightCount++;
    if (h >= 5 && h < 9) morningCount++;
  }

  const isNightOwl = nightCount > morningCount;

  // Most active platform (user-triggered only)
  const platformCounts = new Map<Platform, number>();
  for (const e of userTriggered) {
    platformCounts.set(e.source, (platformCounts.get(e.source) ?? 0) + 1);
  }
  let topPlatform: Platform = "whatsapp";
  let topPlatformCount = 0;
  for (const [p, c] of platformCounts) {
    if (c > topPlatformCount) {
      topPlatform = p;
      topPlatformCount = c;
    }
  }
  const topPlatformPct = Math.round((topPlatformCount / userTriggered.length) * 100);

  // Close contacts (user-triggered only)
  const contactCounts = new Map<string, number>();
  for (const e of userTriggered) {
    for (const p of e.participants) {
      if (p !== "You") contactCounts.set(p, (contactCounts.get(p) ?? 0) + 1);
    }
  }
  // How many contacts make up 80% of interactions (percentile-based)
  const sorted = [...contactCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalWithContacts = sorted.reduce((s, [, c]) => s + c, 0);
  let cumulative = 0, closeCount = 0;
  for (const [, count] of sorted) {
    cumulative += count;
    closeCount++;
    if (cumulative >= totalWithContacts * 0.8) break;
  }
  const closePct = Math.round((cumulative / totalWithContacts) * 100);

  // Busiest day of week (user-triggered only)
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const e of userTriggered) {
    dowCounts[e.timestamp.getDay()]++;
  }
  const busiestDow = dowCounts.indexOf(Math.max(...dowCounts));

  const cards: InferenceCard[] = [
    {
      id: "sleep-pattern",
      icon: isNightOwl ? "moon" : "sun",
      titleKey: isNightOwl ? "inference.nightOwl.title" : "inference.earlyBird.title",
      descKey: isNightOwl ? "inference.sleep.desc.night" : "inference.sleep.desc.morning",
      descParams: { count: isNightOwl ? nightCount : morningCount },
      privacyKey: "inference.sleep.privacy",
    },
    {
      id: "top-platform",
      icon: "activity",
      titleKey: "inference.topPlatform.title",
      titleParams: { platform: PLATFORM_META[topPlatform].name },
      descKey: "inference.topPlatform.desc",
      descParams: { pct: topPlatformPct, platform: PLATFORM_META[topPlatform].name },
      privacyKey: "inference.topPlatform.privacy",
    },
    {
      id: "close-contacts",
      icon: "users",
      titleKey: "inference.closeContacts.title",
      titleParams: { count: closeCount, pct: closePct },
      descKey: "inference.closeContacts.desc",
      descParams: { totalContacts: contactCounts.size, count: closeCount, pct: closePct },
      privacyKey: "inference.closeContacts.privacy",
    },
    {
      id: "busiest-day",
      icon: "calendar",
      titleKey: "inference.busiestDay.title",
      titleParams: { dayIndex: busiestDow },
      descKey: "inference.busiestDay.desc",
      descParams: {
        dayIndex: busiestDow,
        count: dowCounts[busiestDow],
        pct: Math.round((dowCounts[busiestDow] / userTriggered.length) * 100),
      },
      privacyKey: "inference.busiestDay.privacy",
    },
  ];

  const inferenceComputers = [
    // Behavior-based: use userTriggered (passive events ≠ user activity)
    computeWorkHoursLost(userTriggered, stats),
    computeLullDetection(userTriggered),
    computeChattiestRelationship(userTriggered, stats),
    computeTimeByPlatform(userTriggered),
    computeActivityGaps(userTriggered, stats),
    computeQuietPeriodsInference(userTriggered, stats, detectSleepingPatterns(userTriggered)),
    computeSleepDrift(userTriggered),
    computePlatformMigration(userTriggered),
    computeLateNightContactCorrelation(userTriggered),
    computeFirstLastActivity(userTriggered),
    computeLateScreenEarlyStart(userTriggered),
    computeWeekendPlatformShift(userTriggered),
    computeConsumptionCreationRatio(userTriggered),
    computeRelationshipTrendInference(userTriggered, stats),
    // Direction-aware / self-filtering: need ALL events (sent + received)
    computeAsyncRelationship(events),
    computeEmailResponseTime(events),
    computeEmailVolumePattern(events, stats),    // self-filters to Gmail sent
    computeSearchPatterns(events, stats),         // self-filters to search events
    computeCalendarLoad(events, stats),           // self-filters to calendar events
    computeDeviceSwitch(events),                  // device detection uses all
    computeBurstCommunicator(events),             // self-filters internally
    computeReciprocityInference(events),          // needs sent + received
    computeResponseLatencyInference(events),      // needs sent + received
    computeSocialCirclesInference(events, rankContacts(events)), // rankContacts self-filters
    computeHydrationConsistency(events, stats),               // Garmin hydration tracking
    // Spotify-specific inferences
    computeListeningSchedule(events, stats),
    computeSkipRate(events),
    computeIncognitoListening(events),
    computeContentMix(events),
    computeListeningCountries(events),
    computeListeningIntensity(events, stats),
    // Cross-platform Spotify inferences
    computeMusicWindDown(userTriggered),
    computeSoundtrackToSilence(events),
    computeWorkListening(events, stats),
    // Spotify account data inferences
    computeSearchBehavior(events, stats),
    computeLibraryCuration(events),
    computeSpotifyPiiExposure(events),
    computeSpotifySocialGraph(events),
    computePlaylistIdentity(events),
    computeSpotifyWrappedProfile(events),
    computeSpotifyMarqueeSegments(events),
  ];

  for (const inf of inferenceComputers) {
    if (inf) cards.push(inf);
  }

  return cards;
}
