import type { MetadataEvent } from "../types";
import { parseTwitterJs, snowflakeToTimestamp, makeTwitterEvent } from "./utils";

interface LikeEntry {
  like: {
    tweetId: string;
    fullText?: string;
    expandedUrl?: string;
  };
}

/**
 * Parse like.js. Since likes don't have explicit timestamps,
 * we derive approximate time from the tweet's snowflake ID
 * (gives the tweet creation time, not the like time).
 */
export function parseLikes(data: Uint8Array): MetadataEvent[] {
  const entries = parseTwitterJs<LikeEntry>(data);
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const like = entry.like;
    if (!like?.tweetId) continue;

    let ts: Date;
    try {
      ts = snowflakeToTimestamp(like.tweetId);
    } catch {
      continue;
    }
    if (isNaN(ts.getTime())) continue;

    events.push(
      makeTwitterEvent("reaction", ts, "me", [], {
        tweetId: like.tweetId,
        approximateTime: true,
      }),
    );
  }

  return events;
}
