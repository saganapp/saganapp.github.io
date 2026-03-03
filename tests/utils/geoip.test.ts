import { describe, it, expect } from "vitest";
import { ipToNum } from "@/utils/geoip";

describe("ipToNum", () => {
  it("converts valid IPv4 to uint32", () => {
    expect(ipToNum("0.0.0.0")).toBe(0);
    expect(ipToNum("0.0.0.1")).toBe(1);
    expect(ipToNum("0.0.1.0")).toBe(256);
    expect(ipToNum("1.0.0.0")).toBe(16777216);
    expect(ipToNum("255.255.255.255")).toBe(4294967295);
    expect(ipToNum("83.12.34.56")).toBe(83 * 16777216 + 12 * 65536 + 34 * 256 + 56);
  });

  it("returns null for invalid IPs", () => {
    expect(ipToNum("")).toBeNull();
    expect(ipToNum("1.2.3")).toBeNull();
    expect(ipToNum("1.2.3.4.5")).toBeNull();
    expect(ipToNum("256.0.0.0")).toBeNull();
    expect(ipToNum("-1.0.0.0")).toBeNull();
    expect(ipToNum("abc.def.ghi.jkl")).toBeNull();
    expect(ipToNum("1.2.3.4a")).toBeNull();
  });

  it("rejects non-integer octets", () => {
    expect(ipToNum("1.2.3.4.5")).toBeNull();
    expect(ipToNum("1.2.3.")).toBeNull();
  });
});
