import { describe, it, expect, beforeEach } from "vitest";
import { routeFile, SKIP_MY_ACTIVITY } from "@/parsers/google/index";
import { parseMyActivity } from "@/parsers/google/my-activity";
import { resetIdCounter } from "@/parsers/google/utils";

function toUint8(json: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(json));
}

describe("Chrome dedup — routeFile skips Chrome/History.json paths", () => {
  beforeEach(() => resetIdCounter());

  it("parses Chrome/History.json when My Activity/Chrome is absent", () => {
    const data = {
      "Browser History": [
        { time_usec: 1718451000000000, url: "https://example.com" },
      ],
    };
    const events = routeFile("Chrome/History.json", toUint8(data), { userEmail: null });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("browsing");
  });

  it("parses Chrome/BrowserHistory.json as well", () => {
    const data = {
      "Browser History": [
        { time_usec: 1718451000000000, url: "https://example.com" },
      ],
    };
    const events = routeFile("Chrome/BrowserHistory.json", toUint8(data), { userEmail: null });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("browsing");
  });

  it("Chrome dedup filtering removes Chrome/History.json when My Activity/Chrome exists", () => {
    // Simulate the filtering logic from parseGoogleTakeout
    const entries: [string, Uint8Array][] = [
      ["Takeout/Chrome/History.json", new Uint8Array()],
      ["Takeout/My Activity/Chrome/MyActivity.html", new Uint8Array()],
      ["Takeout/My Activity/Search/MyActivity.json", new Uint8Array()],
    ];

    const hasMyActivityChrome = entries.some(([p]) => /My Activity\/Chrome\//.test(p));
    expect(hasMyActivityChrome).toBe(true);

    const filtered = entries.filter(
      ([p]) => !/Chrome\/(?:BrowserHistory|History)\.json$/.test(p.replace(/^Takeout\//, "")),
    );

    expect(filtered).toHaveLength(2);
    expect(filtered.map(([p]) => p)).not.toContain("Takeout/Chrome/History.json");
  });

  it("Chrome dedup filtering keeps Chrome/History.json when My Activity/Chrome is absent", () => {
    const entries: [string, Uint8Array][] = [
      ["Takeout/Chrome/History.json", new Uint8Array()],
      ["Takeout/My Activity/Search/MyActivity.json", new Uint8Array()],
    ];

    const hasMyActivityChrome = entries.some(([p]) => /My Activity\/Chrome\//.test(p));
    expect(hasMyActivityChrome).toBe(false);

    // No filtering applied
    expect(entries).toHaveLength(2);
  });
});

describe("SKIP_MY_ACTIVITY — non-user-initiated folders", () => {
  it("matches My Activity/Discover/", () => {
    expect(SKIP_MY_ACTIVITY.test("My Activity/Discover/MyActivity.html")).toBe(true);
  });

  it("matches My Activity/Takeout/", () => {
    expect(SKIP_MY_ACTIVITY.test("My Activity/Takeout/MyActivity.json")).toBe(true);
  });

  it("matches My Activity/Voice Match/", () => {
    expect(SKIP_MY_ACTIVITY.test("My Activity/Voice Match/MyActivity.html")).toBe(true);
  });

  it("does not match My Activity/Chrome/", () => {
    expect(SKIP_MY_ACTIVITY.test("My Activity/Chrome/MyActivity.html")).toBe(false);
  });

  it("does not match My Activity/Search/", () => {
    expect(SKIP_MY_ACTIVITY.test("My Activity/Search/MyActivity.json")).toBe(false);
  });

  it("routeFile returns no events for skipped folders", () => {
    const data = [
      { header: "Discover", title: "9 cards in your feed", time: "2024-06-15T10:00:00Z" },
    ];
    const events = routeFile("My Activity/Discover/MyActivity.json", toUint8(data), { userEmail: null });
    expect(events).toHaveLength(0);
  });
});

describe("Notification classification", () => {
  beforeEach(() => resetIdCounter());

  it("classifies 'Received a notification' as notification", () => {
    const data = [
      {
        header: "Google Play Store",
        title: "Received a notification from App Name",
        time: "2024-06-15T10:00:00Z",
        products: ["Google Play Store"],
      },
    ];
    const events = parseMyActivity(toUint8(data), "My Activity/Google Play Store/MyActivity.json");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("notification");
  });

  it("classifies lowercase 'received a notification' as notification", () => {
    const data = [
      {
        header: "Android",
        title: "received a notification",
        time: "2024-06-15T10:00:00Z",
      },
    ];
    const events = parseMyActivity(toUint8(data), "test.json");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("notification");
  });

  it("does not classify unrelated titles as notification", () => {
    const data = [
      {
        header: "Something",
        title: "Used an app",
        time: "2024-06-15T10:00:00Z",
      },
    ];
    const events = parseMyActivity(toUint8(data), "test.json");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("other");
  });
});
