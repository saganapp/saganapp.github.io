import type { MetadataEvent } from "../types";
import { makeInstagramEvent, parseInstagramDate } from "./utils";

/**
 * Parse Instagram liked_posts.html.
 *
 * Each liked post block contains:
 *   - Owner info in nested tables with "Nombre de usuario" / "Username" label
 *   - Date: <div class="_3-94 _a6-o">jun. 07, 2024 5:44 am</div>
 *
 * The owner username is extracted from the nested table structure where
 * the label is "Nombre de usuario" (Spanish) or "Username" (English) and
 * the value is in the adjacent cell.
 */
export function parseInstagramLikes(html: string): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  // Strategy: find each liked post block by splitting on date markers,
  // then extract the owner username from the section before each date.
  //
  // The structure has owner info BEFORE the date div for each liked post.
  // We'll find all date divs and owner usernames and pair them.

  // Extract all owner usernames from the nested table structure
  // Pattern: <td class="_a6_q">Nombre de usuario</td><td class="_2piu _a6_r">username</td>
  // Also handle English: <td class="_a6_q">Username</td><td class="_2piu _a6_r">username</td>
  const ownerRegex =
    /_a6_q">(?:Nombre de usuario|Username)<\/td><td class="_2piu _a6_r">(.*?)<\/td>/g;
  const dateRegex = /_a6-o">(.*?)<\/div>/g;

  const owners: string[] = [];
  const dates: string[] = [];

  let m;
  while ((m = ownerRegex.exec(html)) !== null) {
    owners.push(m[1]);
  }
  while ((m = dateRegex.exec(html)) !== null) {
    dates.push(m[1]);
  }

  const count = Math.min(owners.length, dates.length);

  for (let i = 0; i < count; i++) {
    const owner = owners[i];
    const dateStr = dates[i];

    const timestamp = parseInstagramDate(dateStr);
    if (!timestamp) continue;

    events.push(
      makeInstagramEvent("reaction", timestamp, "me", [owner], {
        owner,
        subType: "liked_post",
      }),
    );
  }

  return events;
}
