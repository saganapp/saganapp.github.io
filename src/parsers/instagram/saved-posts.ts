import type { MetadataEvent } from "../types";
import { makeInstagramEvent, parseInstagramDate } from "./utils";

/**
 * Parse saved_posts.html → reaction events (subType: "saved_post").
 *
 * Actual structure: owner username in <h2> tag, date in _a6_r cell.
 */
export function parseSavedPosts(html: string): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  // Split into blocks by uiBoxWhite container
  const blockRegex =
    /uiBoxWhite noborder">([\s\S]*?)(?=(?:<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">)|$)/g;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];

    // Extract owner from <h2>
    const ownerMatch = block.match(/<h2[^>]*_a6-h[^>]*>([^<]+)<\/h2>/);
    if (!ownerMatch) continue;
    const owner = ownerMatch[1].trim();

    // Extract date from _a6_r cell
    const dateMatch = block.match(/_a6_r">(.*?)<\/td>/);
    if (!dateMatch) continue;

    const timestamp = parseInstagramDate(dateMatch[1]);
    if (!timestamp) continue;

    events.push(
      makeInstagramEvent("reaction", timestamp, "me", [owner], {
        subType: "saved_post",
        owner,
      }),
    );
  }

  return events;
}
