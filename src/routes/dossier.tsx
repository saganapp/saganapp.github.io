import { motion } from "framer-motion";
import { usePageTitle } from "@/hooks/use-page-title";
import { Printer, Clock, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/i18n";
import { useAppStore } from "@/store/app-store";
import { Link } from "react-router";
import { useDossierData } from "@/hooks/use-dossier-data";
import { DossierHabits } from "@/components/dossier/dossier-habits";
import { DossierSocial } from "@/components/dossier/dossier-social";
import { DossierWork } from "@/components/dossier/dossier-work";
import { DossierDigital } from "@/components/dossier/dossier-digital";
import { DossierTimeline } from "@/components/dossier/dossier-timeline";
import { DossierWarning } from "@/components/dossier/dossier-warning";

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
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

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : !hasData || !dossier ? (
        <div className="mt-8 flex h-64 items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20">
          <p className="text-sm text-muted-foreground">{t("dossier.empty")}</p>
        </div>
      ) : (
        <motion.div
          className="mt-8 space-y-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {/* 2x2 Grid of Profile Sections */}
          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div variants={item}>
              <DossierHabits habits={dossier.personalHabits} />
            </motion.div>
            <motion.div variants={item}>
              <DossierSocial social={dossier.socialNetwork} />
            </motion.div>
            <motion.div variants={item}>
              <DossierWork work={dossier.workProfile} />
            </motion.div>
            <motion.div variants={item}>
              <DossierDigital digital={dossier.digitalProfile} />
            </motion.div>
          </div>

          {/* Life Events Timeline */}
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{t("dossier.timeline.title")}</CardTitle>
                  {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <DossierTimeline events={dossier.lifeEvents} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Privacy Warning */}
          <motion.div variants={item}>
            <DossierWarning />
          </motion.div>
        </motion.div>
      )}

    </div>
  );
}
