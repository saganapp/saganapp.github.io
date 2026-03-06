import { describe, it, expect, beforeEach } from "vitest";
import { parseVideosWatched, parseSuggestedProfiles } from "@/parsers/instagram/ads-activity";
import { resetIdCounter } from "@/parsers/instagram/utils";

/** Videos watched: _a6-o date, username in _a6_q label + _a6_r value */
function makeVideosWatchedHtml(entries: { username: string; date: string }[]): string {
  const blocks = entries
    .map(
      (e) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <h2 class="_3-95 _2pim _a6-h _a6-i">Propietario</h2>
        <div class="_a6-p"><table>
          <tr><td class="_2pin _a6_q">Username</td><td class="_2pin _2piu _a6_r">${e.username}</td></tr>
        </table></div>
        <div class="_3-94 _a6-o">${e.date}</div>
      </div>`,
    )
    .join("\n");

  return `<html><body>${blocks}</body></html>`;
}

/** Suggested profiles: no <h2>, username in _a6_q nested divs, date in _a6_r */
function makeSuggestedProfilesHtml(entries: { username: string; date: string }[]): string {
  const blocks = entries
    .map(
      (e) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <div class="_a6-p"><table>
          <tr><td colspan="2" class="_2pin _a6_q">Username<div><div>${e.username}</div></div></td></tr>
          <tr><td class="_2pin _a6_q">Time</td><td class="_2pin _2piu _a6_r">${e.date}</td></tr>
        </table></div>
      </div>`,
    )
    .join("\n");

  return `<html><body>${blocks}</body></html>`;
}

describe("parseVideosWatched", () => {
  beforeEach(() => resetIdCounter());

  it("parses videos watched as browsing events", () => {
    const html = makeVideosWatchedHtml([
      { username: "coolcreator", date: "jun. 07, 2024 5:44 am" },
    ]);

    const events = parseVideosWatched(html);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("instagram");
    expect(events[0].eventType).toBe("browsing");
    expect(events[0].metadata.subType).toBe("video_watched");
    expect(events[0].metadata.username).toBe("coolcreator");
  });

  it("parses Spanish-labeled videos", () => {
    const html = `<html><body>
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <h2 class="_3-95 _2pim _a6-h _a6-i">Propietario</h2>
        <div class="_a6-p"><table>
          <tr><td class="_2pin _a6_q">Nombre de usuario</td><td class="_2pin _2piu _a6_r">maximevelly</td></tr>
        </table></div>
        <div class="_3-94 _a6-o">feb. 27, 2026 6:17 am</div>
      </div>
    </body></html>`;

    const events = parseVideosWatched(html);
    expect(events).toHaveLength(1);
    expect(events[0].metadata.username).toBe("maximevelly");
  });

  it("parses multiple videos", () => {
    const html = makeVideosWatchedHtml([
      { username: "video1", date: "jan. 10, 2024 1:00 pm" },
      { username: "video2", date: "feb. 20, 2024 3:30 pm" },
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
    const html = makeSuggestedProfilesHtml([
      { username: "claudiareyal", date: "sept. 29, 2018 10:10 pm" },
    ]);

    const events = parseSuggestedProfiles(html);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("instagram");
    expect(events[0].eventType).toBe("ad_interaction");
    expect(events[0].metadata.subType).toBe("suggested_profile");
    expect(events[0].metadata.username).toBe("claudiareyal");
  });

  it("parses Spanish-labeled suggested profiles", () => {
    const html = `<html><body>
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <div class="_a6-p"><table>
          <tr><td colspan="2" class="_2pin _a6_q">Nombre de usuario<div><div>maria_garcia</div></div></td></tr>
          <tr><td class="_2pin _a6_q">Hora</td><td class="_2pin _2piu _a6_r">mar. 15, 2023 4:30 pm</td></tr>
        </table></div>
      </div>
    </body></html>`;

    const events = parseSuggestedProfiles(html);
    expect(events).toHaveLength(1);
    expect(events[0].metadata.username).toBe("maria_garcia");
  });

  it("parses multiple suggested profiles", () => {
    const html = makeSuggestedProfilesHtml([
      { username: "user1", date: "mar. 01, 2024 12:00 pm" },
      { username: "user2", date: "apr. 05, 2024 3:00 pm" },
    ]);

    const events = parseSuggestedProfiles(html);
    expect(events).toHaveLength(2);
  });

  it("returns empty for HTML without entries", () => {
    const html = "<html><body></body></html>";
    const events = parseSuggestedProfiles(html);
    expect(events).toHaveLength(0);
  });
});
