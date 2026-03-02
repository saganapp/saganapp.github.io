import { describe, it, expect } from "vitest";
import { buildDossier } from "@/analysis/dossier";
import type { BuildDossierInput } from "@/analysis/dossier";
import type { DashboardStats } from "@/hooks/use-dashboard-data";
import type { Platform } from "@/parsers/types";

function makeInput(overrides?: Partial<BuildDossierInput>): BuildDossierInput {
  const defaultStats: DashboardStats = {
    total: 500,
    totalUserTriggered: 400,
    totalWithAggregates: 500,
    dateRange: { start: new Date(2024, 0, 1), end: new Date(2024, 6, 1) },
    effectiveRange: { start: new Date(2024, 0, 1), end: new Date(2024, 6, 1) },
    outlierCount: 0,
    estimatedTotalTimeSeconds: 36000,
    uniqueContacts: 25,
    topCategories: [],
  };

  return {
    stats: defaultStats,
    contactRankings: [
      {
        name: "Alice",
        totalInteractions: 100,
        platforms: ["whatsapp"],
        estimatedTimeSeconds: 5000,
        byTimeWindow: { "08-12": 50, "12-16": 30, "16-20": 20, "20-24": 0, "00-04": 0, "04-08": 0 },
        nightInteractions: 5,
        weekendInteractions: 10,
        byCategory: { Messages: 80, Calls: 20 },
      },
      {
        name: "Bob",
        totalInteractions: 50,
        platforms: ["telegram"],
        estimatedTimeSeconds: 2000,
        byTimeWindow: { "08-12": 20, "12-16": 15, "16-20": 10, "20-24": 5, "00-04": 0, "04-08": 0 },
        nightInteractions: 2,
        weekendInteractions: 5,
        byCategory: { Messages: 40, Calls: 10 },
      },
    ],
    nightContacts: [
      {
        name: "Charlie",
        totalInteractions: 30,
        platforms: ["whatsapp"],
        estimatedTimeSeconds: 1000,
        byTimeWindow: { "08-12": 5, "12-16": 5, "16-20": 5, "20-24": 10, "00-04": 5, "04-08": 0 },
        nightInteractions: 15,
        weekendInteractions: 3,
        byCategory: { Messages: 30 },
      },
    ],
    weekendContacts: [
      {
        name: "Dave",
        totalInteractions: 20,
        platforms: ["whatsapp"],
        estimatedTimeSeconds: 800,
        byTimeWindow: { "08-12": 5, "12-16": 5, "16-20": 5, "20-24": 5, "00-04": 0, "04-08": 0 },
        nightInteractions: 2,
        weekendInteractions: 12,
        byCategory: { Messages: 20 },
      },
    ],
    sleepPatterns: [
      { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 7, confidence: 0.9, weekCount: 20 },
    ],
    sleepConfidence: 0.9,
    socialCircles: [
      { label: "Work", contacts: ["Alice", "Bob"], dominantTimeWindow: "08-12", dominantPlatform: "whatsapp", weekdayRatio: 0.85 },
      { label: "Night circle", contacts: ["Charlie", "Dave"], dominantTimeWindow: "20-24", dominantPlatform: "telegram", weekdayRatio: 0.5 },
    ],
    devices: [],
    workHoursAnalysis: { totalSeconds: 7200, weeklyMinutes: 5, percentOfWorkHours: 2.5, byPlatform: {} as Record<Platform, number> },
    reciprocity: [
      { contact: "Alice", sent: 80, received: 20, ratio: 0.8 },
    ],
    trends: [
      { contact: "Bob", recentCount: 5, priorCount: 30, changePct: -83, direction: "fading" },
      { contact: "Alice", recentCount: 40, priorCount: 20, changePct: 100, direction: "growing" },
    ],
    responseLatency: [
      { contact: "Alice", yourMedianMs: 60000, theirMedianMs: 300000, pairCount: 20 },
    ],
    lulls: [
      { daysOfWeek: [1, 3], startHour: 10, endHour: 12, confidence: 0.75, weekCount: 15 },
    ],
    burstContact: { contact: "Charlie", bursts: 5, avgMessages: 12 },
    sleepDrift: { minutes: 90, direction: "later" },
    firstActivity: "07:30",
    lastActivity: "23:15",
    platformMigration: "Instagram → Telegram",
    activityGaps: [
      { startDate: "2024-03-10", endDate: "2024-03-17", days: 7 },
    ],
    chronotype: "night-owl",
    primaryPlatform: "WhatsApp",
    primaryPlatformPct: 65,
    allPlatforms: ["WhatsApp", "Telegram", "Instagram"],
    meetingsPerWeek: 8.5,
    busiestDay: 3,
    busiestDayPct: 42,
    weekendWeekdayRatio: 0.7,
    peakActivityHour: 14,
    timeByPlatform: { whatsapp: 18000, telegram: 7200, instagram: 3600 } as Record<Platform, number>,
    activityBreakdown: [
      { label: "Messages", count: 300 },
      { label: "Calls", count: 100 },
      { label: "Media", count: 50 },
    ],
    ...overrides,
  };
}

describe("buildDossier", () => {
  it("builds a complete dossier profile with all 6 sections", () => {
    const dossier = buildDossier(makeInput());

    // Section 1: Overview
    expect(dossier.overview.totalEvents).toBe(500);
    expect(dossier.overview.uniqueContacts).toBe(25);
    expect(dossier.overview.platforms).toHaveLength(3);
    expect(dossier.overview.estimatedScreenHours).toBe(10);
    expect(dossier.overview.topCategories.length).toBeGreaterThan(0);
    expect(dossier.overview.topCategories[0].label).toBe("Messages");

    // Section 2: Behavioral
    expect(dossier.behavioral.sleep.schedule).toBe("0:00–7:00");
    expect(dossier.behavioral.sleep.chronotype).toBe("night-owl");
    expect(dossier.behavioral.sleep.confidence).toBe(0.9);
    expect(dossier.behavioral.sleep.drift).toEqual({ minutes: 90, direction: "later" });
    expect(dossier.behavioral.sleep.firstActivity).toBe("07:30");
    expect(dossier.behavioral.sleep.lastActivity).toBe("23:15");
    expect(dossier.behavioral.lulls).toHaveLength(1);
    expect(dossier.behavioral.rhythm.busiestDay).toBe(3);
    expect(dossier.behavioral.rhythm.busiestDayPct).toBe(42);
    expect(dossier.behavioral.rhythm.weekendWeekdayRatio).toBe(0.7);
    expect(dossier.behavioral.rhythm.peakHour).toBe(14);

    // Section 3: Social
    expect(dossier.social.network.totalContacts).toBe(25);
    expect(dossier.social.network.innerCircle).toContain("Alice");
    expect(dossier.social.network.socialCircles).toHaveLength(2);
    expect(dossier.social.dynamics.mostImbalanced?.contact).toBe("Alice");
    expect(dossier.social.dynamics.responseLatency?.contact).toBe("Alice");
    expect(dossier.social.dynamics.burstContact?.contact).toBe("Charlie");
    expect(dossier.social.trends.fading).toContainEqual({ contact: "Bob", changePct: -83 });
    expect(dossier.social.trends.growing).toContainEqual({ contact: "Alice", changePct: 100 });
    expect(dossier.social.circles.lateNightContacts).toContain("Charlie");
    expect(dossier.social.circles.weekendContacts).toContain("Dave");

    // Section 4: Work
    expect(dossier.work.workHours.distractionMinPerWeek).toBe(5);
    expect(dossier.work.workHours.percentOfWorkHours).toBe(2.5);
    expect(dossier.work.meetings.perWeek).toBe(8.5);

    // Section 5: Digital
    expect(dossier.digital.platforms.primary).toBe("WhatsApp");
    expect(dossier.digital.platforms.primaryPct).toBe(65);
    expect(dossier.digital.platforms.all).toHaveLength(3);
    expect(dossier.digital.platforms.migration).toBe("Instagram → Telegram");
    expect(dossier.digital.platforms.timeByPlatform.length).toBeGreaterThan(0);
    expect(dossier.digital.devices.totalEstimatedHours).toBe(10);

    // Section 6: Events
    expect(dossier.events.activityGaps).toHaveLength(1);
    expect(dossier.events.activityGaps[0].descriptionKey).toBe("dossier.report.event.gap");
    expect(dossier.events.platformShifts).toHaveLength(1);
    expect(dossier.events.behavioralChanges).toHaveLength(1);
  });

  it("handles empty/minimal data gracefully", () => {
    const dossier = buildDossier(makeInput({
      sleepPatterns: [],
      sleepConfidence: null,
      socialCircles: [],
      devices: [],
      workHoursAnalysis: null,
      reciprocity: [],
      trends: [],
      responseLatency: [],
      lulls: [],
      burstContact: null,
      sleepDrift: null,
      firstActivity: null,
      lastActivity: null,
      platformMigration: null,
      activityGaps: [],
      chronotype: null,
      meetingsPerWeek: null,
      weekendWeekdayRatio: null,
      peakActivityHour: null,
      busiestDayPct: null,
      timeByPlatform: {} as Record<Platform, number>,
      activityBreakdown: [],
    }));

    expect(dossier.behavioral.sleep.schedule).toBeNull();
    expect(dossier.behavioral.sleep.chronotype).toBeNull();
    expect(dossier.behavioral.sleep.confidence).toBeNull();
    expect(dossier.behavioral.lulls).toHaveLength(0);
    expect(dossier.social.network.socialCircles).toHaveLength(0);
    expect(dossier.social.dynamics.mostImbalanced).toBeNull();
    expect(dossier.social.dynamics.responseLatency).toBeNull();
    expect(dossier.social.dynamics.burstContact).toBeNull();
    expect(dossier.work.workHours.distractionMinPerWeek).toBeNull();
    expect(dossier.digital.platforms.migration).toBeNull();
    expect(dossier.events.activityGaps).toHaveLength(0);
    expect(dossier.events.platformShifts).toHaveLength(0);
    expect(dossier.events.behavioralChanges).toHaveLength(0);
  });

  it("groups events by type correctly", () => {
    const dossier = buildDossier(makeInput({
      activityGaps: [
        { startDate: "2024-06-01", endDate: "2024-06-05", days: 4 },
        { startDate: "2024-02-01", endDate: "2024-02-04", days: 3 },
      ],
    }));

    expect(dossier.events.activityGaps).toHaveLength(2);
    expect(dossier.events.platformShifts).toHaveLength(1);
    expect(dossier.events.behavioralChanges).toHaveLength(1);
  });
});
