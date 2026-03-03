import { describe, it, expect } from "vitest";
import { detectRecurringLulls } from "@/analysis/lulls";
import { generateDemoData } from "@/demo/generate";
import type { MetadataEvent } from "@/parsers/types";

/** Helper: create events spread across multiple weeks */
function makeEvents(opts: {
  weeks: number;
  daysOfWeek?: number[];
  hours?: number[];
  eventsPerSlot?: number;
  skipHours?: { days: number[]; hours: number[] };
}): MetadataEvent[] {
  const {
    weeks,
    daysOfWeek = [0, 1, 2, 3, 4, 5, 6],
    hours = Array.from({ length: 15 }, (_, i) => i + 8), // 8–22
    eventsPerSlot = 5,
    skipHours,
  } = opts;
  const events: MetadataEvent[] = [];
  let id = 0;

  // Start on a known Sunday: 2024-01-07
  const baseDate = new Date(2024, 0, 7);

  for (let w = 0; w < weeks; w++) {
    for (const day of daysOfWeek) {
      for (const hour of hours) {
        // Check if this (day, hour) should be skipped
        if (skipHours && skipHours.days.includes(day) && skipHours.hours.includes(hour)) {
          continue;
        }
        for (let e = 0; e < eventsPerSlot; e++) {
          const date = new Date(baseDate);
          date.setDate(date.getDate() + w * 7 + day);
          date.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
          events.push({
            id: `test-${id++}`,
            source: "whatsapp",
            eventType: "message_sent",
            timestamp: date,
            actor: "You",
            participants: ["Alice"],
            metadata: {},
          });
        }
      }
    }
  }
  return events;
}

describe("detectRecurringLulls", () => {
  it("returns [] for <50 events", () => {
    const events: MetadataEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      source: "whatsapp" as const,
      eventType: "message_sent" as const,
      timestamp: new Date(2024, 0, 7 + i, 10),
      actor: "You",
      participants: ["Alice"],
      metadata: {},
    }));
    expect(detectRecurringLulls(events)).toEqual([]);
  });

  it("returns [] for <3 weeks of data", () => {
    // 2 weeks of data, plenty of events
    const events = makeEvents({ weeks: 2, eventsPerSlot: 8 });
    expect(detectRecurringLulls(events)).toEqual([]);
  });

  it("detects a weekday lunch lull (1h window across 5 days)", () => {
    // Normal activity 7–22 every day, but skip hour 12 on weekdays
    const events = makeEvents({
      weeks: 8,
      eventsPerSlot: 5,
      skipHours: { days: [1, 2, 3, 4, 5], hours: [12] },
    });

    const lulls = detectRecurringLulls(events);
    expect(lulls.length).toBeGreaterThanOrEqual(1);

    const lunchLull = lulls.find(
      (l) => l.startHour === 12 && l.endHour === 13,
    );
    expect(lunchLull).toBeDefined();
    expect(lunchLull!.daysOfWeek.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(lunchLull!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("does not return overnight gaps", () => {
    // Activity only during 9–17, which means 7-8 and 18-22 are quiet
    // but those quiet periods are outside the 1–2h window or at edges
    const events = makeEvents({
      weeks: 8,
      hours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
      eventsPerSlot: 5,
    });

    const lulls = detectRecurringLulls(events);
    // Should not detect gaps at 7-8 or 18-22 since those are long multi-hour quiet periods
    for (const l of lulls) {
      const length = l.endHour - l.startHour;
      expect(length).toBeLessThanOrEqual(2);
      expect(length).toBeGreaterThanOrEqual(1);
    }
  });

  it("allows single-day patterns (requires >=1 day)", () => {
    // Only skip hour 12 on Wednesday (day 3) — should create a lull
    const events = makeEvents({
      weeks: 8,
      eventsPerSlot: 5,
      skipHours: { days: [3], hours: [12] },
    });

    const lulls = detectRecurringLulls(events);
    for (const l of lulls) {
      expect(l.daysOfWeek.length).toBeGreaterThanOrEqual(1);
    }
    // A Wednesday-at-12 lull should now be detected
    const wednesdayOnly = lulls.find(
      (l) => l.startHour === 12 && l.daysOfWeek.length === 1 && l.daysOfWeek[0] === 3,
    );
    expect(wednesdayOnly).toBeDefined();
  });

  it("rejects 3h windows (max gap is 2 hours)", () => {
    // Skip hours 12, 13, 14 on weekdays — 3h window too large
    const events = makeEvents({
      weeks: 8,
      eventsPerSlot: 5,
      skipHours: { days: [1, 2, 3, 4, 5], hours: [12, 13, 14] },
    });

    const lulls = detectRecurringLulls(events);
    for (const l of lulls) {
      const length = l.endHour - l.startHour;
      expect(length).toBeLessThanOrEqual(2);
    }
  });

  it("confidence reflects week count", () => {
    const events = makeEvents({
      weeks: 10,
      eventsPerSlot: 5,
      skipHours: { days: [1, 2, 3, 4, 5], hours: [12] },
    });

    const lulls = detectRecurringLulls(events);
    expect(lulls.length).toBeGreaterThanOrEqual(1);
    const best = lulls[0];
    // weekCount should be close to totalWeeks
    expect(best.weekCount).toBeGreaterThanOrEqual(5);
    expect(best.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("detects lunch lull in demo data (integration)", () => {
    const demoEvents = generateDemoData({ seed: 42 });
    const lulls = detectRecurringLulls(demoEvents);

    expect(lulls.length).toBeGreaterThanOrEqual(1);

    // Find the lunch lull covering hour 12
    const lunchLull = lulls.find(
      (l) => l.startHour <= 12 && l.endHour >= 13,
    );
    expect(lunchLull).toBeDefined();

    // Most weekdays (Mon=1 through Fri=5) should be detected
    const weekdays = lunchLull!.daysOfWeek.filter((d) => d >= 1 && d <= 5);
    expect(weekdays.length).toBeGreaterThanOrEqual(4);

    expect(lunchLull!.confidence).toBeGreaterThanOrEqual(0.5);
  });
});
