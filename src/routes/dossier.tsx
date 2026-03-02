import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { usePageTitle } from "@/hooks/use-page-title";
import { Printer, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/i18n";
import { useAppStore } from "@/store/app-store";
import { Link } from "react-router";
import { useDossierData } from "@/hooks/use-dossier-data";
import { ReportOverview } from "@/components/dossier/report-overview";
import { ReportBehavioral } from "@/components/dossier/report-behavioral";
import { ReportSocial } from "@/components/dossier/report-social";
import { ReportWork } from "@/components/dossier/report-work";
import { ReportDigital } from "@/components/dossier/report-digital";
import { ReportEvents } from "@/components/dossier/report-events";
import { DossierWarning } from "@/components/dossier/dossier-warning";
import { loadDemoData } from "@/demo/load-demo";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function DossierPage() {
  usePageTitle("pageTitle.dossier");
  const { loading, dossier, hasData } = useDossierData();
  const { t } = useLocale();
  const demoMode = useAppStore((s) => s.demoMode);

  // Auto-load demo data when dossier is empty
  const demoGuard = useRef(false);
  useEffect(() => {
    if (!loading && !hasData && !demoGuard.current) {
      demoGuard.current = true;
      loadDemoData();
    }
  }, [loading, hasData]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("dossier.title")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("dossier.subtitle")}
          </p>
        </div>
        {hasData && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            {t("dossier.printButton")}
          </Button>
        )}
      </motion.div>

      {/* Demo mode banner */}
      {demoMode && !loading && hasData && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30"
        >
          <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t("demo.banner")}
          </p>
          <Button asChild variant="outline" size="xs" className="ml-auto shrink-0">
            <Link to="/import">{t("landing.hero.importData")}</Link>
          </Button>
        </motion.div>
      )}

      {/* Demo badge */}
      {demoMode && !loading && hasData && (
        <div className="mt-4 print:hidden">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
            {t("demo.badge")}
          </Badge>
        </div>
      )}

      {loading ? (
        <div className="mt-8 space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      ) : !hasData || !dossier ? (
        <div className="mt-8 flex h-64 items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20">
          <p className="text-sm text-muted-foreground">{t("dossier.empty")}</p>
        </div>
      ) : (
        <motion.div
          className="mt-8 space-y-6"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item}>
            <ReportOverview data={dossier.overview} />
          </motion.div>

          <motion.div variants={item}>
            <ReportBehavioral data={dossier.behavioral} />
          </motion.div>

          <motion.div variants={item}>
            <ReportSocial data={dossier.social} />
          </motion.div>

          <motion.div variants={item}>
            <ReportWork data={dossier.work} />
          </motion.div>

          <motion.div variants={item}>
            <ReportDigital data={dossier.digital} />
          </motion.div>

          <motion.div variants={item}>
            <ReportEvents data={dossier.events} />
          </motion.div>

          <motion.div variants={item}>
            <DossierWarning />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
