import { describe, it, expect, beforeEach } from "vitest";
import { parseTikTokSearches } from "@/parsers/tiktok/searches";
import { resetIdCounter } from "@/parsers/tiktok/utils";

describe("parseTikTokSearches", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it("parses valid entries into search events", () => {
    const entries = [
      { Date: "2025-04-24 21:43:04", SearchTerm: "paula barral" },
      { Date: "2025-04-24 21:44:04", SearchTerm: "cooking tips" },
    ];
    const events = parseTikTokSearches(entries);
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("search");
    expect(events[0].source).toBe("tiktok");
    expect(events[0].metadata.searchTerm).toBe("paula barral");
    expect(events[1].metadata.searchTerm).toBe("cooking tips");
  });

  it("returns empty array for null input", () => {
    expect(parseTikTokSearches(null)).toEqual([]);
  });

  it("skips entries with missing Date", () => {
    const entries = [
      { SearchTerm: "no date" },
      { Date: "2025-04-24 21:44:04", SearchTerm: "has date" },
    ];
    const events = parseTikTokSearches(entries);
    expect(events).toHaveLength(1);
    expect(events[0].metadata.searchTerm).toBe("has date");
  });
});
