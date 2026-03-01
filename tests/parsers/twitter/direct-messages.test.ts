import { describe, it, expect, beforeEach } from "vitest";
import { parseDMHeaders } from "@/parsers/twitter/direct-messages";
import { resetIdCounter } from "@/parsers/twitter/utils";

function toTwitterJs(varName: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `window.YTD.${varName}.part0 = ${JSON.stringify(data)}`,
  );
}

const MY_ACCOUNT_ID = "30907751";
const OTHER_USER_ID = "7450312";

describe("parseDMHeaders", () => {
  beforeEach(() => resetIdCounter());

  it("classifies sent messages correctly", () => {
    const data = toTwitterJs("direct_message_headers", [
      {
        dmConversation: {
          conversationId: `${OTHER_USER_ID}-${MY_ACCOUNT_ID}`,
          messages: [
            {
              messageCreate: {
                id: "100",
                senderId: MY_ACCOUNT_ID,
                recipientId: OTHER_USER_ID,
                createdAt: "2024-01-15T10:00:00.000Z",
              },
            },
          ],
        },
      },
    ]);

    const events = parseDMHeaders(data, MY_ACCOUNT_ID);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("message_sent");
    expect(events[0].actor).toBe("me");
    expect(events[0].participants).toEqual([OTHER_USER_ID]);
  });

  it("classifies received messages correctly", () => {
    const data = toTwitterJs("direct_message_headers", [
      {
        dmConversation: {
          conversationId: `${OTHER_USER_ID}-${MY_ACCOUNT_ID}`,
          messages: [
            {
              messageCreate: {
                id: "200",
                senderId: OTHER_USER_ID,
                recipientId: MY_ACCOUNT_ID,
                createdAt: "2024-01-15T11:00:00.000Z",
              },
            },
          ],
        },
      },
    ]);

    const events = parseDMHeaders(data, MY_ACCOUNT_ID);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("message_received");
    expect(events[0].actor).toBe(OTHER_USER_ID);
    expect(events[0].participants).toEqual([OTHER_USER_ID]);
  });

  it("handles a conversation with mixed sent/received", () => {
    const data = toTwitterJs("direct_message_headers", [
      {
        dmConversation: {
          conversationId: `${OTHER_USER_ID}-${MY_ACCOUNT_ID}`,
          messages: [
            {
              messageCreate: {
                id: "301",
                senderId: MY_ACCOUNT_ID,
                recipientId: OTHER_USER_ID,
                createdAt: "2024-01-15T10:00:00.000Z",
              },
            },
            {
              messageCreate: {
                id: "302",
                senderId: OTHER_USER_ID,
                recipientId: MY_ACCOUNT_ID,
                createdAt: "2024-01-15T10:05:00.000Z",
              },
            },
          ],
        },
      },
    ]);

    const events = parseDMHeaders(data, MY_ACCOUNT_ID);
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("message_sent");
    expect(events[1].eventType).toBe("message_received");
  });

  it("handles group DMs (no recipientId)", () => {
    const data = toTwitterJs("direct_message_group_headers", [
      {
        dmConversation: {
          conversationId: "822755860673871872",
          messages: [
            {
              messageCreate: {
                id: "400",
                senderId: "548732022",
                createdAt: "2019-05-31T05:04:20.545Z",
              },
            },
          ],
        },
      },
    ]);

    const events = parseDMHeaders(data, MY_ACCOUNT_ID);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("message_received");
    expect(events[0].participants).toEqual(["548732022"]);
  });

  it("skips messages without timestamps", () => {
    const data = toTwitterJs("direct_message_headers", [
      {
        dmConversation: {
          conversationId: "test",
          messages: [{ messageCreate: { id: "500", senderId: MY_ACCOUNT_ID } }],
        },
      },
    ]);

    const events = parseDMHeaders(data, MY_ACCOUNT_ID);
    expect(events).toHaveLength(0);
  });
});
