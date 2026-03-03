import { describe, it, expect, beforeEach } from "vitest";
import { parseIpAudit } from "@/parsers/twitter/ip-audit";
import { resetIdCounter } from "@/parsers/twitter/utils";

function toTwitterJs(varName: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `window.YTD.${varName}.part0 = ${JSON.stringify(data)}`,
  );
}

describe("parseIpAudit", () => {
  beforeEach(() => resetIdCounter());

  it("parses login events with IP and port", () => {
    const data = toTwitterJs("ip_audit", [
      {
        ipAudit: {
          accountId: "12345",
          createdAt: "2024-06-15T10:30:00.000Z",
          loginIp: "192.168.1.1",
          loginPortNumber: 443,
        },
      },
    ]);

    const events = parseIpAudit(data);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("twitter");
    expect(events[0].eventType).toBe("login");
    expect(events[0].metadata.ip).toBe("192.168.1.1");
    expect(events[0].metadata.port).toBe(443);
    expect(events[0].timestamp.getFullYear()).toBe(2024);
  });

  it("parses multiple login entries", () => {
    const data = toTwitterJs("ip_audit", [
      {
        ipAudit: {
          createdAt: "2024-06-15T10:30:00.000Z",
          loginIp: "10.0.0.1",
        },
      },
      {
        ipAudit: {
          createdAt: "2024-06-16T08:00:00.000Z",
          loginIp: "10.0.0.2",
        },
      },
    ]);

    const events = parseIpAudit(data);
    expect(events).toHaveLength(2);
  });

  it("skips entries without createdAt", () => {
    const data = toTwitterJs("ip_audit", [
      { ipAudit: { loginIp: "10.0.0.1" } },
    ]);
    const events = parseIpAudit(data);
    expect(events).toHaveLength(0);
  });

  it("skips entries with invalid dates", () => {
    const data = toTwitterJs("ip_audit", [
      { ipAudit: { createdAt: "not-a-date" } },
    ]);
    const events = parseIpAudit(data);
    expect(events).toHaveLength(0);
  });
});
