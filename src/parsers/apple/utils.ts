import type { MetadataEvent, EventType } from "../types";

let counter = 0;

export function makeEventId(): string {
  return `ap-${Date.now()}-${++counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

export function makeAppleEvent(
  eventType: EventType,
  timestamp: Date,
  metadata: Record<string, unknown> = {},
): MetadataEvent {
  return {
    id: makeEventId(),
    source: "apple",
    eventType,
    timestamp,
    actor: "You",
    participants: [],
    metadata,
  };
}

/**
 * RFC 4180 CSV line parser — handles quoted fields with embedded commas and newlines.
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

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
      } else if (ch === ",") {
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

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
  col: (name: string) => number;
}

/**
 * Parse a full CSV text into headers + rows with a column-index lookup helper.
 */
export function parseCSV(text: string): ParsedCSV {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], col: () => -1 };

  const headers = parseCSVLine(lines[0]);
  const headerIndex = new Map<string, number>();
  headers.forEach((h, i) => headerIndex.set(h, i));

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(parseCSVLine(lines[i]));
  }

  return {
    headers,
    rows,
    col: (name: string) => headerIndex.get(name) ?? -1,
  };
}

/**
 * Parse Apple Device Details / User Agent strings like:
 * "AppStore/3.0 iOS/16.6 model/iPad12,1 hwp/t8030 build/20G75 (5; dt:267) AMS/1"
 * Returns device model + OS version.
 */
export function parseAppleDeviceUA(raw: string): { device?: string; os?: string } {
  if (!raw) return {};
  const modelMatch = raw.match(/model\/([^\s]+)/);
  const osMatch = raw.match(/(iOS|macOS|iPadOS|watchOS)\/([^\s]+)/);
  return {
    device: modelMatch?.[1],
    os: osMatch ? `${osMatch[1]} ${osMatch[2]}` : undefined,
  };
}

/**
 * Parse an ISO 8601 date string, treating dates without 'Z' suffix as UTC.
 */
export function parseAppleDate(str: string): Date | null {
  if (!str) return null;
  // If it has no timezone info, treat as UTC
  const normalized = str.endsWith("Z") || str.includes("+") || str.includes("-", 10)
    ? str
    : str + "Z";
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}
