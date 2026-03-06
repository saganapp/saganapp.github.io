import type { MetadataEvent } from "../types";
import { makeInstagramEvent, parseInstagramDate } from "./utils";

/**
 * Parse ads_and_topics/videos_watched.html → browsing events.
 *
 * Structure: blocks with _a6-o date divs, username in _a6_q label + _a6_r value.
 * The <h2> contains "Propietario" (header), not the actual author name.
 */
export function parseVideosWatched(html: string): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  // Split into blocks by uiBoxWhite container
  const blockRegex =
    /uiBoxWhite noborder">([\s\S]*?)(?=(?:<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">)|$)/g;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];

    // Extract username from label+value pattern:
    // <td class="_a6_q">Username</td><td class="... _a6_r">value</td>
    const usernameMatch = block.match(
      /_a6_q">(?:Nombre de usuario|Username)<\/td>\s*<td[^>]*_a6_r">(.*?)<\/td>/,
    );
    if (!usernameMatch) continue;
    const username = usernameMatch[1].trim();

    // Extract date from _a6-o div first, fall back to _a6_r date
    let dateStr: string | null = null;
    const a6oMatch = block.match(/_a6-o">(.*?)<\/div>/);
    if (a6oMatch) {
      dateStr = a6oMatch[1];
    } else {
      // Fall back: find _a6_r cells that look like dates (not usernames)
      const a6rRegex = /_a6_r">(.*?)<\/td>/g;
      let m;
      while ((m = a6rRegex.exec(block)) !== null) {
        // Skip the username cell we already matched
        if (m[1].trim() === username) continue;
        dateStr = m[1];
        break;
      }
    }
    if (!dateStr) continue;

    const timestamp = parseInstagramDate(dateStr);
    if (!timestamp) continue;

    events.push(
      makeInstagramEvent("browsing", timestamp, "me", [], {
        subType: "video_watched",
        username,
      }),
    );
  }

  return events;
}

/**
 * Parse ads_and_topics/suggested_profiles_viewed.html → ad_interaction events.
 *
 * Structure: no <h2> tags. Usernames in _a6_q cells with nested <div><div>value</div></div>,
 * dates in _a6_r cells.
 */
export function parseSuggestedProfiles(html: string): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  // Split into blocks by uiBoxWhite container
  const blockRegex =
    /uiBoxWhite noborder">([\s\S]*?)(?=(?:<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">)|$)/g;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];

    // Extract username from _a6_q cell with nested divs:
    // <td ... _a6_q">Username<div><div>claudiareyal</div></div></td>
    const usernameMatch = block.match(
      /_a6_q">(?:Nombre de usuario|Username)<div><div>(.*?)<\/div><\/div><\/td>/,
    );
    if (!usernameMatch) continue;
    const username = usernameMatch[1].trim();

    // Extract date from _a6_r cell
    const dateMatch = block.match(/_a6_r">(.*?)<\/td>/);
    if (!dateMatch) continue;

    const timestamp = parseInstagramDate(dateMatch[1]);
    if (!timestamp) continue;

    events.push(
      makeInstagramEvent("ad_interaction", timestamp, "me", [], {
        subType: "suggested_profile",
        username,
      }),
    );
  }

  return events;
}
