import { describe, it, expect, beforeEach } from "vitest";
import {
  stripJsPrefix,
  parseTwitterJs,
  parseJsonArrayChunked,
  snowflakeToTimestamp,
  extractDevice,
  makeTwitterEvent,
  resetIdCounter,
} from "@/parsers/twitter/utils";

describe("stripJsPrefix", () => {
  it("strips window.YTD assignment prefix", () => {
    const input = 'window.YTD.like.part0 = [{"foo": 1}]';
    expect(stripJsPrefix(input)).toBe('[{"foo": 1}]');
  });

  it("handles multi-part names", () => {
    const input = 'window.YTD.direct_message_headers.part0 = []';
    expect(stripJsPrefix(input)).toBe("[]");
  });

  it("returns raw string when no prefix found", () => {
    const input = '[{"foo": 1}]';
    expect(stripJsPrefix(input)).toBe('[{"foo": 1}]');
  });
});

describe("parseTwitterJs", () => {
  it("parses a Twitter JS data file", () => {
    const raw = 'window.YTD.account.part0 = [{"account": {"id": "123"}}]';
    const data = new TextEncoder().encode(raw);
    const result = parseTwitterJs(data);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ account: { id: "123" } });
  });

  it("returns empty array for non-array JSON", () => {
    const raw = 'window.YTD.foo.part0 = {"not": "array"}';
    const data = new TextEncoder().encode(raw);
    expect(parseTwitterJs(data)).toEqual([]);
  });
});

describe("parseJsonArrayChunked", () => {
  it("parses a normal array of objects", () => {
    const json = '[{"a":1},{"b":2},{"c":3}]';
    expect(parseJsonArrayChunked(json)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it("handles nested objects and arrays", () => {
    const json = '[{"a":{"b":[1,2,{"c":3}]}},{"d":[[4,5]]}]';
    expect(parseJsonArrayChunked(json)).toEqual([
      { a: { b: [1, 2, { c: 3 }] } },
      { d: [[4, 5]] },
    ]);
  });

  it("handles strings containing braces and brackets", () => {
    const json = '[{"text":"hello {world} [test]"},{"text":"a\\"b"}]';
    expect(parseJsonArrayChunked(json)).toEqual([
      { text: "hello {world} [test]" },
      { text: 'a"b' },
    ]);
  });

  it("returns empty array for empty JSON array", () => {
    expect(parseJsonArrayChunked("[]")).toEqual([]);
  });

  it("returns empty array for whitespace-only array", () => {
    expect(parseJsonArrayChunked("[  \n  ]")).toEqual([]);
  });

  it("returns empty array for non-array input", () => {
    expect(parseJsonArrayChunked("not json")).toEqual([]);
  });

  it("handles whitespace between elements", () => {
    const json = '[ {"a": 1} , {"b": 2} ]';
    expect(parseJsonArrayChunked(json)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("handles strings with escaped backslashes", () => {
    const json = '[{"path":"C:\\\\Users\\\\test"}]';
    expect(parseJsonArrayChunked(json)).toEqual([{ path: "C:\\Users\\test" }]);
  });
});

describe("snowflakeToTimestamp", () => {
  it("converts a known snowflake ID to approximate timestamp", () => {
    // ID 1085498591706312708 should decode to approximately 2019-01-16
    const ts = snowflakeToTimestamp("1085498591706312708");
    expect(ts.getFullYear()).toBe(2019);
    expect(ts.getMonth()).toBe(0); // January
    expect(ts.getDate()).toBe(16);
  });

  it("converts a recent snowflake ID", () => {
    const ts = snowflakeToTimestamp("2026668169864077710");
    expect(ts.getFullYear()).toBe(2026);
  });
});

describe("extractDevice", () => {
  it("extracts device name from Twitter source HTML", () => {
    const html = '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>';
    expect(extractDevice(html)).toBe("Twitter for Android");
  });

  it("extracts web client", () => {
    const html = '<a href="https://mobile.twitter.com" rel="nofollow">Twitter Web App</a>';
    expect(extractDevice(html)).toBe("Twitter Web App");
  });

  it("returns raw string if no HTML tags", () => {
    expect(extractDevice("plain text")).toBe("plain text");
  });
});

describe("makeTwitterEvent", () => {
  beforeEach(() => resetIdCounter());

  it("creates an event with twitter source", () => {
    const ts = new Date("2024-01-01T12:00:00Z");
    const event = makeTwitterEvent("message_sent", ts, "me", ["user1"], { device: "Android" });
    expect(event.source).toBe("twitter");
    expect(event.eventType).toBe("message_sent");
    expect(event.id).toMatch(/^tw-/);
    expect(event.participants).toEqual(["user1"]);
    expect(event.metadata.device).toBe("Android");
  });
});
