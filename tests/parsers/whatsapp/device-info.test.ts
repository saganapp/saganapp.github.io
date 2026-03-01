import { describe, it, expect } from "vitest";
import { buildDeviceInfoMap } from "@/parsers/whatsapp/device-info";

describe("buildDeviceInfoMap", () => {
  it("builds map keyed by device_id string", () => {
    const data = {
      wa_settings: {
        device_info: [
          { device_id: 0, device_model: "husky", device_manufacturer: "Google", app_version: "Android-2.26.7.73" },
          { device_id: 34, device_model: "Desktop", device_manufacturer: "", app_version: "Web-2.3000" },
        ],
      },
    };
    const map = buildDeviceInfoMap(data);
    expect(map.size).toBe(2);
    expect(map.get("0")?.device_model).toBe("husky");
    expect(map.get("34")?.device_model).toBe("Desktop");
  });

  it("returns empty map for null input", () => {
    expect(buildDeviceInfoMap(null).size).toBe(0);
  });

  it("returns empty map for missing device_info", () => {
    expect(buildDeviceInfoMap({ wa_settings: {} }).size).toBe(0);
  });
});
