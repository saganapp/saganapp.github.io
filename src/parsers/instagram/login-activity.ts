import type { MetadataEvent } from "../types";
import { makeInstagramEvent } from "./utils";

/**
 * Parse login_activity.html → login events.
 *
 * HTML structure: each login is an <h2> with ISO timestamp,
 * followed by a table containing IP Address, User Agent, Language Code.
 */
export function parseLoginActivity(html: string): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  // Each login block has: <h2>ISO_TIMESTAMP</h2> then table rows with IP, User Agent, etc.
  // Match timestamp headers
  const timestampRegex = /<h2[^>]*>(\d{4}-\d{2}-\d{2}T[\d:.]+[+-][\d:]+)<\/h2>/g;

  // Extract IP addresses and user agents from table cells
  // Pattern: <td class="_2piu _a6_r">value</td>
  const valueRegex = /_a6_r">(.*?)<\/td>/g;

  const timestamps: Date[] = [];
  const values: string[] = [];

  let m;
  while ((m = timestampRegex.exec(html)) !== null) {
    const ts = new Date(m[1]);
    if (!isNaN(ts.getTime())) {
      timestamps.push(ts);
    }
  }

  while ((m = valueRegex.exec(html)) !== null) {
    values.push(m[1]);
  }

  // Each login has 3 values: IP, User Agent, Language Code
  for (let i = 0; i < timestamps.length; i++) {
    const baseIdx = i * 3;
    const ip = values[baseIdx];
    const userAgent = values[baseIdx + 1];
    const language = values[baseIdx + 2];

    events.push(
      makeInstagramEvent("login", timestamps[i], "me", [], {
        ip,
        userAgent,
        language,
      }),
    );
  }

  return events;
}
