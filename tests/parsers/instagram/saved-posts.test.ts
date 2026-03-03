import { describe, it, expect, beforeEach } from "vitest";
import { parseSavedPosts } from "@/parsers/instagram/saved-posts";
import { resetIdCounter } from "@/parsers/instagram/utils";

function makeSavedPostsHtml(posts: { username: string; date: string }[]): string {
  const blocks = posts
    .map(
      (p) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <div class="_a6-p"><table>
          <tr><td class="_a6_q">Nombre de usuario</td><td class="_2piu _a6_r">${p.username}</td></tr>
        </table></div>
        <div class="_3-94 _a6-o">${p.date}</div>
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
  });

  it("handles English username label", () => {
    const html = `<html><body>
      <div><table>
        <tr><td class="_a6_q">Username</td><td class="_2piu _a6_r">english_user</td></tr>
      </table></div>
      <div class="_3-94 _a6-o">jan. 15, 2024 2:00 pm</div>
    </body></html>`;

    const events = parseSavedPosts(html);
    expect(events).toHaveLength(1);
    expect(events[0].participants).toEqual(["english_user"]);
  });

  it("returns empty for HTML without saved posts", () => {
    const html = "<html><body></body></html>";
    const events = parseSavedPosts(html);
    expect(events).toHaveLength(0);
  });
});
