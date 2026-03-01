import type { MetadataEvent } from "../types";
import { makeInstagramEvent, parseInstagramDate } from "./utils";

/**
 * Parse Instagram message HTML files.
 *
 * HTML structure per message block:
 *   <h2 class="_3-95 _2pim _a6-h _a6-i">SenderName</h2>
 *   ... message content ...
 *   <div class="_3-94 _a6-o">mar. 15, 2025 3:52 pm</div>
 *
 * The conversation name is in:
 *   <h1 id="...">ConversationName</h1>
 */
export function parseInstagramMessages(
  html: string,
  userName: string,
): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  // Extract conversation name from <h1>
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/);
  const conversationName = h1Match ? h1Match[1] : "Unknown";

  // Extract (sender, date) pairs in order
  // Sender: <h2 class="_3-95 _2pim _a6-h _a6-i">Name</h2>
  // Date: <div class="_3-94 _a6-o">date string</div>
  //
  // We collect them by position in the HTML and pair them up.
  // Each message block has exactly one sender h2 followed by one date div.

  const senderRegex = /_a6-h _a6-i">(.*?)<\/h2>/g;
  const dateRegex = /_a6-o">(.*?)<\/div>/g;

  const senders: string[] = [];
  const dates: string[] = [];

  let m;
  while ((m = senderRegex.exec(html)) !== null) {
    senders.push(m[1]);
  }
  while ((m = dateRegex.exec(html)) !== null) {
    dates.push(m[1]);
  }

  // Pair senders with dates (they appear in order, 1:1)
  const count = Math.min(senders.length, dates.length);

  for (let i = 0; i < count; i++) {
    const sender = senders[i];
    const dateStr = dates[i];

    const timestamp = parseInstagramDate(dateStr);
    if (!timestamp) continue;

    // Skip received messages — only emit user-triggered events
    if (sender.toLowerCase() !== userName.toLowerCase()) continue;

    const participants = [conversationName];

    events.push(
      makeInstagramEvent("message_sent", timestamp, "me", participants, {
        conversationName,
        sender,
      }),
    );
  }

  return events;
}
