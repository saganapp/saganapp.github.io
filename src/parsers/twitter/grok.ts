import type { MetadataEvent } from "../types";
import { parseTwitterJs, makeTwitterEvent } from "./utils";

interface GrokChatEntry {
  grokChatItem: {
    chatId?: string;
    createdAt?: string;
    sender?: {
      name?: string;
    };
    message?: string;
    grokMode?: string;
  };
}

/**
 * Parse grok-chat-item.js → message_sent events.
 * Only emits events for user-sent messages (sender.name === "User").
 */
export function parseGrokChats(data: Uint8Array): MetadataEvent[] {
  const entries = parseTwitterJs<GrokChatEntry>(data);
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const item = entry.grokChatItem;
    if (!item?.createdAt) continue;
    if (item.sender?.name !== "User") continue;

    const ts = new Date(item.createdAt);
    if (isNaN(ts.getTime())) continue;

    events.push(
      makeTwitterEvent("message_sent", ts, "me", ["Grok"], {
        chatId: item.chatId,
        mode: item.grokMode,
        participant: "Grok",
      }),
    );
  }

  return events;
}
