import type { MetadataEvent } from "../types";
import { makeTelegramEvent } from "./utils";

interface TelegramMessage {
  id: number;
  type: string;
  date: string;
  date_unixtime: string;
  from?: string;
  from_id?: string;
  text: unknown;
  text_entities?: unknown[];
  reply_to_message_id?: number;
  forwarded_from?: string;
  media_type?: string;
  file_name?: string;
}

interface TelegramChat {
  name: string | null;
  type: string;
  id: number;
  messages: TelegramMessage[];
}

interface TelegramChats {
  list: TelegramChat[];
}

/**
 * Parse Telegram messages from chats, yielding only user-sent messages.
 * Returns batches of up to 1000 events to keep memory bounded.
 */
export function* parseTelegramMessages(
  chats: TelegramChats,
  userId: string,
): Generator<MetadataEvent[]> {
  const userFromId = `user${userId}`;
  let batch: MetadataEvent[] = [];

  for (const chat of chats.list) {
    // Skip saved_messages (self-chat)
    if (chat.type === "saved_messages") continue;

    for (const msg of chat.messages) {
      // Only actual messages, not service messages
      if (msg.type !== "message") continue;

      // Only user-triggered events (sent by the user)
      if (msg.from_id !== userFromId) continue;

      const timestamp = new Date(Number(msg.date_unixtime) * 1000);
      if (isNaN(timestamp.getTime())) continue;

      const event = makeTelegramEvent(
        "message_sent",
        timestamp,
        msg.from ?? "me",
        chat.name ? [chat.name] : [],
        {
          subSource: chat.type,
          chatName: chat.name ?? undefined,
          chatId: chat.id,
          hasMedia: !!msg.media_type,
          isForwarded: !!msg.forwarded_from,
          isReply: !!msg.reply_to_message_id,
        },
      );

      batch.push(event);

      if (batch.length >= 1000) {
        yield batch;
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}
