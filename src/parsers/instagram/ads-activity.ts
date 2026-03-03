import type { MetadataEvent } from "../types";
import { makeInstagramEvent, parseInstagramDate } from "./utils";

/**
 * Parse ads_and_topics/videos_watched.html → browsing events.
 *
 * Structure: <h2>Author/Title</h2> followed by <div class="_a6-o">date</div>
 */
export function parseVideosWatched(html: string): MetadataEvent[] {
  return parseAdsItems(html, "browsing", "video_watched");
}

/**
 * Parse ads_and_topics/suggested_profiles_viewed.html → ad_interaction events.
 *
 * Same structure: <h2>username</h2> followed by <div class="_a6-o">date</div>
 */
export function parseSuggestedProfiles(html: string): MetadataEvent[] {
  return parseAdsItems(html, "ad_interaction", "suggested_profile");
}

function parseAdsItems(
  html: string,
  eventType: "browsing" | "ad_interaction",
  subType: string,
): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  const nameRegex = /<h2[^>]*>([^<]+)<\/h2>/g;
  const dateRegex = /_a6-o">(.*?)<\/div>/g;

  const names: string[] = [];
  const dates: string[] = [];

  let m;
  while ((m = nameRegex.exec(html)) !== null) {
    names.push(m[1]);
  }
  while ((m = dateRegex.exec(html)) !== null) {
    dates.push(m[1]);
  }

  const count = Math.min(names.length, dates.length);

  for (let i = 0; i < count; i++) {
    const timestamp = parseInstagramDate(dates[i]);
    if (!timestamp) continue;

    events.push(
      makeInstagramEvent(eventType, timestamp, "me", [], {
        subType,
        username: names[i],
      }),
    );
  }

  return events;
}
