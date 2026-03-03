import { describe, it, expect, beforeEach } from "vitest";
import { parseVideosWatched, parseSuggestedProfiles } from "@/parsers/instagram/ads-activity";
import { resetIdCounter } from "@/parsers/instagram/utils";

function makeAdsHtml(entries: { name: string; date: string }[]): string {
  const blocks = entries
    .map(
      (e) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <h2 class="_3-95 _2pim _a6-h _a6-i">${e.name}</h2>
        <div class="_3-94 _a6-o">${e.date}</div>
      </div>`,
    )
    .join("\n");

  return `<html><body>${blocks}</body></html>`;
}

describe("parseVideosWatched", () => {
  beforeEach(() => resetIdCounter());

  it("parses videos watched as browsing events", () => {
    const html = makeAdsHtml([
      { name: "Cool Video Creator", date: "jun. 07, 2024 5:44 am" },
    ]);

    const events = parseVideosWatched(html);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("instagram");
    expect(events[0].eventType).toBe("browsing");
    expect(events[0].metadata.subType).toBe("video_watched");
    expect(events[0].metadata.username).toBe("Cool Video Creator");
  });

  it("parses multiple videos", () => {
    const html = makeAdsHtml([
      { name: "Video1", date: "jan. 10, 2024 1:00 pm" },
      { name: "Video2", date: "feb. 20, 2024 3:30 pm" },
    ]);

    const events = parseVideosWatched(html);
    expect(events).toHaveLength(2);
  });

  it("returns empty for HTML without entries", () => {
    const html = "<html><body></body></html>";
    const events = parseVideosWatched(html);
    expect(events).toHaveLength(0);
  });
});

describe("parseSuggestedProfiles", () => {
  beforeEach(() => resetIdCounter());

  it("parses suggested profiles as ad_interaction events", () => {
    const html = makeAdsHtml([
      { name: "suggested_user", date: "mar. 01, 2024 12:00 pm" },
    ]);

    const events = parseSuggestedProfiles(html);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("instagram");
    expect(events[0].eventType).toBe("ad_interaction");
    expect(events[0].metadata.subType).toBe("suggested_profile");
    expect(events[0].metadata.username).toBe("suggested_user");
  });

  it("returns empty for HTML without entries", () => {
    const html = "<html><body></body></html>";
    const events = parseSuggestedProfiles(html);
    expect(events).toHaveLength(0);
  });
});
