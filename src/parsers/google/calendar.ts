import type { MetadataEvent } from "../types";
import { makeEvent, decodeUtf8 } from "./utils";

/**
 * Minimal ICS VEVENT parser — extracts metadata only.
 * Handles folded lines (continuation with leading whitespace).
 */
export function parseCalendar(
  data: Uint8Array,
  filename: string,
  userEmail?: string,
): MetadataEvent[] {
  const text = decodeUtf8(data);

  // Unfold: lines starting with space/tab are continuations
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const events: MetadataEvent[] = [];
  let inEvent = false;
  let dtstart: string | null = null;
  let summary: string | null = null;
  let organizer: string | null = null;
  let attendees: string[] = [];
  let isRecurring = false;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      dtstart = null;
      summary = null;
      organizer = null;
      attendees = [];
      isRecurring = false;
      continue;
    }

    if (line === "END:VEVENT") {
      if (inEvent && dtstart) {
        const ts = parseIcsDate(dtstart);
        if (ts) {
          events.push(
            makeEvent("calendar_event", ts, organizer ?? "me", attendees, {
              subSource: filename,
              calendarEvent: summary ?? "Untitled",
              attendeeCount: attendees.length,
              isRecurring,
            }),
          );
        }
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    if (line.startsWith("DTSTART")) {
      dtstart = extractIcsValue(line);
    } else if (line.startsWith("SUMMARY")) {
      summary = extractIcsValue(line);
    } else if (line.startsWith("ORGANIZER")) {
      organizer = extractMailto(line) ?? extractIcsValue(line);
    } else if (line.startsWith("ATTENDEE")) {
      const email = extractMailto(line);
      if (email && !(userEmail && email.toLowerCase() === userEmail.toLowerCase())) attendees.push(email);
    } else if (line.startsWith("RRULE")) {
      isRecurring = true;
    }
  }

  return events;
}

function extractIcsValue(line: string): string {
  // Properties can have params: DTSTART;TZID=America/New_York:20230101T120000
  const colonIdx = line.indexOf(":");
  return colonIdx >= 0 ? line.slice(colonIdx + 1) : line;
}

function extractMailto(line: string): string | null {
  const match = line.match(/mailto:([^\s;]+)/i);
  return match ? match[1] : null;
}

function parseIcsDate(value: string): Date | null {
  // Formats: 20230615T120000Z, 20230615T120000, 20230615
  const clean = value.trim();

  if (clean.length >= 15) {
    // 20230615T120000 or 20230615T120000Z
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    const h = parseInt(clean.slice(9, 11));
    const min = parseInt(clean.slice(11, 13));
    const s = parseInt(clean.slice(13, 15));

    if (clean.endsWith("Z")) {
      return new Date(Date.UTC(y, m, d, h, min, s));
    }
    return new Date(y, m, d, h, min, s);
  }

  if (clean.length >= 8) {
    // 20230615
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    return new Date(y, m, d);
  }

  return null;
}
