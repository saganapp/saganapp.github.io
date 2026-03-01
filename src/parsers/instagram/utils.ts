import type { MetadataEvent, EventType } from "../types";

let counter = 0;

export function makeEventId(): string {
  return `ig-${Date.now()}-${++counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

export function makeInstagramEvent(
  eventType: EventType,
  timestamp: Date,
  actor: string,
  participants: string[],
  metadata: Record<string, unknown> = {},
): MetadataEvent {
  return {
    id: makeEventId(),
    source: "instagram",
    eventType,
    timestamp,
    actor,
    participants,
    metadata,
  };
}

/**
 * Map of localized month abbreviations to 0-based month index.
 * Covers: English, Spanish, French, German, Italian, Portuguese,
 * Dutch, Polish, Turkish, Russian.
 */
const MONTH_MAP: Record<string, number> = {
  // English
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  // Spanish
  ene: 0, abr: 3, ago: 7, dic: 11,
  // French
  janv: 0, févr: 1, fév: 1, avr: 3, mai: 4, juin: 5,
  juil: 6, juill: 6, août: 7, déc: 11,
  // German
  jän: 0, mär: 2, mrz: 2, mai_de: 4, okt: 9, dez: 11,
  // Italian
  gen: 0, mag: 4, giu: 5, lug: 6, set: 8, ott: 9,
  // Portuguese
  fev: 1, abr_pt: 3, out: 9,
  // Dutch
  mrt: 2, mei: 4, // jul, aug, sep, okt, nov, dec same
  // Polish
  sty: 0, lut: 1, kwi: 3, maj: 4, cze: 5, lip: 6,
  sie: 7, wrz: 8, paź: 9, paz: 9, lis: 10, gru: 11,
  // Turkish
  oca: 0, şub: 1, sub: 1, nis: 3, may_tr: 4, haz: 5,
  tem: 6, ağu: 7, agu: 7, eyl: 8, eki: 9, kas: 10, ara: 11,
  // Russian (transliterated)
  янв: 0, фев: 1, мар: 2, апр: 3, мая: 4, июн: 5,
  июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11,
};

/**
 * Parse Instagram's localized date strings.
 * Pattern: "{month}. {DD}, {YYYY} {H}:{MM} {am/pm}"
 * Examples: "abr. 14, 2023 9:27 am", "sept. 30, 2024 2:15 pm"
 */
export function parseInstagramDate(dateStr: string): Date | null {
  // Normalize: remove trailing dot from month, lowercase
  const normalized = dateStr.trim().toLowerCase();

  // Pattern: month. DD, YYYY H:MM am/pm
  const match = normalized.match(
    /^(\S+?)\.?\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/,
  );
  if (!match) return null;

  const [, monthStr, dayStr, yearStr, hourStr, minStr, ampm] = match;

  const monthIndex = MONTH_MAP[monthStr];
  if (monthIndex === undefined) return null;

  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);

  // Convert 12-hour to 24-hour
  if (ampm === "pm" && hour !== 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  const date = new Date(year, monthIndex, day, hour, minute);
  if (isNaN(date.getTime())) return null;

  return date;
}
