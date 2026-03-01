import type { MetadataEvent } from "../types";
import { parseTwitterJs, makeTwitterEvent } from "./utils";

interface DMConversationEntry {
  dmConversation: {
    conversationId: string;
    messages: {
      messageCreate?: {
        id: string;
        senderId: string;
        recipientId?: string;
        createdAt: string;
      };
    }[];
  };
}

/**
 * Parse direct-message-headers.js (1:1 DMs) and direct-message-group-headers.js (group DMs).
 * Classifies messages as sent/received based on the user's accountId.
 */
export function parseDMHeaders(
  data: Uint8Array,
  accountId: string,
  idMap?: Map<string, string>,
): MetadataEvent[] {
  const entries = parseTwitterJs<DMConversationEntry>(data);
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const conv = entry.dmConversation;
    if (!conv?.messages) continue;

    for (const msg of conv.messages) {
      const mc = msg.messageCreate;
      if (!mc?.createdAt) continue;

      const ts = new Date(mc.createdAt);
      if (isNaN(ts.getTime())) continue;

      const isSent = mc.senderId === accountId;
      const eventType = isSent ? "message_sent" : "message_received";

      // For 1:1 DMs, the other party is either the recipient (if sent) or the sender (if received)
      // For group DMs, recipientId is absent — use senderId as participant
      const otherParty = isSent
        ? (mc.recipientId ?? mc.senderId)
        : mc.senderId;

      // Skip messages where the other party is the user themselves (group DM fallback)
      if (otherParty === accountId) continue;

      // Resolve numeric ID to username if available
      const resolvedParty = idMap?.get(otherParty) ?? otherParty;

      events.push(
        makeTwitterEvent(eventType, ts, isSent ? "me" : resolvedParty, [resolvedParty], {
          conversationId: conv.conversationId,
          messageId: mc.id,
        }),
      );
    }
  }

  return events;
}
