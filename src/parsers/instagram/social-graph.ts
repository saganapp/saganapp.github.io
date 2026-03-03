import type { MetadataEvent } from "../types";
import { makeInstagramEvent, parseInstagramDate } from "./utils";

/**
 * Parse following.html or followers_1.html → contact_added events.
 *
 * HTML structure: <h2>username</h2> followed by <div class="_a6-o">date</div>
 */
export function parseInstagramSocialGraph(
  html: string,
  direction: "follower" | "following",
): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  // Extract usernames from <h2> tags and dates from _a6-o divs
  // The structure pairs each <h2>username</h2> with the next <div class="_a6-o">date</div>
  const usernameRegex = /<h2[^>]*>([^<]+)<\/h2>/g;
  const dateRegex = /_a6-o">(.*?)<\/div>/g;

  const usernames: string[] = [];
  const dates: string[] = [];

  let m;
  while ((m = usernameRegex.exec(html)) !== null) {
    usernames.push(m[1]);
  }
  while ((m = dateRegex.exec(html)) !== null) {
    dates.push(m[1]);
  }

  const count = Math.min(usernames.length, dates.length);

  for (let i = 0; i < count; i++) {
    const timestamp = parseInstagramDate(dates[i]);
    if (!timestamp) continue;

    events.push(
      makeInstagramEvent("contact_added", timestamp, "me", [usernames[i]], {
        username: usernames[i],
        direction,
      }),
    );
  }

  return events;
}
