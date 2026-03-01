export interface DeviceInfoEntry {
  device_id: number;
  app_version?: string;
  device_manufacturer?: string;
  device_model?: string;
  operating_system_version?: string;
}

interface AccountSettingsData {
  wa_settings?: {
    device_info?: DeviceInfoEntry[];
  };
}

export function buildDeviceInfoMap(
  data: AccountSettingsData | null | undefined,
): Map<string, DeviceInfoEntry> {
  const map = new Map<string, DeviceInfoEntry>();
  const devices = data?.wa_settings?.device_info;
  if (!devices || !Array.isArray(devices)) return map;

  for (const d of devices) {
    map.set(String(d.device_id), d);
  }
  return map;
}
