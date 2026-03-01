import type { ContactRanking } from "@/parsers/types";
import type { DashboardStats } from "@/hooks/use-dashboard-data";
import type { DeviceRecord, WorkHoursAnalysis, SleepingPattern, SocialCircle, ReciprocityScore, RelationshipTrend } from "@/analysis";

export interface DossierProfile {
  personalHabits: {
    sleepSchedule: string | null;
    chronotype: "night-owl" | "early-bird" | null;
    sleepDrift: { minutes: number; direction: "later" | "earlier" } | null;
    firstActivity: string | null;
    lastActivity: string | null;
  };
  socialNetwork: {
    innerCircle: string[];
    totalContacts: number;
    lateNightContacts: string[];
    socialCircles: SocialCircle[];
    mostImbalanced: { contact: string; ratio: number } | null;
    fadingContacts: string[];
    growingContacts: string[];
  };
  workProfile: {
    estimatedWorkHours: number | null;
    distractionMinutesPerWeek: number | null;
    meetingsPerWeek: number | null;
    busiestDay: number | null;
  };
  digitalProfile: {
    primaryPlatform: string | null;
    platforms: string[];
    devices: string[];
    platformMigration: string | null;
    totalEstimatedHours: number | null;
  };
  lifeEvents: DossierLifeEvent[];
}

export interface DossierLifeEvent {
  date: string;
  type: "gap" | "device-switch" | "platform-shift" | "sleep-change";
  descriptionKey: string;
  descriptionParams: Record<string, string | number>;
}

export interface BuildDossierInput {
  stats: DashboardStats;
  contactRankings: ContactRanking[];
  nightContacts: ContactRanking[];
  sleepPatterns: SleepingPattern[];
  socialCircles: SocialCircle[];
  devices: DeviceRecord[];
  workHoursAnalysis: WorkHoursAnalysis | null;
  reciprocity: ReciprocityScore[];
  trends: RelationshipTrend[];
  // Pre-computed inference results to extract data from
  sleepDrift: { minutes: number; direction: "later" | "earlier" } | null;
  firstActivity: string | null;
  lastActivity: string | null;
  platformMigration: string | null;
  activityGaps: { startDate: string; endDate: string; days: number }[];
  chronotype: "night-owl" | "early-bird" | null;
  primaryPlatform: string | null;
  allPlatforms: string[];
  meetingsPerWeek: number | null;
  busiestDay: number | null;
}

export function buildDossier(input: BuildDossierInput): DossierProfile {
  const {
    stats,
    contactRankings,
    nightContacts,
    sleepPatterns,
    socialCircles,
    devices,
    workHoursAnalysis,
    reciprocity,
    trends,
    sleepDrift,
    firstActivity,
    lastActivity,
    platformMigration,
    activityGaps,
    chronotype,
    primaryPlatform,
    allPlatforms,
    meetingsPerWeek,
    busiestDay,
  } = input;

  // Personal Habits
  const sleepSchedule = sleepPatterns.length > 0
    ? `${sleepPatterns[0].startHour}:00–${sleepPatterns[0].endHour}:00`
    : null;

  // Social Network
  const threshold = stats.total * 0.03;
  const innerCircle = contactRankings
    .filter((r) => r.totalInteractions > threshold)
    .slice(0, 10)
    .map((r) => r.name);

  const lateNightContactNames = nightContacts.slice(0, 5).map((r) => r.name);

  const mostImbalanced = reciprocity.length > 0 && Math.abs(reciprocity[0].ratio - 0.5) > 0.15
    ? { contact: reciprocity[0].contact, ratio: reciprocity[0].ratio }
    : null;

  const fadingContacts = trends
    .filter((t) => t.direction === "fading")
    .slice(0, 5)
    .map((t) => t.contact);

  const growingContacts = trends
    .filter((t) => t.direction === "growing")
    .slice(0, 5)
    .map((t) => t.contact);

  // Work Profile
  const distractionMinutesPerWeek = workHoursAnalysis
    ? workHoursAnalysis.weeklyMinutes
    : null;

  const estimatedWorkHours = workHoursAnalysis
    ? workHoursAnalysis.totalSeconds / 3600
    : null;

  // Digital Profile
  const deviceNames = devices.map((d) => d.device.model ?? d.device.raw);
  const totalEstimatedHours = stats.estimatedTotalTimeSeconds > 0
    ? stats.estimatedTotalTimeSeconds / 3600
    : null;

  // Life Events
  const lifeEvents: DossierLifeEvent[] = [];

  for (const gap of activityGaps) {
    lifeEvents.push({
      date: gap.startDate,
      type: "gap",
      descriptionKey: "dossier.timeline.gap.desc",
      descriptionParams: { days: gap.days, startDate: gap.startDate, endDate: gap.endDate },
    });
  }

  // Device switches
  for (let i = 0; i < devices.length - 1; i++) {
    const current = devices[i];
    const next = devices[i + 1];
    const gapMs = next.firstSeen.getTime() - current.lastSeen.getTime();
    if (gapMs < 30 * 24 * 60 * 60 * 1000) {
      const switchDate = new Date((current.lastSeen.getTime() + next.firstSeen.getTime()) / 2);
      const dateStr = `${switchDate.getFullYear()}-${String(switchDate.getMonth() + 1).padStart(2, "0")}`;
      lifeEvents.push({
        date: dateStr,
        type: "device-switch",
        descriptionKey: "dossier.timeline.deviceSwitch.desc",
        descriptionParams: { from: current.device.model ?? current.device.raw, to: next.device.model ?? next.device.raw },
      });
    }
  }

  if (platformMigration) {
    lifeEvents.push({
      date: stats.effectiveRange
        ? `${stats.effectiveRange.start.getFullYear()}-${String(stats.effectiveRange.start.getMonth() + 1).padStart(2, "0")}`
        : "",
      type: "platform-shift",
      descriptionKey: "dossier.timeline.platformShift.desc",
      descriptionParams: { migration: platformMigration },
    });
  }

  if (sleepDrift) {
    lifeEvents.push({
      date: stats.effectiveRange
        ? `${stats.effectiveRange.end.getFullYear()}-${String(stats.effectiveRange.end.getMonth() + 1).padStart(2, "0")}`
        : "",
      type: "sleep-change",
      descriptionKey: "dossier.timeline.sleepChange.desc",
      descriptionParams: { minutes: sleepDrift.minutes, direction: sleepDrift.direction },
    });
  }

  lifeEvents.sort((a, b) => a.date.localeCompare(b.date));

  return {
    personalHabits: {
      sleepSchedule,
      chronotype,
      sleepDrift,
      firstActivity,
      lastActivity,
    },
    socialNetwork: {
      innerCircle,
      totalContacts: stats.uniqueContacts,
      lateNightContacts: lateNightContactNames,
      socialCircles,
      mostImbalanced,
      fadingContacts,
      growingContacts,
    },
    workProfile: {
      estimatedWorkHours,
      distractionMinutesPerWeek,
      meetingsPerWeek,
      busiestDay,
    },
    digitalProfile: {
      primaryPlatform,
      platforms: allPlatforms,
      devices: deviceNames,
      platformMigration,
      totalEstimatedHours,
    },
    lifeEvents,
  };
}
