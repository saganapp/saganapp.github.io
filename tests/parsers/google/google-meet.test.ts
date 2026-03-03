import { describe, it, expect, beforeEach } from "vitest";
import { parseGoogleMeet } from "@/parsers/google/google-meet";
import { resetIdCounter } from "@/parsers/google/utils";

function toUint8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("parseGoogleMeet", () => {
  beforeEach(() => resetIdCounter());

  it("parses a conference history CSV", () => {
    const csv = [
      "Conference ID,Start Time,End Time,Duration,Call Direction,Call Counterparts,Meeting Media Type,Meeting Code",
      "conf-1,2024-06-15T10:00:00Z,2024-06-15T10:30:00Z,30 minutes,Outgoing,[alice@example.com],Video,abc-defg-hij",
    ].join("\n");

    const events = parseGoogleMeet(toUint8(csv));
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("google");
    expect(events[0].eventType).toBe("call_started");
    expect(events[0].participants).toEqual(["alice@example.com"]);
    expect(events[0].metadata.subSource).toBe("Google Meet");
    expect(events[0].metadata.direction).toBe("Outgoing");
    expect(events[0].metadata.duration).toBe("30 minutes");
    expect(events[0].metadata.meetingCode).toBe("abc-defg-hij");
  });

  it("parses multiple counterparts", () => {
    const csv = [
      "Conference ID,Start Time,End Time,Duration,Call Direction,Call Counterparts,Meeting Media Type",
      "conf-2,2024-06-16T14:00:00Z,2024-06-16T15:00:00Z,1 hour,Incoming,[bob@example.com,carol@example.com],Audio",
    ].join("\n");

    const events = parseGoogleMeet(toUint8(csv));
    expect(events).toHaveLength(1);
    expect(events[0].participants).toEqual(["bob@example.com", "carol@example.com"]);
  });

  it("handles empty counterparts", () => {
    const csv = [
      "Conference ID,Start Time,End Time,Duration,Call Direction,Call Counterparts,Meeting Media Type",
      "conf-3,2024-06-17T09:00:00Z,2024-06-17T09:15:00Z,15 minutes,Outgoing,[],Video",
    ].join("\n");

    const events = parseGoogleMeet(toUint8(csv));
    expect(events).toHaveLength(1);
    expect(events[0].participants).toEqual([]);
  });

  it("returns empty for header-only CSV", () => {
    const csv = "Conference ID,Start Time,End Time\n";
    const events = parseGoogleMeet(toUint8(csv));
    expect(events).toHaveLength(0);
  });

  it("returns empty for empty input", () => {
    const events = parseGoogleMeet(toUint8(""));
    expect(events).toHaveLength(0);
  });

  it("skips rows with invalid dates", () => {
    const csv = [
      "Conference ID,Start Time",
      "conf-4,not-a-date",
    ].join("\n");

    const events = parseGoogleMeet(toUint8(csv));
    expect(events).toHaveLength(0);
  });
});
