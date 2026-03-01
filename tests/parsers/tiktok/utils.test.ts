import { describe, it, expect, beforeEach } from "vitest";
import { makeEventId, resetIdCounter, parseTikTokDate } from "@/parsers/tiktok/utils";

describe("makeEventId", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it("produces ids with tk- prefix", () => {
    const id = makeEventId();
    expect(id).toMatch(/^tk-/);
  });

  it("produces unique ids", () => {
    const ids = new Set([makeEventId(), makeEventId(), makeEventId()]);
    expect(ids.size).toBe(3);
  });
});

describe("parseTikTokDate", () => {
  it("parses valid YYYY-MM-DD HH:MM:SS", () => {
    const d = parseTikTokDate("2025-04-24 22:45:08");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2025);
    expect(d!.getUTCMonth()).toBe(3); // April = 3
    expect(d!.getUTCDate()).toBe(24);
    expect(d!.getUTCHours()).toBe(22);
    expect(d!.getUTCMinutes()).toBe(45);
  });

  it("returns null for invalid date", () => {
    expect(parseTikTokDate("not-a-date")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseTikTokDate("")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseTikTokDate(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseTikTokDate(null)).toBeNull();
  });
});
