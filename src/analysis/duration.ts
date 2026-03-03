import type { MetadataEvent, Platform } from "@/parsers/types";
import { EVENT_DURATION_SECONDS } from "@/parsers/types";

export function estimateEventDuration(event: MetadataEvent): number {
  if (event.source === "spotify" && typeof event.metadata.msPlayed === "number") {
    return event.metadata.msPlayed / 1000;
  }
  return EVENT_DURATION_SECONDS[event.eventType];
}

export function estimateTotalTime(events: MetadataEvent[]): number {
  let total = 0;
  for (const e of events) {
    total += estimateEventDuration(e);
  }
  return total;
}

export function estimateTimeByPlatform(events: MetadataEvent[]): Record<Platform, number> {
  const result = {} as Record<Platform, number>;
  for (const e of events) {
    const dur = estimateEventDuration(e);
    result[e.source] = (result[e.source] ?? 0) + dur;
  }
  return result;
}

export interface WorkHoursAnalysis {
  totalSeconds: number;
  weeklyMinutes: number;
  percentOfWorkHours: number;
  byPlatform: Record<Platform, number>;
}

export function estimateWorkHoursWasted(
  events: MetadataEvent[],
  effectiveRange: { start: Date; end: Date },
): WorkHoursAnalysis {
  const workEvents = events.filter((e) => {
    const day = e.timestamp.getDay();
    const hour = e.timestamp.getHours();
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  });

  let totalSeconds = 0;
  const byPlatform = {} as Record<Platform, number>;
  for (const e of workEvents) {
    const dur = estimateEventDuration(e);
    totalSeconds += dur;
    byPlatform[e.source] = (byPlatform[e.source] ?? 0) + dur;
  }

  const totalMs = effectiveRange.end.getTime() - effectiveRange.start.getTime();
  const totalWeeks = Math.max(1, totalMs / (1000 * 60 * 60 * 24 * 7));
  const weeklyMinutes = Math.round(totalSeconds / totalWeeks / 60);

  // Available work hours in range: ~40h/week
  const totalWorkHoursAvailable = totalWeeks * 40;
  const totalWorkSecondsAvailable = totalWorkHoursAvailable * 3600;
  const percentOfWorkHours = totalWorkSecondsAvailable > 0
    ? Math.round((totalSeconds / totalWorkSecondsAvailable) * 1000) / 10
    : 0;

  return { totalSeconds, weeklyMinutes, percentOfWorkHours, byPlatform };
}
