import type { MetadataEvent, EventType } from "../types";
import { makeEvent, parseTimestamp, decodeUtf8 } from "./utils";

interface MyActivityItem {
  header?: string;
  title?: string;
  titleUrl?: string;
  time?: string;
  products?: string[];
  activityControls?: string[];
}

function classifyActivity(item: MyActivityItem): { eventType: EventType; subSource?: string } {
  const header = (item.header ?? "").toLowerCase();
  const title = (item.title ?? "").toLowerCase();
  const products = (item.products ?? []).map((p) => p.toLowerCase());

  // Check specific products/headers FIRST (before generic "search" check)
  // Chrome/browsing → "browsing" not "search"
  if (products.includes("chrome") || header.includes("chrome")) return { eventType: "browsing", subSource: "Chrome" };

  // YouTube → "other" with subSource
  if (products.includes("youtube") || header.includes("youtube")) return { eventType: "other", subSource: "YouTube" };

  // Maps → "location"
  if (products.includes("maps") || header.includes("maps")) return { eventType: "location", subSource: "Maps" };

  // Generic search (Google Search header or "searched for" title)
  if (header.includes("search") || title.startsWith("searched for")) return { eventType: "search" };

  if (header.includes("ads") || header.includes("ad services")) return { eventType: "ad_interaction" };
  if (
    header.includes("login") ||
    header.includes("sign-in") ||
    title.includes("signed in")
  )
    return { eventType: "login" };

  if (title.startsWith("received a notification")) return { eventType: "notification" };

  return { eventType: "other" };
}

export function parseMyActivity(
  data: Uint8Array,
  filename: string,
): MetadataEvent[] {
  const text = decodeUtf8(data);

  // Detect HTML vs JSON format
  if (text.trimStart().startsWith("<") || text.trimStart().startsWith("<!")) {
    return parseMyActivityHtml(text, filename);
  }

  let items: MyActivityItem[];
  try {
    items = JSON.parse(text);
  } catch {
    return [];
  }

  if (!Array.isArray(items)) return [];

  return itemsToEvents(items, filename);
}

function itemsToEvents(items: MyActivityItem[], filename: string): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  for (const item of items) {
    if (!item.time) continue;
    const ts = parseTimestamp(item.time);
    if (!ts) continue;

    const { eventType, subSource } = classifyActivity(item);
    const metadata: Record<string, unknown> = {
      subSource: subSource ?? filename,
    };
    if (item.header) metadata.header = item.header;
    if (item.title) metadata.title = item.title;
    if (item.products) metadata.products = item.products;

    events.push(makeEvent(eventType, ts, "me", [], metadata));
  }

  return events;
}

/**
 * Parse Google Takeout "My Activity" HTML export format.
 * Each entry is a div.outer-cell containing:
 *   - header-cell > p.mdl-typography--title → header (e.g., "Search")
 *   - content-cell.mdl-typography--body-1   → title text + timestamp
 *   - content-cell.mdl-typography--caption  → Products list
 *
 * Timestamp format: "Feb 25, 2026, 10:39:22 PM CET"
 */

// Strip HTML tags, decode entities
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&emsp;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Date pattern: "Mon DD, YYYY, HH:MM:SS AM/PM TZ" — Google's HTML format
// TZ may be a timezone abbreviation (CET, PST, etc.) that JS Date can't parse
const DATE_RE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)(?:\s+\S+)?/i;

// Strip trailing timezone abbreviation (e.g., "CET", "PST") that Date can't parse
function stripTimezoneAbbr(dateStr: string): string {
  return dateStr.replace(/\s+(?:[A-Z]{2,5}|UTC[+-]\d{1,2})$/i, "").trim();
}

function parseMyActivityHtml(html: string, filename: string): MetadataEvent[] {
  // Split into outer-cell blocks
  const blocks = html.split(/class="outer-cell[^"]*"/);
  if (blocks.length < 2) return [];

  const items: MyActivityItem[] = [];

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Extract header from mdl-typography--title
    const headerMatch = block.match(/mdl-typography--title[^>]*>(.*?)<\/p>/s);
    const header = headerMatch ? stripHtml(headerMatch[1]).trim() : undefined;

    // Extract body content from first content-cell with mdl-typography--body-1
    const bodyMatch = block.match(/content-cell[^"]*mdl-typography--body-1">(.*?)<\/div>/s);
    if (!bodyMatch) continue;

    const bodyHtml = bodyMatch[1];
    const bodyText = stripHtml(bodyHtml).trim();

    // Extract timestamp (strip TZ abbreviation JS Date can't parse, e.g., "CET")
    const dateMatch = bodyText.match(DATE_RE);
    if (!dateMatch) continue;
    const time = stripTimezoneAbbr(dateMatch[0]);

    // Title is everything before the date line
    const titleLines = bodyText.split("\n").filter((l) => l.trim() && !DATE_RE.test(l));
    const title = titleLines.join(" ").trim() || undefined;

    // Extract products from caption cell
    const captionMatch = block.match(/mdl-typography--caption">(.*?)<\/div>/s);
    let products: string[] | undefined;
    if (captionMatch) {
      const captionText = stripHtml(captionMatch[1]);
      const prodMatch = captionText.match(/Products?:\s*(.*?)(?:Why is this|$)/si);
      if (prodMatch) {
        products = prodMatch[1]
          .split(/\n/)
          .map((p) => p.trim())
          .filter(Boolean);
      }
    }

    items.push({ header, title, time, products });
  }

  return itemsToEvents(items, filename);
}
