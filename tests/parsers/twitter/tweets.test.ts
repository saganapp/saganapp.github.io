import { describe, it, expect, beforeEach } from "vitest";
import { parseTweets } from "@/parsers/twitter/tweets";
import { resetIdCounter } from "@/parsers/twitter/utils";

function toTwitterJs(varName: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `window.YTD.${varName}.part0 = ${JSON.stringify(data)}`,
  );
}

describe("parseTweets", () => {
  beforeEach(() => resetIdCounter());

  it("parses a tweet with device extraction", () => {
    const data = toTwitterJs("tweets", [
      {
        tweet: {
          id_str: "123456",
          created_at: "Wed Feb 25 14:38:40 +0000 2026",
          source: '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>',
          lang: "en",
          full_text: "Hello world",
        },
      },
    ]);

    const { events } = parseTweets(data);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("twitter");
    expect(events[0].eventType).toBe("message_sent");
    expect(events[0].metadata.device).toBe("Twitter for Android");
    expect(events[0].metadata.tweetId).toBe("123456");
    expect(events[0].timestamp.getFullYear()).toBe(2026);
  });

  it("extracts user mentions as participants", () => {
    const data = toTwitterJs("tweets", [
      {
        tweet: {
          id_str: "789",
          created_at: "Mon Jan 01 12:00:00 +0000 2024",
          source: '<a href="https://mobile.twitter.com">Twitter Web App</a>',
          entities: {
            user_mentions: [
              { id_str: "111", screen_name: "alice" },
              { id_str: "222", screen_name: "bob" },
            ],
          },
        },
      },
    ]);

    const { events, idMap } = parseTweets(data);
    expect(events).toHaveLength(1);
    expect(events[0].participants).toEqual(["alice", "bob"]);
    expect(idMap.get("111")).toBe("alice");
    expect(idMap.get("222")).toBe("bob");
  });

  it("skips tweets with invalid timestamps", () => {
    const data = toTwitterJs("tweets", [
      {
        tweet: {
          id_str: "111",
          created_at: "not a date",
          source: "web",
        },
      },
    ]);

    const { events } = parseTweets(data);
    expect(events).toHaveLength(0);
  });

  it("parses multiple tweets", () => {
    const data = toTwitterJs("tweets", [
      {
        tweet: {
          id_str: "1",
          created_at: "Mon Jan 01 10:00:00 +0000 2024",
          source: "web",
        },
      },
      {
        tweet: {
          id_str: "2",
          created_at: "Mon Jan 01 11:00:00 +0000 2024",
          source: "web",
        },
      },
    ]);

    const { events } = parseTweets(data);
    expect(events).toHaveLength(2);
  });
});
