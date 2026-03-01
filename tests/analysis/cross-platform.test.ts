import { describe, it, expect } from "vitest";
import {
  computeActivityGaps,
  computeSleepDrift,
  computePlatformMigration,
  computeLateNightContactCorrelation,
  computeFirstLastActivity,
} from "@/analysis/cross-platform";
import type { MetadataEvent, Platform } from "@/parsers/types";
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

describe("computeActivityGaps", () => {
  it("returns null for fewer than 50 events", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent({ timestamp: new Date(2024, 0, 1 + i, 10) }),
    );
    expect(computeActivityGaps(events, makeStats(events))).toBeNull();
  });

  it("detects a multi-day gap", () => {
    const events: MetadataEvent[] = [];
    // 10 events/day for 30 days, but skip days 10-14 (5-day gap)
    for (let d = 0; d < 30; d++) {
      if (d >= 10 && d <= 14) continue;
      for (let e = 0; e < 10; e++) {
        events.push(
          makeEvent({ timestamp: new Date(2024, 0, 1 + d, 8 + e) }),
        );
      }
    }
    const result = computeActivityGaps(events, makeStats(events));
    expect(result).not.toBeNull();
    expect(result!.id).toBe("activity-gaps");
    expect(result!.titleParams!.days).toBeGreaterThanOrEqual(3);
  });

  it("returns null when no gaps exist", () => {
    const events: MetadataEvent[] = [];
    for (let d = 0; d < 30; d++) {
      for (let e = 0; e < 10; e++) {
        events.push(makeEvent({ timestamp: new Date(2024, 0, 1 + d, 8 + e) }));
      }
    }
    const result = computeActivityGaps(events, makeStats(events));
    expect(result).toBeNull();
  });
});

describe("computeSleepDrift", () => {
  it("returns null for fewer than 100 events", () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      makeEvent({ timestamp: new Date(2024, 0, 1 + i, 10) }),
    );
    expect(computeSleepDrift(events)).toBeNull();
  });

  it("detects bedtime shifting later", () => {
    const events: MetadataEvent[] = [];
    // Month 1: last activity at 22:00, Month 2: at 23:30
    for (let d = 0; d < 30; d++) {
      for (let h = 8; h <= 22; h++) {
        events.push(makeEvent({ timestamp: new Date(2024, 0, 1 + d, h) }));
      }
    }
    for (let d = 0; d < 30; d++) {
      for (let h = 8; h <= 22; h++) {
        events.push(makeEvent({ timestamp: new Date(2024, 1, 1 + d, h) }));
      }
      // Extra late activity
      events.push(makeEvent({ timestamp: new Date(2024, 1, 1 + d, 23, 30) }));
    }
    const result = computeSleepDrift(events);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("sleep-drift");
  });
});

describe("computePlatformMigration", () => {
  it("returns null for fewer than 100 events", () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      makeEvent({ timestamp: new Date(2024, 0, 1, i) }),
    );
    expect(computePlatformMigration(events)).toBeNull();
  });

  it("detects a shift from instagram to telegram", () => {
    const events: MetadataEvent[] = [];
    // First half: 80% instagram, 20% telegram
    for (let i = 0; i < 100; i++) {
      const source: Platform = i < 80 ? "instagram" : "telegram";
      events.push(
        makeEvent({ timestamp: new Date(2024, 0, 1, i % 24), source }),
      );
    }
    // Second half: 20% instagram, 80% telegram
    for (let i = 0; i < 100; i++) {
      const source: Platform = i < 20 ? "instagram" : "telegram";
      events.push(
        makeEvent({ timestamp: new Date(2024, 6, 1, i % 24), source }),
      );
    }
    const result = computePlatformMigration(events);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("platform-migration");
  });

  it("returns null when no significant shift", () => {
    const events: MetadataEvent[] = [];
    for (let i = 0; i < 200; i++) {
      events.push(
        makeEvent({
          timestamp: new Date(2024, 0, 1 + Math.floor(i / 10), i % 24),
          source: "whatsapp",
        }),
      );
    }
    expect(computePlatformMigration(events)).toBeNull();
  });
});

describe("computeLateNightContactCorrelation", () => {
  it("returns null for fewer than 100 events", () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      makeEvent({ timestamp: new Date(2024, 0, 1, 10 + (i % 12)) }),
    );
    expect(computeLateNightContactCorrelation(events)).toBeNull();
  });

  it("detects a contact driving late-night increases", () => {
    const events: MetadataEvent[] = [];
    // First half: Alice mostly daytime
    for (let i = 0; i < 80; i++) {
      events.push(
        makeEvent({
          timestamp: new Date(2024, 0, 1 + Math.floor(i / 4), 10 + (i % 8)),
          participants: ["Alice"],
        }),
      );
    }
    // Second half: Alice now heavily at night
    for (let i = 0; i < 80; i++) {
      const hour = i % 2 === 0 ? 23 : 1; // late night
      events.push(
        makeEvent({
          timestamp: new Date(2024, 6, 1 + Math.floor(i / 4), hour),
          participants: ["Alice"],
        }),
      );
    }
    // Add some daytime events in second half so it's not 100% night
    for (let i = 0; i < 20; i++) {
      events.push(
        makeEvent({
          timestamp: new Date(2024, 6, 1 + i, 14),
          participants: ["Bob"],
        }),
      );
    }
    const result = computeLateNightContactCorrelation(events);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("late-night-correlation");
  });
});

describe("computeFirstLastActivity", () => {
  it("returns null for fewer than 50 events", () => {
    const events = Array.from({ length: 10 }, () =>
      makeEvent({ timestamp: new Date(2024, 0, 1, 10) }),
    );
    expect(computeFirstLastActivity(events)).toBeNull();
  });

  it("detects first and last activity times and platforms", () => {
    const events: MetadataEvent[] = [];
    // 14 days, first activity at 7am on Instagram, last at 23pm on WhatsApp
    for (let d = 0; d < 14; d++) {
      events.push(
        makeEvent({
          timestamp: new Date(2024, 0, 1 + d, 7, 0),
          source: "instagram",
        }),
      );
      for (let h = 10; h <= 20; h++) {
        events.push(
          makeEvent({ timestamp: new Date(2024, 0, 1 + d, h), source: "whatsapp" }),
        );
      }
      events.push(
        makeEvent({
          timestamp: new Date(2024, 0, 1 + d, 23, 0),
          source: "telegram",
        }),
      );
    }
    const result = computeFirstLastActivity(events);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("first-last-activity");
    expect(result!.descParams!.firstPlatform).toBe("Instagram");
    expect(result!.descParams!.lastPlatform).toBe("Telegram");
  });
});
