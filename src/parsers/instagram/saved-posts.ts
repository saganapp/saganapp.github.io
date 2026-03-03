import type { MetadataEvent } from "../types";
import { makeInstagramEvent, parseInstagramDate } from "./utils";

/**
 * Parse saved_posts.html → reaction events (subType: "saved_post").
 *
 * Similar structure to likes: owner username in table + date in _a6-o div.
 */
export function parseSavedPosts(html: string): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  // Extract owner usernames — same pattern as likes
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
    const timestamp = parseInstagramDate(dates[i]);
    if (!timestamp) continue;

    events.push(
      makeInstagramEvent("reaction", timestamp, "me", [owners[i]], {
        subType: "saved_post",
        owner: owners[i],
      }),
    );
  }

  return events;
}
