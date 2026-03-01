import { describe, it, expect, beforeEach } from "vitest";
import { makeEventId, resetIdCounter, fromUnixSeconds } from "@/parsers/whatsapp/utils";

describe("makeEventId", () => {
  beforeEach(() => resetIdCounter());

  it("produces ids with wa- prefix", () => {
    expect(makeEventId()).toMatch(/^wa-/);
  });

  it("produces unique ids", () => {
    const ids = new Set([makeEventId(), makeEventId(), makeEventId()]);
    expect(ids.size).toBe(3);
  });
});

describe("fromUnixSeconds", () => {
  it("converts valid unix timestamp to Date", () => {
    const d = fromUnixSeconds(1735644306);
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2024);
    expect(d!.getUTCMonth()).toBe(11); // December
    expect(d!.getUTCDate()).toBe(31);
  });

  it("returns null for 0", () => {
    expect(fromUnixSeconds(0)).toBeNull();
  });

  it("returns null for null", () => {
    expect(fromUnixSeconds(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(fromUnixSeconds(undefined)).toBeNull();
  });

  it("returns null for negative numbers", () => {
    expect(fromUnixSeconds(-1)).toBeNull();
  });
});
