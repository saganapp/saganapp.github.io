import { Fragment, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Activity,
  Calendar,
  Lightbulb,
  BarChart3,
  Users,
  Briefcase,
  Smartphone,
  Moon,
  Sun,
  Pause,
  BedDouble,
  FileText,
  Info,
  Globe,
} from "lucide-react";
import { Link } from "react-router";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useLocale } from "@/i18n";
import { formatDate } from "@/utils/time";
import { formatCompact } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { PLATFORM_META } from "@/utils/platform";
import type { Platform } from "@/parsers/types";
import { ErrorBoundary } from "@/components/error-boundary";
import { loadDemoData } from "@/demo/load-demo";
import { ChartContainer } from "@/components/charts/chart-container";
import { TimelineChart } from "@/components/charts/timeline-chart";
import { HeatmapChart } from "@/components/charts/heatmap-chart";
import { ActivityBarChart } from "@/components/charts/activity-bar-chart";
import { GarminActivityChart } from "@/components/charts/garmin-activity-chart";
import { GarminTrendsChart } from "@/components/charts/garmin-trends-chart";
import { InferenceCards } from "@/components/charts/inference-cards";
import { ContactRankingTable } from "@/components/charts/contact-ranking-table";
import { NightContacts } from "@/components/charts/night-contacts";
import { WeekendContacts } from "@/components/charts/weekend-contacts";
import { DeviceTimeline } from "@/components/charts/device-timeline";
import { WorkHoursCard } from "@/components/charts/work-hours-card";
import { LullCard } from "@/components/charts/lull-card";
import { SleepCard } from "@/components/charts/sleep-card";
import { EmptyStateOverlay, EmptyStateMessage } from "@/components/charts/empty-state-overlay";
import { WorldMapChart } from "@/components/charts/world-map-chart";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function formatTimeEstimate(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function DashboardPage() {
  usePageTitle("pageTitle.dashboard");
  const {
    loading: dataLoading, isDemo: demoMode, stats, timelineData, timelineAnnotations, heatmapData, activityBreakdown, inferences,
    contactRankings, nightContacts, weekendContacts, devices, deviceTimeline,
    workHoursAnalysis, lulls, sleepPatterns, countryData, availableYears, allPlatforms, yearPlatformHasData, yearHints,
    garminActivities, garminDailyMetrics,
  } = useDashboardData();
  const { t, locale } = useLocale();
  const selectedYear = useAppStore((s) => s.selectedYear);
  const setSelectedYear = useAppStore((s) => s.setSelectedYear);
  const selectedPlatform = useAppStore((s) => s.selectedPlatform);
  const setSelectedPlatform = useAppStore((s) => s.setSelectedPlatform);

  const hasData = stats.totalWithAggregates > 0;

  // Handlers that auto-reset the cross-filter when the combo has no data
  const handleSelectYear = (year: number | null) => {
    setSelectedYear(year);
    if (year !== null && selectedPlatform !== "all" && !yearPlatformHasData(year, selectedPlatform)) {
      setSelectedPlatform("all");
    }
  };
  const handleSelectPlatform = (platform: Platform | "all") => {
    setSelectedPlatform(platform);
    if (platform !== "all" && selectedYear !== null && !yearPlatformHasData(selectedYear, platform)) {
      setSelectedYear(null);
    }
  };

  // Auto-load demo data when dashboard is empty
  const demoGuard = useRef(false);
  useEffect(() => {
    if (!dataLoading && !hasData && !demoGuard.current) {
      demoGuard.current = true;
      loadDemoData();
    }
  }, [dataLoading, hasData]);

  // Show skeletons whenever data isn't ready (initial load or demo generation)
  const loading = dataLoading || !hasData;

  const statCards = [
    {
      label: t("dashboard.stat.userTriggered"),
      value: hasData ? formatCompact(stats.totalUserTriggered) : "\u2014",
      subtitle: hasData
        ? `${formatCompact(stats.total)} ${t("dashboard.stat.total").toLowerCase()}`
        : undefined,
    },
    {
      label: t("dashboard.stat.dateRange"),
      value:
        hasData && stats.effectiveRange
          ? `${formatDate(stats.effectiveRange.start, locale)} \u2013 ${formatDate(stats.effectiveRange.end, locale)}`
          : "\u2014",
      subtitle:
        hasData && stats.outlierCount > 0
          ? t("dashboard.stat.outlierNote", { count: stats.outlierCount })
          : undefined,
    },
    {
      label: t("dashboard.stat.estimatedTime"),
      value: hasData ? formatTimeEstimate(stats.estimatedTotalTimeSeconds) : "\u2014",
      subtitle: undefined,
    },
    {
      label: t("dashboard.stat.uniqueContacts"),
      value: hasData ? formatCompact(stats.uniqueContacts) : "\u2014",
      subtitle: undefined,
    },
  ];

  // Timeline outlier note
  const timelineNote =
    hasData && stats.outlierCount > 0 && stats.effectiveRange && stats.dateRange
      ? t("dashboard.timeline.outlierNote", {
          startYear: stats.effectiveRange.start.getFullYear(),
          endYear: stats.effectiveRange.end.getFullYear(),
          count: stats.outlierCount,
        })
      : null;

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="mt-2 text-muted-foreground">
          {hasData ? t("dashboard.subtitle") : t("dashboard.subtitleEmpty")}
        </p>
      </motion.div>

      {/* Demo mode banner */}
      {demoMode && !loading && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30"
        >
          <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="min-w-0 text-sm text-amber-800 dark:text-amber-200">
            {t("demo.banner")}
          </p>
          <Button asChild variant="outline" size="xs" className="ml-auto shrink-0">
            <Link to="/import">{t("landing.hero.importData")}</Link>
          </Button>
        </motion.div>
      )}

      {/* Year Filter */}
      {availableYears.length >= 2 && (
        <motion.div
          className="mt-4 flex items-center gap-1.5 overflow-x-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <span className="text-sm text-muted-foreground mr-1">{t("dashboard.yearFilter.label")}</span>
          <Button
            variant={selectedYear === null ? "secondary" : "ghost"}
            size="xs"
            className="hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:shadow-none transition-all duration-150"
            onClick={() => handleSelectYear(null)}
          >
            {t("dashboard.yearFilter.all")}
          </Button>
          {availableYears.map((year) => {
            const disabled = selectedPlatform !== "all" && !yearPlatformHasData(year, selectedPlatform);
            return (
              <Button
                key={year}
                variant={selectedYear === year ? "secondary" : "ghost"}
                size="xs"
                className="hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:shadow-none transition-all duration-150"
                disabled={disabled}
                onClick={() => handleSelectYear(year)}
              >
                {year}
              </Button>
            );
          })}
        </motion.div>
      )}

      {/* Platform Filter */}
      {allPlatforms.length >= 2 && (
        <motion.div
          className="mt-3 flex items-center gap-1.5 overflow-x-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <span className="text-sm text-muted-foreground mr-1 shrink-0">
            {t("dashboard.platformFilter.label")}
          </span>
          <Button
            variant={selectedPlatform === "all" ? "secondary" : "ghost"}
            size="xs"
            className="hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:shadow-none transition-all duration-150"
            onClick={() => handleSelectPlatform("all")}
          >
            {t("dashboard.platformFilter.all")}
          </Button>
          {allPlatforms.map((platform: Platform) => {
            const meta = PLATFORM_META[platform];
            const Icon = meta.icon;
            const isActive = selectedPlatform === platform;
            const disabled = selectedYear !== null && !yearPlatformHasData(selectedYear, platform);
            return (
              <Button
                key={platform}
                variant={isActive ? "secondary" : "ghost"}
                size="xs"
                className="hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:shadow-none transition-all duration-150"
                disabled={disabled}
                onClick={() => handleSelectPlatform(platform)}
                style={isActive ? { borderColor: `var(${meta.cssVar})`, borderWidth: 1 } : undefined}
              >
                <Icon className="size-3" style={{ color: `var(${meta.cssVar})` }} />
                <span className="hidden sm:inline">{meta.name}</span>
              </Button>
            );
          })}
        </motion.div>
      )}

      {/* Stat Cards */}
      <motion.div
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {statCards.map((s) => (
          <motion.div key={s.label} variants={item}>
            <Card className="py-3">
              <CardHeader className="pb-1">
                <CardDescription>{s.label}</CardDescription>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg sm:text-xl font-bold tracking-tight font-mono break-words">
                    {loading ? "\u2014" : s.value}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-2 w-3/4" />
                ) : s.subtitle ? (
                  <p className="text-xs text-muted-foreground truncate">{s.subtitle}</p>
                ) : (
                  <div className="h-2" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Dashboard sections */}
      <motion.div
        className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "0px 0px 200px 0px" }}
      >
        {/* 1. Timeline — full width */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.timeline.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>
                {t("dashboard.timeline.desc")}
                <span className="ml-1.5 text-muted-foreground/50">{t("chart.hint.desktop")}</span>
              </CardDescription>
              {timelineNote && (
                <p className="text-xs text-muted-foreground mt-1">{timelineNote}</p>
              )}
            </CardHeader>
            <CardContent>
              <ErrorBoundary compact>
                <ChartContainer height={300} mobileHeight={220} loading={loading} empty={!hasData} label={t("dashboard.timeline.title")}>
                  <TimelineChart data={timelineData} effectiveRange={stats.effectiveRange} annotations={timelineAnnotations} />
                </ChartContainer>
              </ErrorBoundary>
            </CardContent>
          </Card>
        </motion.div>

        {/* 2. Work Hours Impact — half width */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.workHours.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>{t("dashboard.workHours.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-lg bg-muted/30 px-2 py-2.5 text-center">
                        <Skeleton className="mx-auto h-5 w-12" />
                        <Skeleton className="mx-auto mt-1.5 h-2 w-16" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className="flex w-20 shrink-0 items-center gap-1.5">
                          <Skeleton className="h-3.5 w-3.5 rounded-full" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="h-5 flex-1 rounded-md" />
                        <Skeleton className="h-3 w-8" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : hasData ? (
                workHoursAnalysis && workHoursAnalysis.totalSeconds > 0 ? (
                  <ErrorBoundary compact>
                    <WorkHoursCard analysis={workHoursAnalysis} />
                  </ErrorBoundary>
                ) : (
                  <EmptyStateMessage message={t("dashboard.workHours.empty")} yearHintYears={yearHints.workHours} />
                )
              ) : (
                <EmptyStateMessage message={t("dashboard.workHours.empty")} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 3. Activity Heatmap — half width */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.heatmap.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>{t("dashboard.heatmap.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorBoundary compact>
                <ChartContainer height={260} mobileHeight={200} loading={loading} empty={!hasData} label={t("dashboard.heatmap.title")}>
                  <HeatmapChart data={heatmapData} />
                </ChartContainer>
              </ErrorBoundary>
            </CardContent>
          </Card>
        </motion.div>

        {/* 4. Lull Detection — full width */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Pause className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.lulls.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>{t("dashboard.lulls.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <div className="grid gap-px overflow-hidden" style={{ gridTemplateColumns: `auto repeat(14, 1fr)` }}>
                    <div />
                    {Array.from({ length: 14 }, (_, i) => (
                      <Skeleton key={`h-${i}`} className="h-3 w-full" />
                    ))}
                    {Array.from({ length: 7 }, (_, d) => (
                      <Fragment key={d}>
                        <Skeleton className="h-3 w-6" />
                        {Array.from({ length: 14 }, (_, h) => (
                          <Skeleton key={`${d}-${h}`} className="h-5 rounded-sm" />
                        ))}
                      </Fragment>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="rounded-lg border border-border/50 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="mt-1 h-3 w-48" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : lulls.length > 0 ? (
                <ErrorBoundary compact>
                  <LullCard lulls={lulls} />
                </ErrorBoundary>
              ) : hasData ? (
                <EmptyStateOverlay message={t("dashboard.lulls.empty")} yearHintYears={yearHints.lulls}>
                  <LullCard lulls={[]} />
                </EmptyStateOverlay>
              ) : (
                <EmptyStateMessage message={t("dashboard.lulls.empty")} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 5. Sleeping Patterns — full width */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.sleep.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>{t("dashboard.sleep.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {/* Axis placeholder */}
                  <div className="flex justify-between" style={{ paddingLeft: 32 }}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton key={i} className="h-3 w-4" />
                    ))}
                  </div>
                  {/* Bar row skeletons */}
                  {Array.from({ length: 7 }, (_, d) => (
                    <div key={d} className="flex items-center gap-1.5">
                      <Skeleton className="h-3 w-6" />
                      <div className="relative h-6 flex-1 rounded-md bg-muted/10">
                        <Skeleton
                          className="absolute inset-y-0.5 rounded-md"
                          style={{ left: `${10 + (d % 2) * 5}%`, width: `${55 + (d % 3) * 5}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="rounded-lg border border-border/50 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="mt-1 h-3 w-48" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : sleepPatterns.length > 0 ? (
                <ErrorBoundary compact>
                  <SleepCard patterns={sleepPatterns} />
                </ErrorBoundary>
              ) : hasData ? (
                <EmptyStateOverlay message={t("dashboard.sleep.empty")} yearHintYears={yearHints.sleep}>
                  <SleepCard patterns={[]} />
                </EmptyStateOverlay>
              ) : (
                <EmptyStateMessage message={t("dashboard.sleep.empty")} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 6. Top Contacts — full width */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.contacts.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>{t("dashboard.contacts.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-6 w-16 rounded-full" />
                    ))}
                  </div>
                  <div className="space-y-0">
                    <div className="flex items-center gap-3 border-b pb-2">
                      <Skeleton className="h-3 w-6" />
                      <Skeleton className="h-3 w-24" />
                      <div className="flex-1" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3 border-b border-border/50 py-2 last:border-0">
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                        <div className="flex-1" />
                        <Skeleton className="hidden h-1.5 w-16 rounded-full sm:block" />
                        <Skeleton className="h-4 w-10" />
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-3.5 w-3.5 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : hasData && contactRankings.length > 0 ? (
                <ErrorBoundary compact>
                  <ContactRankingTable rankings={contactRankings} />
                </ErrorBoundary>
              ) : (
                <EmptyStateMessage message={t("dashboard.contacts.empty")} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 6. Night Contacts — half width */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.nightContacts.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>{t("dashboard.nightContacts.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="rounded-lg border border-border/50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3.5 w-3.5 rounded-full" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : hasData ? (
                nightContacts.length > 0 ? (
                  <ErrorBoundary compact>
                    <NightContacts contacts={nightContacts} />
                  </ErrorBoundary>
                ) : (
                  <EmptyStateMessage message={t("dashboard.nightContacts.empty")} yearHintYears={yearHints.nightContacts} />
                )
              ) : (
                <EmptyStateMessage message={t("dashboard.nightContacts.empty")} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 7. Weekend Contacts — half width */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.weekendContacts.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>{t("dashboard.weekendContacts.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="rounded-lg border border-border/50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3.5 w-3.5 rounded-full" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : hasData ? (
                weekendContacts.length > 0 ? (
                  <ErrorBoundary compact>
                    <WeekendContacts contacts={weekendContacts} />
                  </ErrorBoundary>
                ) : (
                  <EmptyStateMessage message={t("dashboard.weekendContacts.empty")} yearHintYears={yearHints.weekendContacts} />
                )
              ) : (
                <EmptyStateMessage message={t("dashboard.weekendContacts.empty")} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* World Map — full width */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.map.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>{t("dashboard.map.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorBoundary compact>
                <ChartContainer height={380} mobileHeight={260} loading={loading} empty={!hasData || countryData.length === 0} label={t("dashboard.map.title")}>
                  <WorldMapChart data={countryData} locale={locale} />
                </ChartContainer>
              </ErrorBoundary>
            </CardContent>
          </Card>
        </motion.div>

        {/* 8. Device Timeline — full width */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.devices.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>{t("dashboard.devices.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Skeleton className="h-2.5 w-2.5 rounded-full" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-7 flex-1 rounded-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : hasData ? (
                devices.length > 0 ? (
                  <ErrorBoundary compact>
                    <DeviceTimeline devices={devices} timeline={deviceTimeline} />
                  </ErrorBoundary>
                ) : (
                  <EmptyStateMessage message={t("dashboard.devices.empty")} yearHintYears={yearHints.devices} />
                )
              ) : (
                <EmptyStateMessage message={t("dashboard.devices.empty")} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 9. Inference Cards — full width */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.inferences.title")}</CardTitle>
                {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
              </div>
              <CardDescription>{t("dashboard.inferences.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                      </div>
                      <Skeleton className="mt-3 h-6 w-full rounded-md" />
                    </div>
                  ))}
                </div>
              ) : hasData ? (
                inferences.length > 0 ? (
                  <ErrorBoundary compact>
                    <InferenceCards inferences={inferences} />
                  </ErrorBoundary>
                ) : (
                  <EmptyStateMessage message={t("dashboard.inferences.empty")} />
                )
              ) : (
                <EmptyStateMessage message={t("dashboard.inferences.empty")} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Garmin Activity Breakdown — full width */}
        {garminActivities.length > 0 && !loading && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" style={{ color: "var(--platform-garmin)" }} />
                  <CardTitle className="text-base">{t("dashboard.garminActivity.title")}</CardTitle>
                  {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
                </div>
                <CardDescription>{t("dashboard.garminActivity.desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ErrorBoundary compact>
                  <GarminActivityChart data={garminActivities} />
                </ErrorBoundary>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Garmin Health Trends — full width */}
        {garminDailyMetrics.length > 0 && !loading && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: "var(--platform-garmin)" }} />
                  <CardTitle className="text-base">{t("dashboard.garminTrends.title")}</CardTitle>
                  {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
                </div>
                <CardDescription>{t("dashboard.garminTrends.desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ErrorBoundary compact>
                  <GarminTrendsChart data={garminDailyMetrics} />
                </ErrorBoundary>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Dossier CTA */}
        {hasData && !loading && (
          <motion.div variants={item} className="lg:col-span-2">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t("dossier.cta.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("dossier.cta.desc")}</p>
                </div>
                <Button asChild size="sm">
                  <Link to="/dossier">{t("dossier.cta.button")}</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 10. Activity Breakdown — full width */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("dashboard.activity.title")}</CardTitle>
              </div>
              <CardDescription>{t("dashboard.activity.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorBoundary compact>
                <ChartContainer height={300} mobileHeight={240} loading={loading} empty={!hasData} label={t("dashboard.activity.title")}>
                  <ActivityBarChart data={activityBreakdown} />
                </ChartContainer>
              </ErrorBoundary>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
