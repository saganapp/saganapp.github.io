import type { MetadataEvent } from "../types";
import { makeWhatsAppEvent } from "./utils";

/**
 * Regex matching a WhatsApp chat export message line:
 * M/D/YY, HH:MM - SENDER: MESSAGE
 */
const MESSAGE_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{2}), (\d{1,2}):(\d{2})\s-\s(.+?):\s(.*)$/;

/** Unicode mention wrapper characters */
const MENTION_RE = /\u2068.*?\u2069/;

const MEDIA_OMITTED = "<Media omitted>";

const BATCH_SIZE = 1000;

/** Extract chat name from "WhatsApp Chat with <Name>.zip" or ".txt" filename */
export function extractChatName(filename: string): string {
  const match = filename.match(
    /^WhatsApp Chat with (.+)\.(zip|txt)$/i,
  );
  return match ? match[1] : filename;
}

function parseTimestamp(
  month: string,
  day: string,
  year2: string,
  hour: string,
  minute: string,
): Date {
  const fullYear = 2000 + Number(year2);
  return new Date(fullYear, Number(month) - 1, Number(day), Number(hour), Number(minute));
}

/**
 * Scan chat export text for unique sender names.
 * Used to populate the sender selection dropdown.
 */
export function scanSenders(text: string): string[] {
  const senders = new Set<string>();
  const lines = text.split("\n");
  for (const line of lines) {
    const m = MESSAGE_RE.exec(line);
    if (m) {
      senders.add(m[6]);
    }
  }
  return Array.from(senders).sort();
}

/**
 * Parse WhatsApp chat export messages, yielding only events from `senderName`.
 * Yields batches of up to 1000 events to keep memory bounded.
 */
export function* parseChatExportMessages(
  text: string,
  chatName: string,
  senderName: string,
): Generator<MetadataEvent[]> {
  const lines = text.split("\n");
  let batch: MetadataEvent[] = [];

  for (const line of lines) {
    const m = MESSAGE_RE.exec(line);
    if (!m) {
      // Could be a multiline continuation or system message — skip
      continue;
    }

    const [, month, day, year2, hour, minute, sender, content] = m;

    // Only emit events from the selected sender
    if (sender !== senderName) continue;

    const timestamp = parseTimestamp(month, day, year2, hour, minute);
    if (isNaN(timestamp.getTime())) continue;

    const hasMedia = content.trim() === MEDIA_OMITTED;
    const hasMention = MENTION_RE.test(content);
    const eventType = hasMedia ? "media_shared" : "message_sent";

    const event = makeWhatsAppEvent(
      eventType,
      timestamp,
      "You",
      [chatName],
      {
        chatName,
        hasMedia,
        hasMention,
        subSource: "chat_export",
      },
    );

    batch.push(event);

    if (batch.length >= BATCH_SIZE) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}
