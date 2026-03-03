import type { MetadataEvent } from "../types";
import { parseTwitterJs, snowflakeToTimestamp, makeTwitterEvent } from "./utils";

interface FollowerEntry {
  follower: {
    accountId: string;
    userLink?: string;
  };
}

interface FollowingEntry {
  following: {
    accountId: string;
    userLink?: string;
  };
}

/**
 * Parse follower.js → contact_added events (direction: "follower").
 * Timestamps are derived from the accountId snowflake (approximate).
 */
export function parseFollowers(data: Uint8Array): MetadataEvent[] {
  const entries = parseTwitterJs<FollowerEntry>(data);
  return parseGraphEntries(entries, "follower", (e) => e.follower);
}

/**
 * Parse following.js → contact_added events (direction: "following").
 * Timestamps are derived from the accountId snowflake (approximate).
 */
export function parseFollowing(data: Uint8Array): MetadataEvent[] {
  const entries = parseTwitterJs<FollowingEntry>(data);
  return parseGraphEntries(entries, "following", (e) => e.following);
}

function parseGraphEntries<T>(
  entries: T[],
  direction: "follower" | "following",
  extract: (entry: T) => { accountId: string; userLink?: string } | undefined,
): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const node = extract(entry);
    if (!node?.accountId) continue;

    let ts: Date;
    try {
      ts = snowflakeToTimestamp(node.accountId);
    } catch {
      continue;
    }
    if (isNaN(ts.getTime())) continue;

    events.push(
      makeTwitterEvent("contact_added", ts, "me", [], {
        accountId: node.accountId,
        direction,
        approximateTime: true,
      }),
    );
  }

  return events;
}
