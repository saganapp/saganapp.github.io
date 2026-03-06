import type { MetadataEvent } from "../types";
import { makeInstagramEvent } from "./utils";

/** Localized label → metadata field mapping */
const LABEL_MAP: Record<string, "ip" | "userAgent" | "language"> = {
  // English
  "ip address": "ip",
  "user agent": "userAgent",
  "language code": "language",
  // Spanish
  "dirección ip": "ip",
  "agente de usuario": "userAgent",
  "código de idioma": "language",
};

/**
 * Parse login_activity.html → login events.
 *
 * Each login block has an <h2> with ISO timestamp, then a table where:
 *  - Most fields use colspan=2 _a6_q cells with nested <div><div>value</div></div>
 *  - The localized date uses a _a6_q label + _a6_r value pair
 */
export function parseLoginActivity(html: string): MetadataEvent[] {
  const events: MetadataEvent[] = [];

  // Split into blocks by uiBoxWhite container
  const blockRegex =
    /uiBoxWhite noborder">([\s\S]*?)(?=(?:<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">)|$)/g;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];

    // Extract ISO timestamp from <h2>
    const tsMatch = block.match(
      /<h2[^>]*>(\d{4}-\d{2}-\d{2}T[\d:.]+[+-][\d:]+)<\/h2>/,
    );
    if (!tsMatch) continue;

    const ts = new Date(tsMatch[1]);
    if (isNaN(ts.getTime())) continue;

    const meta: Record<string, string | undefined> = {
      ip: undefined,
      userAgent: undefined,
      language: undefined,
    };

    // Pattern 1: colspan=2 _a6_q cells with nested <div><div>value</div></div>
    // e.g., <td colspan="2" class="_2pin _a6_q">Label<div><div>value</div></div></td>
    // Use [^<]* for label to avoid crossing </td> boundaries (e.g. "Date and Time" row)
    const nestedRegex =
      /_a6_q">([^<]*)<div><div>([\s\S]*?)<\/div><\/div><\/td>/g;
    let m;
    while ((m = nestedRegex.exec(block)) !== null) {
      const label = m[1].replace(/<[^>]*>/g, "").trim().toLowerCase();
      const value = m[2].trim();
      const field = LABEL_MAP[label];
      if (field) meta[field] = value;
    }

    // Pattern 2: _a6_q label + _a6_r value pair (for localized date — we skip it)
    // We already have the ISO timestamp from <h2>, no need to extract the date cell

    events.push(
      makeInstagramEvent("login", ts, "me", [], {
        ip: meta.ip,
        userAgent: meta.userAgent,
        language: meta.language,
      }),
    );
  }

  return events;
}
