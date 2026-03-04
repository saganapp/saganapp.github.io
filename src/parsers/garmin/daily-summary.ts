import type { MetadataEvent } from "../types";
import { makeGarminEvent } from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface UDSRecord {
  calendarDate?: string;
  totalSteps?: number;
  dailyStepGoal?: number;
  totalDistanceMeters?: number;
  totalKilocalories?: number;
  activeKilocalories?: number;
  bmrKilocalories?: number;
  minHeartRate?: number;
  maxHeartRate?: number;
  restingHeartRate?: number;
  currentDayRestingHeartRate?: number;
  floorsAscendedInMeters?: number;
  activeSeconds?: number;
  highlyActiveSeconds?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;
  allDayStress?: {
    aggregatorList?: {
      type?: string;
      averageStressLevel?: number;
      maxStressLevel?: number;
    }[];
  };
  bodyBattery?: {
    chargedValue?: number;
    drainedValue?: number;
    bodyBatteryStatList?: {
      bodyBatteryStatType?: string;
      statsValue?: number;
    }[];
  };
  respiration?: {
    avgWakingRespirationValue?: number;
    highestRespirationValue?: number;
    lowestRespirationValue?: number;
  };
  hydration?: {
    goalInML?: number;
    valueInML?: number;
    sweatLossInML?: number;
  };
}

export function parseGarminDailySummary(
  data: unknown,
): MetadataEvent[] {
  if (!Array.isArray(data)) return [];

  const events: MetadataEvent[] = [];

  for (const record of data as UDSRecord[]) {
    if (!record.calendarDate) continue;

    // Parse to noon to avoid TZ issues
    const timestamp = new Date(`${record.calendarDate}T12:00:00`);
    if (isNaN(timestamp.getTime())) continue;

    // Extract stress data from nested structure
    const totalStress = record.allDayStress?.aggregatorList?.find(
      (a: any) => a.type === "TOTAL",
    );

    // Extract body battery high/low
    let bodyBatteryHigh: number | undefined;
    let bodyBatteryLow: number | undefined;
    if (record.bodyBattery?.bodyBatteryStatList) {
      for (const stat of record.bodyBattery.bodyBatteryStatList) {
        if (stat.bodyBatteryStatType === "HIGHEST") bodyBatteryHigh = stat.statsValue;
        if (stat.bodyBatteryStatType === "LOWEST") bodyBatteryLow = stat.statsValue;
      }
    }

    events.push(
      makeGarminEvent("wellness_log", timestamp, "You", [], {
        garminEventType: "DAILY_SUMMARY",
        calendarDate: record.calendarDate,
        totalSteps: record.totalSteps,
        dailyStepGoal: record.dailyStepGoal,
        totalDistanceMeters: record.totalDistanceMeters,
        totalCalories: record.totalKilocalories,
        activeCalories: record.activeKilocalories,
        minHr: record.minHeartRate,
        maxHr: record.maxHeartRate,
        restingHr: record.restingHeartRate ?? record.currentDayRestingHeartRate,
        floorsAscendedM: record.floorsAscendedInMeters,
        activeSeconds: record.activeSeconds,
        highlyActiveSeconds: record.highlyActiveSeconds,
        moderateIntensityMinutes: record.moderateIntensityMinutes,
        vigorousIntensityMinutes: record.vigorousIntensityMinutes,
        avgStressLevel: totalStress?.averageStressLevel,
        maxStressLevel: totalStress?.maxStressLevel,
        bodyBatteryHigh,
        bodyBatteryLow,
        bodyBatteryCharged: record.bodyBattery?.chargedValue,
        bodyBatteryDrained: record.bodyBattery?.drainedValue,
        avgWakingRespiration: record.respiration?.avgWakingRespirationValue,
        hydrationGoalML: record.hydration?.goalInML,
        hydrationValueML: record.hydration?.valueInML,
        hydrationSweatLossML: record.hydration?.sweatLossInML,
      }),
    );
  }

  return events;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
