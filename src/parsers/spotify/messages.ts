import type { MetadataEvent } from "../types";
import { makeSpotifyEvent } from "./utils";

interface SpotifyMessage {
  time: string;
  from: string;
  message: string;
  uri?: string;
}

interface ChatData {
  members: string[];
  messages: SpotifyMessage[];
}

export function parseMessages(
  data: Record<string, ChatData>,
  username?: string,
): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  for (const [, chat] of Object.entries(data)) {
    const otherMembers = chat.members.filter((m) => m !== username);

    for (const msg of chat.messages) {
      const timestamp = new Date(msg.time);
      if (isNaN(timestamp.getTime())) continue;

      const isSent = username
        ? msg.from === username
        : true; // Fall back to message_sent if no username context

      const eventType = isSent ? "message_sent" : "message_received";
      const hasTrackUri = msg.message.startsWith("spotify:");

      events.push(
        makeSpotifyEvent(eventType, timestamp, msg.from, otherMembers, {
          subSource: "spotify_message",
          hasTrackUri,
        }),
      );
    }
  }

  return events;
}
