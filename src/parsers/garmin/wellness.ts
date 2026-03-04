import type { MetadataEvent } from "../types";
import { makeGarminEvent, parseGarminDateArray, parseGarminDate } from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Lifestyle Logging ---

interface LifestyleDailyLog {
  behaviourName?: string;
  status?: string;
  calendarDate?: number[];
  dailyLogDetailDTOList?: { subTypeId?: number; amount?: number }[];
}

interface LifestyleLoggingData {
  dailyLogList?: LifestyleDailyLog[];
  trackedBehaviourList?: any[];
}

export function parseGarminLifestyleLogging(
  data: unknown,
): MetadataEvent[] {
  if (!Array.isArray(data)) return [];

  const events: MetadataEvent[] = [];

  for (const wrapper of data as LifestyleLoggingData[]) {
    if (!Array.isArray(wrapper?.dailyLogList)) continue;

    for (const log of wrapper.dailyLogList) {
      const timestamp = parseGarminDateArray(log.calendarDate);
      if (!timestamp) continue;

      const detail = log.dailyLogDetailDTOList?.[0];

      events.push(
        makeGarminEvent("wellness_log", timestamp, "You", [], {
          garminEventType: "LIFESTYLE_LOG",
          behaviourName: log.behaviourName,
          status: log.status,
          amount: detail?.amount,
        }),
      );
    }
  }

  return events;
}

// --- Hydration Log ---

interface HydrationLogEntry {
  calendarDate?: string;
  hydrationSource?: string;
  valueInML?: number;
  estimatedSweatLossInML?: number;
  activityId?: number;
  duration?: number;
  timestampLocal?: string;
}

export function parseGarminHydrationLog(
  data: unknown,
): MetadataEvent[] {
  if (!Array.isArray(data)) return [];

  const events: MetadataEvent[] = [];

  for (const entry of data as HydrationLogEntry[]) {
    const timestamp = parseGarminDate(entry.timestampLocal) ?? parseGarminDate(entry.calendarDate);
    if (!timestamp) continue;

    events.push(
      makeGarminEvent("wellness_log", timestamp, "You", [], {
        garminEventType: "HYDRATION_LOG",
        estimatedSweatLossMl: entry.estimatedSweatLossInML,
        durationSeconds: entry.duration,
        activityId: entry.activityId,
        hydrationSource: entry.hydrationSource,
      }),
    );
  }

  return events;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
