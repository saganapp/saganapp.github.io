import type { MetadataEvent, EventType } from "../types";
import { makeAppleEvent, parseCSV, parseAppleDate } from "./utils";

/**
 * Map Apple's Event Type values to our EventType.
 * search → search, page/click/media/enter/exit → browsing,
 * impressions → ad_interaction, purchase/buy → other
 */
function mapEventType(appleEventType: string): EventType {
  const lower = appleEventType.toLowerCase();
  if (lower === "search") return "search";
  if (lower === "impressions" || lower === "impression") return "ad_interaction";
  if (
    lower === "purchase" ||
    lower.startsWith("buy") ||
    lower === "commerce"
  ) return "other";
  // page, click, media, enter, exit, etc.
  return "browsing";
}

/**
 * Parse "App Store Click Activity.csv" from nested Appstore.zip.
 * Selectively extracts ~15 of 109 columns via header lookup.
 */
export function parseClickActivity(csvText: string): MetadataEvent[] {
  const { rows, col } = parseCSV(csvText);
  const events: MetadataEvent[] = [];

  const iDateTime = col("Event Date Time");
  const iEventType = col("Event Type");
  const iActionType = col("Action Type");
  const iSearchTerm = col("Search Term");
  const iFinalSearchTerm = col("Final Search Term");
  const iPage = col("Page");
  const iPageType = col("Page Type");
  const iTab = col("Tab");
  const iHardwareModel = col("Hardware Model");
  const iHardwareType = col("Hardware Type");
  const iPlatform = col("Platform");
  const iItemDescriptions = col("Item Descriptions");
  const iIsPersonalized = col("Is Personalized");
  const iIsPurchase = col("Is Purchase");
  const iStoreFront = col("Store Front");

  for (const row of rows) {
    const ts = parseAppleDate(row[iDateTime]);
    if (!ts) continue;

    const appleEventType = iEventType >= 0 ? row[iEventType] ?? "" : "";
    const eventType = mapEventType(appleEventType);

    const metadata: Record<string, unknown> = {
      subSource: "Click Activity",
      appleEventType,
    };

    const actionType = iActionType >= 0 ? row[iActionType] : undefined;
    if (actionType) metadata.actionType = actionType;

    // Search terms
    const searchTerm = iSearchTerm >= 0 ? row[iSearchTerm] : undefined;
    const finalSearch = iFinalSearchTerm >= 0 ? row[iFinalSearchTerm] : undefined;
    if (finalSearch) metadata.searchTerm = finalSearch;
    else if (searchTerm) metadata.searchTerm = searchTerm;

    const page = iPage >= 0 ? row[iPage] : undefined;
    if (page) metadata.page = page;

    const pageType = iPageType >= 0 ? row[iPageType] : undefined;
    if (pageType) metadata.pageType = pageType;

    const tab = iTab >= 0 ? row[iTab] : undefined;
    if (tab) metadata.tab = tab;

    const hwModel = iHardwareModel >= 0 ? row[iHardwareModel] : undefined;
    if (hwModel) metadata.device = hwModel;

    const hwType = iHardwareType >= 0 ? row[iHardwareType] : undefined;
    if (hwType) metadata.hardwareType = hwType;

    const platform = iPlatform >= 0 ? row[iPlatform] : undefined;
    if (platform) metadata.platform = platform;

    const items = iItemDescriptions >= 0 ? row[iItemDescriptions] : undefined;
    if (items) metadata.itemDescriptions = items;

    const personalized = iIsPersonalized >= 0 ? row[iIsPersonalized] : undefined;
    if (personalized && personalized.toLowerCase() === "true") metadata.isPersonalized = true;

    const purchase = iIsPurchase >= 0 ? row[iIsPurchase] : undefined;
    if (purchase && purchase.toLowerCase() === "true") metadata.isPurchase = true;

    const storeFront = iStoreFront >= 0 ? row[iStoreFront] : undefined;
    if (storeFront) metadata.storeFront = storeFront;

    events.push(makeAppleEvent(eventType, ts, metadata));
  }

  return events;
}
