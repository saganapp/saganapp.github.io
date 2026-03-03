import { describe, it, expect } from "vitest";
import { computeCountryData } from "@/analysis/countries";
import type { MetadataEvent } from "@/parsers/types";

function makeEvent(
  source: MetadataEvent["source"],
  metadata: Record<string, unknown> = {},
): MetadataEvent {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    source,
    eventType: "media_played",
    timestamp: new Date(2024, 5, 15),
    actor: "You",
    participants: [],
    metadata,
  };
}

describe("computeCountryData", () => {
  it("aggregates events with connCountry", () => {
    const events = [
      makeEvent("spotify", { connCountry: "ES" }),
      makeEvent("spotify", { connCountry: "ES" }),
      makeEvent("spotify", { connCountry: "FR" }),
      makeEvent("spotify", { connCountry: "PT" }),
    ];
    const result = computeCountryData(events);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ countryCode: "ES", count: 2, platforms: ["spotify"] });
    expect(result[1]).toEqual({ countryCode: "FR", count: 1, platforms: ["spotify"] });
    expect(result[2]).toEqual({ countryCode: "PT", count: 1, platforms: ["spotify"] });
  });

  it("merges platforms for same country", () => {
    const events = [
      makeEvent("spotify", { connCountry: "ES" }),
      makeEvent("twitter", { connCountry: "ES" }),
      makeEvent("instagram", { connCountry: "ES" }),
    ];
    const result = computeCountryData(events);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
    expect(result[0].platforms).toContain("spotify");
    expect(result[0].platforms).toContain("twitter");
    expect(result[0].platforms).toContain("instagram");
  });

  it("ignores events without connCountry", () => {
    const events = [
      makeEvent("spotify", { connCountry: "ES" }),
      makeEvent("twitter", { ip: "1.2.3.4" }), // no connCountry
      makeEvent("instagram", {}),
    ];
    const result = computeCountryData(events);
    expect(result).toHaveLength(1);
    expect(result[0].countryCode).toBe("ES");
  });

  it("ignores invalid country codes", () => {
    const events = [
      makeEvent("spotify", { connCountry: "X" }),      // too short
      makeEvent("spotify", { connCountry: "INVALID" }), // too long
      makeEvent("spotify", { connCountry: 123 }),        // not string
    ];
    const result = computeCountryData(events);
    expect(result).toHaveLength(0);
  });

  it("uppercases country codes", () => {
    const events = [
      makeEvent("spotify", { connCountry: "es" }),
      makeEvent("spotify", { connCountry: "Es" }),
    ];
    const result = computeCountryData(events);
    expect(result).toHaveLength(1);
    expect(result[0].countryCode).toBe("ES");
    expect(result[0].count).toBe(2);
  });

  it("returns empty array for no events", () => {
    expect(computeCountryData([])).toEqual([]);
  });

  it("sorts by count descending", () => {
    const events = [
      makeEvent("spotify", { connCountry: "PT" }),
      makeEvent("spotify", { connCountry: "FR" }),
      makeEvent("spotify", { connCountry: "FR" }),
      makeEvent("spotify", { connCountry: "ES" }),
      makeEvent("spotify", { connCountry: "ES" }),
      makeEvent("spotify", { connCountry: "ES" }),
    ];
    const result = computeCountryData(events);
    expect(result[0].countryCode).toBe("ES");
    expect(result[1].countryCode).toBe("FR");
    expect(result[2].countryCode).toBe("PT");
  });
});
