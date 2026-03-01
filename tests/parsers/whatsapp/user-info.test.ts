import { describe, it, expect, beforeEach } from "vitest";
import { parseUserInfo } from "@/parsers/whatsapp/user-info";
import { resetIdCounter } from "@/parsers/whatsapp/utils";
import type { DeviceInfoEntry } from "@/parsers/whatsapp/device-info";

describe("parseUserInfo", () => {
  beforeEach(() => resetIdCounter());

  const emptyDeviceMap = new Map<string, DeviceInfoEntry>();

  it("extracts phone number as actor", () => {
    const data = {
      label_values: [{ label: "Phone number", value: "+34669727046" }],
    };
    const result = parseUserInfo(data, emptyDeviceMap);
    expect(result.phoneNumber).toBe("+34669727046");
  });

  it("parses Profile Picture Upload Time", () => {
    const data = {
      label_values: [
        { label: "Phone number", value: "+34669727046" },
        { label: "Profile Picture Upload Time", timestamp_value: 1711960466 },
      ],
    };
    const result = parseUserInfo(data, emptyDeviceMap);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventType).toBe("profile_update");
    expect(result.events[0].metadata.action).toBe("profile_picture_upload");
    expect(result.events[0].actor).toBe("+34669727046");
  });

  it("parses About Set Time with about text", () => {
    const data = {
      label_values: [
        { label: "Phone number", value: "+34669727046" },
        { label: "About", value: "sir, this is a casino" },
        { label: "About Set Time", timestamp_value: 1763420310 },
      ],
    };
    const result = parseUserInfo(data, emptyDeviceMap);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventType).toBe("profile_update");
    expect(result.events[0].metadata.action).toBe("about_set");
    expect(result.events[0].metadata.aboutText).toBe("sir, this is a casino");
  });

  it("parses Device Activity with enriched device info", () => {
    const deviceMap = new Map<string, DeviceInfoEntry>([
      ["0", { device_id: 0, device_model: "husky", device_manufacturer: "Google", app_version: "Android-2.26.7.73" }],
    ]);
    const data = {
      label_values: [
        { label: "Phone number", value: "+34669727046" },
        {
          label: "Device Activity",
          vec: [{
            dict: [
              { label: "Device", value: "0" },
              { label: "Last Active Time", timestamp_value: 1772320863 },
              { label: "Online Since", timestamp_value: 0 },
            ],
          }],
        },
      ],
    };
    const result = parseUserInfo(data, deviceMap);
    // Only Last Active Time (Online Since is 0 -> skipped)
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventType).toBe("login");
    expect(result.events[0].metadata.action).toBe("device_last_active");
    expect(result.events[0].metadata.deviceModel).toBe("husky");
    expect(result.events[0].metadata.deviceManufacturer).toBe("Google");
  });

  it("creates device_session_start when Online Since > 0", () => {
    const data = {
      label_values: [
        { label: "Phone number", value: "+34669727046" },
        {
          label: "Device Activity",
          vec: [{
            dict: [
              { label: "Device", value: "34" },
              { label: "Last Active Time", timestamp_value: 1772312782 },
              { label: "Online Since", timestamp_value: 1772269765 },
            ],
          }],
        },
      ],
    };
    const result = parseUserInfo(data, emptyDeviceMap);
    expect(result.events).toHaveLength(2);
    const actions = result.events.map(e => e.metadata.action);
    expect(actions).toContain("device_session_start");
    expect(actions).toContain("device_last_active");
  });

  it("skips Report Request Time and Report Generation Time", () => {
    const data = {
      label_values: [
        { label: "Phone number", value: "+34669727046" },
        { label: "Report Request Time", timestamp_value: 1772044827 },
        { label: "Report Generation Time", timestamp_value: 1772323939 },
      ],
    };
    const result = parseUserInfo(data, emptyDeviceMap);
    expect(result.events).toHaveLength(0);
  });

  it("returns empty for null input", () => {
    const result = parseUserInfo(null, emptyDeviceMap);
    expect(result.events).toEqual([]);
    expect(result.phoneNumber).toBe("");
  });
});
