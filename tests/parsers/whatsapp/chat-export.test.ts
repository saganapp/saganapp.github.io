import { describe, it, expect, beforeEach } from "vitest";
import {
  extractChatName,
  scanSenders,
  parseChatExportMessages,
} from "@/parsers/whatsapp/chat-export";
import { resetIdCounter } from "@/parsers/whatsapp/utils";

describe("extractChatName", () => {
  it("extracts name from zip filename", () => {
    expect(extractChatName("WhatsApp Chat with Happy family.zip")).toBe(
      "Happy family",
    );
  });

  it("extracts name from txt filename", () => {
    expect(extractChatName("WhatsApp Chat with Opsec links.txt")).toBe(
      "Opsec links",
    );
  });

  it("is case-insensitive", () => {
    expect(extractChatName("whatsapp chat with Test Group.zip")).toBe(
      "Test Group",
    );
  });

  it("returns original string for non-matching filenames", () => {
    expect(extractChatName("some-other-file.zip")).toBe("some-other-file.zip");
  });
});

describe("scanSenders", () => {
  it("extracts unique senders sorted alphabetically", () => {
    const text = [
      "1/1/25, 10:00 - Alice: Hello",
      "1/1/25, 10:01 - Bob: Hi there",
      "1/1/25, 10:02 - Alice: How are you?",
      "1/1/25, 10:03 - Charlie: Hey!",
    ].join("\n");
    expect(scanSenders(text)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("ignores system messages", () => {
    const text = [
      "1/1/25, 10:00 - Messages and calls are end-to-end encrypted.",
      "1/1/25, 10:00 - Alice created group \"Test\"",
      "1/1/25, 10:01 - Bob: Hello",
    ].join("\n");
    expect(scanSenders(text)).toEqual(["Bob"]);
  });

  it("returns empty for empty text", () => {
    expect(scanSenders("")).toEqual([]);
  });
});

describe("parseChatExportMessages", () => {
  beforeEach(() => resetIdCounter());

  it("only yields events from the selected sender", () => {
    const text = [
      "1/1/25, 10:00 - Alice: Hello",
      "1/1/25, 10:01 - Bob: Hi there",
      "1/1/25, 10:02 - Alice: How are you?",
    ].join("\n");
    const batches = [...parseChatExportMessages(text, "Test Chat", "Alice")];
    expect(batches).toHaveLength(1);
    const events = batches[0];
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("message_sent");
    expect(events[0].actor).toBe("You");
    expect(events[0].participants).toEqual(["Test Chat"]);
    expect(events[0].metadata.chatName).toBe("Test Chat");
    expect(events[0].metadata.subSource).toBe("chat_export");
  });

  it("detects media_shared for <Media omitted>", () => {
    const text = "1/5/25, 14:30 - Alice: <Media omitted>\n";
    const batches = [...parseChatExportMessages(text, "Chat", "Alice")];
    expect(batches[0][0].eventType).toBe("media_shared");
    expect(batches[0][0].metadata.hasMedia).toBe(true);
  });

  it("detects mentions with Unicode wrappers", () => {
    const text = "1/5/25, 14:30 - Alice: Hey \u2068Bob\u2069 check this\n";
    const batches = [...parseChatExportMessages(text, "Chat", "Alice")];
    expect(batches[0][0].metadata.hasMention).toBe(true);
  });

  it("skips system messages", () => {
    const text = [
      "1/1/25, 10:00 - Messages and calls are end-to-end encrypted.",
      "1/1/25, 10:00 - You created this group",
      "1/1/25, 10:01 - Alice: Hello",
    ].join("\n");
    const batches = [...parseChatExportMessages(text, "Chat", "Alice")];
    expect(batches[0]).toHaveLength(1);
    expect(batches[0][0].eventType).toBe("message_sent");
  });

  it("handles multiline messages (continuation lines are ignored)", () => {
    const text = [
      "1/1/25, 10:00 - Alice: First line",
      "This is a continuation",
      "And another continuation",
      "1/1/25, 10:05 - Alice: Second message",
    ].join("\n");
    const batches = [...parseChatExportMessages(text, "Chat", "Alice")];
    expect(batches[0]).toHaveLength(2);
  });

  it("parses timestamps correctly (M/D/YY format)", () => {
    const text = "3/15/25, 8:05 - Alice: Morning!\n";
    const batches = [...parseChatExportMessages(text, "Chat", "Alice")];
    const ts = batches[0][0].timestamp;
    expect(ts.getFullYear()).toBe(2025);
    expect(ts.getMonth()).toBe(2); // March = 2
    expect(ts.getDate()).toBe(15);
    expect(ts.getHours()).toBe(8);
    expect(ts.getMinutes()).toBe(5);
  });

  it("yields batches of 1000", () => {
    const lines: string[] = [];
    for (let i = 0; i < 2500; i++) {
      lines.push(`1/1/25, 10:00 - Alice: Message ${i}`);
    }
    const batches = [...parseChatExportMessages(lines.join("\n"), "Chat", "Alice")];
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(1000);
    expect(batches[1]).toHaveLength(1000);
    expect(batches[2]).toHaveLength(500);
  });

  it("returns no batches when sender has no messages", () => {
    const text = [
      "1/1/25, 10:00 - Bob: Hello",
      "1/1/25, 10:01 - Charlie: Hey",
    ].join("\n");
    const batches = [...parseChatExportMessages(text, "Chat", "Alice")];
    expect(batches).toHaveLength(0);
  });

  it("sets source to whatsapp", () => {
    const text = "1/1/25, 10:00 - Alice: Hello\n";
    const batches = [...parseChatExportMessages(text, "Chat", "Alice")];
    expect(batches[0][0].source).toBe("whatsapp");
  });
});
