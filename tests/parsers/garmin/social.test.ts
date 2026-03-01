import { describe, it, expect, beforeEach } from "vitest";
import { resetIdCounter } from "@/parsers/garmin/utils";
import { parseGarminComments, parseGarminLikes } from "@/parsers/garmin/social";

describe("parseGarminComments", () => {
  beforeEach(() => resetIdCounter());

  it("converts comments to message_sent events", () => {
    const events = parseGarminComments([
      { createDate: "2022-03-21T20:15:27.0", body: "hello world" },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("message_sent");
    expect(events[0].source).toBe("garmin");
    expect(events[0].metadata.hasBody).toBe(true);
  });

  it("handles comments without body", () => {
    const events = parseGarminComments([
      { createDate: "2022-03-21T20:15:27.0" },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].metadata.hasBody).toBe(false);
  });

  it("skips entries with missing createDate", () => {
    const events = parseGarminComments([
      { body: "no date" },
    ]);
    expect(events).toHaveLength(0);
  });

  it("handles null/undefined input", () => {
    expect(parseGarminComments(null)).toEqual([]);
    expect(parseGarminComments(undefined)).toEqual([]);
  });
});

describe("parseGarminLikes", () => {
  beforeEach(() => resetIdCounter());

  it("converts like timestamps to reaction events", () => {
    const events = parseGarminLikes(["2022-01-13T13:48:44.0"]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("reaction");
    expect(events[0].source).toBe("garmin");
  });

  it("handles multiple likes", () => {
    const events = parseGarminLikes([
      "2022-01-13T13:48:44.0",
      "2022-02-14T10:00:00.0",
    ]);
    expect(events).toHaveLength(2);
  });

  it("skips invalid date strings", () => {
    const events = parseGarminLikes(["not-a-date"]);
    expect(events).toHaveLength(0);
  });

  it("handles null/undefined input", () => {
    expect(parseGarminLikes(null)).toEqual([]);
    expect(parseGarminLikes(undefined)).toEqual([]);
  });
});
