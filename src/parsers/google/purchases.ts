import type { MetadataEvent } from "../types";
import { makeEvent, decodeUtf8 } from "./utils";

interface ReservationData {
  booking?: {
    name?: string;
    merchantName?: string;
    startTime?: string;
    endTime?: string;
    partySize?: number;
    address?: string;
    canceled?: boolean;
  };
}

/**
 * Parse Google Purchases & Reservations JSON files → other events.
 * Each file (action_*.json) contains a booking/reservation entry.
 */
export function parseReservation(data: Uint8Array): MetadataEvent[] {
  const text = decodeUtf8(data);
  let parsed: ReservationData;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  const booking = parsed.booking;
  if (!booking?.startTime) return [];

  const ts = new Date(booking.startTime);
  if (isNaN(ts.getTime())) return [];

  return [
    makeEvent("other", ts, "me", [], {
      subSource: "Google Reservations",
      merchantName: booking.merchantName,
      service: booking.name,
      partySize: booking.partySize,
      canceled: booking.canceled,
    }),
  ];
}
