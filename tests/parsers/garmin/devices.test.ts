import { describe, it, expect, beforeEach } from "vitest";
import { resetIdCounter } from "@/parsers/garmin/utils";
import { parseGarminDevices } from "@/parsers/garmin/devices";

describe("parseGarminDevices", () => {
  beforeEach(() => resetIdCounter());

  it("parses device registrations", () => {
    const data = {
      deviceAndContentInfo: [
        {
          Devices: [
            {
              unitId: "3346092901",
              serialNumber: "5ZN144148",
              partNumber: "010-02174-12",
              registrationDate: "March 16, 2025",
            },
          ],
        },
      ],
    };

    const events = parseGarminDevices(data);
    expect(events).toHaveLength(1);

    const e = events[0];
    expect(e.source).toBe("garmin");
    expect(e.eventType).toBe("profile_update");
    expect(e.metadata.garminEventType).toBe("DEVICE_REGISTRATION");
    expect(e.metadata.unitId).toBe("3346092901");
    expect(e.metadata.serialNumber).toBe("5ZN144148");
    expect(e.metadata.partNumber).toBe("010-02174-12");
    expect(e.timestamp.getFullYear()).toBe(2025);
    expect(e.timestamp.getMonth()).toBe(2); // March
  });

  it("returns empty for invalid input", () => {
    expect(parseGarminDevices(null)).toEqual([]);
    expect(parseGarminDevices({})).toEqual([]);
    expect(parseGarminDevices({ deviceAndContentInfo: [] })).toEqual([]);
  });
});
