import type { MetadataEvent } from "../types";
import { makeGarminEvent, parseGarminDate, parseGarminLongDate } from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Workouts ---

interface GarminWorkoutData {
  workoutList?: {
    workoutName?: string;
    createdDate?: string;
    sportType?: { sportTypeKey?: string };
    workoutSteps?: any[];
  }[];
}

export function parseGarminWorkouts(entries: GarminWorkoutData | null | undefined): MetadataEvent[] {
  if (!entries?.workoutList || !Array.isArray(entries.workoutList)) return [];

  const events: MetadataEvent[] = [];

  for (const workout of entries.workoutList) {
    const timestamp = parseGarminDate(workout.createdDate);
    if (!timestamp) continue;

    events.push(
      makeGarminEvent("wellness_log", timestamp, "You", [], {
        garminEventType: "CONNECT_WORKOUT",
        name: workout.workoutName,
        sportType: workout.sportType?.sportTypeKey,
        steps: workout.workoutSteps?.length ?? 0,
      }),
    );
  }

  return events;
}

// --- Gear ---

interface GarminGearData {
  gearDTOS?: {
    displayName?: string;
    productSku?: string;
    createDate?: string;
    dateBegin?: string;
    gearTypeName?: string;
    gearStatusName?: string;
  }[];
}

export function parseGarminGear(entries: GarminGearData | null | undefined): MetadataEvent[] {
  if (!entries?.gearDTOS || !Array.isArray(entries.gearDTOS)) return [];

  const events: MetadataEvent[] = [];

  for (const gear of entries.gearDTOS) {
    const timestamp = parseGarminDate(gear.createDate ?? gear.dateBegin);
    if (!timestamp) continue;

    events.push(
      makeGarminEvent("profile_update", timestamp, "You", [], {
        garminEventType: "CONNECT_GEAR",
        displayName: gear.displayName,
        productSku: gear.productSku,
        gearType: gear.gearTypeName,
        status: gear.gearStatusName,
      }),
    );
  }

  return events;
}

// --- Biometrics ---

interface GarminBiometricEntry {
  metaData?: { calendarDate?: string };
  weight?: { weight?: number; sourceType?: string };
  height?: number;
  vo2MaxRunning?: number;
}

export function parseGarminBiometrics(entries: GarminBiometricEntry[] | null | undefined): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const timestamp = parseGarminDate(entry.metaData?.calendarDate);
    if (!timestamp) continue;

    // Determine what metric was logged
    let metricType = "biometric";
    let value: number | undefined;
    if (entry.weight?.weight != null) {
      metricType = "weight";
      value = entry.weight.weight;
    } else if (entry.height != null) {
      metricType = "height";
      value = entry.height;
    } else if (entry.vo2MaxRunning != null) {
      metricType = "vo2max";
      value = entry.vo2MaxRunning;
    }

    events.push(
      makeGarminEvent("wellness_log", timestamp, "You", [], {
        garminEventType: "CONNECT_PROFILE_WEIGHT",
        metricType,
        value,
      }),
    );
  }

  return events;
}

// --- Goals ---

interface GarminGoalEntry {
  userGoalType?: string;
  goalValue?: string;
  createDate?: { date?: string };
  updateDate?: { date?: string };
}

export function parseGarminGoals(entries: GarminGoalEntry[] | null | undefined): MetadataEvent[] {
  if (!entries || !Array.isArray(entries)) return [];

  const events: MetadataEvent[] = [];

  for (const goal of entries) {
    // Try createDate first, fall back to updateDate
    const dateStr = goal.createDate?.date ?? goal.updateDate?.date;
    if (!dateStr) continue;

    const timestamp = new Date(dateStr);
    if (isNaN(timestamp.getTime())) continue;

    events.push(
      makeGarminEvent("wellness_log", timestamp, "You", [], {
        garminEventType: "CONNECT_WELLNESS_GOAL",
        goalType: goal.userGoalType,
        goalValue: goal.goalValue,
      }),
    );
  }

  return events;
}

// --- Personal Records ---

interface GarminPersonalRecord {
  personalRecordId?: number;
  activityId?: number;
  value?: number;
  prStartTimeGMT?: string;
  personalRecordType?: string;
  createdDate?: string;
  current?: boolean;
}

interface PersonalRecordWrapper {
  personalRecords?: GarminPersonalRecord[];
}

export function parseGarminPersonalRecords(
  data: unknown,
): MetadataEvent[] {
  if (!Array.isArray(data)) return [];

  const events: MetadataEvent[] = [];

  for (const wrapper of data as PersonalRecordWrapper[]) {
    if (!Array.isArray(wrapper?.personalRecords)) continue;

    for (const record of wrapper.personalRecords) {
      const timestamp = parseGarminLongDate(record.prStartTimeGMT)
        ?? parseGarminDate(record.createdDate);
      if (!timestamp) continue;

      events.push(
        makeGarminEvent("wellness_log", timestamp, "You", [], {
          garminEventType: "PERSONAL_RECORD",
          recordType: record.personalRecordType,
          value: record.value,
          current: record.current,
          activityId: record.activityId,
        }),
      );
    }
  }

  return events;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
