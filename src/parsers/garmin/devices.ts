import type { MetadataEvent } from "../types";
import { makeGarminEvent, parseGarminTextDate } from "./utils";

interface DeviceEntry {
  unitId?: string;
  serialNumber?: string;
  partNumber?: string;
  registrationDate?: string;
}

interface DeviceAndContentData {
  deviceAndContentInfo?: {
    Devices?: DeviceEntry[];
  }[];
}

export function parseGarminDevices(
  data: unknown,
): MetadataEvent[] {
  const typed = data as DeviceAndContentData;
  if (!typed?.deviceAndContentInfo || !Array.isArray(typed.deviceAndContentInfo)) return [];

  const events: MetadataEvent[] = [];

  for (const info of typed.deviceAndContentInfo) {
    if (!Array.isArray(info?.Devices)) continue;

    for (const device of info.Devices) {
      const timestamp = parseGarminTextDate(device.registrationDate);
      if (!timestamp) continue;

      events.push(
        makeGarminEvent("profile_update", timestamp, "You", [], {
          garminEventType: "DEVICE_REGISTRATION",
          unitId: device.unitId,
          serialNumber: device.serialNumber,
          partNumber: device.partNumber,
        }),
      );
    }
  }

  return events;
}
