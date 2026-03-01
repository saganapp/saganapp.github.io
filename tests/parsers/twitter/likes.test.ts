import { describe, it, expect, beforeEach } from "vitest";
import { parseLikes } from "@/parsers/twitter/likes";
import { resetIdCounter } from "@/parsers/twitter/utils";

function toTwitterJs(varName: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `window.YTD.${varName}.part0 = ${JSON.stringify(data)}`,
  );
}

describe("parseLikes", () => {
  beforeEach(() => resetIdCounter());

  it("parses likes with snowflake timestamp extraction", () => {
    const data = toTwitterJs("like", [
      {
        like: {
          tweetId: "1085498591706312708",
          fullText: "Some tweet text",
        },
      },
    ]);

    const events = parseLikes(data);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("twitter");
    expect(events[0].eventType).toBe("reaction");
    expect(events[0].metadata.tweetId).toBe("1085498591706312708");
    expect(events[0].metadata.approximateTime).toBe(true);
    // Snowflake 1085498591706312708 → approximately 2019-01-16
    expect(events[0].timestamp.getFullYear()).toBe(2019);
  });

  it("parses multiple likes", () => {
    const data = toTwitterJs("like", [
      { like: { tweetId: "1085498591706312708" } },
      { like: { tweetId: "2026415106150531454" } },
    ]);

    const events = parseLikes(data);
    expect(events).toHaveLength(2);
  });

  it("skips likes without tweetId", () => {
    const data = toTwitterJs("like", [{ like: {} }]);
    const events = parseLikes(data);
    expect(events).toHaveLength(0);
  });
});
