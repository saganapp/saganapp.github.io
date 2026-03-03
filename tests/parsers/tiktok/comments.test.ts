import { describe, it, expect, beforeEach } from "vitest";
import { parseTikTokComments } from "@/parsers/tiktok/comments";
import { resetIdCounter } from "@/parsers/tiktok/utils";

describe("parseTikTokComments", () => {
  beforeEach(() => resetIdCounter());

  it("parses comments into message_sent events", () => {
    const entries = [
      { Date: "2023-08-15 14:30:00", Comment: "Great video!" },
    ];

    const events = parseTikTokComments(entries);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("tiktok");
    expect(events[0].eventType).toBe("message_sent");
    expect(events[0].metadata.subSource).toBe("comment");
  });

  it("parses multiple comments", () => {
    const entries = [
      { Date: "2023-08-15 14:30:00", Comment: "Comment 1" },
      { Date: "2023-08-16 10:00:00", Comment: "Comment 2" },
    ];

    const events = parseTikTokComments(entries);
    expect(events).toHaveLength(2);
  });

  it("skips entries without Date", () => {
    const entries = [{ Comment: "No date" }];
    const events = parseTikTokComments(entries);
    expect(events).toHaveLength(0);
  });

  it("returns empty array for null input", () => {
    expect(parseTikTokComments(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(parseTikTokComments(undefined)).toEqual([]);
  });
});
