import { describe, it, expect, beforeEach } from "vitest";
import { parseTikTokDirectMessages } from "@/parsers/tiktok/direct-messages";
import { resetIdCounter } from "@/parsers/tiktok/utils";

describe("parseTikTokDirectMessages", () => {
  beforeEach(() => resetIdCounter());

  it("parses DM entries from chat history", () => {
    const data = {
      ChatHistory: {
        "Chat with user1": [
          { Date: "2023-08-15 14:30:00", From: "You", Content: "Hello" },
          { Date: "2023-08-15 14:31:00", From: "user1", Content: "Hi!" },
        ],
      },
    };

    const events = parseTikTokDirectMessages(data);
    expect(events).toHaveLength(2);
    expect(events[0].source).toBe("tiktok");
    expect(events[0].eventType).toBe("message_sent");
    expect(events[0].metadata.subSource).toBe("direct_message");
  });

  it("parses multiple chats", () => {
    const data = {
      ChatHistory: {
        "Chat A": [{ Date: "2023-08-15 14:30:00", From: "A" }],
        "Chat B": [{ Date: "2023-08-16 10:00:00", From: "B" }],
      },
    };

    const events = parseTikTokDirectMessages(data);
    expect(events).toHaveLength(2);
  });

  it("skips messages without Date", () => {
    const data = {
      ChatHistory: {
        "Chat": [{ From: "You", Content: "No date" }],
      },
    };

    const events = parseTikTokDirectMessages(data);
    expect(events).toHaveLength(0);
  });

  it("returns empty array for null input", () => {
    expect(parseTikTokDirectMessages(null)).toEqual([]);
  });

  it("returns empty array for missing ChatHistory", () => {
    expect(parseTikTokDirectMessages({})).toEqual([]);
  });
});
