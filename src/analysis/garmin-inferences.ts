import type { MetadataEvent } from "@/parsers/types";
import type { InferenceCard, DashboardStats } from "@/hooks/use-dashboard-data";
import { getDateKey } from "@/utils/time";

type GarminEventType = string;

/**
 * Compute hydration tracking consistency from Garmin data.
 * Requires 30+ hydration events and 14+ days of data.
 */
export function computeHydrationConsistency(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  if (!stats.effectiveRange) return null;

  // Filter to Garmin hydration events
  const hydrationEvents = events.filter(
    (e) =>
      e.source === "garmin" &&
      e.eventType === "wellness_log" &&
      e.metadata.garminEventType === "CONNECT_HYDRATION",
  );

  if (hydrationEvents.length < 30) return null;

  // Compute total days in range
  const totalMs = stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime();
  const totalDays = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24)));

  if (totalDays < 14) return null;

  // Count unique days with hydration tracking
  const trackingDays = new Set<string>();
  for (const e of hydrationEvents) {
    trackingDays.add(getDateKey(e.timestamp));
  }

  const rate = Math.round((trackingDays.size / totalDays) * 100);

  // Compute longest streak and longest gap
  const sortedDays = [...trackingDays].sort();
  let longestStreak = 1;
  let currentStreak = 1;
  let longestGap = 0;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentStreak++;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else {
      currentStreak = 1;
      if (diffDays - 1 > longestGap) longestGap = diffDays - 1;
    }
  }

  return {
    id: "hydration-consistency",
    icon: "activity",
    titleKey: "inference.hydration.title",
    titleParams: { rate, days: trackingDays.size },
    descKey: "inference.hydration.desc",
    descParams: { streak: longestStreak, gap: longestGap, totalDays },
    privacyKey: "inference.hydration.privacy",
  };
}

// Helper to filter Garmin wellness events by garminEventType
function filterGarminEvents(events: MetadataEvent[], type: GarminEventType): MetadataEvent[] {
  return events.filter(
    (e) => e.source === "garmin" && e.eventType === "wellness_log" && e.metadata.garminEventType === type,
  );
}

/**
 * Activity Summary — requires 3+ activities.
 */
export function computeActivitySummary(
  events: MetadataEvent[],
): InferenceCard | null {
  const activities = filterGarminEvents(events, "ACTIVITY");
  if (activities.length < 3) return null;

  // Group by activity type
  const byType = new Map<string, { count: number; totalMs: number; totalCal: number }>();
  for (const e of activities) {
    const type = (e.metadata.activityType as string) ?? "unknown";
    const existing = byType.get(type) ?? { count: 0, totalMs: 0, totalCal: 0 };
    existing.count++;
    existing.totalMs += (e.metadata.durationMs as number) ?? 0;
    existing.totalCal += (e.metadata.calories as number) ?? 0;
    byType.set(type, existing);
  }

  const types = [...byType.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([type, data]) => `${type.replace(/_/g, " ")} (${data.count})`)
    .slice(0, 3)
    .join(", ");

  const totalHours = Math.round(
    [...byType.values()].reduce((s, d) => s + d.totalMs, 0) / 3_600_000 * 10,
  ) / 10;

  const avgCalories = Math.round(
    [...byType.values()].reduce((s, d) => s + d.totalCal, 0) / activities.length,
  );

  return {
    id: "garmin-activity-summary",
    icon: "activity",
    titleKey: "inference.garminActivity.title",
    titleParams: { count: activities.length },
    descKey: "inference.garminActivity.desc",
    descParams: { types, hours: totalHours, avgCalories },
    privacyKey: "inference.garminActivity.privacy",
  };
}

/**
 * Sleep Pattern — requires 7+ sleep records (excluding OFF_WRIST).
 */
export function computeGarminSleepPattern(
  events: MetadataEvent[],
): InferenceCard | null {
  const sleepEvents = filterGarminEvents(events, "SLEEP").filter(
    (e) => e.metadata.isWorn === true,
  );
  if (sleepEvents.length < 7) return null;

  const bedHours: number[] = [];
  const wakeHours: number[] = [];
  const durations: number[] = [];

  for (const e of sleepEvents) {
    const startStr = e.metadata.sleepStartGmt as string | undefined;
    const endStr = e.metadata.sleepEndGmt as string | undefined;
    if (!startStr || !endStr) continue;
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    bedHours.push(start.getUTCHours() + start.getUTCMinutes() / 60);
    wakeHours.push(end.getUTCHours() + end.getUTCMinutes() / 60);
    durations.push((end.getTime() - start.getTime()) / 3_600_000);
  }

  if (durations.length < 7) return null;

  const avgBed = Math.round(bedHours.reduce((a, b) => a + b, 0) / bedHours.length * 10) / 10;
  const avgWake = Math.round(wakeHours.reduce((a, b) => a + b, 0) / wakeHours.length * 10) / 10;
  const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10;

  const formatHour = (h: number) => {
    const hh = Math.floor(h);
    const mm = String(Math.round((h - hh) * 60)).padStart(2, "0");
    return `${String(hh).padStart(2, "0")}:${mm}`;
  };

  return {
    id: "garmin-sleep-pattern",
    icon: "moon",
    titleKey: "inference.garminSleep.title",
    titleParams: { avgDuration },
    descKey: "inference.garminSleep.desc",
    descParams: { bedtime: formatHour(avgBed), wakeTime: formatHour(avgWake), nights: durations.length },
    privacyKey: "inference.garminSleep.privacy",
  };
}

/**
 * Step Goal Consistency — requires 7+ daily summaries.
 */
export function computeStepGoalConsistency(
  events: MetadataEvent[],
): InferenceCard | null {
  const dailies = filterGarminEvents(events, "DAILY_SUMMARY");
  if (dailies.length < 7) return null;

  let metCount = 0;
  let totalSteps = 0;
  let totalGoal = 0;
  let daysWithGoal = 0;

  for (const e of dailies) {
    const steps = e.metadata.totalSteps as number | undefined;
    const goal = e.metadata.dailyStepGoal as number | undefined;
    if (steps != null) totalSteps += steps;
    if (goal != null && goal > 0) {
      totalGoal += goal;
      daysWithGoal++;
      if (steps != null && steps >= goal) metCount++;
    }
  }

  if (daysWithGoal < 7) return null;

  const metPct = Math.round((metCount / daysWithGoal) * 100);
  const avgSteps = Math.round(totalSteps / dailies.length);
  const avgGoal = Math.round(totalGoal / daysWithGoal);

  return {
    id: "garmin-step-goals",
    icon: "trending-up",
    titleKey: "inference.garminSteps.title",
    titleParams: { metPct },
    descKey: "inference.garminSteps.desc",
    descParams: { avgSteps, avgGoal, days: daysWithGoal },
    privacyKey: "inference.garminSteps.privacy",
  };
}

/**
 * Body Battery Pattern — requires 7+ daily summaries with body battery data.
 */
export function computeBodyBatteryPattern(
  events: MetadataEvent[],
): InferenceCard | null {
  const dailies = filterGarminEvents(events, "DAILY_SUMMARY").filter(
    (e) => e.metadata.bodyBatteryHigh != null && e.metadata.bodyBatteryLow != null,
  );
  if (dailies.length < 7) return null;

  let totalHigh = 0;
  let totalLow = 0;

  for (const e of dailies) {
    totalHigh += e.metadata.bodyBatteryHigh as number;
    totalLow += e.metadata.bodyBatteryLow as number;
  }

  const avgHigh = Math.round(totalHigh / dailies.length);
  const avgLow = Math.round(totalLow / dailies.length);
  const avgSwing = avgHigh - avgLow;

  return {
    id: "garmin-body-battery",
    icon: "activity",
    titleKey: "inference.garminBattery.title",
    titleParams: { avgHigh, avgLow },
    descKey: "inference.garminBattery.desc",
    descParams: { swing: avgSwing, days: dailies.length },
    privacyKey: "inference.garminBattery.privacy",
  };
}

/**
 * Stress Pattern — requires 7+ daily summaries with stress data.
 */
export function computeStressPattern(
  events: MetadataEvent[],
): InferenceCard | null {
  const dailies = filterGarminEvents(events, "DAILY_SUMMARY").filter(
    (e) => e.metadata.avgStressLevel != null,
  );
  if (dailies.length < 7) return null;

  let totalStress = 0;
  let highStressDays = 0;

  for (const e of dailies) {
    const avg = e.metadata.avgStressLevel as number;
    totalStress += avg;
    if (avg > 50) highStressDays++;
  }

  const avgStress = Math.round(totalStress / dailies.length);
  const highPct = Math.round((highStressDays / dailies.length) * 100);

  return {
    id: "garmin-stress-pattern",
    icon: "trending-up",
    titleKey: "inference.garminStress.title",
    titleParams: { avgStress },
    descKey: "inference.garminStress.desc",
    descParams: { highPct, highDays: highStressDays, days: dailies.length },
    privacyKey: "inference.garminStress.privacy",
  };
}
