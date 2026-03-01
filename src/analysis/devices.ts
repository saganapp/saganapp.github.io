import type { MetadataEvent, DeviceInfo } from "@/parsers/types";
import { getDateKey } from "@/utils/time";

export interface DeviceRecord {
  device: DeviceInfo;
  firstSeen: Date;
  lastSeen: Date;
  eventCount: number;
}

export interface DeviceTimelineMonth {
  month: string;
  devices: { device: string; count: number }[];
}

function parseDeviceString(raw: string): DeviceInfo {
  const info: DeviceInfo = { raw };

  // Try to parse common patterns
  const lower = raw.toLowerCase();

  // Brand detection
  if (lower.includes("samsung")) info.brand = "Samsung";
  else if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("macbook")) info.brand = "Apple";
  else if (lower.includes("pixel") || lower.includes("chromebook")) info.brand = "Google";
  else if (lower.includes("huawei")) info.brand = "Huawei";
  else if (lower.includes("xiaomi")) info.brand = "Xiaomi";

  // OS detection
  if (lower.includes("android")) info.os = "Android";
  else if (lower.includes("ios") || lower.includes("iphone") || lower.includes("ipad")) info.os = "iOS";
  else if (lower.includes("macos") || lower.includes("macbook")) info.os = "macOS";
  else if (lower.includes("windows")) info.os = "Windows";
  else if (lower.includes("linux") || lower.includes("chromebook")) info.os = "Linux";

  // Model is the raw string itself (already descriptive)
  info.model = raw;

  return info;
}

function normalizeDeviceString(raw: string): string {
  return raw.trim().toLowerCase();
}

export function extractDevices(events: MetadataEvent[]): DeviceRecord[] {
  const deviceMap = new Map<string, {
    device: DeviceInfo;
    firstSeen: Date;
    lastSeen: Date;
    eventCount: number;
  }>();

  for (const e of events) {
    const deviceStr = (e.metadata.device ?? e.metadata.userAgent) as string | undefined;
    if (!deviceStr) continue;

    const key = normalizeDeviceString(deviceStr);
    if (!deviceMap.has(key)) {
      deviceMap.set(key, {
        device: parseDeviceString(deviceStr),
        firstSeen: e.timestamp,
        lastSeen: e.timestamp,
        eventCount: 0,
      });
    }

    const record = deviceMap.get(key)!;
    record.eventCount++;
    if (e.timestamp < record.firstSeen) record.firstSeen = e.timestamp;
    if (e.timestamp > record.lastSeen) record.lastSeen = e.timestamp;
  }

  return [...deviceMap.values()].sort((a, b) => a.firstSeen.getTime() - b.firstSeen.getTime());
}

export function buildDeviceTimeline(events: MetadataEvent[]): DeviceTimelineMonth[] {
  const monthDevices = new Map<string, Map<string, number>>();

  for (const e of events) {
    const deviceStr = (e.metadata.device ?? e.metadata.userAgent) as string | undefined;
    if (!deviceStr) continue;

    const monthKey = getDateKey(e.timestamp).slice(0, 7); // YYYY-MM
    if (!monthDevices.has(monthKey)) monthDevices.set(monthKey, new Map());

    const devices = monthDevices.get(monthKey)!;
    devices.set(deviceStr, (devices.get(deviceStr) ?? 0) + 1);
  }

  const months = [...monthDevices.keys()].sort();
  return months.map((month) => {
    const devices = monthDevices.get(month)!;
    const sorted = [...devices.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([device, count]) => ({ device, count }));
    return { month, devices: sorted };
  });
}
