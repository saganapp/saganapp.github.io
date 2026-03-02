import type { ContactRanking, Platform } from "@/parsers/types";
import type { DashboardStats } from "@/hooks/use-dashboard-data";
import type {
  DeviceRecord,
  WorkHoursAnalysis,
  SleepingPattern,
  SocialCircle,
  ReciprocityScore,
  RelationshipTrend,
  RecurringLull,
  ResponseLatency,
} from "@/analysis";

// ─── Section 1: Subject Overview ───

export interface DossierOverview {
  dateRange: string | null; // "Jan 2023 – Jul 2024"
  totalEvents: number;
  platforms: string[];
  estimatedScreenHours: number | null;
  uniqueContacts: number;
  topCategories: { label: string; count: number; pct: number }[];
}

// ─── Section 2: Behavioral Patterns ───

export interface DossierBehavioral {
  sleep: {
    schedule: string | null; // "0:00–7:00"
    chronotype: "night-owl" | "early-bird" | null;
    confidence: number | null; // 0–1
    drift: { minutes: number; direction: "later" | "earlier" } | null;
    firstActivity: string | null;
    lastActivity: string | null;
  };
  lulls: RecurringLull[];
  rhythm: {
    busiestDay: number | null;
    busiestDayPct: number | null; // % above average
    weekendWeekdayRatio: number | null; // weekend events / weekday events
    peakHour: number | null; // 0–23
  };
}

// ─── Section 3: Social Network Analysis ───

export interface DossierSocial {
  network: {
    totalContacts: number;
    innerCircle: string[];
    socialCircles: SocialCircle[];
  };
  dynamics: {
    mostImbalanced: { contact: string; ratio: number } | null;
    responseLatency: { contact: string; yourMedianMs: number; theirMedianMs: number } | null;
    burstContact: { contact: string; bursts: number; avgMessages: number } | null;
  };
  trends: {
    growing: { contact: string; changePct: number }[];
    fading: { contact: string; changePct: number }[];
  };
  circles: {
    lateNightContacts: string[];
    weekendContacts: string[];
  };
}

// ─── Section 4: Work & Productivity ───

export interface DossierWork {
  workHours: {
    distractionMinPerWeek: number | null;
    percentOfWorkHours: number | null;
    byPlatform: { platform: string; minutes: number }[];
  };
  meetings: {
    perWeek: number | null;
  };
}

// ─── Section 5: Digital Footprint ───

export interface DossierDigital {
  platforms: {
    primary: string | null;
    primaryPct: number | null;
    all: string[];
    migration: string | null;
    timeByPlatform: { platform: string; hours: number }[];
  };
  devices: {
    records: { name: string; firstSeen: string; lastSeen: string }[];
    totalEstimatedHours: number | null;
  };
}

// ─── Section 6: Significant Events (grouped) ───

export interface DossierEventItem {
  date: string;
  descriptionKey: string;
  descriptionParams: Record<string, string | number>;
}

export interface DossierEvents {
  activityGaps: DossierEventItem[];
  deviceChanges: DossierEventItem[];
  platformShifts: DossierEventItem[];
  behavioralChanges: DossierEventItem[];
}

// ─── Full Profile ───

export interface DossierProfile {
  overview: DossierOverview;
  behavioral: DossierBehavioral;
  social: DossierSocial;
  work: DossierWork;
  digital: DossierDigital;
  events: DossierEvents;
}

// ─── Builder Input ───

export interface BuildDossierInput {
  stats: DashboardStats;
  contactRankings: ContactRanking[];
  nightContacts: ContactRanking[];
  weekendContacts: ContactRanking[];
  sleepPatterns: SleepingPattern[];
  sleepConfidence: number | null;
  socialCircles: SocialCircle[];
  devices: DeviceRecord[];
  workHoursAnalysis: WorkHoursAnalysis | null;
  reciprocity: ReciprocityScore[];
  trends: RelationshipTrend[];
  responseLatency: ResponseLatency[];
  lulls: RecurringLull[];
  burstContact: { contact: string; bursts: number; avgMessages: number } | null;
  // Pre-computed inference results
  sleepDrift: { minutes: number; direction: "later" | "earlier" } | null;
  firstActivity: string | null;
  lastActivity: string | null;
  platformMigration: string | null;
  activityGaps: { startDate: string; endDate: string; days: number }[];
  chronotype: "night-owl" | "early-bird" | null;
  primaryPlatform: string | null;
  primaryPlatformPct: number | null;
  allPlatforms: string[];
  meetingsPerWeek: number | null;
  busiestDay: number | null;
  busiestDayPct: number | null;
  weekendWeekdayRatio: number | null;
  peakActivityHour: number | null;
  timeByPlatform: Record<Platform, number>;
  activityBreakdown: { label: string; count: number }[];
}

// ─── Builder ───

function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildDossier(input: BuildDossierInput): DossierProfile {
  const {
    stats,
    contactRankings,
    nightContacts,
    weekendContacts,
    sleepPatterns,
    sleepConfidence,
    socialCircles,
    devices,
    workHoursAnalysis,
    reciprocity,
    trends,
    responseLatency,
    lulls,
    burstContact,
    sleepDrift,
    firstActivity,
    lastActivity,
    platformMigration,
    activityGaps,
    chronotype,
    primaryPlatform,
    primaryPlatformPct,
    allPlatforms,
    meetingsPerWeek,
    busiestDay,
    busiestDayPct,
    weekendWeekdayRatio,
    peakActivityHour,
    timeByPlatform,
    activityBreakdown,
  } = input;

  // ── Section 1: Overview ──
  const dateRange = stats.effectiveRange
    ? `${formatMonth(stats.effectiveRange.start)} – ${formatMonth(stats.effectiveRange.end)}`
    : null;

  const totalBreakdown = activityBreakdown.reduce((s, c) => s + c.count, 0);
  const topCategories = activityBreakdown
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => ({
      label: c.label,
      count: c.count,
      pct: totalBreakdown > 0 ? Math.round((c.count / totalBreakdown) * 100) : 0,
    }));

  const overview: DossierOverview = {
    dateRange,
    totalEvents: stats.total,
    platforms: allPlatforms,
    estimatedScreenHours: stats.estimatedTotalTimeSeconds > 0
      ? Math.round(stats.estimatedTotalTimeSeconds / 3600)
      : null,
    uniqueContacts: stats.uniqueContacts,
    topCategories,
  };

  // ── Section 2: Behavioral ──
  const sleepSchedule = sleepPatterns.length > 0
    ? `${sleepPatterns[0].startHour}:00–${sleepPatterns[0].endHour}:00`
    : null;

  const behavioral: DossierBehavioral = {
    sleep: {
      schedule: sleepSchedule,
      chronotype,
      confidence: sleepConfidence,
      drift: sleepDrift,
      firstActivity,
      lastActivity,
    },
    lulls,
    rhythm: {
      busiestDay,
      busiestDayPct,
      weekendWeekdayRatio,
      peakHour: peakActivityHour,
    },
  };

  // ── Section 3: Social ──
  const threshold = stats.total * 0.03;
  const innerCircle = contactRankings
    .filter((r) => r.totalInteractions > threshold)
    .slice(0, 10)
    .map((r) => r.name);

  const lateNightContactNames = nightContacts.slice(0, 5).map((r) => r.name);
  const weekendContactNames = weekendContacts.slice(0, 5).map((r) => r.name);

  const mostImbalanced = reciprocity.length > 0 && Math.abs(reciprocity[0].ratio - 0.5) > 0.15
    ? { contact: reciprocity[0].contact, ratio: reciprocity[0].ratio }
    : null;

  const topLatency = responseLatency.length > 0
    ? { contact: responseLatency[0].contact, yourMedianMs: responseLatency[0].yourMedianMs, theirMedianMs: responseLatency[0].theirMedianMs }
    : null;

  const fadingTrends = trends
    .filter((t) => t.direction === "fading")
    .slice(0, 5)
    .map((t) => ({ contact: t.contact, changePct: t.changePct }));

  const growingTrends = trends
    .filter((t) => t.direction === "growing")
    .slice(0, 5)
    .map((t) => ({ contact: t.contact, changePct: t.changePct }));

  const social: DossierSocial = {
    network: {
      totalContacts: stats.uniqueContacts,
      innerCircle,
      socialCircles,
    },
    dynamics: {
      mostImbalanced,
      responseLatency: topLatency,
      burstContact,
    },
    trends: {
      growing: growingTrends,
      fading: fadingTrends,
    },
    circles: {
      lateNightContacts: lateNightContactNames,
      weekendContacts: weekendContactNames,
    },
  };

  // ── Section 4: Work ──
  const workByPlatform = workHoursAnalysis
    ? Object.entries(workHoursAnalysis.byPlatform)
      .filter(([, secs]) => secs > 0)
      .map(([platform, secs]) => ({ platform, minutes: Math.round(secs / 60) }))
      .sort((a, b) => b.minutes - a.minutes)
    : [];

  const work: DossierWork = {
    workHours: {
      distractionMinPerWeek: workHoursAnalysis ? workHoursAnalysis.weeklyMinutes : null,
      percentOfWorkHours: workHoursAnalysis ? workHoursAnalysis.percentOfWorkHours : null,
      byPlatform: workByPlatform,
    },
    meetings: {
      perWeek: meetingsPerWeek,
    },
  };

  // ── Section 5: Digital ──
  const platformTimeEntries = Object.entries(timeByPlatform)
    .filter(([, secs]) => secs > 0)
    .map(([platform, secs]) => ({ platform, hours: Math.round((secs / 3600) * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours);

  const deviceRecords = devices.map((d) => ({
    name: d.device.model ?? d.device.raw,
    firstSeen: formatMonth(d.firstSeen),
    lastSeen: formatMonth(d.lastSeen),
  }));

  const totalEstimatedHours = stats.estimatedTotalTimeSeconds > 0
    ? Math.round(stats.estimatedTotalTimeSeconds / 3600)
    : null;

  const digital: DossierDigital = {
    platforms: {
      primary: primaryPlatform,
      primaryPct: primaryPlatformPct,
      all: allPlatforms,
      migration: platformMigration,
      timeByPlatform: platformTimeEntries,
    },
    devices: {
      records: deviceRecords,
      totalEstimatedHours,
    },
  };

  // ── Section 6: Events (grouped) ──
  const events: DossierEvents = {
    activityGaps: [],
    deviceChanges: [],
    platformShifts: [],
    behavioralChanges: [],
  };

  for (const gap of activityGaps) {
    events.activityGaps.push({
      date: gap.startDate,
      descriptionKey: "dossier.report.event.gap",
      descriptionParams: { days: gap.days, startDate: gap.startDate, endDate: gap.endDate },
    });
  }

  for (let i = 0; i < devices.length - 1; i++) {
    const current = devices[i];
    const next = devices[i + 1];
    const gapMs = next.firstSeen.getTime() - current.lastSeen.getTime();
    if (gapMs < 30 * 24 * 60 * 60 * 1000) {
      const switchDate = new Date((current.lastSeen.getTime() + next.firstSeen.getTime()) / 2);
      events.deviceChanges.push({
        date: formatMonth(switchDate),
        descriptionKey: "dossier.report.event.deviceSwitch",
        descriptionParams: {
          from: current.device.model ?? current.device.raw,
          to: next.device.model ?? next.device.raw,
        },
      });
    }
  }

  if (platformMigration) {
    events.platformShifts.push({
      date: stats.effectiveRange ? formatMonth(stats.effectiveRange.start) : "",
      descriptionKey: "dossier.report.event.platformShift",
      descriptionParams: { migration: platformMigration },
    });
  }

  if (sleepDrift) {
    events.behavioralChanges.push({
      date: stats.effectiveRange ? formatMonth(stats.effectiveRange.end) : "",
      descriptionKey: "dossier.report.event.sleepChange",
      descriptionParams: { minutes: sleepDrift.minutes, direction: `direction.${sleepDrift.direction}` },
    });
  }

  return { overview, behavioral, social, work, digital, events };
}
