import type { MetadataEvent } from "../types";
import { makeAppleEvent, parseCSV, parseAppleDate, parseAppleDeviceUA } from "./utils";

/**
 * Parse "Reviews.csv" from nested Appstore.zip.
 * Columns: Review Reference Number, Item Reference Number, Item Type,
 * Item Description, Provider Name, App Version, Review Title, Review Text,
 * Created on, Rating, Removed?, Language, IP Address, User Agent,
 * Pulled For Concern, Device Identifier
 */
export function parseReviews(csvText: string): MetadataEvent[] {
  const { rows, col } = parseCSV(csvText);
  const events: MetadataEvent[] = [];

  const iDate = col("Created on");
  const iDesc = col("Item Description");
  const iRating = col("Rating");
  const iTitle = col("Review Title");
  const iText = col("Review Text");
  const iIP = col("IP Address");
  const iUA = col("User Agent");

  for (const row of rows) {
    const ts = parseAppleDate(row[iDate]);
    if (!ts) continue;

    const metadata: Record<string, unknown> = {
      subSource: "Reviews",
    };

    const desc = iDesc >= 0 ? row[iDesc] : undefined;
    if (desc) metadata.appDescription = desc;

    const rating = iRating >= 0 ? row[iRating] : undefined;
    if (rating) metadata.rating = parseInt(rating, 10) || rating;

    const title = iTitle >= 0 ? row[iTitle] : undefined;
    if (title) metadata.reviewTitle = title;

    const text = iText >= 0 ? row[iText] : undefined;
    if (text) metadata.reviewText = text;

    const ip = iIP >= 0 ? row[iIP] : undefined;
    if (ip) metadata.ipAddr = ip;

    const ua = iUA >= 0 ? row[iUA] : undefined;
    if (ua) {
      const parsed = parseAppleDeviceUA(ua);
      if (parsed.device) metadata.device = parsed.device;
      if (parsed.os) metadata.osVersion = parsed.os;
    }

    events.push(makeAppleEvent("other", ts, metadata));
  }

  return events;
}
