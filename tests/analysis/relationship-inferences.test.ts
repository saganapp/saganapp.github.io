import { describe, it, expect } from "vitest";
import {
  computeReciprocityInference,
  computeRelationshipTrendInference,
  computeResponseLatencyInference,
  computeSocialCirclesInference,
} from "@/analysis/relationship-inferences";
import type { MetadataEvent, ContactRanking } from "@/parsers/types";
import type { DashboardStats } from "@/hooks/use-dashboard-data";

function makeEvent(
  overrides: Partial<MetadataEvent> & { timestamp: Date },
): MetadataEvent {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    source: "whatsapp",
    eventType: "message_sent",
    actor: "You",
    participants: ["Alice"],
    metadata: {},
    ...overrides,
  };
}

function makeStats(events: MetadataEvent[]): DashboardStats {
  if (events.length === 0) {
    return {
      total: 0, totalUserTriggered: 0, totalWithAggregates: 0,
      dateRange: null, effectiveRange: null, outlierCount: 0,
      estimatedTotalTimeSeconds: 0, uniqueContacts: 0, topCategories: [],
    };
  }
  const sorted = events.map((e) => e.timestamp.getTime()).sort((a, b) => a - b);
  const range = { start: new Date(sorted[0]), end: new Date(sorted[sorted.length - 1]) };
  return {
    total: events.length,
    totalUserTriggered: events.length,
    totalWithAggregates: events.length,
    dateRange: range,
    effectiveRange: range,
    outlierCount: 0,
    estimatedTotalTimeSeconds: 0,
    uniqueContacts: 1,
    topCategories: [],
  };
}

describe("computeReciprocityInference", () => {
  it("returns null for insufficient data", () => {
    expect(computeReciprocityInference([])).toBeNull();
  });

  it("returns inference for imbalanced contact", () => {
    const events: MetadataEvent[] = [];
    for (let i = 0; i < 9; i++) {
      events.push(makeEvent({
        timestamp: new Date(2024, 0, 1, i),
        eventType: "message_sent",
        participants: ["Alice"],
      }));
    }
    events.push(makeEvent({
      timestamp: new Date(2024, 0, 1, 10),
      eventType: "message_received",
      participants: ["Alice"],
    }));

    const result = computeReciprocityInference(events);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("reciprocity");
  });

  it("returns null when balanced", () => {
    const events: MetadataEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(makeEvent({
        timestamp: new Date(2024, 0, 1, i),
        eventType: "message_sent",
        participants: ["Alice"],
      }));
      events.push(makeEvent({
        timestamp: new Date(2024, 0, 1, 10 + i),
        eventType: "message_received",
        participants: ["Alice"],
      }));
    }
    expect(computeReciprocityInference(events)).toBeNull();
  });
});

describe("computeRelationshipTrendInference", () => {
  it("returns null for empty data", () => {
    expect(computeRelationshipTrendInference([], makeStats([]))).toBeNull();
  });

  it("returns inference for fading contact", () => {
    const events: MetadataEvent[] = [];
    const end = new Date(2024, 6, 1);

    // Prior: 30 events
    for (let i = 0; i < 30; i++) {
      events.push(makeEvent({ timestamp: new Date(2024, 0, 1 + i), participants: ["Alice"] }));
    }
    // Recent: 3 events
    for (let i = 0; i < 3; i++) {
      events.push(makeEvent({ timestamp: new Date(2024, 4, 1 + i), participants: ["Alice"] }));
    }

    const stats = makeStats(events);
    stats.effectiveRange = { start: new Date(2024, 0, 1), end };

    const result = computeRelationshipTrendInference(events, stats);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("relationship-trend");
  });
});

describe("computeResponseLatencyInference", () => {
  it("returns null for empty data", () => {
    expect(computeResponseLatencyInference([])).toBeNull();
  });

  it("returns inference for asymmetric response times", () => {
    const events: MetadataEvent[] = [];
    for (let i = 0; i < 20; i++) {
      const base = new Date(2024, 0, 1, 10, i * 45);
      events.push(makeEvent({
        timestamp: base,
        eventType: "message_received",
        participants: ["Alice"],
      }));
      events.push(makeEvent({
        timestamp: new Date(base.getTime() + 2 * 60000), // 2 min reply
        eventType: "message_sent",
        participants: ["Alice"],
      }));
      events.push(makeEvent({
        timestamp: new Date(base.getTime() + 42 * 60000), // 40 min reply from them
        eventType: "message_received",
        participants: ["Alice"],
      }));
    }

    const result = computeResponseLatencyInference(events);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("response-latency");
  });
});

describe("computeSocialCirclesInference", () => {
  it("returns null for empty data", () => {
    expect(computeSocialCirclesInference([], [])).toBeNull();
  });

  it("returns inference when circles are detected", () => {
    const events: MetadataEvent[] = [];
    const rankings: ContactRanking[] = [];
    const contacts = ["A", "B", "C", "D", "E", "F", "G"];

    for (let ci = 0; ci < contacts.length; ci++) {
      const name = contacts[ci];
      const isNight = ci < 3;
      for (let i = 0; i < 20; i++) {
        const hour = isNight ? 23 : 10;
        events.push(makeEvent({
          timestamp: new Date(2024, 0, 1 + i, hour),
          participants: [name],
        }));
      }
      rankings.push({
        name,
        totalInteractions: 20,
        platforms: ["whatsapp"],
        estimatedTimeSeconds: 200,
        byTimeWindow: {
          "00-04": 0, "04-08": 0, "08-12": isNight ? 0 : 20,
          "12-16": 0, "16-20": 0, "20-24": isNight ? 20 : 0,
        },
        nightInteractions: isNight ? 20 : 0,
        weekendInteractions: 0,
        byCategory: {},
      });
    }

    const result = computeSocialCirclesInference(events, rankings);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("social-circles");
  });
});
