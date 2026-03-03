import { describe, it, expect, beforeEach } from "vitest";
import { parseGrokChats } from "@/parsers/twitter/grok";
import { resetIdCounter } from "@/parsers/twitter/utils";

function toTwitterJs(varName: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `window.YTD.${varName}.part0 = ${JSON.stringify(data)}`,
  );
}

describe("parseGrokChats", () => {
  beforeEach(() => resetIdCounter());

  it("parses user-sent messages to Grok", () => {
    const data = toTwitterJs("grok_chat_item", [
      {
        grokChatItem: {
          chatId: "chat-1",
          createdAt: "2024-11-20T15:30:00.000Z",
          sender: { name: "User" },
          message: "What is the meaning of life?",
          grokMode: "fun",
        },
      },
    ]);

    const events = parseGrokChats(data);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("twitter");
    expect(events[0].eventType).toBe("message_sent");
    expect(events[0].participants).toEqual(["Grok"]);
    expect(events[0].metadata.chatId).toBe("chat-1");
    expect(events[0].metadata.mode).toBe("fun");
    expect(events[0].metadata.participant).toBe("Grok");
  });

  it("skips Grok-sent messages", () => {
    const data = toTwitterJs("grok_chat_item", [
      {
        grokChatItem: {
          chatId: "chat-1",
          createdAt: "2024-11-20T15:30:00.000Z",
          sender: { name: "Grok" },
          message: "42.",
        },
      },
    ]);

    const events = parseGrokChats(data);
    expect(events).toHaveLength(0);
  });

  it("parses multiple user messages, skipping Grok responses", () => {
    const data = toTwitterJs("grok_chat_item", [
      {
        grokChatItem: {
          chatId: "chat-1",
          createdAt: "2024-11-20T15:30:00.000Z",
          sender: { name: "User" },
          message: "Hello",
        },
      },
      {
        grokChatItem: {
          chatId: "chat-1",
          createdAt: "2024-11-20T15:30:01.000Z",
          sender: { name: "Grok" },
          message: "Hi there!",
        },
      },
      {
        grokChatItem: {
          chatId: "chat-1",
          createdAt: "2024-11-20T15:31:00.000Z",
          sender: { name: "User" },
          message: "Tell me a joke",
        },
      },
    ]);

    const events = parseGrokChats(data);
    expect(events).toHaveLength(2);
  });

  it("skips entries without createdAt", () => {
    const data = toTwitterJs("grok_chat_item", [
      { grokChatItem: { sender: { name: "User" } } },
    ]);
    const events = parseGrokChats(data);
    expect(events).toHaveLength(0);
  });

  it("returns empty array for empty data", () => {
    const data = toTwitterJs("grok_chat_item", []);
    const events = parseGrokChats(data);
    expect(events).toHaveLength(0);
  });
});
