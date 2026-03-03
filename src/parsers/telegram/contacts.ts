import type { MetadataEvent } from "../types";
import { makeTelegramEvent } from "./utils";

export interface TelegramContact {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  date?: string;
  date_unixtime?: string;
}

/**
 * Parse Telegram contacts list → contact_added events.
 * Each contact has a name, phone number, and a unix timestamp.
 */
export function parseTelegramContacts(
  contacts: TelegramContact[] | null | undefined,
): MetadataEvent[] {
  if (!contacts || !Array.isArray(contacts)) return [];

  const events: MetadataEvent[] = [];

  for (const contact of contacts) {
    const unixTime = contact.date_unixtime;
    if (!unixTime) continue;

    const ts = new Date(parseInt(unixTime, 10) * 1000);
    if (isNaN(ts.getTime())) continue;

    const name = [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ") || "Unknown";

    events.push(
      makeTelegramEvent("contact_added", ts, "me", [name], {
        name,
        phone: contact.phone_number,
      }),
    );
  }

  return events;
}
