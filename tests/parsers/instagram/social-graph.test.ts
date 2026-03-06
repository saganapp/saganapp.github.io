import { describe, it, expect, beforeEach } from "vitest";
import { parseInstagramSocialGraph } from "@/parsers/instagram/social-graph";
import { resetIdCounter } from "@/parsers/instagram/utils";

/** Followers: no <h2>, username in <a>, date in plain <div> */
function makeFollowersHtml(entries: { username: string; date: string }[]): string {
  const blocks = entries
    .map(
      (e) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <div class="_a6-p"><div><div>
          <a target="_blank" href="https://www.instagram.com/${e.username}">${e.username}</a>
        </div>
        <div>${e.date}</div></div></div>
      </div>`,
    )
    .join("\n");

  return `<html><body><main>${blocks}</main></body></html>`;
}

/** Following: username in <h2>, date in plain <div> (no _a6-o) */
function makeFollowingHtml(entries: { username: string; date: string }[]): string {
  const blocks = entries
    .map(
      (e) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <h2 class="_3-95 _2pim _a6-h _a6-i">${e.username}</h2>
        <div class="_a6-p"><div><div>
          <a target="_blank" href="https://www.instagram.com/${e.username}">${e.username}</a>
        </div>
        <div>${e.date}</div></div></div>
      </div>`,
    )
    .join("\n");

  return `<html><body><main>${blocks}</main></body></html>`;
}

describe("parseInstagramSocialGraph", () => {
  beforeEach(() => resetIdCounter());

  it("parses following entries (with <h2>)", () => {
    const html = makeFollowingHtml([
      { username: "someuser", date: "jun. 07, 2024 5:44 am" },
    ]);

    const events = parseInstagramSocialGraph(html, "following");
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("instagram");
    expect(events[0].eventType).toBe("contact_added");
    expect(events[0].participants).toEqual(["someuser"]);
    expect(events[0].metadata.direction).toBe("following");
    expect(events[0].metadata.username).toBe("someuser");
  });

  it("parses follower entries (no <h2>, username from <a>)", () => {
    const html = makeFollowersHtml([
      { username: "follower1", date: "jan. 15, 2024 2:00 pm" },
    ]);

    const events = parseInstagramSocialGraph(html, "follower");
    expect(events).toHaveLength(1);
    expect(events[0].metadata.direction).toBe("follower");
    expect(events[0].participants).toEqual(["follower1"]);
  });

  it("parses multiple entries", () => {
    const html = makeFollowersHtml([
      { username: "user1", date: "jan. 10, 2024 1:00 pm" },
      { username: "user2", date: "feb. 20, 2024 3:30 pm" },
    ]);

    const events = parseInstagramSocialGraph(html, "following");
    expect(events).toHaveLength(2);
    expect(events[0].participants).toEqual(["user1"]);
    expect(events[1].participants).toEqual(["user2"]);
  });

  it("parses Spanish date format", () => {
    const html = makeFollowersHtml([
      { username: "rodrigotalavitz", date: "mar. 28, 2025 10:57 am" },
    ]);

    const events = parseInstagramSocialGraph(html, "follower");
    expect(events).toHaveLength(1);
    expect(events[0].participants).toEqual(["rodrigotalavitz"]);
  });

  it("returns empty for HTML without entries", () => {
    const html = "<html><body></body></html>";
    const events = parseInstagramSocialGraph(html, "following");
    expect(events).toHaveLength(0);
  });
});
