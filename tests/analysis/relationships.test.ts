import { describe, it, expect } from "vitest";
import {
  computeReciprocity,
  computeRelationshipTrends,
  computeResponseLatency,
  computeSocialCircles,
} from "@/analysis/relationships";
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

describe("computeReciprocity", () => {
  it("returns empty for insufficient data", () => {
    const events = [
      makeEvent({ timestamp: new Date(2024, 0, 1), eventType: "message_sent" }),
    ];
    expect(computeReciprocity(events)).toEqual([]);
  });

  it("computes correct ratio for imbalanced conversation", () => {
    const events: MetadataEvent[] = [];
    // 8 sent, 2 received → ratio 0.8
    for (let i = 0; i < 8; i++) {
      events.push(
        makeEvent({
          timestamp: new Date(2024, 0, 1, i),
          eventType: "message_sent",
          participants: ["Alice"],
        }),
      );
    }
    for (let i = 0; i < 2; i++) {
      events.push(
        makeEvent({
          timestamp: new Date(2024, 0, 1, 10 + i),
          eventType: "message_received",
          participants: ["Alice"],
        }),
      );
    }

    const scores = computeReciprocity(events);
    expect(scores.length).toBe(1);
    expect(scores[0].ratio).toBe(0.8);
    expect(scores[0].contact).toBe("Alice");
  });

  it("sorts by most imbalanced first", () => {
    const events: MetadataEvent[] = [];
    // Alice: 7 sent, 3 received → ratio 0.7 (0.2 from 0.5)
    for (let i = 0; i < 7; i++)
      events.push(makeEvent({ timestamp: new Date(2024, 0, 1, i), eventType: "message_sent", participants: ["Alice"] }));
    for (let i = 0; i < 3; i++)
      events.push(makeEvent({ timestamp: new Date(2024, 0, 1, 10 + i), eventType: "message_received", participants: ["Alice"] }));
    // Bob: 5 sent, 5 received → ratio 0.5 (0 from 0.5)
    for (let i = 0; i < 5; i++)
      events.push(makeEvent({ timestamp: new Date(2024, 0, 2, i), eventType: "message_sent", participants: ["Bob"] }));
    for (let i = 0; i < 5; i++)
      events.push(makeEvent({ timestamp: new Date(2024, 0, 2, 10 + i), eventType: "message_received", participants: ["Bob"] }));

    const scores = computeReciprocity(events);
    expect(scores.length).toBe(2);
    expect(scores[0].contact).toBe("Alice");
  });
});

describe("computeRelationshipTrends", () => {
  it("returns empty when no effective range", () => {
    expect(computeRelationshipTrends([], makeStats([]))).toEqual([]);
  });

  it("detects a fading contact", () => {
    const events: MetadataEvent[] = [];
    const end = new Date(2024, 6, 1);

    // Prior period: 30 interactions
    for (let i = 0; i < 30; i++) {
      events.push(
        makeEvent({
          timestamp: new Date(2024, 0, 1 + i),
          participants: ["Alice"],
        }),
      );
    }
    // Recent period: 5 interactions
    for (let i = 0; i < 5; i++) {
      events.push(
        makeEvent({
          timestamp: new Date(2024, 4, 1 + i),
          participants: ["Alice"],
        }),
      );
    }

    const stats = makeStats(events);
    stats.effectiveRange = { start: new Date(2024, 0, 1), end: end };

    const trends = computeRelationshipTrends(events, stats);
    const alice = trends.find((t) => t.contact === "Alice");
    expect(alice).toBeDefined();
    expect(alice!.direction).toBe("fading");
  });

  it("detects a growing contact", () => {
    const events: MetadataEvent[] = [];
    const end = new Date(2024, 6, 1);

    // Prior: 5 interactions
    for (let i = 0; i < 5; i++) {
      events.push(makeEvent({ timestamp: new Date(2024, 0, 1 + i), participants: ["Bob"] }));
    }
    // Recent: 30 interactions
    for (let i = 0; i < 30; i++) {
      events.push(makeEvent({ timestamp: new Date(2024, 4, 1 + i), participants: ["Bob"] }));
    }

    const stats = makeStats(events);
    stats.effectiveRange = { start: new Date(2024, 0, 1), end: end };

    const trends = computeRelationshipTrends(events, stats);
    const bob = trends.find((t) => t.contact === "Bob");
    expect(bob).toBeDefined();
    expect(bob!.direction).toBe("growing");
  });
});

describe("computeResponseLatency", () => {
  it("returns empty for insufficient data", () => {
    expect(computeResponseLatency([])).toEqual([]);
  });

  it("computes median response times", () => {
    const events: MetadataEvent[] = [];
    // Alternate sent/received with Alice, 5 min reply from you, 30 min from them
    for (let i = 0; i < 20; i++) {
      const base = new Date(2024, 0, 1, 10, i * 35);
      // They send
      events.push(
        makeEvent({
          timestamp: base,
          eventType: "message_received",
          participants: ["Alice"],
        }),
      );
      // You reply 5 min later
      events.push(
        makeEvent({
          timestamp: new Date(base.getTime() + 5 * 60000),
          eventType: "message_sent",
          participants: ["Alice"],
        }),
      );
      // They reply 30 min after that
      events.push(
        makeEvent({
          timestamp: new Date(base.getTime() + 35 * 60000),
          eventType: "message_received",
          participants: ["Alice"],
        }),
      );
    }

    const result = computeResponseLatency(events);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const alice = result.find((r) => r.contact === "Alice");
    expect(alice).toBeDefined();
    // Your median should be ~5 min = 300000ms
    expect(alice!.yourMedianMs).toBeLessThan(10 * 60000);
    // Their median should be ~30 min = 1800000ms
    expect(alice!.theirMedianMs).toBeGreaterThan(20 * 60000);
  });
});

describe("computeSocialCircles", () => {
  it("returns empty for fewer than 5 contacts", () => {
    const events: MetadataEvent[] = [
      makeEvent({ timestamp: new Date(2024, 0, 1), participants: ["Alice"] }),
    ];
    const rankings: ContactRanking[] = [
      {
        name: "Alice",
        totalInteractions: 10,
        platforms: ["whatsapp"],
        estimatedTimeSeconds: 100,
        byTimeWindow: { "08-12": 10, "12-16": 0, "16-20": 0, "20-24": 0, "00-04": 0, "04-08": 0 },
        nightInteractions: 0,
        weekendInteractions: 0,
        byCategory: {},
      },
    ];
    expect(computeSocialCircles(events, rankings)).toEqual([]);
  });

  it("clusters contacts into circles when enough data", () => {
    // Create 10 contacts with distinct patterns
    const events: MetadataEvent[] = [];
    const rankings: ContactRanking[] = [];

    const contacts = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    for (let ci = 0; ci < contacts.length; ci++) {
      const name = contacts[ci];
      const isNight = ci < 3;
      const isWorkday = ci >= 3 && ci < 7;

      for (let i = 0; i < 20; i++) {
        const hour = isNight ? 23 : isWorkday ? 10 : 18;
        const day = isWorkday ? 1 : 0; // Mon or Sun
        const date = new Date(2024, 0, 7 + day + i * 7, hour);
        events.push(makeEvent({ timestamp: date, participants: [name] }));
      }

      rankings.push({
        name,
        totalInteractions: 20,
        platforms: ["whatsapp"],
        estimatedTimeSeconds: 200,
        byTimeWindow: {
          "00-04": 0, "04-08": 0, "08-12": isWorkday ? 20 : 0,
          "12-16": 0, "16-20": !isNight && !isWorkday ? 20 : 0,
          "20-24": isNight ? 20 : 0,
        },
        nightInteractions: isNight ? 20 : 0,
        weekendInteractions: !isWorkday ? 20 : 0,
        byCategory: {},
      });
    }

    const circles = computeSocialCircles(events, rankings);
    expect(circles.length).toBeGreaterThanOrEqual(1);
    const totalContacts = circles.reduce((sum, c) => sum + c.contacts.length, 0);
    expect(totalContacts).toBeGreaterThanOrEqual(5);
  });
});
