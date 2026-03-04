import type { MetadataEvent } from "../types";
import { makeGarminEvent, parseEpochMs } from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SummarizedActivity {
  activityId?: number;
  name?: string;
  activityType?: string;
  sportType?: string;
  beginTimestamp?: number;
  duration?: number;
  elapsedDuration?: number;
  movingDuration?: number;
  distance?: number;
  elevationGain?: number;
  elevationLoss?: number;
  avgHr?: number;
  maxHr?: number;
  minHr?: number;
  calories?: number;
  bmrCalories?: number;
  steps?: number;
  startLatitude?: number;
  startLongitude?: number;
  endLatitude?: number;
  endLongitude?: number;
  locationName?: string;
  vO2MaxValue?: number;
  deviceId?: number;
  summarizedExerciseSets?: any[];
}

export function parseGarminActivities(
  data: unknown,
): MetadataEvent[] {
  if (!Array.isArray(data)) return [];

  const events: MetadataEvent[] = [];

  for (const wrapper of data) {
    const activities: SummarizedActivity[] = wrapper?.summarizedActivitiesExport;
    if (!Array.isArray(activities)) continue;

    for (const act of activities) {
      const timestamp = parseEpochMs(act.beginTimestamp);
      if (!timestamp) continue;

      events.push(
        makeGarminEvent("wellness_log", timestamp, "You", [], {
          garminEventType: "ACTIVITY",
          activityId: act.activityId,
          activityType: act.activityType,
          sportType: act.sportType,
          name: act.name,
          durationMs: act.duration,
          distanceMeters: act.distance != null ? act.distance / 1000 : undefined,
          calories: act.calories,
          bmrCalories: act.bmrCalories,
          avgHr: act.avgHr,
          maxHr: act.maxHr,
          minHr: act.minHr,
          steps: act.steps,
          elevationGainM: act.elevationGain != null ? act.elevationGain / 100 : undefined,
          elevationLossM: act.elevationLoss != null ? act.elevationLoss / 100 : undefined,
          vO2MaxValue: act.vO2MaxValue,
          deviceId: act.deviceId,
        }),
      );

      // Emit location event if GPS coords available
      if (act.startLatitude != null && act.startLongitude != null) {
        events.push(
          makeGarminEvent("location", timestamp, "You", [], {
            garminEventType: "ACTIVITY_LOCATION",
            latitude: act.startLatitude,
            longitude: act.startLongitude,
            locationName: act.locationName,
            activityType: act.activityType,
          }),
        );
      }
    }
  }

  return events;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
