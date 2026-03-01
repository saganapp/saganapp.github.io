import { describe, it, expect, beforeEach } from "vitest";
import { parseTelegramMessages } from "@/parsers/telegram/messages";
import { resetIdCounter } from "@/parsers/telegram/utils";

function makeChat(
  overrides: {
    name?: string | null;
    type?: string;
    id?: number;
    messages?: unknown[];
  } = {},
) {
  return {
    name: overrides.name ?? "Test Chat",
    type: overrides.type ?? "personal_chat",
    id: overrides.id ?? 1,
    messages: (overrides.messages ?? []) as never[],
  };
}

function makeMessage(
  overrides: {
    id?: number;
    type?: string;
    from?: string;
    from_id?: string;
    date_unixtime?: string;
    media_type?: string;
    forwarded_from?: string;
    reply_to_message_id?: number;
  } = {},
) {
  return {
    id: overrides.id ?? 1,
    type: overrides.type ?? "message",
    date: "2024-01-15T10:00:00",
    date_unixtime: overrides.date_unixtime ?? "1705312800",
    from: overrides.from ?? "Test User",
    from_id: overrides.from_id ?? "user123",
    text: "hello",
    text_entities: [{ type: "plain", text: "hello" }],
    ...(overrides.media_type && { media_type: overrides.media_type }),
    ...(overrides.forwarded_from && { forwarded_from: overrides.forwarded_from }),
    ...(overrides.reply_to_message_id && { reply_to_message_id: overrides.reply_to_message_id }),
  };
}

describe("parseTelegramMessages", () => {
  beforeEach(() => resetIdCounter());

  it("captures only user-sent messages", () => {
    const chats = {
      list: [
        makeChat({
          messages: [
            makeMessage({ from: "Me", from_id: "user123" }),
            makeMessage({ id: 2, from: "Other", from_id: "user456" }),
            makeMessage({ id: 3, from: "Me", from_id: "user123" }),
          ],
        }),
      ],
    };

    const batches = [...parseTelegramMessages(chats, "123")];
    const events = batches.flat();

    expect(events).toHaveLength(2);
    expect(events.every((e) => e.eventType === "message_sent")).toBe(true);
    expect(events.every((e) => e.actor === "Me")).toBe(true);
  });

  it("skips saved_messages chat", () => {
    const chats = {
      list: [
        makeChat({
          type: "saved_messages",
          name: null,
          messages: [
            makeMessage({ from: "Me", from_id: "user123" }),
          ],
        }),
      ],
    };

    const batches = [...parseTelegramMessages(chats, "123")];
    const events = batches.flat();

    expect(events).toHaveLength(0);
  });

  it("includes bot_chat messages", () => {
    const chats = {
      list: [
        makeChat({
          type: "bot_chat",
          name: "SomeBot",
          messages: [
            makeMessage({ from: "Me", from_id: "user123" }),
          ],
        }),
      ],
    };

    const batches = [...parseTelegramMessages(chats, "123")];
    const events = batches.flat();

    expect(events).toHaveLength(1);
    expect(events[0].metadata.subSource).toBe("bot_chat");
    expect(events[0].participants).toEqual(["SomeBot"]);
  });

  it("correctly parses date_unixtime", () => {
    const chats = {
      list: [
        makeChat({
          messages: [
            makeMessage({
              from: "Me",
              from_id: "user123",
              date_unixtime: "1705312800",
            }),
          ],
        }),
      ],
    };

    const batches = [...parseTelegramMessages(chats, "123")];
    const events = batches.flat();

    expect(events).toHaveLength(1);
    const ts = events[0].timestamp;
    expect(ts.getFullYear()).toBe(2024);
    expect(ts.getMonth()).toBe(0); // January
    expect(ts.getDate()).toBe(15);
  });

  it("skips service messages", () => {
    const chats = {
      list: [
        makeChat({
          messages: [
            makeMessage({ type: "service", from_id: "user123" }),
          ],
        }),
      ],
    };

    const batches = [...parseTelegramMessages(chats, "123")];
    const events = batches.flat();

    expect(events).toHaveLength(0);
  });

  it("sets metadata correctly for forwarded replies with media", () => {
    const chats = {
      list: [
        makeChat({
          name: "Friend",
          id: 42,
          messages: [
            makeMessage({
              from: "Me",
              from_id: "user123",
              media_type: "sticker",
              forwarded_from: "Someone",
              reply_to_message_id: 99,
            }),
          ],
        }),
      ],
    };

    const batches = [...parseTelegramMessages(chats, "123")];
    const events = batches.flat();

    expect(events).toHaveLength(1);
    expect(events[0].metadata).toMatchObject({
      subSource: "personal_chat",
      chatName: "Friend",
      chatId: 42,
      hasMedia: true,
      isForwarded: true,
      isReply: true,
    });
  });

  it("yields in batches of 1000", () => {
    const messages = Array.from({ length: 2500 }, (_, i) =>
      makeMessage({ id: i, from: "Me", from_id: "user123" }),
    );

    const chats = {
      list: [makeChat({ messages })],
    };

    const batches = [...parseTelegramMessages(chats, "123")];

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(1000);
    expect(batches[1]).toHaveLength(1000);
    expect(batches[2]).toHaveLength(500);
  });

  it("sets source to telegram", () => {
    const chats = {
      list: [
        makeChat({
          messages: [makeMessage({ from: "Me", from_id: "user123" })],
        }),
      ],
    };

    const batches = [...parseTelegramMessages(chats, "123")];
    const events = batches.flat();

    expect(events[0].source).toBe("telegram");
  });
});
