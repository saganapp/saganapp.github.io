import { describe, it, expect, beforeEach } from "vitest";
import { parseFollowers, parseFollowing } from "@/parsers/twitter/social-graph";
import { resetIdCounter } from "@/parsers/twitter/utils";

function toTwitterJs(varName: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `window.YTD.${varName}.part0 = ${JSON.stringify(data)}`,
  );
}

describe("parseFollowers", () => {
  beforeEach(() => resetIdCounter());

  it("parses follower entries with snowflake timestamps", () => {
    const data = toTwitterJs("follower", [
      {
        follower: {
          accountId: "1085498591706312708",
          userLink: "https://twitter.com/intent/user?user_id=1085498591706312708",
        },
      },
    ]);

    const events = parseFollowers(data);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("twitter");
    expect(events[0].eventType).toBe("contact_added");
    expect(events[0].metadata.direction).toBe("follower");
    expect(events[0].metadata.approximateTime).toBe(true);
    expect(events[0].metadata.accountId).toBe("1085498591706312708");
    expect(events[0].timestamp.getFullYear()).toBe(2019);
  });

  it("parses multiple followers", () => {
    const data = toTwitterJs("follower", [
      { follower: { accountId: "1085498591706312708" } },
      { follower: { accountId: "2026415106150531454" } },
    ]);

    const events = parseFollowers(data);
    expect(events).toHaveLength(2);
  });

  it("skips entries without accountId", () => {
    const data = toTwitterJs("follower", [{ follower: {} }]);
    const events = parseFollowers(data);
    expect(events).toHaveLength(0);
  });
});

describe("parseFollowing", () => {
  beforeEach(() => resetIdCounter());

  it("parses following entries with direction 'following'", () => {
    const data = toTwitterJs("following", [
      {
        following: {
          accountId: "1085498591706312708",
          userLink: "https://twitter.com/intent/user?user_id=1085498591706312708",
        },
      },
    ]);

    const events = parseFollowing(data);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("contact_added");
    expect(events[0].metadata.direction).toBe("following");
  });

  it("returns empty array for empty input", () => {
    const data = toTwitterJs("following", []);
    const events = parseFollowing(data);
    expect(events).toHaveLength(0);
  });
});
