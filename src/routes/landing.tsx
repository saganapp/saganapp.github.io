import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { usePageTitle } from "@/hooks/use-page-title";
import { motion } from "framer-motion";
import { TileReveal } from "@/components/landing/tile-reveal";
import {
  Shield,
  Eye,
  Zap,
  Lock,
  BarChart3,
  Users,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadDemoData } from "@/demo/load-demo";
import { useLocale } from "@/i18n";
import {
  StatCounterRow,
  MetadataCategoryGrid,
  RealWorldCases,
  ExportGuides,
  CtaBanner,
} from "@/components/landing/metadata-infographic";

const featureDefs = [
  { icon: Shield, key: "private" },
  { icon: Eye, key: "metadata" },
  { icon: Zap, key: "instant" },
  { icon: Lock, key: "gdpr" },
  { icon: BarChart3, key: "viz" },
  { icon: Users, key: "social" },
] as const;

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function renderHighlight(text: string): ReactNode {
  const parts = text.split(/\{highlight\}|\{\/highlight\}/);
  if (parts.length < 3) return text;
  return (
    <>
      {parts[0]}
      <span className="text-primary">{parts[1]}</span>
      {parts[2]}
    </>
  );
}

export function LandingPage() {
  usePageTitle("pageTitle.home");
  const navigate = useNavigate();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const { t } = useLocale();

  async function handleTryDemo() {
    setLoadingDemo(true);
    try {
      await loadDemoData();
      navigate("/dashboard");
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4">
      <TileReveal />
      {/* A) Hero */}
      <motion.section
        className="flex flex-col items-center gap-5 pb-10 pt-12 text-center md:pt-16"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Badge variant="secondary">{t("landing.hero.badge")}</Badge>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
          {renderHighlight(t("landing.hero.title"))}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          {t("landing.hero.subtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full sm:w-auto">
          <Button size="lg" className="w-full sm:w-auto" onClick={handleTryDemo} disabled={loadingDemo}>
            {loadingDemo ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("landing.hero.loading")}
              </>
            ) : (
              t("landing.hero.tryDemo")
            )}
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link to="/import">{t("landing.hero.importData")}</Link>
          </Button>
        </div>
        <button
          onClick={() => document.getElementById("export-guides")?.scrollIntoView({ behavior: "smooth" })}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          {t("landing.hero.howToExport")}
        </button>
      </motion.section>

      {/* B) Stat Counter Row */}
      <StatCounterRow />

      {/* C) Metadata Category Grid */}
      <MetadataCategoryGrid />

      {/* D) Real-World Cases */}
      <RealWorldCases />

      {/* E) Features */}
      <section className="pb-4 pt-8 text-center">
        <h2 className="text-2xl font-bold">{t("landing.features.title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("landing.features.subtitle")}</p>
      </section>
      <motion.section
        className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        {featureDefs.map((f) => (
          <motion.div key={f.key} variants={item}>
            <Card className="h-full">
              <CardHeader>
                <f.icon className="mb-2 h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {t(`landing.feature.${f.key}.title`)}
                </CardTitle>
                <CardDescription>
                  {t(`landing.feature.${f.key}.desc`)}
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </motion.section>

      {/* G) Export Guides */}
      <ExportGuides />

      {/* F) CTA Banner */}
      <CtaBanner onTryDemo={handleTryDemo} loadingDemo={loadingDemo} />
    </div>
  );
}
