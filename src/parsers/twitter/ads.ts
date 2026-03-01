import type { MetadataEvent } from "../types";
import { parseTwitterJs, makeTwitterEvent } from "./utils";

interface AdEngagementEntry {
  ad: {
    adsUserData: {
      adEngagements: {
        engagements: {
          impressionAttributes: {
            impressionTime: string;
            displayLocation?: string;
            deviceInfo?: {
              osType?: string;
            };
            advertiserInfo?: {
              advertiserName?: string;
              screenName?: string;
            };
          };
          engagementAttributes?: {
            engagementTime?: string;
            engagementType?: string;
          }[];
        }[];
      };
    };
  };
}

export function parseAdEngagements(data: Uint8Array): MetadataEvent[] {
  const entries = parseTwitterJs<AdEngagementEntry>(data);
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const engagements =
      entry.ad?.adsUserData?.adEngagements?.engagements;
    if (!engagements) continue;

    for (const eng of engagements) {
      const imp = eng.impressionAttributes;
      if (!imp?.impressionTime) continue;

      const ts = new Date(imp.impressionTime);
      if (isNaN(ts.getTime())) continue;

      events.push(
        makeTwitterEvent("ad_interaction", ts, "me", [], {
          displayLocation: imp.displayLocation,
          os: imp.deviceInfo?.osType,
          advertiser: imp.advertiserInfo?.advertiserName,
        }),
      );
    }
  }

  return events;
}
