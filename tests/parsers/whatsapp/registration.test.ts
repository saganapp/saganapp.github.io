import { describe, it, expect, beforeEach } from "vitest";
import { parseRegistration } from "@/parsers/whatsapp/registration";
import { resetIdCounter } from "@/parsers/whatsapp/utils";

describe("parseRegistration", () => {
  beforeEach(() => resetIdCounter());

  it("parses valid registration timestamp", () => {
    const data = { wa_registration_info: { registration_timestamp: 1735644306 } };
    const events = parseRegistration(data, "+34669727046");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("login");
    expect(events[0].source).toBe("whatsapp");
    expect(events[0].actor).toBe("+34669727046");
    expect(events[0].metadata.action).toBe("registration");
    expect(events[0].timestamp.getUTCFullYear()).toBe(2024);
  });

  it("returns empty for null input", () => {
    expect(parseRegistration(null, "+34669727046")).toEqual([]);
  });

  it("returns empty for missing timestamp", () => {
    expect(parseRegistration({ wa_registration_info: {} }, "+34669727046")).toEqual([]);
  });

  it("returns empty for zero timestamp", () => {
    expect(parseRegistration(
      { wa_registration_info: { registration_timestamp: 0 } }, "+34669727046",
    )).toEqual([]);
  });
});
