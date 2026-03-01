import type { MetadataEvent, EventType } from "../types";

let counter = 0;

export function makeEventId(): string {
  return `tw-${Date.now()}-${++counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

/**
 * Strip the `window.YTD.<type>.part<N> = ` prefix from Twitter data JS files
 * to extract the raw JSON array.
 */
export function stripJsPrefix(raw: string): string {
  const idx = raw.indexOf("= ");
  if (idx === -1) return raw;
  return raw.slice(idx + 2);
}

/**
 * Parse a Twitter JS data file: strip prefix, then JSON.parse.
 * Falls back to chunked parsing if JSON.parse overflows the stack
 * (common with large Twitter archive files like ad-engagements.js).
 */
export function parseTwitterJs<T = unknown>(data: Uint8Array): T[] {
  const text = new TextDecoder().decode(data);
  const json = stripJsPrefix(text);
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed as T[];
  } catch (e) {
    if (e instanceof RangeError) {
      return parseJsonArrayChunked<T>(json);
    }
    throw e;
  }
}

/**
 * Parse a JSON array string by finding top-level element boundaries and
 * parsing each element individually. This avoids blowing the V8 stack on
 * very large / deeply nested arrays where a single JSON.parse would fail.
 */
export function parseJsonArrayChunked<T = unknown>(json: string): T[] {
  // Find the opening bracket
  let pos = 0;
  while (pos < json.length && json[pos] !== "[") pos++;
  if (pos >= json.length) return [];
  pos++; // skip '['

  const results: T[] = [];

  while (pos < json.length) {
    // Skip whitespace and commas between elements
    while (pos < json.length && " \t\n\r,".includes(json[pos])) pos++;

    // Check for end of array
    if (pos >= json.length || json[pos] === "]") break;

    // Find the end of this element by tracking depth
    const start = pos;
    let depth = 0;
    let inString = false;
    let escaped = false;

    while (pos < json.length) {
      const ch = json[pos];

      if (escaped) {
        escaped = false;
        pos++;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        pos++;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        pos++;
        continue;
      }

      if (inString) {
        pos++;
        continue;
      }

      if (ch === "{" || ch === "[") {
        depth++;
      } else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) {
          pos++; // include the closing brace/bracket
          break;
        }
      }

      pos++;
    }

    const element = json.slice(start, pos);
    if (element.trim().length > 0) {
      results.push(JSON.parse(element) as T);
    }
  }

  return results;
}

/**
 * Decode a Twitter snowflake ID to a timestamp in milliseconds.
 * Twitter epoch: 1288834974657 (Nov 4, 2010).
 */
export function snowflakeToTimestamp(snowflakeId: string): Date {
  const ms = Number(BigInt(snowflakeId) >> 22n) + 1288834974657;
  return new Date(ms);
}

/**
 * Extract device name from a Twitter source HTML string.
 * e.g. `<a href="...">Twitter for Android</a>` → "Twitter for Android"
 */
export function extractDevice(sourceHtml: string): string {
  const match = sourceHtml.match(/>([^<]+)</);
  return match ? match[1] : sourceHtml;
}

export function makeTwitterEvent(
  eventType: EventType,
  timestamp: Date,
  actor: string,
  participants: string[],
  metadata: Record<string, unknown> = {},
): MetadataEvent {
  return {
    id: makeEventId(),
    source: "twitter",
    eventType,
    timestamp,
    actor,
    participants,
    metadata,
  };
}
