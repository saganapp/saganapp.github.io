import { describe, it, expect, beforeEach } from "vitest";
import { resetIdCounter } from "@/parsers/garmin/utils";
import { parseGarminDailySummary } from "@/parsers/garmin/daily-summary";

describe("parseGarminDailySummary", () => {
  beforeEach(() => resetIdCounter());

  it("parses daily summary records", () => {
    const data = [
      {
        calendarDate: "2026-03-02",
        totalSteps: 11789,
        dailyStepGoal: 4960,
        totalKilocalories: 2378,
        activeKilocalories: 419,
        minHeartRate: 54,
        maxHeartRate: 112,
        restingHeartRate: 77,
        moderateIntensityMinutes: 13,
        vigorousIntensityMinutes: 0,
        allDayStress: {
          aggregatorList: [
            { type: "TOTAL", averageStressLevel: 35, maxStressLevel: 72 },
            { type: "AWAKE", averageStressLevel: 40, maxStressLevel: 72 },
          ],
        },
        bodyBattery: {
          chargedValue: 50,
          drainedValue: 45,
          bodyBatteryStatList: [
            { bodyBatteryStatType: "HIGHEST", statsValue: 84 },
            { bodyBatteryStatType: "LOWEST", statsValue: 22 },
          ],
        },
        respiration: {
          avgWakingRespirationValue: 16,
        },
      },
    ];

    const events = parseGarminDailySummary(data);
    expect(events).toHaveLength(1);

    const e = events[0];
    expect(e.metadata.garminEventType).toBe("DAILY_SUMMARY");
    expect(e.metadata.totalSteps).toBe(11789);
    expect(e.metadata.dailyStepGoal).toBe(4960);
    expect(e.metadata.restingHr).toBe(77);
    expect(e.metadata.avgStressLevel).toBe(35);
    expect(e.metadata.maxStressLevel).toBe(72);
    expect(e.metadata.bodyBatteryHigh).toBe(84);
    expect(e.metadata.bodyBatteryLow).toBe(22);
    expect(e.metadata.avgWakingRespiration).toBe(16);
  });

  it("handles missing nested data gracefully", () => {
    const data = [
      {
        calendarDate: "2026-01-15",
        totalSteps: 5000,
      },
    ];

    const events = parseGarminDailySummary(data);
    expect(events).toHaveLength(1);
    expect(events[0].metadata.avgStressLevel).toBeUndefined();
    expect(events[0].metadata.bodyBatteryHigh).toBeUndefined();
  });

  it("returns empty for invalid input", () => {
    expect(parseGarminDailySummary(null)).toEqual([]);
    expect(parseGarminDailySummary("invalid")).toEqual([]);
  });

  it("skips records without calendarDate", () => {
    const data = [{ totalSteps: 5000 }];
    expect(parseGarminDailySummary(data)).toHaveLength(0);
  });
});
