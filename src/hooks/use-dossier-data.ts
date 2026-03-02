import { useState, useEffect } from "react";
import { getAllEvents, getDailyAggregates } from "@/store/db";
import { useAppStore } from "@/store/app-store";
import { getDemoEvents } from "@/demo/load-demo";
import {
  filterUserTriggered,
  estimateTotalTime,
  estimateWorkHoursWasted,
  estimateTimeByPlatform,
  rankContacts,
  getNightOwlContacts,
  getWeekendContacts,
  extractDevices,
  detectSleepingPatterns,
  detectRecurringLulls,
  detectMacroEvents,
  computeSocialCircles,
  computeReciprocity,
  computeRelationshipTrends,
  computeResponseLatency,
  computeActivityGaps,
  computeSleepDrift,
  computePlatformMigration,
  computeFirstLastActivity,
  buildDossier,
} from "@/analysis";
import type { DossierProfile } from "@/analysis";
import { computeStats, filterEventsByYear } from "@/hooks/use-dashboard-data";
import { PLATFORM_META } from "@/utils/platform";
import type { Platform } from "@/parsers/types";

export interface DossierData {
  loading: boolean;
  dossier: DossierProfile | null;
  hasData: boolean;
}

export function useDossierData(): DossierData {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const demoMode = useAppStore((s) => s.demoMode);
  const selectedYear = useAppStore((s) => s.selectedYear);
  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<DossierProfile | null>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([getAllEvents(), getDailyAggregates()]).then(([dbEvents, allAggregates]) => {
      if (cancelled) return;

      const allEvents = dbEvents.length > 0 ? dbEvents : (demoMode ? (getDemoEvents() ?? []) : []);
      const events = filterEventsByYear(allEvents, selectedYear);
      if (events.length === 0) {
        setDossier(null);
        setHasData(false);
        setLoading(false);
        return;
      }

      const filteredAggregates = selectedYear
        ? allAggregates.filter((a) => a.date.startsWith(String(selectedYear)))
        : allAggregates;

      const stats = computeStats(events, filteredAggregates);
      const userTriggered = filterUserTriggered(events);
      const contactRankings = rankContacts(events);
      const nightContacts = getNightOwlContacts(contactRankings, 3);
      const weekendContacts = getWeekendContacts(contactRankings, 3);
      const sleepPatterns = detectSleepingPatterns(userTriggered);
      const lulls = detectRecurringLulls(userTriggered);
      const socialCircles = computeSocialCircles(events, contactRankings);
      const devices = extractDevices(events);
      const workHoursAnalysis = stats.effectiveRange
        ? estimateWorkHoursWasted(userTriggered, stats.effectiveRange)
        : null;
      const reciprocity = computeReciprocity(events);
      const trends = computeRelationshipTrends(userTriggered, stats);
      const responseLatency = computeResponseLatency(events);
      const macroEvents = detectMacroEvents(userTriggered);
      const timeByPlatform = estimateTimeByPlatform(userTriggered);

      // Cross-platform analysis results
      const gapCard = computeActivityGaps(userTriggered, stats);
      const driftCard = computeSleepDrift(userTriggered);
      const migrationCard = computePlatformMigration(userTriggered);
      const firstLastCard = computeFirstLastActivity(userTriggered);

      // Extract derived values
      const activityGaps = gapCard ? [{
        startDate: String(gapCard.descParams?.startDate ?? ""),
        endDate: String(gapCard.descParams?.endDate ?? ""),
        days: Number(gapCard.titleParams?.days ?? 0),
      }] : [];

      const sleepDrift = driftCard ? {
        minutes: Number(driftCard.titleParams?.minutes ?? 0),
        direction: String(driftCard.descParams?.direction ?? "direction.later").replace("direction.", "") as "later" | "earlier",
      } : null;

      const platformMigration = migrationCard
        ? `${migrationCard.titleParams?.from} → ${migrationCard.titleParams?.to}`
        : null;

      const firstActivity = firstLastCard ? String(firstLastCard.titleParams?.firstTime ?? null) : null;
      const lastActivity = firstLastCard ? String(firstLastCard.titleParams?.lastTime ?? null) : null;

      // Chronotype
      let nightCount = 0;
      let morningCount = 0;
      for (const e of userTriggered) {
        const h = e.timestamp.getHours();
        if (h >= 22 || h < 4) nightCount++;
        if (h >= 5 && h < 9) morningCount++;
      }
      const chronotype: "night-owl" | "early-bird" | null =
        nightCount > morningCount ? "night-owl" :
        morningCount > nightCount ? "early-bird" : null;

      // Platform info
      const platformCounts = new Map<Platform, number>();
      for (const e of userTriggered) {
        platformCounts.set(e.source, (platformCounts.get(e.source) ?? 0) + 1);
      }
      let topPlatform: Platform = "whatsapp";
      let topCount = 0;
      for (const [p, c] of platformCounts) {
        if (c > topCount) { topPlatform = p; topCount = c; }
      }
      const primaryPlatformPct = userTriggered.length > 0
        ? Math.round((topCount / userTriggered.length) * 100)
        : null;

      // Meetings per week
      const calEvents = events.filter((e) => e.eventType === "calendar_event");
      const weeks = stats.effectiveRange
        ? Math.max(1, (stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime()) / (1000 * 60 * 60 * 24 * 7))
        : 1;
      const meetingsPerWeek = calEvents.length >= 5
        ? Math.round((calEvents.length / weeks) * 10) / 10
        : null;

      // Busiest day + percentage
      const dowCounts = [0, 0, 0, 0, 0, 0, 0];
      for (const e of userTriggered) dowCounts[e.timestamp.getDay()]++;
      const busiestDay = dowCounts.indexOf(Math.max(...dowCounts));
      const avgDowCount = dowCounts.reduce((s, c) => s + c, 0) / 7;
      const busiestDayPct = avgDowCount > 0
        ? Math.round(((dowCounts[busiestDay] - avgDowCount) / avgDowCount) * 100)
        : null;

      // Weekend/weekday ratio
      const weekendCount = dowCounts[0] + dowCounts[6];
      const weekdayCount = dowCounts[1] + dowCounts[2] + dowCounts[3] + dowCounts[4] + dowCounts[5];
      const weekendWeekdayRatio = weekdayCount > 0
        ? Math.round(((weekendCount / 2) / (weekdayCount / 5)) * 100) / 100
        : null;

      // Peak activity hour
      const hourCounts = new Array(24).fill(0) as number[];
      for (const e of userTriggered) hourCounts[e.timestamp.getHours()]++;
      const peakActivityHour = hourCounts.indexOf(Math.max(...hourCounts));

      // Sleep confidence
      const sleepConfidence = sleepPatterns.length > 0 ? sleepPatterns[0].confidence : null;

      // Activity breakdown
      const categoryMap = new Map<string, number>();
      for (const e of events) {
        const label = classifyCategory(e.eventType);
        categoryMap.set(label, (categoryMap.get(label) ?? 0) + 1);
      }
      const activityBreakdown = [...categoryMap.entries()].map(([label, count]) => ({ label, count }));

      // Burst contact (top macro event contact)
      const burstContact = macroEvents.length > 0
        ? (() => {
            const contactBursts = new Map<string, { count: number; totalEvents: number }>();
            for (const me of macroEvents) {
              const existing = contactBursts.get(me.contact) ?? { count: 0, totalEvents: 0 };
              existing.count++;
              existing.totalEvents += me.eventCount;
              contactBursts.set(me.contact, existing);
            }
            let topBurst = { contact: "", bursts: 0, avgMessages: 0 };
            for (const [contact, data] of contactBursts) {
              if (data.count > topBurst.bursts) {
                topBurst = {
                  contact,
                  bursts: data.count,
                  avgMessages: Math.round(data.totalEvents / data.count),
                };
              }
            }
            return topBurst.bursts > 0 ? topBurst : null;
          })()
        : null;

      // Recompute total time
      stats.estimatedTotalTimeSeconds = estimateTotalTime(userTriggered);

      const profile = buildDossier({
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
        primaryPlatform: PLATFORM_META[topPlatform].name,
        primaryPlatformPct,
        allPlatforms: [...platformCounts.keys()].map((p) => PLATFORM_META[p].name),
        meetingsPerWeek,
        busiestDay,
        busiestDayPct,
        weekendWeekdayRatio,
        peakActivityHour,
        timeByPlatform,
        activityBreakdown,
      });

      setDossier(profile);
      setHasData(true);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [dataVersion, demoMode, selectedYear]);

  return { loading, dossier, hasData };
}

function classifyCategory(eventType: string): string {
  switch (eventType) {
    case "message_sent":
    case "message_received":
      return "Messages";
    case "reaction":
      return "Reactions";
    case "media_shared":
      return "Media";
    case "call_started":
    case "call_ended":
      return "Calls";
    case "browsing":
      return "Browsing";
    case "search":
      return "Search";
    case "story_view":
      return "Stories";
    case "calendar_event":
      return "Calendar";
    case "group_created":
    case "group_joined":
    case "group_left":
    case "contact_added":
    case "profile_update":
      return "Social";
    case "wellness_log":
      return "Wellness";
    case "media_played":
      return "Music";
    default:
      return "Other";
  }
}
