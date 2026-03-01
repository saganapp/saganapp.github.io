import { describe, it, expect, beforeEach } from "vitest";
import { parseWatchHistory } from "@/parsers/tiktok/watch-history";
import { resetIdCounter } from "@/parsers/tiktok/utils";

describe("parseWatchHistory", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it("parses valid entries into browsing events", () => {
    const entries = [
      { Date: "2025-04-24 22:45:08", Link: "https://tiktok.com/video/123" },
      { Date: "2025-04-24 22:45:17", Link: "https://tiktok.com/video/456" },
    ];
    const events = parseWatchHistory(entries);
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("browsing");
    expect(events[0].source).toBe("tiktok");
    expect(events[0].metadata.link).toBe("https://tiktok.com/video/123");
  });

  it("returns empty array for null input", () => {
    expect(parseWatchHistory(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(parseWatchHistory(undefined)).toEqual([]);
  });

  it("skips entries with missing Date", () => {
    const entries = [
      { Link: "https://tiktok.com/video/123" },
      { Date: "2025-04-24 22:45:17", Link: "https://tiktok.com/video/456" },
    ];
    const events = parseWatchHistory(entries);
    expect(events).toHaveLength(1);
  });
});
