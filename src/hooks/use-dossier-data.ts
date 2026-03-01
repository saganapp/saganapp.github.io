import { useState, useEffect } from "react";
import { getAllEvents, getDailyAggregates } from "@/store/db";
import { useAppStore } from "@/store/app-store";
import { getDemoEvents } from "@/demo/load-demo";
import {
  filterUserTriggered,
  estimateTotalTime,
  estimateWorkHoursWasted,
  rankContacts,
  getNightOwlContacts,
  extractDevices,
  detectSleepingPatterns,
  computeSocialCircles,
  computeReciprocity,
  computeRelationshipTrends,
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
      const sleepPatterns = detectSleepingPatterns(userTriggered);
      const socialCircles = computeSocialCircles(events, contactRankings);
      const devices = extractDevices(events);
      const workHoursAnalysis = stats.effectiveRange
        ? estimateWorkHoursWasted(userTriggered, stats.effectiveRange)
        : null;
      const reciprocity = computeReciprocity(events);
      const trends = computeRelationshipTrends(userTriggered, stats);

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
        direction: String(driftCard.descParams?.direction ?? "later") as "later" | "earlier",
      } : null;

      const platformMigration = migrationCard
        ? `${migrationCard.titleParams?.from} → ${migrationCard.titleParams?.to}`
        : null;

      const firstActivity = firstLastCard ? String(firstLastCard.titleParams?.firstTime ?? null) : null;
      const lastActivity = firstLastCard ? String(firstLastCard.titleParams?.lastTime ?? null) : null;

      // Chronotype (user-triggered only — a notification at 3am ≠ user awake)
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

      // Platform info (user-triggered only)
      const platformCounts = new Map<Platform, number>();
      for (const e of userTriggered) {
        platformCounts.set(e.source, (platformCounts.get(e.source) ?? 0) + 1);
      }
      let topPlatform: Platform = "whatsapp";
      let topCount = 0;
      for (const [p, c] of platformCounts) {
        if (c > topCount) { topPlatform = p; topCount = c; }
      }

      // Meetings per week + busiest day
      const calEvents = events.filter((e) => e.eventType === "calendar_event");
      const weeks = stats.effectiveRange
        ? Math.max(1, (stats.effectiveRange.end.getTime() - stats.effectiveRange.start.getTime()) / (1000 * 60 * 60 * 24 * 7))
        : 1;
      const meetingsPerWeek = calEvents.length >= 5
        ? Math.round((calEvents.length / weeks) * 10) / 10
        : null;

      const dowCounts = [0, 0, 0, 0, 0, 0, 0];
      for (const e of userTriggered) dowCounts[e.timestamp.getDay()]++;
      const busiestDay = dowCounts.indexOf(Math.max(...dowCounts));

      // Recompute total time
      stats.estimatedTotalTimeSeconds = estimateTotalTime(userTriggered);

      const profile = buildDossier({
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
        primaryPlatform: PLATFORM_META[topPlatform].name,
        allPlatforms: [...platformCounts.keys()].map((p) => PLATFORM_META[p].name),
        meetingsPerWeek,
        busiestDay,
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
