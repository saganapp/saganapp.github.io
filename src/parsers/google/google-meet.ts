import type { MetadataEvent } from "../types";
import { makeEvent, decodeUtf8 } from "./utils";

/**
 * Parse Google Meet conference_history_records.csv → call_started events.
 *
 * CSV columns: Conference ID, Start Time, End Time, Duration,
 * Call Direction, Call Counterparts, Meeting Media Type, etc.
 */
export function parseGoogleMeet(data: Uint8Array): MetadataEvent[] {
  const text = decodeUtf8(data);
  const lines = text.split("\n");
  if (lines.length < 2) return [];

  // Parse header to find column indices
  const header = parseCSVLine(lines[0]);
  const colIdx = {
    startTime: header.indexOf("Start Time"),
    endTime: header.indexOf("End Time"),
    duration: header.indexOf("Duration"),
    direction: header.indexOf("Call Direction"),
    counterparts: header.indexOf("Call Counterparts"),
    mediaType: header.indexOf("Meeting Media Type"),
    meetingCode: header.indexOf("Meeting Code"),
  };

  if (colIdx.startTime === -1) return [];

  const events: MetadataEvent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const startTimeStr = cols[colIdx.startTime];
    if (!startTimeStr) continue;

    const ts = new Date(startTimeStr);
    if (isNaN(ts.getTime())) continue;

    // Parse counterparts — may be in [email1,email2] format
    let counterparts: string[] = [];
    if (colIdx.counterparts !== -1) {
      const raw = cols[colIdx.counterparts] ?? "";
      const cleaned = raw.replace(/^\[|\]$/g, "");
      if (cleaned) {
        counterparts = cleaned.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    events.push(
      makeEvent("call_started", ts, "me", counterparts, {
        subSource: "Google Meet",
        direction: colIdx.direction !== -1 ? cols[colIdx.direction] : undefined,
        duration: colIdx.duration !== -1 ? cols[colIdx.duration] : undefined,
        meetingCode: colIdx.meetingCode !== -1 ? cols[colIdx.meetingCode] : undefined,
        mediaType: colIdx.mediaType !== -1 ? cols[colIdx.mediaType] : undefined,
        counterparts: counterparts.length > 0 ? counterparts : undefined,
      }),
    );
  }

  return events;
}

/**
 * Simple CSV line parser that handles quoted fields and bracket groups.
 * Brackets [..] are treated as grouping (for counterpart lists like [a@b.com,c@d.com]).
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let bracketDepth = 0;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === "[") {
        bracketDepth++;
        current += ch;
      } else if (ch === "]") {
        bracketDepth = Math.max(0, bracketDepth - 1);
        current += ch;
      } else if (ch === "," && bracketDepth === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }

  result.push(current.trim());
  return result;
}
