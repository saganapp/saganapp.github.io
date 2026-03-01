import { describe, it, expect, beforeEach } from "vitest";
import { parseInstagramLikes } from "@/parsers/instagram/likes";
import { resetIdCounter } from "@/parsers/instagram/utils";

function makeLikesHtml(
  likes: { username: string; date: string }[],
): string {
  const likeBlocks = likes
    .map(
      (l) => `
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <div class="_a6-p"><table style="table-layout: fixed;">
          <tr><td colspan="2" class="_a6_q">URL<div><a href="https://www.instagram.com/p/abc/">link</a></div></td></tr>
          <tr><td colspan="2" class="_a6_q"><div><div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
            <h2 class="_3-95 _2pim _a6-h _a6-i">Propietario</h2>
            <div class="_a6-p"><div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
              <div class="_a6-p"><table style="table-layout: fixed;">
                <tr><td colspan="2" class="_a6_q"><div><div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
                  <div class="_a6-p"><div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
                    <div class="_a6-p"><table style="table-layout: fixed;">
                      <tr><td class="_a6_q">URL</td><td class="_2piu _a6_r">https://example.com</td></tr>
                      <tr><td class="_a6_q">Nombre</td><td class="_2piu _a6_r">Display Name</td></tr>
                      <tr><td class="_a6_q">Nombre de usuario</td><td class="_2piu _a6_r">${l.username}</td></tr>
                    </table></div>
                  </div></div>
                </div></div></td></tr>
              </table></div>
            </div></div>
          </div></div></td></tr>
        </table></div>
        <div class="_3-94 _a6-o">${l.date}</div>
      </div>`,
    )
    .join("\n");

  return `<html><body>
    <h1>Publicaciones que te gustan</h1>
    <main class="_a706" role="main">
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <div class="_3-95 _a6-p">
          ${likeBlocks}
        </div>
      </div>
    </main>
  </body></html>`;
}

describe("parseInstagramLikes", () => {
  beforeEach(() => resetIdCounter());

  it("creates reaction events with correct owner", () => {
    const html = makeLikesHtml([
      { username: "aitana", date: "jun. 07, 2024 5:44 am" },
    ]);

    const events = parseInstagramLikes(html);

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("reaction");
    expect(events[0].actor).toBe("me");
    expect(events[0].participants).toEqual(["aitana"]);
    expect(events[0].metadata.owner).toBe("aitana");
    expect(events[0].metadata.subType).toBe("liked_post");
  });

  it("parses multiple likes", () => {
    const html = makeLikesHtml([
      { username: "user1", date: "ene. 10, 2024 1:00 pm" },
      { username: "user2", date: "feb. 20, 2024 3:30 pm" },
    ]);

    const events = parseInstagramLikes(html);

    expect(events).toHaveLength(2);
    expect(events[0].participants).toEqual(["user1"]);
    expect(events[1].participants).toEqual(["user2"]);
  });

  it("parses dates correctly", () => {
    const html = makeLikesHtml([
      { username: "user", date: "jun. 07, 2024 5:44 am" },
    ]);

    const events = parseInstagramLikes(html);
    const ts = events[0].timestamp;

    expect(ts.getFullYear()).toBe(2024);
    expect(ts.getMonth()).toBe(5); // June
    expect(ts.getDate()).toBe(7);
    expect(ts.getHours()).toBe(5);
    expect(ts.getMinutes()).toBe(44);
  });

  it("sets source to instagram", () => {
    const html = makeLikesHtml([
      { username: "user", date: "mar. 01, 2024 12:00 pm" },
    ]);

    const events = parseInstagramLikes(html);
    expect(events[0].source).toBe("instagram");
  });

  it("handles English username label", () => {
    const html = `<html><body>
      <div class="_a6-p"><table>
        <tr><td class="_a6_q">Username</td><td class="_2piu _a6_r">english_user</td></tr>
      </table></div>
      <div class="_3-94 _a6-o">jan. 15, 2024 2:00 pm</div>
    </body></html>`;

    const events = parseInstagramLikes(html);
    expect(events).toHaveLength(1);
    expect(events[0].participants).toEqual(["english_user"]);
  });

  it("returns empty array for HTML without likes", () => {
    const html = "<html><body><h1>Empty</h1></body></html>";
    const events = parseInstagramLikes(html);
    expect(events).toHaveLength(0);
  });
});
