import { describe, it, expect } from "vitest";
import { formatDays } from "@/utils/format-days";

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const label = (i: number) => SHORT_DAYS[i];

describe("formatDays", () => {
  it("formats a consecutive run as a range", () => {
    expect(formatDays([1, 2, 3, 4, 5], label)).toBe("Mon\u2013Fri");
  });

  it("formats non-consecutive days with commas", () => {
    expect(formatDays([1, 3, 5], label)).toBe("Mon, Wed, Fri");
  });

  it("formats mixed runs and singles", () => {
    expect(formatDays([0, 1, 2, 5, 6], label)).toBe("Sun\u2013Tue, Fri, Sat");
  });

  it("formats a single day", () => {
    expect(formatDays([3], label)).toBe("Wed");
  });

  it("returns empty string for empty array", () => {
    expect(formatDays([], label)).toBe("");
  });

  it("handles two consecutive days as comma-separated (run < 3)", () => {
    expect(formatDays([1, 2], label)).toBe("Mon, Tue");
  });

  it("handles full week", () => {
    expect(formatDays([0, 1, 2, 3, 4, 5, 6], label)).toBe("Sun\u2013Sat");
  });
});
