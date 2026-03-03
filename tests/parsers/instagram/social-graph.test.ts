import { describe, it, expect, beforeEach } from "vitest";
import { parseInstagramSocialGraph } from "@/parsers/instagram/social-graph";
import { resetIdCounter } from "@/parsers/instagram/utils";

function makeSocialGraphHtml(entries: { username: string; date: string }[]): string {
  const blocks = entries
    .map(
      (e) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <h2 class="_3-95 _2pim _a6-h _a6-i">${e.username}</h2>
        <div class="_3-94 _a6-o">${e.date}</div>
      </div>`,
    )
    .join("\n");

  return `<html><body>${blocks}</body></html>`;
}

describe("parseInstagramSocialGraph", () => {
  beforeEach(() => resetIdCounter());

  it("parses following entries", () => {
    const html = makeSocialGraphHtml([
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

  it("parses follower entries", () => {
    const html = makeSocialGraphHtml([
      { username: "follower1", date: "jan. 15, 2024 2:00 pm" },
    ]);

    const events = parseInstagramSocialGraph(html, "follower");
    expect(events).toHaveLength(1);
    expect(events[0].metadata.direction).toBe("follower");
  });

  it("parses multiple entries", () => {
    const html = makeSocialGraphHtml([
      { username: "user1", date: "jan. 10, 2024 1:00 pm" },
      { username: "user2", date: "feb. 20, 2024 3:30 pm" },
    ]);

    const events = parseInstagramSocialGraph(html, "following");
    expect(events).toHaveLength(2);
    expect(events[0].participants).toEqual(["user1"]);
    expect(events[1].participants).toEqual(["user2"]);
  });

  it("returns empty for HTML without entries", () => {
    const html = "<html><body></body></html>";
    const events = parseInstagramSocialGraph(html, "following");
    expect(events).toHaveLength(0);
  });
});
