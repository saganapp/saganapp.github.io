import { describe, it, expect, beforeEach } from "vitest";
import { parseReservation } from "@/parsers/google/purchases";
import { resetIdCounter } from "@/parsers/google/utils";

function toUint8(json: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(json));
}

describe("parseReservation", () => {
  beforeEach(() => resetIdCounter());

  it("parses a reservation into an 'other' event", () => {
    const data = {
      booking: {
        name: "Dinner Reservation",
        merchantName: "Fancy Restaurant",
        startTime: "2024-06-15T19:00:00Z",
        endTime: "2024-06-15T21:00:00Z",
        partySize: 4,
        address: "123 Main St",
        canceled: false,
      },
    };

    const events = parseReservation(toUint8(data));
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("google");
    expect(events[0].eventType).toBe("other");
    expect(events[0].metadata.subSource).toBe("Google Reservations");
    expect(events[0].metadata.merchantName).toBe("Fancy Restaurant");
    expect(events[0].metadata.service).toBe("Dinner Reservation");
    expect(events[0].metadata.partySize).toBe(4);
    expect(events[0].metadata.canceled).toBe(false);
  });

  it("handles canceled reservations", () => {
    const data = {
      booking: {
        name: "Canceled Dinner",
        merchantName: "Restaurant",
        startTime: "2024-06-15T19:00:00Z",
        canceled: true,
      },
    };

    const events = parseReservation(toUint8(data));
    expect(events).toHaveLength(1);
    expect(events[0].metadata.canceled).toBe(true);
  });

  it("returns empty for missing booking", () => {
    const events = parseReservation(toUint8({}));
    expect(events).toHaveLength(0);
  });

  it("returns empty for missing startTime", () => {
    const data = { booking: { name: "No Time" } };
    const events = parseReservation(toUint8(data));
    expect(events).toHaveLength(0);
  });

  it("returns empty for invalid JSON", () => {
    const events = parseReservation(new TextEncoder().encode("not json"));
    expect(events).toHaveLength(0);
  });
});
