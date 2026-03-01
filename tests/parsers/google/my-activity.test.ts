import { describe, it, expect, beforeEach } from "vitest";
import { parseMyActivity } from "@/parsers/google/my-activity";
import { resetIdCounter } from "@/parsers/google/utils";

function toUint8(json: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(json));
}

describe("parseMyActivity", () => {
  beforeEach(() => resetIdCounter());

  it("parses search activity", () => {
    const data = [
      {
        header: "Search",
        title: "Searched for weather forecast",
        time: "2024-06-15T10:30:00.000Z",
        products: ["Search"],
      },
    ];
    const events = parseMyActivity(toUint8(data), "My Activity/Search/MyActivity.json");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("search");
    expect(events[0].source).toBe("google");
    expect(events[0].timestamp).toEqual(new Date("2024-06-15T10:30:00.000Z"));
  });

  it("classifies ad interactions", () => {
    const data = [
      {
        header: "Ads",
        title: "Visited advertiser's site",
        time: "2024-06-15T11:00:00.000Z",
        products: ["Ads"],
      },
    ];
    const events = parseMyActivity(toUint8(data), "My Activity/Ads/MyActivity.json");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("ad_interaction");
  });

  it("classifies login events", () => {
    const data = [
      {
        header: "Sign-in",
        title: "Signed in",
        time: "2024-01-01T08:00:00.000Z",
      },
    ];
    const events = parseMyActivity(toUint8(data), "My Activity/Login/MyActivity.json");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("login");
  });

  it("classifies Chrome activity as 'browsing'", () => {
    const data = [
      {
        header: "Chrome",
        title: "Visited page",
        time: "2024-01-01T12:00:00Z",
        products: ["Chrome"],
      },
    ];
    const events = parseMyActivity(toUint8(data), "test.json");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("browsing");
    expect(events[0].metadata.subSource).toBe("Chrome");
  });

  it("classifies YouTube activity as 'other' with subSource", () => {
    const data = [
      {
        header: "YouTube",
        title: "Watched a video",
        time: "2024-01-01T14:00:00Z",
        products: ["YouTube"],
      },
    ];
    const events = parseMyActivity(toUint8(data), "test.json");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("other");
    expect(events[0].metadata.subSource).toBe("YouTube");
  });

  it("classifies Maps activity as 'location'", () => {
    const data = [
      {
        header: "Maps",
        title: "Searched for a place",
        time: "2024-01-01T16:00:00Z",
        products: ["Maps"],
      },
    ];
    const events = parseMyActivity(toUint8(data), "test.json");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("location");
    expect(events[0].metadata.subSource).toBe("Maps");
  });

  it("handles missing time gracefully", () => {
    const data = [{ header: "Search", title: "something" }];
    const events = parseMyActivity(toUint8(data), "test.json");
    expect(events).toHaveLength(0);
  });

  it("handles invalid JSON gracefully", () => {
    const data = new TextEncoder().encode("not json");
    const events = parseMyActivity(data, "test.json");
    expect(events).toHaveLength(0);
  });

  it("handles non-array JSON", () => {
    const data = new TextEncoder().encode('{"foo": "bar"}');
    const events = parseMyActivity(data, "test.json");
    expect(events).toHaveLength(0);
  });

  it("parses multiple activity items with correct classification", () => {
    const data = [
      { header: "Search", title: "Query 1", time: "2024-01-01T10:00:00Z" },
      { header: "Search", title: "Query 2", time: "2024-01-01T11:00:00Z" },
      { header: "Chrome", title: "Visited page", time: "2024-01-01T12:00:00Z", products: ["Chrome"] },
    ];
    const events = parseMyActivity(toUint8(data), "test.json");
    expect(events).toHaveLength(3);
    expect(events[0].eventType).toBe("search");
    expect(events[1].eventType).toBe("search");
    expect(events[2].eventType).toBe("browsing"); // Chrome → browsing, not search
  });

  it("parses HTML format search activity", () => {
    const html = `<html><head></head><body>
      <div class="mdl-grid">
        <div class="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp">
          <div class="mdl-grid">
            <div class="header-cell mdl-cell mdl-cell--12-col">
              <p class="mdl-typography--title">Search<br></p>
            </div>
            <div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">
              Searched for <a href="https://www.google.com/search?q=test">test query</a><br>
              Feb 25, 2026, 10:39:22 PM CET<br>
            </div>
            <div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1 mdl-typography--text-right"></div>
            <div class="content-cell mdl-cell mdl-cell--12-col mdl-typography--caption">
              <b>Products:</b><br>&emsp;Search<br>
            </div>
          </div>
        </div>
      </div>
    </body></html>`;
    const data = new TextEncoder().encode(html);
    const events = parseMyActivity(data, "My Activity/Search/MyActivity.html");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("search");
    expect(events[0].source).toBe("google");
    expect(events[0].metadata.header).toBe("Search");
    expect(events[0].metadata.products).toEqual(["Search"]);
  });

  it("parses HTML format Maps activity", () => {
    const html = `<html><body>
      <div class="mdl-grid">
        <div class="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp">
          <div class="mdl-grid">
            <div class="header-cell mdl-cell mdl-cell--12-col">
              <p class="mdl-typography--title">Maps<br></p>
            </div>
            <div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">
              <a href="http://maps.google.com/maps?ftid=0x123">Some Place</a><br>
              Jan 15, 2025, 1:27:48 PM PST<br>
            </div>
            <div class="content-cell mdl-cell mdl-cell--12-col mdl-typography--caption">
              <b>Products:</b><br>&emsp;Maps<br>
            </div>
          </div>
        </div>
      </div>
    </body></html>`;
    const data = new TextEncoder().encode(html);
    const events = parseMyActivity(data, "My Activity/Maps/MyActivity.html");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("location");
    expect(events[0].metadata.subSource).toBe("Maps");
  });

  it("parses multiple HTML entries", () => {
    const html = `<html><body><div class="mdl-grid">
      <div class="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp">
        <div class="mdl-grid">
          <div class="header-cell mdl-cell mdl-cell--12-col"><p class="mdl-typography--title">Search<br></p></div>
          <div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">Searched for foo<br>Mar 1, 2025, 9:00:00 AM UTC<br></div>
          <div class="content-cell mdl-cell mdl-cell--12-col mdl-typography--caption"><b>Products:</b><br>&emsp;Search<br></div>
        </div>
      </div>
      <div class="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp">
        <div class="mdl-grid">
          <div class="header-cell mdl-cell mdl-cell--12-col"><p class="mdl-typography--title">Chrome<br></p></div>
          <div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">Visited page<br>Mar 1, 2025, 10:00:00 AM UTC<br></div>
          <div class="content-cell mdl-cell mdl-cell--12-col mdl-typography--caption"><b>Products:</b><br>&emsp;Chrome<br></div>
        </div>
      </div>
    </div></body></html>`;
    const data = new TextEncoder().encode(html);
    const events = parseMyActivity(data, "test.html");
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("search");
    expect(events[1].eventType).toBe("browsing");
  });

  it("handles HTML without valid entries gracefully", () => {
    const html = `<html><body><div>No activity entries here</div></body></html>`;
    const data = new TextEncoder().encode(html);
    const events = parseMyActivity(data, "test.html");
    expect(events).toHaveLength(0);
  });
});
