import { describe, it, expect, beforeEach } from "vitest";
import { parseSavedPosts } from "@/parsers/instagram/saved-posts";
import { resetIdCounter } from "@/parsers/instagram/utils";

/** Actual format: owner in <h2>, date in _a6_r cell */
function makeSavedPostsHtml(posts: { username: string; date: string }[]): string {
  const blocks = posts
    .map(
      (p) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <h2 class="_3-95 _2pim _a6-h _a6-i">${p.username}</h2>
        <div class="_a6-p"><table>
          <tr><td colspan="2" class="_2pin _a6_q">Saved on<div><a href="https://www.instagram.com/p/ABC123/">https://www.instagram.com/p/ABC123/</a></div></td></tr>
          <tr><td class="_2pin _a6_q">Saved on</td><td class="_2pin _2piu _a6_r">${p.date}</td></tr>
        </table></div>
      </div>`,
    )
    .join("\n");

  return `<html><body>${blocks}</body></html>`;
}

describe("parseSavedPosts", () => {
  beforeEach(() => resetIdCounter());

  it("parses saved posts as reaction events", () => {
    const html = makeSavedPostsHtml([
      { username: "creator1", date: "jun. 07, 2024 5:44 am" },
    ]);

    const events = parseSavedPosts(html);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("instagram");
    expect(events[0].eventType).toBe("reaction");
    expect(events[0].participants).toEqual(["creator1"]);
    expect(events[0].metadata.subType).toBe("saved_post");
    expect(events[0].metadata.owner).toBe("creator1");
  });

  it("parses multiple saved posts", () => {
    const html = makeSavedPostsHtml([
      { username: "user1", date: "jan. 10, 2024 1:00 pm" },
      { username: "user2", date: "feb. 20, 2024 3:30 pm" },
    ]);

    const events = parseSavedPosts(html);
    expect(events).toHaveLength(2);
    expect(events[0].participants).toEqual(["user1"]);
    expect(events[1].participants).toEqual(["user2"]);
  });

  it("returns empty for HTML without saved posts", () => {
    const html = "<html><body></body></html>";
    const events = parseSavedPosts(html);
    expect(events).toHaveLength(0);
  });
});
