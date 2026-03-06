import type { MetadataEvent } from "../types";
import { makeAppleEvent, parseCSV, parseAppleDate } from "./utils";

/**
 * Parse "App install activity.csv" from Apple GDPR export.
 * Columns: App Name, Application ID, Application Type, Client Event ID,
 * Created Date, Device Identifier, Device OS Version, Event Date,
 * External Referral URL, Installation Type, Origin, OS Build Version,
 * Platform Name, Store Front Name
 */
export function parseAppInstalls(csvText: string): MetadataEvent[] {
  const { rows, col } = parseCSV(csvText);
  const events: MetadataEvent[] = [];

  const iAppName = col("App Name");
  const iEventDate = col("Event Date");
  const iInstallType = col("Installation Type");
  const iPlatform = col("Platform Name");
  const iOsVersion = col("Device OS Version");
  const iStoreFront = col("Store Front Name");

  for (const row of rows) {
    const dateStr = row[iEventDate] ?? row[col("Created Date")];
    const ts = parseAppleDate(dateStr);
    if (!ts) continue;

    const metadata: Record<string, unknown> = {
      subSource: "App Installs",
    };

    const appName = iAppName >= 0 ? row[iAppName] : undefined;
    if (appName) metadata.appName = appName;

    const installType = iInstallType >= 0 ? row[iInstallType] : undefined;
    if (installType) metadata.installationType = installType;

    const platform = iPlatform >= 0 ? row[iPlatform] : undefined;
    if (platform) metadata.device = platform;

    const osVersion = iOsVersion >= 0 ? row[iOsVersion] : undefined;
    if (osVersion) metadata.osVersion = osVersion;

    const storeFront = iStoreFront >= 0 ? row[iStoreFront] : undefined;
    if (storeFront) metadata.storeFront = storeFront;

    events.push(makeAppleEvent("other", ts, metadata));
  }

  return events;
}
