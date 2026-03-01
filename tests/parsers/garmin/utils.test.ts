import { describe, it, expect, beforeEach } from "vitest";
import { makeEventId, resetIdCounter, parseGarminDate, makeGarminEvent } from "@/parsers/garmin/utils";

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
