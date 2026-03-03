import type { MetadataEvent } from "@/parsers/types";
import { getDateKey } from "@/utils/time";

export interface RecurringLull {
  daysOfWeek: number[];
  startHour: number;
  endHour: number;
  confidence: number;
  weekCount: number;
}

export function detectRecurringLulls(events: MetadataEvent[]): RecurringLull[] {
  if (events.length < 50) return [];

  // Build per-day-of-week hourly counts and track unique weeks
  const hourly: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );
  const weeksByDay = new Map<number, Set<string>>();

  for (const e of events) {
    const day = e.timestamp.getDay();
    const hour = e.timestamp.getHours();
    hourly[day][hour]++;

    if (!weeksByDay.has(day)) weeksByDay.set(day, new Set());
    const wkStart = new Date(e.timestamp);
    wkStart.setDate(wkStart.getDate() - wkStart.getDay());
    wkStart.setHours(12, 0, 0, 0);
    weeksByDay.get(day)!.add(getDateKey(wkStart));
  }

  // Build per-week hourly matrices for cross-validation
  const weekHourly = new Map<string, number[][]>(); // weekKey -> [7][24]
  for (const e of events) {
    const d = e.timestamp;
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(12, 0, 0, 0);
    const weekKey = getDateKey(weekStart);

    if (!weekHourly.has(weekKey)) {
      weekHourly.set(weekKey, Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => 0),
      ));
    }
    weekHourly.get(weekKey)![e.timestamp.getDay()][e.timestamp.getHours()]++;
  }

  const totalWeeks = weekHourly.size;
  if (totalWeeks < 3) return [];

  // Compute hourly averages per day of week
  const hourlyAvg: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );
  for (let d = 0; d < 7; d++) {
    const weekCount = weeksByDay.get(d)?.size ?? 1;
    for (let h = 0; h < 24; h++) {
      hourlyAvg[d][h] = hourly[d][h] / weekCount;
    }
  }

  // For each day, find contiguous quiet windows during waking hours (8–22)
  // Windows must be 1–2 hours long (not overnight gaps)
  interface DayWindow { day: number; startHour: number; endHour: number }
  const dayWindows: DayWindow[] = [];

  for (let d = 0; d < 7; d++) {
    const wakingAvgs = hourlyAvg[d].slice(8, 22);
    const dayAvg = wakingAvgs.reduce((a, b) => a + b, 0) / wakingAvgs.length;
    if (dayAvg < 0.1) continue;

    const threshold = dayAvg * 0.30;

    let gapStart = -1;
    for (let h = 8; h <= 22; h++) {
      const isLow = h < 22 && hourlyAvg[d][h] < threshold;
      if (isLow && gapStart === -1) {
        gapStart = h;
      } else if (!isLow && gapStart !== -1) {
        const length = h - gapStart;
        if (length >= 1 && length <= 2) {
          dayWindows.push({ day: d, startHour: gapStart, endHour: h });
        }
        gapStart = -1;
      }
    }
  }

  // Group windows by (startHour, endHour) across days
  const groups = new Map<string, number[]>();
  for (const w of dayWindows) {
    const key = `${w.startHour}-${w.endHour}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(w.day);
  }

  // Filter: must appear on >=2 different days
  const lulls: RecurringLull[] = [];
  for (const [key, daysOfWeek] of groups) {
    if (daysOfWeek.length < 1) continue;

    const [startStr, endStr] = key.split("-");
    const startHour = Number(startStr);
    const endHour = Number(endStr);

    // Cross-validate: a week matches if at least half its listed days
    // show the quiet pattern (max activity in window <= 30% of waking avg)
    let weeksWithGap = 0;
    for (const [, weekMatrix] of weekHourly) {
      let matchingDays = 0;
      for (const d of daysOfWeek) {
        const weekDayAvg = weekMatrix[d].slice(8, 22).reduce((a, b) => a + b, 0) / 14;
        if (weekDayAvg < 0.5) {
          matchingDays++;
          continue;
        }
        const gapHours = weekMatrix[d].slice(startHour, endHour);
        const maxInGap = Math.max(...gapHours);
        if (maxInGap <= weekDayAvg * 0.3) matchingDays++;
      }
      if (matchingDays >= daysOfWeek.length / 2) weeksWithGap++;
    }

    const confidence = totalWeeks > 0 ? weeksWithGap / totalWeeks : 0;
    if (confidence >= 0.5) {
      lulls.push({
        daysOfWeek,
        startHour,
        endHour,
        confidence,
        weekCount: weeksWithGap,
      });
    }
  }

  lulls.sort((a, b) => (b.daysOfWeek.length * b.confidence) - (a.daysOfWeek.length * a.confidence));
  return lulls;
}
