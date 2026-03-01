import type { MetadataEvent } from "@/parsers/types";
import type { RecurringLull } from "./lulls";
import { getDateKey } from "@/utils/time";

export type SleepingPattern = RecurringLull;

/** Night-window hours: 22,23,0,1,2,3,4,5,6,7 (10 hours) */
const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4, 5, 6, 7];

/** Map an hour to a linear night index (0–9). Returns -1 if outside night window. */
function nightIndex(hour: number): number {
  if (hour >= 22) return hour - 22; // 22→0, 23→1
  if (hour <= 7) return hour + 2;   // 0→2, 1→3, ..., 7→9
  return -1;
}

/**
 * For post-midnight hours (0–7), the "night" belongs to the previous calendar day.
 * E.g. an event at 2 AM on Tuesday belongs to Monday night.
 */
function nightDayOfWeek(timestamp: Date): number {
  const hour = timestamp.getHours();
  const dow = timestamp.getDay();
  if (hour <= 7) return (dow + 6) % 7; // previous day
  return dow;
}

/**
 * Week key for a night. Post-midnight hours belong to the previous day's week.
 */
function nightWeekKey(timestamp: Date): string {
  const adjusted = new Date(timestamp);
  if (timestamp.getHours() <= 7) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  const weekStart = new Date(adjusted);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(12, 0, 0, 0);
  return getDateKey(weekStart);
}

export function detectSleepingPatterns(events: MetadataEvent[]): SleepingPattern[] {
  if (events.length < 50) return [];

  // Build per-day-of-week night-hour counts (10 night indices per day)
  const nightCounts: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 10 }, () => 0),
  );
  const weeksByDay = new Map<number, Set<string>>();

  for (const e of events) {
    const hour = e.timestamp.getHours();
    const ni = nightIndex(hour);
    if (ni === -1) continue;

    const day = nightDayOfWeek(e.timestamp);
    nightCounts[day][ni]++;

    if (!weeksByDay.has(day)) weeksByDay.set(day, new Set());
    weeksByDay.get(day)!.add(nightWeekKey(e.timestamp));
  }

  // Build per-week night matrices for cross-validation
  const weekNightly = new Map<string, number[][]>(); // weekKey -> [7][10]
  for (const e of events) {
    const hour = e.timestamp.getHours();
    const ni = nightIndex(hour);
    if (ni === -1) continue;

    const weekKey = nightWeekKey(e.timestamp);
    if (!weekNightly.has(weekKey)) {
      weekNightly.set(weekKey, Array.from({ length: 7 }, () =>
        Array.from({ length: 10 }, () => 0),
      ));
    }
    weekNightly.get(weekKey)![nightDayOfWeek(e.timestamp)][ni]++;
  }

  const totalWeeks = weekNightly.size;
  if (totalWeeks < 3) return [];

  // Compute night-hour averages per day of week
  const nightAvg: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 10 }, () => 0),
  );
  for (let d = 0; d < 7; d++) {
    const weekCount = weeksByDay.get(d)?.size ?? 1;
    for (let ni = 0; ni < 10; ni++) {
      nightAvg[d][ni] = nightCounts[d][ni] / weekCount;
    }
  }

  // For each day, find contiguous quiet runs of ≥4 hours during the night window
  interface DayWindow { day: number; startIdx: number; endIdx: number }
  const dayWindows: DayWindow[] = [];

  for (let d = 0; d < 7; d++) {
    const avg = nightAvg[d];
    const peak = Math.max(...avg);
    if (peak < 0.1) continue;

    const threshold = peak * 0.20;

    let gapStart = -1;
    for (let ni = 0; ni <= 10; ni++) {
      const isLow = ni < 10 && avg[ni] < threshold;
      if (isLow && gapStart === -1) {
        gapStart = ni;
      } else if (!isLow && gapStart !== -1) {
        const length = ni - gapStart;
        if (length >= 4) {
          dayWindows.push({ day: d, startIdx: gapStart, endIdx: ni });
        }
        gapStart = -1;
      }
    }
  }

  // Convert night indices back to hours
  function idxToHour(idx: number): number {
    return NIGHT_HOURS[idx];
  }

  // Group windows by (startHour, endHour) across days
  const groups = new Map<string, number[]>();
  for (const w of dayWindows) {
    const startHour = idxToHour(w.startIdx);
    const endHour = w.endIdx < 10 ? NIGHT_HOURS[w.endIdx] : 8; // endIdx=10 means end of night window (hour 8)
    const key = `${startHour}-${endHour}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(w.day);
  }

  // Filter: must appear on ≥2 different days
  const patterns: SleepingPattern[] = [];
  for (const [key, daysOfWeek] of groups) {
    if (daysOfWeek.length < 2) continue;

    const [startStr, endStr] = key.split("-");
    const startHour = Number(startStr);
    const endHour = Number(endStr);
    const startIdx = NIGHT_HOURS.indexOf(startHour);
    const endIdx = endHour === 8 ? 10 : NIGHT_HOURS.indexOf(endHour);

    // Cross-validate across weeks
    let weeksWithGap = 0;
    for (const [, weekMatrix] of weekNightly) {
      let matchingDays = 0;
      for (const d of daysOfWeek) {
        const weekDayAvg = weekMatrix[d].reduce((a, b) => a + b, 0) / 10;
        if (weekDayAvg < 0.5) {
          matchingDays++;
          continue;
        }
        const gapSlots = weekMatrix[d].slice(startIdx, endIdx);
        const maxInGap = Math.max(...gapSlots);
        if (maxInGap <= weekDayAvg * 0.3) matchingDays++;
      }
      if (matchingDays >= daysOfWeek.length / 2) weeksWithGap++;
    }

    const confidence = totalWeeks > 0 ? weeksWithGap / totalWeeks : 0;
    if (confidence >= 0.5) {
      patterns.push({
        daysOfWeek,
        startHour,
        endHour,
        confidence,
        weekCount: weeksWithGap,
      });
    }
  }

  patterns.sort((a, b) => (b.daysOfWeek.length * b.confidence) - (a.daysOfWeek.length * a.confidence));
  return patterns;
}
