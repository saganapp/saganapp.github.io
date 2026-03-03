import { describe, it, expect, beforeEach } from "vitest";
import { parseTikTokLoginHistory } from "@/parsers/tiktok/login-history";
import { resetIdCounter } from "@/parsers/tiktok/utils";

describe("parseTikTokLoginHistory", () => {
  beforeEach(() => resetIdCounter());

  it("parses login entries with device info", () => {
    const entries = [
      {
        Date: "2023-08-15 14:30:00",
        IP: "192.168.1.1",
        DeviceModel: "iPhone 14",
        DeviceSystem: "iOS 17",
        NetworkType: "WiFi",
        Carrier: "Verizon",
      },
    ];

    const events = parseTikTokLoginHistory(entries);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("tiktok");
    expect(events[0].eventType).toBe("login");
    expect(events[0].metadata.ip).toBe("192.168.1.1");
    expect(events[0].metadata.deviceModel).toBe("iPhone 14");
    expect(events[0].metadata.deviceSystem).toBe("iOS 17");
    expect(events[0].metadata.networkType).toBe("WiFi");
  });

  it("parses multiple login entries", () => {
    const entries = [
      { Date: "2023-08-15 14:30:00", IP: "10.0.0.1" },
      { Date: "2023-08-16 10:00:00", IP: "10.0.0.2" },
    ];

    const events = parseTikTokLoginHistory(entries);
    expect(events).toHaveLength(2);
  });

  it("skips entries without Date", () => {
    const entries = [{ IP: "10.0.0.1" }];
    const events = parseTikTokLoginHistory(entries);
    expect(events).toHaveLength(0);
  });

  it("returns empty array for null input", () => {
    expect(parseTikTokLoginHistory(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(parseTikTokLoginHistory(undefined)).toEqual([]);
  });
});
