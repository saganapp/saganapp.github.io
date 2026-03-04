import { describe, it, expect, beforeEach } from "vitest";
import { makeEventId, resetIdCounter, parseGarminDate, makeGarminEvent, parseEpochMs, parseGarminDateArray, parseGarminLongDate, parseGarminTextDate } from "@/parsers/garmin/utils";

describe("makeEventId", () => {
  beforeEach(() => resetIdCounter());

  it("produces gm- prefixed IDs", () => {
    const id = makeEventId();
    expect(id).toMatch(/^gm-\d+-1$/);
  });

  it("increments counter", () => {
    const id1 = makeEventId();
    const id2 = makeEventId();
    expect(id1).not.toBe(id2);
    expect(id2).toMatch(/^gm-\d+-2$/);
  });
});

describe("parseGarminDate", () => {
  it("parses ISO 8601 with Z timezone", () => {
    const d = parseGarminDate("2025-10-03T14:42:34Z");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2025);
    expect(d!.getUTCMonth()).toBe(9); // October = 9
  });

  it("parses ISO 8601 without timezone", () => {
    const d = parseGarminDate("2022-03-21T20:15:27.0");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2022);
  });

  it("returns null for null/undefined", () => {
    expect(parseGarminDate(null)).toBeNull();
    expect(parseGarminDate(undefined)).toBeNull();
  });

  it("returns null for invalid date", () => {
    expect(parseGarminDate("not-a-date")).toBeNull();
  });
});

describe("parseEpochMs", () => {
  it("parses valid epoch milliseconds", () => {
    const d = parseEpochMs(1700000000000);
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2023);
  });

  it("returns null for null/undefined", () => {
    expect(parseEpochMs(null)).toBeNull();
    expect(parseEpochMs(undefined)).toBeNull();
  });

  it("returns null for non-finite values", () => {
    expect(parseEpochMs(NaN)).toBeNull();
    expect(parseEpochMs(Infinity)).toBeNull();
  });
});

describe("parseGarminDateArray", () => {
  it("parses [year, month, day] array", () => {
    const d = parseGarminDateArray([2026, 3, 3]);
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2); // March = 2
    expect(d!.getDate()).toBe(3);
    expect(d!.getHours()).toBe(12); // noon
  });

  it("returns null for invalid arrays", () => {
    expect(parseGarminDateArray(null)).toBeNull();
    expect(parseGarminDateArray(undefined)).toBeNull();
    expect(parseGarminDateArray([2026])).toBeNull();
    expect(parseGarminDateArray([2026, 3])).toBeNull();
  });
});

describe("parseGarminLongDate", () => {
  it("parses long date format", () => {
    const d = parseGarminLongDate("Sun Oct 12 17:38:10 GMT 2025");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2025);
    expect(d!.getUTCMonth()).toBe(9); // October
  });

  it("returns null for null/invalid", () => {
    expect(parseGarminLongDate(null)).toBeNull();
    expect(parseGarminLongDate("not-a-date")).toBeNull();
  });
});

describe("parseGarminTextDate", () => {
  it("parses English text dates", () => {
    const d = parseGarminTextDate("March 16, 2025");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(2); // March
    expect(d!.getDate()).toBe(16);
  });

  it("returns null for null/invalid", () => {
    expect(parseGarminTextDate(null)).toBeNull();
  });
});

describe("makeGarminEvent", () => {
  beforeEach(() => resetIdCounter());

  it("creates event with garmin source", () => {
    const event = makeGarminEvent("wellness_log", new Date("2025-01-01"), "You", []);
    expect(event.source).toBe("garmin");
    expect(event.eventType).toBe("wellness_log");
    expect(event.actor).toBe("You");
    expect(event.id).toMatch(/^gm-/);
  });
});
