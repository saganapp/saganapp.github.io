import { useState, useEffect } from "react";
import type { Platform, MetadataEvent, DailyAggregate, ContactRanking, MacroEvent } from "@/parsers/types";
import { PLATFORMS } from "@/parsers/types";
import { getAllEvents, getDailyAggregates } from "@/store/db";
import { useAppStore } from "@/store/app-store";
import { getDemoEvents } from "@/demo/load-demo";
import { useLocale } from "@/i18n";
import type { TranslationParams } from "@/i18n";
import { PLATFORM_META } from "@/utils/platform";
import { getDateKey } from "@/utils/time";
import {
  filterUserTriggered,
  estimateTotalTime,
  estimateWorkHoursWasted,
  rankContacts,
  getNightOwlContacts,
  getWeekendContacts,
  detectMacroEvents,
  extractDevices,
  buildDeviceTimeline,
  detectRecurringLulls,
  detectSleepingPatterns,
  computeInferences,
  computeQuietPeriods,
  computeCountryDataWithGeoIp,
} from "@/analysis";
import type { WorkHoursAnalysis, DeviceRecord, DeviceTimelineMonth, RecurringLull, SleepingPattern, SocialCircle, CountryData } from "@/analysis";
import { computeSocialCircles } from "@/analysis";

export interface DashboardStats {
  total: number;
  totalUserTriggered: number;
  totalWithAggregates: number;
  dateRange: { start: Date; end: Date } | null;
  effectiveRange: { start: Date; end: Date } | null;
  outlierCount: number;
  estimatedTotalTimeSeconds: number;
  uniqueContacts: number;
  topCategories: { label: string; count: number }[];
}

export interface TimelineSeries {
  id: string;
  data: { x: string; y: number }[];
}

export interface HeatmapRow {
  id: string;
  data: { x: string; y: number }[];
}

export interface ActivityBreakdownItem {
  label: string;
  count: number;
  color: string;
  [key: string]: string | number;
}

export interface PlatformBreakdownItem {
  platform: string;
  count: number;
  color: string;
  [key: string]: string | number;
}

export interface InferenceCard {
  id: string;
  titleKey: string;
  titleParams?: TranslationParams;
  descKey: string;
  descParams?: TranslationParams;
  privacyKey: string;
  icon: "moon" | "sun" | "activity" | "users" | "calendar" | "briefcase" | "pause" | "message-circle" | "hourglass" | "clock" | "mail" | "search" | "bar-chart" | "plane" | "trending-up" | "arrow-right-left" | "smartphone" | "scale" | "trending-down" | "timer" | "circle-dot" | "headphones";
}

// Colors for activity breakdown — cross-platform
const CATEGORY_COLORS: Record<string, string> = {
  "category.Messages": "var(--platform-whatsapp)",
  "category.Reactions": "var(--platform-instagram)",
  "category.Media": "var(--platform-tiktok)",
  "category.Calls": "var(--platform-telegram)",
  "category.Browsing": "var(--platform-google)",
  "category.Search": "var(--platform-twitter)",
  "category.Stories": "var(--platform-instagram)",
  "category.Calendar": "#8e24aa",
  "category.Social": "#00897b",
  "category.Wellness": "var(--platform-garmin)",
  "category.Music": "var(--platform-spotify)",
  "category.Other": "#78909c",
};

function computeEffectiveRange(events: MetadataEvent[]): {
  effectiveRange: { start: Date; end: Date } | null;
  totalRange: { start: Date; end: Date } | null;
  outlierCount: number;
} {
  if (events.length === 0) return { effectiveRange: null, totalRange: null, outlierCount: 0 };

  const timestamps = events.map((e) => e.timestamp.getTime()).sort((a, b) => a - b);
  const total = timestamps.length;

  const totalRange = {
    start: new Date(timestamps[0]),
    end: new Date(timestamps[total - 1]),
  };

  const p2Index = Math.floor(total * 0.02);
  const p98Index = Math.min(Math.floor(total * 0.98), total - 1);

  const effectiveRange = {
    start: new Date(timestamps[p2Index]),
    end: new Date(timestamps[p98Index]),
  };

  const outlierCount = p2Index + (total - 1 - p98Index);

  return { effectiveRange, totalRange, outlierCount };
}

export function computeStats(
  events: MetadataEvent[],
  aggregates: DailyAggregate[],
): DashboardStats {
  if (events.length === 0 && aggregates.length === 0) {
    return {
      total: 0,
      totalUserTriggered: 0,
      totalWithAggregates: 0,
      dateRange: null,
      effectiveRange: null,
      outlierCount: 0,
      estimatedTotalTimeSeconds: 0,
      uniqueContacts: 0,
      topCategories: [],
    };
  }

  const { effectiveRange, totalRange, outlierCount } = computeEffectiveRange(events);
  const aggregateTotal = aggregates.reduce((sum, a) => sum + a.count, 0);

  const userTriggered = filterUserTriggered(events);
  const estimatedTotalTimeSeconds = estimateTotalTime(userTriggered);

  // Count unique contacts
  const contactSet = new Set<string>();
  for (const e of events) {
    for (const p of e.participants) {
      if (p !== "You") contactSet.add(p);
    }
  }

  // Top categories — cross-platform
  const categoryCounts = computeCrossPlatformCategories(events);
  const topCategories = categoryCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(({ label, count }) => ({ label, count }));

  return {
    total: events.length,
    totalUserTriggered: userTriggered.length,
    totalWithAggregates: events.length + aggregateTotal,
    dateRange: totalRange,
    effectiveRange,
    outlierCount,
    estimatedTotalTimeSeconds,
    uniqueContacts: contactSet.size,
    topCategories,
  };
}

function computeCrossPlatformCategories(
  events: MetadataEvent[],
): { label: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const e of events) {
    const label = classifyEventCategory(e);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function classifyEventCategory(e: MetadataEvent): string {
  switch (e.eventType) {
    case "message_sent":
    case "message_received":
      return "category.Messages";
    case "reaction":
      return "category.Reactions";
    case "media_shared":
      return "category.Media";
    case "call_started":
    case "call_ended":
      return "category.Calls";
    case "browsing":
      return "category.Browsing";
    case "search":
      return "category.Search";
    case "story_view":
      return "category.Stories";
    case "calendar_event":
      return "category.Calendar";
    case "group_created":
    case "group_joined":
    case "group_left":
    case "contact_added":
    case "profile_update":
      return "category.Social";
    case "wellness_log":
      return "category.Wellness";
    case "media_played":
      return "category.Music";
    default:
      return "category.Other";
  }
}

export function computeActivityBreakdown(
  events: MetadataEvent[],
): ActivityBreakdownItem[] {
  const categoryCounts = computeCrossPlatformCategories(events);

  return categoryCounts
    .sort((a, b) => b.count - a.count)
    .map(({ label, count }) => ({
      label,
      count,
      color: CATEGORY_COLORS[label] ?? CATEGORY_COLORS["Other"],
    }));
}

export function computeTimelineData(
  events: MetadataEvent[],
  effectiveRange?: { start: Date; end: Date } | null,
): TimelineSeries[] {
  const filtered = effectiveRange
    ? events.filter(
        (e) => e.timestamp >= effectiveRange.start && e.timestamp <= effectiveRange.end,
      )
    : events;

  const byPlatformDate = new Map<Platform, Map<string, number>>();

  for (const e of filtered) {
    const key = getDateKey(e.timestamp);
    if (!byPlatformDate.has(e.source)) {
      byPlatformDate.set(e.source, new Map());
    }
    const dateMap = byPlatformDate.get(e.source)!;
    dateMap.set(key, (dateMap.get(key) ?? 0) + 1);
  }

  const allDates = new Set<string>();
  for (const dateMap of byPlatformDate.values()) {
    for (const d of dateMap.keys()) allDates.add(d);
  }
  const sortedDates = [...allDates].sort();

  const weekBuckets = new Map<string, string>();
  for (const d of sortedDates) {
    const date = new Date(d);
    const dayOfWeek = date.getDay();
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    weekBuckets.set(d, getDateKey(weekStart));
  }

  const series: TimelineSeries[] = [];
  for (const [platform, dateMap] of byPlatformDate) {
    const weeklyData = new Map<string, number>();
    for (const [date, count] of dateMap) {
      const week = weekBuckets.get(date)!;
      weeklyData.set(week, (weeklyData.get(week) ?? 0) + count);
    }
    const weeks = [...weeklyData.keys()].sort();
    series.push({
      id: PLATFORM_META[platform].name,
      data: weeks.map((w) => ({ x: w, y: weeklyData.get(w) ?? 0 })),
    });
  }

  return series;
}

export function computeHeatmapData(
  events: MetadataEvent[],
  dayLabels: string[],
): HeatmapRow[] {
  const matrix: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );

  for (const e of events) {
    const day = e.timestamp.getDay();
    const hour = e.timestamp.getHours();
    matrix[day][hour]++;
  }

  return dayLabels.map((label, dayIdx) => ({
    id: label,
    data: Array.from({ length: 24 }, (_, h) => ({
      x: String(h).padStart(2, "0"),
      y: matrix[dayIdx][h],
    })),
  }));
}

export function computePlatformBreakdown(events: MetadataEvent[]): PlatformBreakdownItem[] {
  const counts = new Map<Platform, number>();
  for (const e of events) {
    counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([platform, count]) => ({
      platform: PLATFORM_META[platform].name,
      count,
      color: `var(--platform-${platform})`,
    }));
}

export function computeAvailableYears(events: MetadataEvent[], minEvents = 20): number[] {
  const counts = new Map<number, number>();
  for (const e of events) {
    const y = e.timestamp.getFullYear();
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minEvents)
    .map(([year]) => year)
    .sort((a, b) => a - b);
}

export function filterEventsByYear(events: MetadataEvent[], year: number | null): MetadataEvent[] {
  if (year === null) return events;
  return events.filter((e) => e.timestamp.getFullYear() === year);
}

function filterAggregatesByYear(aggregates: DailyAggregate[], year: number | null): DailyAggregate[] {
  if (year === null) return aggregates;
  const prefix = String(year);
  return aggregates.filter((a) => a.date.startsWith(prefix));
}

export interface YearHints {
  lulls: number[];
  sleep: number[];
  workHours: number[];
  nightContacts: number[];
  weekendContacts: number[];
  devices: number[];
}

export interface TimelineAnnotation {
  date: Date;
  label: string;
}

export interface GarminActivityItem {
  type: string;
  count: number;
  totalDurationHours: number;
  totalCalories: number;
}

export interface GarminDailyMetric {
  date: string;
  steps?: number;
  stepGoal?: number;
  restingHr?: number;
  avgStress?: number;
  bodyBatteryHigh?: number;
  bodyBatteryLow?: number;
}

export interface DashboardData {
  loading: boolean;
  isDemo: boolean;
  stats: DashboardStats;
  timelineData: TimelineSeries[];
  timelineAnnotations: TimelineAnnotation[];
  heatmapData: HeatmapRow[];
  platformBreakdown: PlatformBreakdownItem[];
  activityBreakdown: ActivityBreakdownItem[];
  inferences: InferenceCard[];
  contactRankings: ContactRanking[];
  nightContacts: ContactRanking[];
  weekendContacts: ContactRanking[];
  macroEvents: MacroEvent[];
  devices: DeviceRecord[];
  deviceTimeline: DeviceTimelineMonth[];
  workHoursAnalysis: WorkHoursAnalysis | null;
  lulls: RecurringLull[];
  sleepPatterns: SleepingPattern[];
  socialCircles: SocialCircle[];
  countryData: CountryData[];
  availableYears: number[];
  availablePlatforms: Platform[];
  allPlatforms: Platform[];
  yearPlatformHasData: (year: number, platform: Platform) => boolean;
  yearHints: YearHints;
  garminActivities: GarminActivityItem[];
  garminDailyMetrics: GarminDailyMetric[];
}

const PLATFORM_SPECIFIC_IDS: Record<string, Platform> = {
  "listening-schedule": "spotify",
  "skip-rate": "spotify",
  "incognito-listening": "spotify",
  "content-mix": "spotify",
  "listening-countries": "spotify",
  "listening-intensity": "spotify",
  "spotify-search-behavior": "spotify",
  "library-curation": "spotify",
  "spotify-pii-exposure": "spotify",
  "spotify-social-graph": "spotify",
  "playlist-identity": "spotify",
  "spotify-wrapped-profile": "spotify",
  "spotify-marquee-segments": "spotify",
  "email-response-time": "google",
  "email-volume": "google",
  "search-patterns": "google",
  "calendar-load": "google",
  "hydration-consistency": "garmin",
  "garmin-activity-summary": "garmin",
  "garmin-sleep-pattern": "garmin",
  "garmin-step-goals": "garmin",
  "garmin-body-battery": "garmin",
  "garmin-stress-pattern": "garmin",
};

const CROSS_PLATFORM_IDS = new Set([
  "platform-migration",
  "music-wind-down",
  "soundtrack-to-silence",
  "top-platform",
  "time-by-platform",
  "weekend-platform-shift",
]);

function computeGarminActivities(events: MetadataEvent[]): GarminActivityItem[] {
  const byType = new Map<string, { count: number; totalMs: number; totalCal: number }>();
  for (const e of events) {
    if (e.source !== "garmin" || e.metadata.garminEventType !== "ACTIVITY") continue;
    const type = (e.metadata.activityType as string) ?? "unknown";
    const existing = byType.get(type) ?? { count: 0, totalMs: 0, totalCal: 0 };
    existing.count++;
    existing.totalMs += (e.metadata.durationMs as number) ?? 0;
    existing.totalCal += (e.metadata.calories as number) ?? 0;
    byType.set(type, existing);
  }
  return [...byType.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([type, data]) => ({
      type,
      count: data.count,
      totalDurationHours: Math.round(data.totalMs / 3_600_000 * 10) / 10,
      totalCalories: Math.round(data.totalCal),
    }));
}

function computeGarminDailyMetrics(events: MetadataEvent[]): GarminDailyMetric[] {
  const byDate = new Map<string, GarminDailyMetric>();
  for (const e of events) {
    if (e.source !== "garmin" || e.metadata.garminEventType !== "DAILY_SUMMARY") continue;
    const date = e.metadata.calendarDate as string;
    if (!date) continue;
    byDate.set(date, {
      date,
      steps: e.metadata.totalSteps as number | undefined,
      stepGoal: e.metadata.dailyStepGoal as number | undefined,
      restingHr: e.metadata.restingHr as number | undefined,
      avgStress: e.metadata.avgStressLevel as number | undefined,
      bodyBatteryHigh: e.metadata.bodyBatteryHigh as number | undefined,
      bodyBatteryLow: e.metadata.bodyBatteryLow as number | undefined,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function computeAvailablePlatforms(events: MetadataEvent[]): Platform[] {
  const seen = new Set<Platform>();
  for (const e of events) seen.add(e.source);
  return PLATFORMS.filter((p) => seen.has(p));
}

function filterInferencesForView(
  inferences: InferenceCard[],
  selectedPlatform: Platform | "all",
  platformCount: number,
): InferenceCard[] {
  return inferences.filter((inf) => {
    if (selectedPlatform === "all") {
      if (PLATFORM_SPECIFIC_IDS[inf.id]) return false;
      if (inf.id === "top-platform" && platformCount <= 1) return false;
      if (inf.id === "time-by-platform" && platformCount <= 1) return false;
      return true;
    } else {
      if (CROSS_PLATFORM_IDS.has(inf.id)) return false;
      const owner = PLATFORM_SPECIFIC_IDS[inf.id];
      if (owner && owner !== selectedPlatform) return false;
      return true;
    }
  });
}

export function useDashboardData(): DashboardData {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const demoMode = useAppStore((s) => s.demoMode);
  const selectedYear = useAppStore((s) => s.selectedYear);
  const selectedPlatform = useAppStore((s) => s.selectedPlatform);
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Omit<DashboardData, "loading">>({
    isDemo: false,
    stats: {
      total: 0,
      totalUserTriggered: 0,
      totalWithAggregates: 0,
      dateRange: null,
      effectiveRange: null,
      outlierCount: 0,
      estimatedTotalTimeSeconds: 0,
      uniqueContacts: 0,
      topCategories: [],
    },
    timelineData: [],
    timelineAnnotations: [],
    heatmapData: [],
    platformBreakdown: [],
    activityBreakdown: [],
    inferences: [],
    contactRankings: [],
    nightContacts: [],
    weekendContacts: [],
    macroEvents: [],
    devices: [],
    deviceTimeline: [],
    workHoursAnalysis: null,
    lulls: [],
    sleepPatterns: [],
    socialCircles: [],
    countryData: [],
    availableYears: [],
    availablePlatforms: [],
    allPlatforms: [],
    yearPlatformHasData: () => true,
    yearHints: { lulls: [], sleep: [], workHours: [], nightContacts: [], weekendContacts: [], devices: [] },
    garminActivities: [],
    garminDailyMetrics: [],
  });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const dayLabels = Array.from({ length: 7 }, (_, i) => t(`day.short.${i}`));

    Promise.all([getAllEvents(), getDailyAggregates()]).then(([dbEvents, allAggregates]) => {
      if (cancelled) return;

      const isDemo = dbEvents.length === 0 && demoMode;
      const allEvents = dbEvents.length > 0 ? dbEvents : (isDemo ? (getDemoEvents() ?? []) : []);
      const availableYears = computeAvailableYears(allEvents);

      // All platforms across all years (stable — doesn't change with year filter)
      const allPlatforms = computeAvailablePlatforms(allEvents);

      // Build year×platform lookup for cross-filter disabled states
      const ypSet = new Set<string>();
      for (const e of allEvents) {
        ypSet.add(`${e.timestamp.getFullYear()}:${e.source}`);
      }
      const yearPlatformHasData = (year: number, platform: Platform) =>
        ypSet.has(`${year}:${platform}`);

      const yearFiltered = filterEventsByYear(allEvents, selectedYear);
      const aggregates = filterAggregatesByYear(allAggregates, selectedYear);

      // Compute available platforms from year-filtered events (stable for tab bar)
      const availablePlatforms = computeAvailablePlatforms(yearFiltered);

      // Apply platform filter
      const events = selectedPlatform === "all"
        ? yearFiltered
        : yearFiltered.filter((e) => e.source === selectedPlatform);

      const s = computeStats(events, aggregates);
      const userTriggered = filterUserTriggered(events);

      // Contact analysis
      const contactRankings = rankContacts(events);
      const nightContacts = getNightOwlContacts(contactRankings, 3);
      const weekendContacts = getWeekendContacts(contactRankings, 3);

      // Macro events (burst detection)
      const macroEvents = detectMacroEvents(userTriggered);

      // Device analysis
      const devices = extractDevices(events);
      const deviceTimeline = buildDeviceTimeline(events);

      // Work hours
      const workHoursAnalysis = s.effectiveRange
        ? estimateWorkHoursWasted(userTriggered, s.effectiveRange)
        : null;

      // Lulls (user-triggered only — passive events like notifications don't indicate user activity)
      const lulls = detectRecurringLulls(userTriggered);

      // Sleeping patterns (user-triggered only — a notification at 3am ≠ user awake)
      const sleepPatterns = detectSleepingPatterns(userTriggered);

      // Social circles
      const socialCircles = computeSocialCircles(events, contactRankings);

      // Garmin-specific computations
      const garminActivities = computeGarminActivities(events);
      const garminDailyMetrics = computeGarminDailyMetrics(events);

      // Year hints — detect which individual years have data when combined "All" view doesn't
      const yearHints: YearHints = { lulls: [], sleep: [], workHours: [], nightContacts: [], weekendContacts: [], devices: [] };

      if (availableYears.length >= 2) {
        const needsLull = lulls.length === 0;
        const needsSleep = sleepPatterns.length === 0;
        const needsWork = !workHoursAnalysis || workHoursAnalysis.totalSeconds === 0;
        const needsNight = nightContacts.length === 0;
        const needsWeekend = weekendContacts.length === 0;
        const needsDevice = devices.length === 0;

        if (needsLull || needsSleep || needsWork || needsNight || needsWeekend || needsDevice) {
          for (const year of availableYears) {
            if (year === selectedYear) continue;
            const ye = filterEventsByYear(allEvents, year);
            const ype = selectedPlatform === "all" ? ye : ye.filter(e => e.source === selectedPlatform);
            const yut = filterUserTriggered(ype);

            if (needsLull && detectRecurringLulls(yut).length > 0) yearHints.lulls.push(year);
            if (needsSleep && detectSleepingPatterns(yut).length > 0) yearHints.sleep.push(year);
            if (needsWork) {
              const ys = computeStats(ype, filterAggregatesByYear(allAggregates, year));
              if (ys.effectiveRange && estimateWorkHoursWasted(yut, ys.effectiveRange).totalSeconds > 0)
                yearHints.workHours.push(year);
            }
            if (needsNight || needsWeekend) {
              const yr = rankContacts(ype);
              if (needsNight && getNightOwlContacts(yr, 3).length > 0) yearHints.nightContacts.push(year);
              if (needsWeekend && getWeekendContacts(yr, 3).length > 0) yearHints.weekendContacts.push(year);
            }
            if (needsDevice && extractDevices(ype).length > 0) yearHints.devices.push(year);
          }
        }
      }

      // Build timeline annotations from quiet periods
      const timelineAnnotations: TimelineAnnotation[] = [];
      const quietPeriods = computeQuietPeriods(userTriggered, s, sleepPatterns);
      for (const period of quietPeriods) {
        timelineAnnotations.push({
          date: period.start,
          label: t("chart.annotation.quietPeriod", { hours: period.durationHours }),
        });
      }

      // Shared dashboard data (without countryData — added async below)
      const baseData = {
        isDemo,
        stats: s,
        timelineData: computeTimelineData(events, s.effectiveRange),
        timelineAnnotations,
        heatmapData: computeHeatmapData(events, dayLabels),
        platformBreakdown: computePlatformBreakdown(userTriggered),
        activityBreakdown: computeActivityBreakdown(userTriggered),
        inferences: filterInferencesForView(computeInferences(events, s), selectedPlatform, availablePlatforms.length),
        contactRankings,
        nightContacts,
        weekendContacts,
        macroEvents,
        devices,
        deviceTimeline,
        workHoursAnalysis,
        lulls,
        sleepPatterns,
        socialCircles,
        availableYears,
        availablePlatforms,
        allPlatforms,
        yearPlatformHasData,
        yearHints,
        garminActivities,
        garminDailyMetrics,
      };

      // Set data immediately with empty countryData, then resolve GeoIP async
      setData({ ...baseData, countryData: [] });
      setLoading(false);

      // Async: resolve country data (GeoIP DB fetched once and cached)
      computeCountryDataWithGeoIp(events).then((countryData) => {
        if (!cancelled) setData({ ...baseData, countryData });
      }).catch(() => { /* GeoIP unavailable — map shows less data */ });
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [dataVersion, demoMode, selectedYear, selectedPlatform, t]);

  return { loading, ...data };
}
