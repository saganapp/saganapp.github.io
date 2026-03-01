import type { MetadataEvent } from "../types";
import type { DeviceInfoEntry } from "./device-info";
import { makeWhatsAppEvent, fromUnixSeconds } from "./utils";

interface LabelValue {
  label: string;
  value?: string;
  timestamp_value?: number;
  vec?: DeviceVecEntry[];
  media?: { uri: string }[];
}

interface DeviceVecEntry {
  dict: { label: string; value?: string; timestamp_value?: number }[];
}

interface UserInfoData {
  label_values?: LabelValue[];
}

export function parseUserInfo(
  data: UserInfoData | null | undefined,
  deviceInfoMap: Map<string, DeviceInfoEntry>,
): { events: MetadataEvent[]; phoneNumber: string; aboutText: string } {
  const result = { events: [] as MetadataEvent[], phoneNumber: "", aboutText: "" };
  if (!data?.label_values || !Array.isArray(data.label_values)) return result;

  // Extract phone number (used as actor for all events)
  const phoneLV = data.label_values.find(lv => lv.label === "Phone number");
  const phone = phoneLV?.value ?? "Unknown";
  result.phoneNumber = phone;

  // Extract about text
  const aboutLV = data.label_values.find(lv => lv.label === "About");
  result.aboutText = aboutLV?.value ?? "";

  for (const lv of data.label_values) {
    switch (lv.label) {
      case "Profile Picture Upload Time": {
        const ts = fromUnixSeconds(lv.timestamp_value);
        if (ts) {
          result.events.push(
            makeWhatsAppEvent("profile_update", ts, phone, [], {
              action: "profile_picture_upload",
            }),
          );
        }
        break;
      }

      case "About Set Time": {
        const ts = fromUnixSeconds(lv.timestamp_value);
        if (ts) {
          result.events.push(
            makeWhatsAppEvent("profile_update", ts, phone, [], {
              action: "about_set",
              aboutText: result.aboutText,
            }),
          );
        }
        break;
      }

      case "Device Activity": {
        if (!lv.vec || !Array.isArray(lv.vec)) break;
        for (const deviceEntry of lv.vec) {
          if (!deviceEntry.dict) continue;
          const dictMap = new Map(
            deviceEntry.dict.map(d => [d.label, d]),
          );

          const deviceIdStr = dictMap.get("Device")?.value ?? "";
          const devInfo = deviceInfoMap.get(deviceIdStr);

          const deviceMeta = {
            deviceId: deviceIdStr,
            deviceModel: devInfo?.device_model ?? "",
            deviceManufacturer: devInfo?.device_manufacturer ?? "",
            appVersion: devInfo?.app_version ?? "",
          };

          // "Online Since" > 0 means a session start time
          const onlineSince = fromUnixSeconds(
            dictMap.get("Online Since")?.timestamp_value,
          );
          if (onlineSince) {
            result.events.push(
              makeWhatsAppEvent("login", onlineSince, phone, [], {
                action: "device_session_start",
                ...deviceMeta,
              }),
            );
          }

          // "Last Active Time" is the most recent activity timestamp
          const lastActive = fromUnixSeconds(
            dictMap.get("Last Active Time")?.timestamp_value,
          );
          if (lastActive) {
            result.events.push(
              makeWhatsAppEvent("login", lastActive, phone, [], {
                action: "device_last_active",
                ...deviceMeta,
              }),
            );
          }
        }
        break;
      }

      // Explicitly skip system-generated timestamps
      case "Report Request Time":
      case "Report Generation Time":
      case "About Expiry Time":
        break;
    }
  }

  return result;
}
