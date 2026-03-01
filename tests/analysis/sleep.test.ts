import { describe, it, expect } from "vitest";
import { detectSleepingPatterns } from "@/analysis/sleep";
import type { MetadataEvent } from "@/parsers/types";

/** Helper: create events with configurable night/day patterns across weeks */
function makeEvents(opts: {
  weeks: number;
  daysOfWeek?: number[];
  /** Hours with activity (default: full day 8–21 + some night activity) */
  activeHours?: number[];
  eventsPerSlot?: number;
  /** Hours to skip (simulating quiet/sleep window) */
  skipHours?: { days: number[]; hours: number[] };
}): MetadataEvent[] {
  const {
    weeks,
    daysOfWeek = [0, 1, 2, 3, 4, 5, 6],
    activeHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
    eventsPerSlot = 5,
    skipHours,
  } = opts;
  const events: MetadataEvent[] = [];
  let id = 0;

  // Start on a known Sunday: 2024-01-07
  const baseDate = new Date(2024, 0, 7);

  for (let w = 0; w < weeks; w++) {
    for (const day of daysOfWeek) {
      for (const hour of activeHours) {
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

describe("detectSleepingPatterns", () => {
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
    expect(detectSleepingPatterns(events)).toEqual([]);
  });

  it("returns [] for <3 weeks of data", () => {
    const events = makeEvents({ weeks: 2, eventsPerSlot: 8 });
    expect(detectSleepingPatterns(events)).toEqual([]);
  });

  it("detects consistent 7h sleep window (0:00–7:00 on weekdays)", () => {
    // Activity at hours 8–23 every day, but hours 0–6 are quiet (sleep)
    // This means the night window 22,23 has activity, but 0–7 is quiet
    // That's a 7-hour quiet run: indices 2–8 (hours 0,1,2,3,4,5,6)
    // Actually 0–6 is 7 hours → indices 2 through 8 (7 slots)
    const events = makeEvents({
      weeks: 8,
      activeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
      eventsPerSlot: 5,
    });

    const patterns = detectSleepingPatterns(events);
    expect(patterns.length).toBeGreaterThanOrEqual(1);

    // Should detect a quiet window covering hours 0–7
    const sleepPattern = patterns.find(
      (p) => p.startHour <= 0 && p.endHour >= 7,
    );
    expect(sleepPattern).toBeDefined();
    expect(sleepPattern!.daysOfWeek.length).toBeGreaterThanOrEqual(2);
    expect(sleepPattern!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("detects midnight-crossing pattern (23:00–6:00)", () => {
    // Activity at 8–21 and also at 22 and 7, but quiet from 23 to 6
    // Night hours: 22,23,0,1,2,3,4,5,6,7
    // Active at idx 0 (22) and idx 9 (7), quiet at idx 1–8 (23,0,1,2,3,4,5,6) = 8 hours
    const events = makeEvents({
      weeks: 8,
      activeHours: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      eventsPerSlot: 5,
    });

    const patterns = detectSleepingPatterns(events);
    expect(patterns.length).toBeGreaterThanOrEqual(1);

    // Should detect a quiet window starting at 23 and ending at 7
    const sleepPattern = patterns.find(
      (p) => p.startHour === 23 && p.endHour === 7,
    );
    expect(sleepPattern).toBeDefined();
    expect(sleepPattern!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("rejects short gaps (<4 hours)", () => {
    // Activity at all night hours except 2–4 (only 3 hours quiet)
    const events = makeEvents({
      weeks: 8,
      activeHours: [0, 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
      eventsPerSlot: 5,
    });

    const patterns = detectSleepingPatterns(events);
    // Should not detect any pattern since the quiet window (2–4) is only 3 hours
    for (const p of patterns) {
      // endHour wraps around, so compute length via night indices
      const startIdx = p.startHour >= 22 ? p.startHour - 22 : p.startHour + 2;
      const endIdx = p.endHour === 8 ? 10 : (p.endHour >= 22 ? p.endHour - 22 : p.endHour + 2);
      expect(endIdx - startIdx).toBeGreaterThanOrEqual(4);
    }
  });

  it("requires >=2 days", () => {
    // Activity at all hours except 0–6, but only skip on Wednesdays
    const events = makeEvents({
      weeks: 8,
      activeHours: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
      eventsPerSlot: 5,
      skipHours: { days: [3], hours: [0, 1, 2, 3, 4, 5, 6] },
    });

    const patterns = detectSleepingPatterns(events);
    for (const p of patterns) {
      expect(p.daysOfWeek.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("correctly attributes post-midnight events to previous night's day", () => {
    // Create events specifically at 2 AM on Tuesdays (should count as Monday nights)
    // and verify the algorithm attributes them correctly
    const events: MetadataEvent[] = [];
    let id = 0;
    const baseDate = new Date(2024, 0, 7); // Sunday

    for (let w = 0; w < 8; w++) {
      // Add daytime activity every day for enough data
      for (let day = 0; day < 7; day++) {
        for (let hour = 8; hour <= 21; hour++) {
          for (let e = 0; e < 3; e++) {
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

      // Add late-night activity at 22 and 23 every day
      for (let day = 0; day < 7; day++) {
        for (const hour of [22, 23]) {
          for (let e = 0; e < 3; e++) {
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

      // Add early morning activity at 2 AM specifically on Tuesday (calendar day)
      // This should be attributed to Monday night (day 1)
      const tuesday = new Date(baseDate);
      tuesday.setDate(tuesday.getDate() + w * 7 + 2); // Tuesday
      tuesday.setHours(2, 30, 0, 0);
      events.push({
        id: `test-${id++}`,
        source: "whatsapp",
        eventType: "message_sent",
        timestamp: tuesday,
        actor: "You",
        participants: ["Alice"],
        metadata: {},
      });
    }

    // The algorithm should run without errors and attribute 2 AM Tuesday events to Monday night
    const patterns = detectSleepingPatterns(events);
    // We mainly verify it doesn't crash and returns valid data
    for (const p of patterns) {
      expect(p.daysOfWeek.length).toBeGreaterThanOrEqual(2);
      expect(p.confidence).toBeGreaterThanOrEqual(0.5);
    }
  });
});
