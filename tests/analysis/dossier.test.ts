import { describe, it, expect } from "vitest";
import { buildDossier } from "@/analysis/dossier";
import type { BuildDossierInput } from "@/analysis/dossier";
import type { DashboardStats } from "@/hooks/use-dashboard-data";

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
    sleepPatterns: [
      { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 7, confidence: 0.9, weekCount: 20 },
    ],
    socialCircles: [
      { label: "Work", contacts: ["Alice", "Bob"], dominantTimeWindow: "08-12", dominantPlatform: "whatsapp", weekdayRatio: 0.85 },
      { label: "Night circle", contacts: ["Charlie", "Dave"], dominantTimeWindow: "20-24", dominantPlatform: "telegram", weekdayRatio: 0.5 },
    ],
    devices: [],
    workHoursAnalysis: { totalSeconds: 7200, weeklyMinutes: 5, percentOfWorkHours: 2.5, byPlatform: {} as Record<string, number> },
    reciprocity: [
      { contact: "Alice", sent: 80, received: 20, ratio: 0.8 },
    ],
    trends: [
      { contact: "Bob", recentCount: 5, priorCount: 30, changePct: -83, direction: "fading" },
      { contact: "Alice", recentCount: 40, priorCount: 20, changePct: 100, direction: "growing" },
    ],
    sleepDrift: { minutes: 90, direction: "later" },
    firstActivity: "07:30",
    lastActivity: "23:15",
    platformMigration: "Instagram → Telegram",
    activityGaps: [
      { startDate: "2024-03-10", endDate: "2024-03-17", days: 7 },
    ],
    chronotype: "night-owl",
    primaryPlatform: "WhatsApp",
    allPlatforms: ["WhatsApp", "Telegram", "Instagram"],
    meetingsPerWeek: 8.5,
    busiestDay: 3,
    ...overrides,
  };
}

describe("buildDossier", () => {
  it("builds a complete dossier profile", () => {
    const dossier = buildDossier(makeInput());

    // Personal Habits
    expect(dossier.personalHabits.sleepSchedule).toBe("0:00–7:00");
    expect(dossier.personalHabits.chronotype).toBe("night-owl");
    expect(dossier.personalHabits.sleepDrift).toEqual({ minutes: 90, direction: "later" });
    expect(dossier.personalHabits.firstActivity).toBe("07:30");
    expect(dossier.personalHabits.lastActivity).toBe("23:15");

    // Social Network
    expect(dossier.socialNetwork.totalContacts).toBe(25);
    expect(dossier.socialNetwork.innerCircle).toContain("Alice");
    expect(dossier.socialNetwork.lateNightContacts).toContain("Charlie");
    expect(dossier.socialNetwork.socialCircles).toHaveLength(2);
    expect(dossier.socialNetwork.mostImbalanced?.contact).toBe("Alice");
    expect(dossier.socialNetwork.fadingContacts).toContain("Bob");
    expect(dossier.socialNetwork.growingContacts).toContain("Alice");

    // Work Profile
    expect(dossier.workProfile.estimatedWorkHours).toBe(2);
    expect(dossier.workProfile.distractionMinutesPerWeek).toBe(5);
    expect(dossier.workProfile.meetingsPerWeek).toBe(8.5);
    expect(dossier.workProfile.busiestDay).toBe(3);

    // Digital Profile
    expect(dossier.digitalProfile.primaryPlatform).toBe("WhatsApp");
    expect(dossier.digitalProfile.platforms).toHaveLength(3);
    expect(dossier.digitalProfile.platformMigration).toBe("Instagram → Telegram");
    expect(dossier.digitalProfile.totalEstimatedHours).toBe(10);

    // Life Events
    expect(dossier.lifeEvents.length).toBeGreaterThanOrEqual(1);
    const gapEvent = dossier.lifeEvents.find((e) => e.type === "gap");
    expect(gapEvent).toBeDefined();
    expect(gapEvent!.descriptionKey).toBe("dossier.timeline.gap.desc");
    expect(gapEvent!.descriptionParams).toEqual({ days: 7, startDate: "2024-03-10", endDate: "2024-03-17" });
  });

  it("handles empty/minimal data gracefully", () => {
    const dossier = buildDossier(makeInput({
      sleepPatterns: [],
      socialCircles: [],
      devices: [],
      workHoursAnalysis: null,
      reciprocity: [],
      trends: [],
      sleepDrift: null,
      firstActivity: null,
      lastActivity: null,
      platformMigration: null,
      activityGaps: [],
      chronotype: null,
      meetingsPerWeek: null,
    }));

    expect(dossier.personalHabits.sleepSchedule).toBeNull();
    expect(dossier.personalHabits.chronotype).toBeNull();
    expect(dossier.socialNetwork.socialCircles).toHaveLength(0);
    expect(dossier.socialNetwork.mostImbalanced).toBeNull();
    expect(dossier.workProfile.distractionMinutesPerWeek).toBeNull();
    expect(dossier.digitalProfile.platformMigration).toBeNull();
    expect(dossier.lifeEvents).toHaveLength(0);
  });

  it("sorts life events chronologically", () => {
    const dossier = buildDossier(makeInput({
      activityGaps: [
        { startDate: "2024-06-01", endDate: "2024-06-05", days: 4 },
        { startDate: "2024-02-01", endDate: "2024-02-04", days: 3 },
      ],
    }));

    const dates = dossier.lifeEvents.map((e) => e.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });
});
