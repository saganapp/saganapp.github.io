import { describe, it, expect, beforeEach } from "vitest";
import { parseTelegramContacts } from "@/parsers/telegram/contacts";
import { resetIdCounter } from "@/parsers/telegram/utils";

describe("parseTelegramContacts", () => {
  beforeEach(() => resetIdCounter());

  it("parses contacts with timestamps", () => {
    const contacts = [
      {
        first_name: "John",
        last_name: "Doe",
        phone_number: "+1234567890",
        date: "2023-06-15T10:30:00",
        date_unixtime: "1686825000",
      },
    ];

    const events = parseTelegramContacts(contacts);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("telegram");
    expect(events[0].eventType).toBe("contact_added");
    expect(events[0].participants).toEqual(["John Doe"]);
    expect(events[0].metadata.name).toBe("John Doe");
    expect(events[0].metadata.phone).toBe("+1234567890");
  });

  it("parses contacts with first name only", () => {
    const contacts = [
      {
        first_name: "Alice",
        phone_number: "+9876543210",
        date_unixtime: "1686825000",
      },
    ];

    const events = parseTelegramContacts(contacts);
    expect(events).toHaveLength(1);
    expect(events[0].participants).toEqual(["Alice"]);
  });

  it("uses 'Unknown' for contacts with no name", () => {
    const contacts = [
      {
        phone_number: "+111",
        date_unixtime: "1686825000",
      },
    ];

    const events = parseTelegramContacts(contacts);
    expect(events).toHaveLength(1);
    expect(events[0].participants).toEqual(["Unknown"]);
  });

  it("skips contacts without date_unixtime", () => {
    const contacts = [
      { first_name: "NoDate", phone_number: "+111" },
    ];
    const events = parseTelegramContacts(contacts);
    expect(events).toHaveLength(0);
  });

  it("parses multiple contacts", () => {
    const contacts = [
      { first_name: "A", date_unixtime: "1686825000" },
      { first_name: "B", date_unixtime: "1686826000" },
      { first_name: "C", date_unixtime: "1686827000" },
    ];
    const events = parseTelegramContacts(contacts);
    expect(events).toHaveLength(3);
  });

  it("returns empty array for null input", () => {
    expect(parseTelegramContacts(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(parseTelegramContacts(undefined)).toEqual([]);
  });
});
