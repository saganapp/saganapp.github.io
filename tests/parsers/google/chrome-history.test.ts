import { describe, it, expect, beforeEach } from "vitest";
import { parseChromeHistory } from "@/parsers/google/chrome-history";
import { resetIdCounter } from "@/parsers/google/utils";

function toUint8(json: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(json));
}

describe("parseChromeHistory", () => {
  beforeEach(() => resetIdCounter());

  it("classifies regular browsing as 'browsing'", () => {
    const data = {
      "Browser History": [
        {
          page_transition: "LINK",
          title: "Example Page",
          url: "https://example.com/page",
          time_usec: 1718451000000000,
        },
      ],
    };
    const events = parseChromeHistory(toUint8(data));
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("browsing");
    expect(events[0].source).toBe("google");
    expect(events[0].actor).toBe("me");
    expect(events[0].metadata.domain).toBe("example.com");
    expect(events[0].metadata.transition).toBe("LINK");
  });

  it("classifies Google search URLs as 'search'", () => {
    const data = {
      "Browser History": [
        {
          time_usec: 1718451000000000,
          url: "https://www.google.com/search?q=test+query",
        },
      ],
    };
    const events = parseChromeHistory(toUint8(data));
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("search");
  });

  it("classifies Bing search URLs as 'search'", () => {
    const data = {
      "Browser History": [
        {
          time_usec: 1718451000000000,
          url: "https://www.bing.com/search?q=test",
        },
      ],
    };
    const events = parseChromeHistory(toUint8(data));
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("search");
  });

  it("classifies DuckDuckGo search as 'search'", () => {
    const data = {
      "Browser History": [
        {
          time_usec: 1718451000000000,
          url: "https://duckduckgo.com/?q=test",
        },
      ],
    };
    const events = parseChromeHistory(toUint8(data));
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("search");
  });

  it("classifies Google homepage (no query) as 'browsing'", () => {
    const data = {
      "Browser History": [
        {
          time_usec: 1718451000000000,
          url: "https://www.google.com/",
        },
      ],
    };
    const events = parseChromeHistory(toUint8(data));
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("browsing");
  });

  it("handles multiple entries with mixed types", () => {
    const data = {
      "Browser History": [
        { time_usec: 1718451000000000, url: "https://a.com" },
        { time_usec: 1718452000000000, url: "https://www.google.com/search?q=hello" },
        { time_usec: 1718453000000000, url: "https://c.org/path" },
      ],
    };
    const events = parseChromeHistory(toUint8(data));
    expect(events).toHaveLength(3);
    expect(events[0].eventType).toBe("browsing");
    expect(events[1].eventType).toBe("search");
    expect(events[2].eventType).toBe("browsing");
    expect(events[2].metadata.domain).toBe("c.org");
  });

  it("handles missing Browser History key", () => {
    const data = { other: [] };
    const events = parseChromeHistory(toUint8(data));
    expect(events).toHaveLength(0);
  });

  it("skips entries without time_usec", () => {
    const data = {
      "Browser History": [
        { url: "https://example.com" },
      ],
    };
    const events = parseChromeHistory(toUint8(data));
    expect(events).toHaveLength(0);
  });

  it("handles invalid URL gracefully", () => {
    const data = {
      "Browser History": [
        { time_usec: 1718451000000000, url: "not-a-url" },
      ],
    };
    const events = parseChromeHistory(toUint8(data));
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("browsing");
    expect(events[0].metadata.domain).toBe("");
  });
});
