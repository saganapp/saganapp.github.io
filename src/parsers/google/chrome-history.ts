import type { MetadataEvent, EventType } from "../types";
import { makeEvent, parseTimestamp, decodeUtf8 } from "./utils";

interface BrowserHistoryItem {
  page_transition?: string;
  page_transition_qualifier?: string;
  title?: string;
  url?: string;
  client_id?: string;
  time_usec?: number;
  favicon_url?: string;
}

interface BrowserHistoryExport {
  "Browser History"?: BrowserHistoryItem[];
}

const SEARCH_DOMAINS = new Set([
  "www.google.com",
  "google.com",
  "www.bing.com",
  "bing.com",
  "duckduckgo.com",
  "www.duckduckgo.com",
  "search.yahoo.com",
]);

function classifyUrl(url: string | undefined): EventType {
  if (!url) return "browsing";
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (SEARCH_DOMAINS.has(hostname)) {
      // Only classify as search if URL has a search query
      if (parsed.searchParams.has("q") || parsed.pathname.includes("/search")) {
        return "search";
      }
    }
  } catch {
    // invalid URL
  }
  return "browsing";
}

export function parseChromeHistory(
  data: Uint8Array,
): MetadataEvent[] {
  const json = decodeUtf8(data);
  let historyData: BrowserHistoryExport;
  try {
    historyData = JSON.parse(json);
  } catch {
    return [];
  }

  const items = historyData["Browser History"];
  if (!Array.isArray(items)) return [];

  const events: MetadataEvent[] = [];

  for (const item of items) {
    if (!item.time_usec) continue;
    const ts = parseTimestamp(item.time_usec);
    if (!ts) continue;

    // Extract domain from URL for metadata (no full URL stored)
    let domain = "";
    if (item.url) {
      try {
        domain = new URL(item.url).hostname;
      } catch {
        // invalid URL, skip domain
      }
    }

    const eventType = classifyUrl(item.url);

    events.push(
      makeEvent(eventType, ts, "me", [], {
        subSource: "Chrome/BrowserHistory",
        domain,
        transition: item.page_transition ?? item.page_transition_qualifier ?? "unknown",
      }),
    );
  }

  return events;
}
