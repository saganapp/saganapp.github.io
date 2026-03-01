import { describe, it, expect, beforeEach } from "vitest";
import { resetIdCounter } from "@/parsers/garmin/utils";
import { parseGarminEvents } from "@/parsers/garmin/events";

describe("parseGarminEvents", () => {
  beforeEach(() => resetIdCounter());

  it("maps CONNECT_HYDRATION to wellness_log", () => {
    const events = parseGarminEvents([
      {
        eventType: "CONNECT_HYDRATION",
        eventDateTime: "2025-01-01T10:00:00Z",
        platformId: "GARMIN_CONNECT",
        sourceSystem: "CONNECT_WEB",
        locationCountry: "ES",
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("wellness_log");
    expect(events[0].source).toBe("garmin");
    expect(events[0].metadata.garminEventType).toBe("CONNECT_HYDRATION");
    expect(events[0].metadata.country).toBe("ES");
  });

  it("maps CONNECT_CONVERSATION_COMMENT to message_sent", () => {
    const events = parseGarminEvents([
      {
        eventType: "CONNECT_CONVERSATION_COMMENT",
        eventDateTime: "2022-03-21T20:15:27Z",
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("message_sent");
  });

  it("maps CONNECT_CONVERSATION_LIKE to reaction", () => {
    const events = parseGarminEvents([
      {
        eventType: "CONNECT_CONVERSATION_LIKE",
        eventDateTime: "2022-01-13T13:48:44Z",
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("reaction");
  });

  it("maps IT_SSO_LOGIN to login", () => {
    const events = parseGarminEvents([
      {
        eventType: "IT_SSO_LOGIN",
        eventDateTime: "2025-05-01T08:00:00Z",
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("login");
  });

  it("maps CONNECT_GEAR to profile_update", () => {
    const events = parseGarminEvents([
      {
        eventType: "CONNECT_GEAR",
        eventDateTime: "2021-03-04T00:00:00Z",
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("profile_update");
  });

  it("maps CONNECT_PROFILE_BIRTHDATE to profile_update", () => {
    const events = parseGarminEvents([
      {
        eventType: "CONNECT_PROFILE_BIRTHDATE",
        eventDateTime: "2021-01-06T10:00:00Z",
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("profile_update");
  });

  it("skips CONNECT_USER_PREFERENCE events", () => {
    const events = parseGarminEvents([
      {
        eventType: "CONNECT_USER_PREFERENCE",
        eventDateTime: "2025-01-01T00:00:00Z",
      },
    ]);
    expect(events).toHaveLength(0);
  });

  it("skips CONNECT_DEVICE_SETTINGS_* events", () => {
    const events = parseGarminEvents([
      {
        eventType: "CONNECT_DEVICE_SETTINGS_PULSE_OX_SLEEP_TRACKING_ALERT",
        eventDateTime: "2025-01-01T00:00:00Z",
      },
    ]);
    expect(events).toHaveLength(0);
  });

  it("skips IT_SSO_ACCOUNT_CREATION", () => {
    const events = parseGarminEvents([
      {
        eventType: "IT_SSO_ACCOUNT_CREATION",
        eventDateTime: "2020-12-24T23:26:04Z",
      },
    ]);
    expect(events).toHaveLength(0);
  });

  it("skips entries without eventDateTime", () => {
    const events = parseGarminEvents([
      {
        eventType: "CONNECT_HYDRATION",
      },
    ]);
    expect(events).toHaveLength(0);
  });

  it("handles null/undefined input", () => {
    expect(parseGarminEvents(null)).toEqual([]);
    expect(parseGarminEvents(undefined)).toEqual([]);
  });

  it("preserves metadata", () => {
    const events = parseGarminEvents([
      {
        eventType: "CONNECT_HYDRATION",
        eventDateTime: "2025-01-01T10:00:00Z",
        platformId: "GARMIN_CONNECT",
        sourceSystem: "CONNECT_WEB_SERVER_SIDE",
        locationCountry: "US",
        eventData: { EVENT_ACTION: "CREATED" },
      },
    ]);
    expect(events[0].metadata.platform).toBe("GARMIN_CONNECT");
    expect(events[0].metadata.device).toBe("CONNECT_WEB_SERVER_SIDE");
    expect(events[0].metadata.action).toBe("CREATED");
  });
});
