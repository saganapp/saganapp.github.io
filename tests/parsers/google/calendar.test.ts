import { describe, it, expect, beforeEach } from "vitest";
import { parseCalendar } from "@/parsers/google/calendar";
import { resetIdCounter } from "@/parsers/google/utils";

function toUint8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("parseCalendar", () => {
  beforeEach(() => resetIdCounter());

  it("parses a simple VEVENT with calendar_event type", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20240615T120000Z
SUMMARY:Team Meeting
ORGANIZER;CN=Boss:mailto:boss@example.com
ATTENDEE;CN=Alice:mailto:alice@example.com
ATTENDEE;CN=Bob:mailto:bob@example.com
END:VEVENT
END:VCALENDAR`;

    const events = parseCalendar(toUint8(ics), "Calendar/main.ics");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("calendar_event");
    expect(events[0].source).toBe("google");
    expect(events[0].actor).toBe("boss@example.com");
    expect(events[0].participants).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
    expect(events[0].metadata.calendarEvent).toBe("Team Meeting");
    expect(events[0].metadata.attendeeCount).toBe(2);
    expect(events[0].metadata.isRecurring).toBe(false);
    expect(events[0].timestamp).toEqual(new Date("2024-06-15T12:00:00Z"));
  });

  it("detects recurring events with RRULE", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20240101T090000Z
SUMMARY:Weekly Standup
RRULE:FREQ=WEEKLY;BYDAY=MO
END:VEVENT
END:VCALENDAR`;

    const events = parseCalendar(toUint8(ics), "cal.ics");
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("calendar_event");
    expect(events[0].metadata.isRecurring).toBe(true);
  });

  it("marks non-recurring events correctly", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20240301T140000Z
SUMMARY:One-off Meeting
END:VEVENT
END:VCALENDAR`;

    const events = parseCalendar(toUint8(ics), "cal.ics");
    expect(events).toHaveLength(1);
    expect(events[0].metadata.isRecurring).toBe(false);
  });

  it("parses multiple events", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20240101T090000Z
SUMMARY:Event A
END:VEVENT
BEGIN:VEVENT
DTSTART:20240202T140000Z
SUMMARY:Event B
END:VEVENT
END:VCALENDAR`;

    const events = parseCalendar(toUint8(ics), "Calendar/cal.ics");
    expect(events).toHaveLength(2);
    expect(events[0].metadata.calendarEvent).toBe("Event A");
    expect(events[1].metadata.calendarEvent).toBe("Event B");
    expect(events[0].eventType).toBe("calendar_event");
    expect(events[1].eventType).toBe("calendar_event");
  });

  it("handles DTSTART with timezone parameter", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20240315T100000
SUMMARY:Meeting
END:VEVENT
END:VCALENDAR`;

    const events = parseCalendar(toUint8(ics), "cal.ics");
    expect(events).toHaveLength(1);
    expect(events[0].timestamp.getFullYear()).toBe(2024);
    expect(events[0].timestamp.getMonth()).toBe(2); // March = 2
    expect(events[0].timestamp.getDate()).toBe(15);
  });

  it("handles date-only DTSTART", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240701
SUMMARY:All-day Event
END:VEVENT
END:VCALENDAR`;

    const events = parseCalendar(toUint8(ics), "cal.ics");
    expect(events).toHaveLength(1);
    expect(events[0].timestamp.getFullYear()).toBe(2024);
    expect(events[0].timestamp.getMonth()).toBe(6); // July = 6
  });

  it("handles folded lines", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20240615T120000Z
SUMMARY:Very Long Event Summary That
 Spans Multiple Lines
END:VEVENT
END:VCALENDAR`;

    const events = parseCalendar(toUint8(ics), "cal.ics");
    expect(events).toHaveLength(1);
    expect(events[0].metadata.calendarEvent).toBe(
      "Very Long Event Summary ThatSpans Multiple Lines",
    );
  });

  it("skips VEVENT without DTSTART", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:No Date
END:VEVENT
END:VCALENDAR`;

    const events = parseCalendar(toUint8(ics), "cal.ics");
    expect(events).toHaveLength(0);
  });

  it("excludes user's own email from attendees when userEmail is provided", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20240615T120000Z
SUMMARY:Team Sync
ORGANIZER;CN=Boss:mailto:boss@example.com
ATTENDEE;CN=Me:mailto:Me@MyDomain.com
ATTENDEE;CN=Alice:mailto:alice@example.com
END:VEVENT
END:VCALENDAR`;

    const events = parseCalendar(toUint8(ics), "Calendar/main.ics", "me@mydomain.com");
    expect(events).toHaveLength(1);
    expect(events[0].participants).toEqual(["alice@example.com"]);
    expect(events[0].metadata.attendeeCount).toBe(1);
  });

  it("defaults actor to 'me' when no organizer", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20240615T120000Z
SUMMARY:Solo Event
END:VEVENT
END:VCALENDAR`;

    const events = parseCalendar(toUint8(ics), "cal.ics");
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe("me");
  });
});
