import { describe, it, expect, beforeEach } from "vitest";
import { parseTikTokPosts } from "@/parsers/tiktok/posts";
import { resetIdCounter } from "@/parsers/tiktok/utils";

describe("parseTikTokPosts", () => {
  beforeEach(() => resetIdCounter());

  it("parses posts into media_shared events", () => {
    const entries = [
      { Date: "2023-08-15 14:30:00", Link: "https://tiktok.com/v/123" },
    ];

    const events = parseTikTokPosts(entries);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("tiktok");
    expect(events[0].eventType).toBe("media_shared");
    expect(events[0].metadata.link).toBe("https://tiktok.com/v/123");
  });

  it("parses multiple posts", () => {
    const entries = [
      { Date: "2023-08-15 14:30:00", Link: "link1" },
      { Date: "2023-08-16 10:00:00", Link: "link2" },
    ];

    const events = parseTikTokPosts(entries);
    expect(events).toHaveLength(2);
  });

  it("skips entries without Date", () => {
    const entries = [{ Link: "no-date" }];
    const events = parseTikTokPosts(entries);
    expect(events).toHaveLength(0);
  });

  it("returns empty array for null input", () => {
    expect(parseTikTokPosts(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(parseTikTokPosts(undefined)).toEqual([]);
  });
});
