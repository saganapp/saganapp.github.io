import type { MetadataEvent } from "../types";
import { parseTwitterJs, extractDevice, makeTwitterEvent } from "./utils";

interface TweetEntry {
  tweet: {
    id_str: string;
    created_at: string;
    source: string;
    lang?: string;
    full_text?: string;
    retweeted?: boolean;
    entities?: {
      user_mentions?: { id_str: string; screen_name: string }[];
    };
  };
}

export function parseTweets(data: Uint8Array): { events: MetadataEvent[]; idMap: Map<string, string> } {
  const entries = parseTwitterJs<TweetEntry>(data);
  const events: MetadataEvent[] = [];
  const idMap = new Map<string, string>();

  for (const entry of entries) {
    const t = entry.tweet;
    if (!t?.created_at) continue;

    const ts = new Date(t.created_at);
    if (isNaN(ts.getTime())) continue;

    const device = t.source ? extractDevice(t.source) : undefined;
    const mentionEntities = t.entities?.user_mentions ?? [];
    const mentions: string[] = [];
    for (const m of mentionEntities) {
      mentions.push(m.screen_name);
      if (m.id_str) {
        idMap.set(m.id_str, m.screen_name);
      }
    }

    events.push(
      makeTwitterEvent("message_sent", ts, "me", mentions, {
        tweetId: t.id_str,
        device,
        lang: t.lang,
        isRetweet: t.retweeted ?? false,
      }),
    );
  }

  return { events, idMap };
}
