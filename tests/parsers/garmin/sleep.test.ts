import { describe, it, expect, beforeEach } from "vitest";
import { resetIdCounter } from "@/parsers/garmin/utils";
import { parseGarminSleep } from "@/parsers/garmin/sleep";

describe("parseGarminSleep", () => {
  beforeEach(() => resetIdCounter());

  it("parses sleep records", () => {
    const data = [
      {
        sleepStartTimestampGMT: "2025-10-02T22:00:00.0",
        sleepEndTimestampGMT: "2025-10-03T06:30:00.0",
        calendarDate: "2025-10-03",
        sleepWindowConfirmationType: "UNCONFIRMED",
        deepSleepSeconds: 3600,
        lightSleepSeconds: 7200,
        awakeSleepSeconds: 1800,
      },
    ];

    const events = parseGarminSleep(data);
    expect(events).toHaveLength(1);

    const e = events[0];
    expect(e.source).toBe("garmin");
    expect(e.eventType).toBe("wellness_log");
    expect(e.metadata.garminEventType).toBe("SLEEP");
    expect(e.metadata.confirmationType).toBe("UNCONFIRMED");
    expect(e.metadata.deepSleepSeconds).toBe(3600);
    expect(e.metadata.isWorn).toBe(true);
    // Uses sleep end timestamp (parsed as local time since no Z suffix)
    expect(e.timestamp.getHours()).toBe(6);
  });

  it("marks OFF_WRIST as not worn", () => {
    const data = [
      {
        sleepStartTimestampGMT: "2025-10-02T22:00:00.0",
        sleepEndTimestampGMT: "2025-10-03T06:30:00.0",
        sleepWindowConfirmationType: "OFF_WRIST",
      },
    ];

    const events = parseGarminSleep(data);
    expect(events[0].metadata.isWorn).toBe(false);
  });

  it("returns empty for invalid input", () => {
    expect(parseGarminSleep(null)).toEqual([]);
    expect(parseGarminSleep("invalid")).toEqual([]);
  });

  it("skips records without timestamps", () => {
    const data = [{ sleepWindowConfirmationType: "UNCONFIRMED" }];
    expect(parseGarminSleep(data)).toHaveLength(0);
  });
});
