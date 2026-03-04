import { describe, it, expect, beforeEach } from "vitest";
import { resetIdCounter } from "@/parsers/garmin/utils";
import { parseGarminPersonalRecords } from "@/parsers/garmin/fitness";

describe("parseGarminPersonalRecords", () => {
  beforeEach(() => resetIdCounter());

  it("parses personal records", () => {
    const data = [
      {
        personalRecords: [
          {
            personalRecordId: 123,
            activityId: 456,
            value: 329.245,
            prStartTimeGMT: "Sun Oct 12 17:38:10 GMT 2025",
            personalRecordType: "Best 1km Run",
            createdDate: "2025-10-12",
            current: true,
          },
        ],
      },
    ];

    const events = parseGarminPersonalRecords(data);
    expect(events).toHaveLength(1);

    const e = events[0];
    expect(e.metadata.garminEventType).toBe("PERSONAL_RECORD");
    expect(e.metadata.recordType).toBe("Best 1km Run");
    expect(e.metadata.value).toBe(329.245);
    expect(e.metadata.current).toBe(true);
    expect(e.timestamp.getFullYear()).toBe(2025);
  });

  it("falls back to createdDate when prStartTimeGMT is missing", () => {
    const data = [
      {
        personalRecords: [
          {
            value: 100,
            personalRecordType: "Most Steps in a Day",
            createdDate: "2026-01-15",
            current: false,
          },
        ],
      },
    ];

    const events = parseGarminPersonalRecords(data);
    expect(events).toHaveLength(1);
    expect(events[0].timestamp.getFullYear()).toBe(2026);
  });

  it("returns empty for invalid input", () => {
    expect(parseGarminPersonalRecords(null)).toEqual([]);
    expect(parseGarminPersonalRecords([])).toEqual([]);
  });
});
