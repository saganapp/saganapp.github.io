import { unzip } from "fflate";
import type { MetadataEvent, DailyAggregate, ParseProgressCallback } from "../types";
import { resetIdCounter } from "./utils";
import { parseGarminEvents } from "./events";
import { parseGarminComments, parseGarminLikes } from "./social";
import { parseGarminWorkouts, parseGarminGear, parseGarminBiometrics, parseGarminGoals, parseGarminPersonalRecords } from "./fitness";
import { parseGarminActivities } from "./activities";
import { parseGarminSleep } from "./sleep";
import { parseGarminDailySummary } from "./daily-summary";
import { parseGarminLifestyleLogging, parseGarminHydrationLog } from "./wellness";
import { parseGarminDevices } from "./devices";

export interface GarminBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

const BATCH_SIZE = 1000;

/**
 * Parse a Garmin GDPR export ZIP.
 * Extracts events.json, social files, fitness files, and goal files.
 */
export async function* parseGarminExport(
  files: File[],
  onProgress?: ParseProgressCallback,
): AsyncGenerator<GarminBatch> {
  resetIdCounter();
  let totalEvents = 0;

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".zip")) continue;

    onProgress?.({
      phase: "reading",
      progress: 0,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    onProgress?.({
      phase: "extracting",
      progress: 0.1,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    const unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(data, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    onProgress?.({
      phase: "parsing",
      progress: 0.3,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    const allEvents: MetadataEvent[] = [];
    const decoder = new TextDecoder();

    // Helper to parse JSON from a zip entry
    const parseJson = (key: string) => {
      const entry = unzipped[key];
      if (!entry) return null;
      try {
        return JSON.parse(decoder.decode(entry));
      } catch {
        return null;
      }
    };

    // 1. Main events.json
    const eventsKey = Object.keys(unzipped).find(
      (k) => k === "IT_GLOBAL_EVENT/events.json" || k.endsWith("/events.json"),
    );
    if (eventsKey) {
      const eventsData = parseJson(eventsKey);
      if (Array.isArray(eventsData)) {
        allEvents.push(...parseGarminEvents(eventsData));
      }
    }

    // 2. Social files
    for (const key of Object.keys(unzipped)) {
      if (key.includes("DI-Connect-Social/") || key.includes("DI_CONNECT/DI-Connect-Social/")) {
        if (key.endsWith("-comments.json")) {
          const data = parseJson(key);
          if (Array.isArray(data)) {
            allEvents.push(...parseGarminComments(data));
          }
        } else if (key.endsWith("-likes.json")) {
          const data = parseJson(key);
          if (Array.isArray(data)) {
            allEvents.push(...parseGarminLikes(data));
          }
        }
      }
    }

    // 3. Fitness files
    for (const key of Object.keys(unzipped)) {
      if (key.includes("DI-Connect-Fitness/") || key.includes("DI_CONNECT/DI-Connect-Fitness/")) {
        if (key.endsWith("_workout.json")) {
          const data = parseJson(key);
          allEvents.push(...parseGarminWorkouts(data));
        } else if (key.endsWith("_gear.json")) {
          const data = parseJson(key);
          allEvents.push(...parseGarminGear(data));
        }
      }
      if (key.includes("DI-Connect-Wellness/") || key.includes("DI_CONNECT/DI-Connect-Wellness/")) {
        if (key.endsWith("_userBioMetrics.json")) {
          const data = parseJson(key);
          if (Array.isArray(data)) {
            allEvents.push(...parseGarminBiometrics(data));
          }
        }
      }
    }

    // 4. Goal files
    for (const key of Object.keys(unzipped)) {
      if (
        (key.includes("DI-Connect-User/") || key.includes("DI_CONNECT/DI-Connect-User/")) &&
        key.match(/UserGoal_.*\.json$/)
      ) {
        const data = parseJson(key);
        if (Array.isArray(data)) {
          allEvents.push(...parseGarminGoals(data));
        }
      }
    }

    // 5. Summarized Activities
    for (const key of Object.keys(unzipped)) {
      if (
        (key.includes("DI-Connect-Fitness/") || key.includes("DI_CONNECT/DI-Connect-Fitness/")) &&
        key.includes("_summarizedActivities.json")
      ) {
        const data = parseJson(key);
        if (data) allEvents.push(...parseGarminActivities(Array.isArray(data) ? data : [data]));
      }
    }

    // 6. Sleep Data
    for (const key of Object.keys(unzipped)) {
      if (
        (key.includes("DI-Connect-Wellness/") || key.includes("DI_CONNECT/DI-Connect-Wellness/")) &&
        key.includes("_sleepData.json")
      ) {
        const data = parseJson(key);
        if (Array.isArray(data)) allEvents.push(...parseGarminSleep(data));
      }
    }

    // 7. User Daily Summary (UDS) files
    for (const key of Object.keys(unzipped)) {
      if (
        (key.includes("DI-Connect-Aggregator/") || key.includes("DI_CONNECT/DI-Connect-Aggregator/")) &&
        key.match(/UDSFile_.*\.json$/)
      ) {
        const data = parseJson(key);
        if (Array.isArray(data)) allEvents.push(...parseGarminDailySummary(data));
      }
    }

    // 8. Personal Records
    for (const key of Object.keys(unzipped)) {
      if (
        (key.includes("DI-Connect-Fitness/") || key.includes("DI_CONNECT/DI-Connect-Fitness/")) &&
        key.includes("_personalRecord.json")
      ) {
        const data = parseJson(key);
        if (data) allEvents.push(...parseGarminPersonalRecords(Array.isArray(data) ? data : [data]));
      }
    }

    // 9. Lifestyle Logging
    for (const key of Object.keys(unzipped)) {
      if (
        (key.includes("DI-Connect-Wellness/") || key.includes("DI_CONNECT/DI-Connect-Wellness/")) &&
        key.includes("_LifestyleLogging.json")
      ) {
        const data = parseJson(key);
        if (data) allEvents.push(...parseGarminLifestyleLogging(Array.isArray(data) ? data : [data]));
      }
    }

    // 10. Hydration Log
    for (const key of Object.keys(unzipped)) {
      if (
        (key.includes("DI-Connect-Aggregator/") || key.includes("DI_CONNECT/DI-Connect-Aggregator/")) &&
        key.match(/HydrationLogFile_.*\.json$/)
      ) {
        const data = parseJson(key);
        if (Array.isArray(data)) allEvents.push(...parseGarminHydrationLog(data));
      }
    }

    // 11. Device Info
    for (const key of Object.keys(unzipped)) {
      if (
        (key.includes("IT_DEVICE_AND_CONTENT/") || key.includes("IT_DEVICE_AND_CONTENT/")) &&
        key.endsWith("devicesandcontent.json")
      ) {
        const data = parseJson(key);
        if (data) allEvents.push(...parseGarminDevices(data));
      }
    }

    // Sort all events by timestamp
    allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Yield in batches
    for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
      const batch = allEvents.slice(i, i + BATCH_SIZE);
      totalEvents += batch.length;
      yield { events: batch, aggregates: [] };

      onProgress?.({
        phase: "parsing",
        progress: 0.3 + 0.7 * (i / allEvents.length),
        eventsProcessed: totalEvents,
        currentFile: file.name,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    onProgress?.({
      phase: "parsing",
      progress: 1,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });
  }
}
