import { describe, it, expect, beforeEach } from "vitest";
import { parseTikTokLikes } from "@/parsers/tiktok/likes";
import { resetIdCounter } from "@/parsers/tiktok/utils";

describe("parseTikTokLikes", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it("parses entries with lowercase date key into reaction events", () => {
    const entries = [
      { date: "2020-05-31 21:38:19", link: "https://tiktok.com/video/123" },
    ];
    const events = parseTikTokLikes(entries);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("reaction");
    expect(events[0].source).toBe("tiktok");
    expect(events[0].metadata.link).toBe("https://tiktok.com/video/123");
  });

  it("parses entries with uppercase Date key", () => {
    const entries = [
      { Date: "2020-05-31 21:38:19", Link: "https://tiktok.com/video/456" },
    ];
    const events = parseTikTokLikes(entries);
    expect(events).toHaveLength(1);
    expect(events[0].metadata.link).toBe("https://tiktok.com/video/456");
  });

  it("returns empty array for null input", () => {
    expect(parseTikTokLikes(null)).toEqual([]);
  });
});
