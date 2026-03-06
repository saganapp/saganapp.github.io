import type { MetadataEvent } from "../types";
import { makeInstagramEvent, parseInstagramDate } from "./utils";

/**
 * Parse following.html or followers_1.html → contact_added events.
 *
 * Splits on uiBoxWhite blocks, extracts username from <h2> or <a> tag,
 * and date from a plain <div> matching the localized date pattern.
 */
export function parseInstagramSocialGraph(
  html: string,
  direction: "follower" | "following",
): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  // Split into blocks delimited by the uiBoxWhite container class
  const blockRegex =
    /uiBoxWhite noborder">([\s\S]*?)(?=(?:<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">)|$)/g;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];

    // Extract username: prefer <h2>, fall back to <a> tag
    let username: string | null = null;
    const h2Match = block.match(/<h2[^>]*>([^<]+)<\/h2>/);
    if (h2Match) {
      username = h2Match[1];
    } else {
      const aMatch = block.match(/<a[^>]*>([^<]+)<\/a>/);
      if (aMatch) {
        username = aMatch[1];
      }
    }
    if (!username) continue;

    // Extract date: find a <div> containing a localized date pattern
    // (month abbreviation. DD, YYYY H:MM am/pm)
    const dateMatch = block.match(
      /<div>(\s*\S+\.?\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:am|pm)\s*)<\/div>/i,
    );
    if (!dateMatch) continue;

    const timestamp = parseInstagramDate(dateMatch[1]);
    if (!timestamp) continue;

    events.push(
      makeInstagramEvent("contact_added", timestamp, "me", [username], {
        username,
        direction,
      }),
    );
  }

  return events;
}
