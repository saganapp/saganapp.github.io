import type { MetadataEvent } from "@/parsers/types";
import type { InferenceCard, DashboardStats } from "@/hooks/use-dashboard-data";
import { getDateKey } from "@/utils/time";

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
