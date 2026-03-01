import type { MetadataEvent } from "../types";
import { makeEvent, parseTimestamp, decodeUtf8 } from "./utils";

interface ChatMessage {
  creator?: { name?: string; email?: string };
  created_date?: string;
  topic_id?: string;
  message_id?: string;
  text?: string; // We only check length, never store content
}

interface ChatExport {
  messages?: ChatMessage[];
}

export function parseGoogleChat(
  data: Uint8Array,
  filename: string,
  userEmail?: string,
): MetadataEvent[] {
  const json = decodeUtf8(data);
  let chatData: ChatExport;
  try {
    chatData = JSON.parse(json);
  } catch {
    return [];
  }

  if (!chatData.messages || !Array.isArray(chatData.messages)) return [];

  // Extract group name from path: Google Chat/Groups/<name>/messages.json
  const groupMatch = filename.match(/Groups\/([^/]+)\//);
  const group = groupMatch?.[1] ?? "unknown";

  // Detect user email from most frequent sender if not provided
  const resolvedUserEmail = userEmail?.toLowerCase() ?? detectUserEmail(chatData.messages);

  const events: MetadataEvent[] = [];

  for (const msg of chatData.messages) {
    if (!msg.created_date) continue;
    const ts = parseTimestamp(msg.created_date);
    if (!ts) continue;

    const sender =
      msg.creator?.email ?? msg.creator?.name ?? "unknown";

    const isSent = resolvedUserEmail
      ? sender.toLowerCase() === resolvedUserEmail
      : false;

    events.push(
      makeEvent(
        isSent ? "message_sent" : "message_received",
        ts,
        sender,
        [group],
        {
          subSource: filename,
          group,
          hasMedia: false,
          messageLength: msg.text?.length ?? 0,
        },
      ),
    );
  }

  return events;
}

function detectUserEmail(messages: ChatMessage[]): string | null {
  const counts = new Map<string, number>();
  for (const msg of messages) {
    const email = msg.creator?.email;
    if (email) {
      const lower = email.toLowerCase();
      counts.set(lower, (counts.get(lower) ?? 0) + 1);
    }
  }
  let topEmail = "";
  let topCount = 0;
  for (const [email, count] of counts) {
    if (count > topCount) {
      topEmail = email;
      topCount = count;
    }
  }
  return topEmail || null;
}
