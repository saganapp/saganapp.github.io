import { describe, it, expect, beforeEach } from "vitest";
import {
  parseEmailChanges,
  parseScreenNameChanges,
  parseConnectedApps,
} from "@/parsers/twitter/profile-changes";
import { resetIdCounter } from "@/parsers/twitter/utils";

function toTwitterJs(varName: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `window.YTD.${varName}.part0 = ${JSON.stringify(data)}`,
  );
}

describe("parseEmailChanges", () => {
  beforeEach(() => resetIdCounter());

  it("parses email change events", () => {
    const data = toTwitterJs("email_address_change", [
      {
        emailChange: {
          changedAt: "2024-03-15T12:00:00.000Z",
          changedFrom: "old@example.com",
          changedTo: "new@example.com",
        },
      },
    ]);

    const events = parseEmailChanges(data);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("twitter");
    expect(events[0].eventType).toBe("profile_update");
    expect(events[0].metadata.changeType).toBe("email");
    expect(events[0].metadata.from).toBe("old@example.com");
    expect(events[0].metadata.to).toBe("new@example.com");
  });

  it("skips entries without changedAt", () => {
    const data = toTwitterJs("email_address_change", [
      { emailChange: { changedFrom: "old@example.com" } },
    ]);
    const events = parseEmailChanges(data);
    expect(events).toHaveLength(0);
  });
});

describe("parseScreenNameChanges", () => {
  beforeEach(() => resetIdCounter());

  it("parses screen name change events", () => {
    const data = toTwitterJs("screen_name_change", [
      {
        screenNameChange: {
          changedAt: "2024-01-01T00:00:00.000Z",
          changedFrom: "oldhandle",
          changedTo: "newhandle",
        },
      },
    ]);

    const events = parseScreenNameChanges(data);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("profile_update");
    expect(events[0].metadata.changeType).toBe("screen_name");
    expect(events[0].metadata.from).toBe("oldhandle");
    expect(events[0].metadata.to).toBe("newhandle");
  });

  it("returns empty array for empty data", () => {
    const data = toTwitterJs("screen_name_change", []);
    const events = parseScreenNameChanges(data);
    expect(events).toHaveLength(0);
  });
});

describe("parseConnectedApps", () => {
  beforeEach(() => resetIdCounter());

  it("parses connected application events", () => {
    const data = toTwitterJs("connected_application", [
      {
        connectedApplication: {
          name: "TweetDeck",
          permissions: ["read", "write"],
          approvedAt: "2023-06-15T09:00:00.000Z",
          id: "123",
        },
      },
    ]);

    const events = parseConnectedApps(data);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("profile_update");
    expect(events[0].metadata.changeType).toBe("app_authorization");
    expect(events[0].metadata.appName).toBe("TweetDeck");
    expect(events[0].metadata.permissions).toEqual(["read", "write"]);
  });

  it("skips entries without approvedAt", () => {
    const data = toTwitterJs("connected_application", [
      { connectedApplication: { name: "SomeApp" } },
    ]);
    const events = parseConnectedApps(data);
    expect(events).toHaveLength(0);
  });
});
