import type { MetadataEvent } from "../types";
import { makeGarminEvent, parseGarminDate } from "./utils";

interface GarminSleepRecord {
  sleepStartTimestampGMT?: string;
  sleepEndTimestampGMT?: string;
  calendarDate?: string;
  sleepWindowConfirmationType?: string;
  deepSleepSeconds?: number;
  lightSleepSeconds?: number;
  awakeSleepSeconds?: number;
  unmeasurableSeconds?: number;
  retro?: boolean;
}

export function parseGarminSleep(
  data: unknown,
): MetadataEvent[] {
  if (!Array.isArray(data)) return [];

  const events: MetadataEvent[] = [];

  for (const record of data as GarminSleepRecord[]) {
    // Use sleep end timestamp (wake time) as event timestamp
    const timestamp = parseGarminDate(record.sleepEndTimestampGMT)
      ?? parseGarminDate(record.sleepStartTimestampGMT);
    if (!timestamp) continue;

    const confirmationType = record.sleepWindowConfirmationType;

    events.push(
      makeGarminEvent("wellness_log", timestamp, "You", [], {
        garminEventType: "SLEEP",
        sleepStartGmt: record.sleepStartTimestampGMT,
        sleepEndGmt: record.sleepEndTimestampGMT,
        calendarDate: record.calendarDate,
        confirmationType,
        deepSleepSeconds: record.deepSleepSeconds,
        lightSleepSeconds: record.lightSleepSeconds,
        awakeSleepSeconds: record.awakeSleepSeconds,
        isWorn: confirmationType !== "OFF_WRIST",
      }),
    );
  }

  return events;
}
