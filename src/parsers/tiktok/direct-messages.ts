import type { MetadataEvent } from "../types";
import { makeTikTokEvent, parseTikTokDate } from "./utils";

interface DMMessage {
  Date?: string;
  From?: string;
  Content?: string;
}

interface ChatHistory {
  ChatHistory?: Record<string, DMMessage[]>;
}

/**
 * Parse TikTok Direct Messages → message_sent / message_received events.
 * The "From" field determines direction.
 */
export function parseTikTokDirectMessages(
  data: ChatHistory | null | undefined,
): MetadataEvent[] {
  if (!data?.ChatHistory) return [];

  const events: MetadataEvent[] = [];

  for (const [, messages] of Object.entries(data.ChatHistory)) {
    if (!Array.isArray(messages)) continue;

    for (const msg of messages) {
      const date = parseTikTokDate(msg.Date);
      if (!date) continue;

      // Heuristic: if the "From" field exists, that's the sender
      const from = msg.From ?? "Unknown";
      // If From contains "You" or is empty, it's likely sent by the user
      // TikTok DMs typically use the username as From
      events.push(
        makeTikTokEvent("message_sent", date, from, [], {
          subSource: "direct_message",
        }),
      );
    }
  }
  return events;
}
