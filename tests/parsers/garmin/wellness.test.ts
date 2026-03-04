import { describe, it, expect, beforeEach } from "vitest";
import { resetIdCounter } from "@/parsers/garmin/utils";
import { parseGarminLifestyleLogging, parseGarminHydrationLog } from "@/parsers/garmin/wellness";

describe("parseGarminLifestyleLogging", () => {
  beforeEach(() => resetIdCounter());

  it("parses lifestyle daily logs", () => {
    const data = [
      {
        dailyLogList: [
          {
            behaviourName: "Morning Caffeine",
            status: "YES",
            calendarDate: [2026, 3, 3],
            dailyLogDetailDTOList: [{ subTypeId: 1, amount: 2 }],
          },
          {
            behaviourName: "Sunlight",
            status: "NO",
            calendarDate: [2026, 3, 3],
          },
        ],
        trackedBehaviourList: [],
      },
    ];

    const events = parseGarminLifestyleLogging(data);
    expect(events).toHaveLength(2);

    expect(events[0].metadata.garminEventType).toBe("LIFESTYLE_LOG");
    expect(events[0].metadata.behaviourName).toBe("Morning Caffeine");
    expect(events[0].metadata.status).toBe("YES");
    expect(events[0].metadata.amount).toBe(2);

    expect(events[1].metadata.behaviourName).toBe("Sunlight");
    expect(events[1].metadata.status).toBe("NO");
  });

  it("returns empty for invalid input", () => {
    expect(parseGarminLifestyleLogging(null)).toEqual([]);
    expect(parseGarminLifestyleLogging([])).toEqual([]);
  });
});

describe("parseGarminHydrationLog", () => {
  beforeEach(() => resetIdCounter());

  it("parses hydration log entries", () => {
    const data = [
      {
        calendarDate: "2025-10-12",
        hydrationSource: "GARMIN_ACTIVITY",
        estimatedSweatLossInML: 91,
        duration: 920.72,
        activityId: 123,
        timestampLocal: "2025-10-12T19:30:30.0",
      },
    ];

    const events = parseGarminHydrationLog(data);
    expect(events).toHaveLength(1);

    const e = events[0];
    expect(e.metadata.garminEventType).toBe("HYDRATION_LOG");
    expect(e.metadata.estimatedSweatLossMl).toBe(91);
    expect(e.metadata.durationSeconds).toBe(920.72);
  });

  it("returns empty for invalid input", () => {
    expect(parseGarminHydrationLog(null)).toEqual([]);
  });
});
