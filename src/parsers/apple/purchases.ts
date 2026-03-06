import type { MetadataEvent } from "../types";
import { makeAppleEvent, parseCSV, parseAppleDate, parseAppleDeviceUA } from "./utils";

/**
 * Parse "Store Transaction Purchase and Free Apps History.csv" from nested Appstore.zip.
 * Columns include: Item Purchased Date, Item Description, Content Type,
 * Device Details, Device IP Address, Invoice Item Total, Currency, Payment Type,
 * iCloud Family Purchase?, Free product Code Redemption?, etc.
 */
export function parsePurchases(csvText: string): MetadataEvent[] {
  const { rows, col } = parseCSV(csvText);
  const events: MetadataEvent[] = [];

  const iDate = col("Item Purchased Date");
  const iDesc = col("Item Description");
  const iContentType = col("Content Type");
  const iDevice = col("Device Details");
  const iIP = col("Device IP Address");
  const iPrice = col("Invoice Item Total");
  const iCurrency = col("Currency");
  const iPayment = col("Payment Type");
  const iFamily = col("iCloud Family Purchase?");
  const iFree = col("Free product Code Redemption?");

  for (const row of rows) {
    const ts = parseAppleDate(row[iDate]);
    if (!ts) continue;

    const metadata: Record<string, unknown> = {
      subSource: "Purchases",
    };

    const desc = iDesc >= 0 ? row[iDesc] : undefined;
    if (desc) metadata.appName = desc;

    const contentType = iContentType >= 0 ? row[iContentType] : undefined;
    if (contentType) metadata.contentType = contentType;

    const deviceRaw = iDevice >= 0 ? row[iDevice] : undefined;
    if (deviceRaw) {
      const ua = parseAppleDeviceUA(deviceRaw);
      if (ua.device) metadata.device = ua.device;
      if (ua.os) metadata.osVersion = ua.os;
    }

    const ip = iIP >= 0 ? row[iIP] : undefined;
    if (ip) metadata.ipAddr = ip;

    const price = iPrice >= 0 ? row[iPrice] : undefined;
    if (price) metadata.price = price;

    const currency = iCurrency >= 0 ? row[iCurrency] : undefined;
    if (currency) metadata.currency = currency;

    const payment = iPayment >= 0 ? row[iPayment] : undefined;
    if (payment) metadata.paymentType = payment;

    const family = iFamily >= 0 ? row[iFamily] : undefined;
    if (family && family.toLowerCase() === "yes") metadata.isFamilyPurchase = true;

    const free = iFree >= 0 ? row[iFree] : undefined;
    if (free && free.toLowerCase() === "yes") metadata.isFreeRedemption = true;

    events.push(makeAppleEvent("other", ts, metadata));
  }

  return events;
}
