import type { MetadataEvent } from "../types";
import { makeAppleEvent, parseCSV, parseAppleDate, parseAppleDeviceUA } from "./utils";

/**
 * Parse "Store Re-download and Update History.csv" from Apple GDPR export.
 * Columns: Activity Date, Content Type, Item Reference Number, Item Description,
 * Version Text, Seller, Device Details, Device IP Address, Device Identifier
 */
export function parseRedownloads(csvText: string): MetadataEvent[] {
  const { rows, col } = parseCSV(csvText);
  const events: MetadataEvent[] = [];

  const iDate = col("Activity Date");
  const iContentType = col("Content Type");
  const iDesc = col("Item Description");
  const iVersion = col("Version Text");
  const iSeller = col("Seller");
  const iDevice = col("Device Details");
  const iIP = col("Device IP Address");

  for (const row of rows) {
    const ts = parseAppleDate(row[iDate]);
    if (!ts) continue;

    const metadata: Record<string, unknown> = {
      subSource: "Re-downloads",
    };

    // "Content Type" actually contains the app name (e.g. "Asphalt 8: Airborne")
    const appName = iContentType >= 0 ? row[iContentType] : undefined;
    if (appName) metadata.appName = appName;

    // "Item Description" contains the category (e.g. "Mac Apps", "iOS and tvOS Apps")
    const desc = iDesc >= 0 ? row[iDesc] : undefined;
    if (desc) metadata.contentType = desc;

    const version = iVersion >= 0 ? row[iVersion] : undefined;
    if (version) metadata.version = version;

    const seller = iSeller >= 0 ? row[iSeller] : undefined;
    if (seller) metadata.seller = seller;

    const deviceRaw = iDevice >= 0 ? row[iDevice] : undefined;
    if (deviceRaw) {
      const ua = parseAppleDeviceUA(deviceRaw);
      if (ua.device) metadata.device = ua.device;
      if (ua.os) metadata.osVersion = ua.os;
    }

    const ip = iIP >= 0 ? row[iIP] : undefined;
    if (ip) metadata.ipAddr = ip;

    events.push(makeAppleEvent("other", ts, metadata));
  }

  return events;
}
