import { describe, it, expect, beforeEach } from "vitest";
import { parseTikTokFollowing } from "@/parsers/tiktok/following";
import { resetIdCounter } from "@/parsers/tiktok/utils";

describe("parseTikTokFollowing", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it("parses valid entries into contact_added events", () => {
    const entries = [
      { Date: "2021-09-01 13:09:04", UserName: "mkbhd" },
      { Date: "2022-01-15 08:30:00", UserName: "nasa" },
    ];
    const events = parseTikTokFollowing(entries);
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("contact_added");
    expect(events[0].source).toBe("tiktok");
    expect(events[0].participants).toEqual(["mkbhd"]);
    expect(events[1].participants).toEqual(["nasa"]);
  });

  it("returns empty array for null input", () => {
    expect(parseTikTokFollowing(null)).toEqual([]);
  });

  it("skips entries with missing Date", () => {
    const entries = [
      { UserName: "no_date" },
      { Date: "2021-09-01 13:09:04", UserName: "has_date" },
    ];
    const events = parseTikTokFollowing(entries);
    expect(events).toHaveLength(1);
    expect(events[0].participants).toEqual(["has_date"]);
  });
});
