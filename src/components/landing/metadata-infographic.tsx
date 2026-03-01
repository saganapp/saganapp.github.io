import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  Clock,
  Users,
  MapPin,
  Heart,
  FileText,
  GitBranch,
  Cpu,
  EyeOff,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/* ------------------------------------------------------------------ */
/*  B) Stat Counter Row                                                */
/* ------------------------------------------------------------------ */

const statDefs = [
  { icon: Clock, key: "wake" },
  { icon: Users, key: "contacts" },
  { icon: MapPin, key: "cities" },
  { icon: Heart, key: "partner" },
] as const;

export function StatCounterRow() {
  const { t } = useLocale();
  return (
    <motion.section
      className="grid grid-cols-2 gap-8 py-16 md:grid-cols-4"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      {statDefs.map((s) => (
        <motion.div key={s.key} variants={item} className="flex flex-col items-center text-center gap-2">
          <s.icon className="h-6 w-6 text-primary" />
          <span className="text-4xl font-bold tabular-nums">
            {t(`landing.stats.${s.key}.value`)}
          </span>
          <span className="text-sm text-muted-foreground">
            {t(`landing.stats.${s.key}.label`)}
          </span>
        </motion.div>
      ))}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  C) "The Four Faces of Metadata" Category Grid                      */
/* ------------------------------------------------------------------ */

const categoryDefs = [
  { icon: FileText, key: "properties" },
  { icon: GitBranch, key: "correlation" },
  { icon: Cpu, key: "technical" },
  { icon: EyeOff, key: "absence" },
] as const;

export function MetadataCategoryGrid() {
  const { t } = useLocale();
  return (
    <motion.section
      className="grid gap-4 py-16 sm:grid-cols-2"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      {categoryDefs.map((c) => (
        <motion.div key={c.key} variants={item}>
          <Card className="h-full bg-muted/50">
            <CardHeader>
              <c.icon className="mb-2 h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                {t(`landing.category.${c.key}.title`)}
              </CardTitle>
              <CardDescription>
                {t(`landing.category.${c.key}.desc`)}
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      ))}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  D) "Real-World Cases" Reference Cards                              */
/* ------------------------------------------------------------------ */

const caseDefs = [
  { key: "pizza", url: "https://es.wikipedia.org/wiki/Pizza_Meter" },
  { key: "fitness", url: "https://techcrunch.com/2013/07/05/how-health-trackers-could-reduce-sexual-infidelity/" },
  { key: "likes", url: "https://www.pnas.org/doi/10.1073/pnas.1218772110" },
  { key: "jets", url: "https://gizmodo.com/meta-bans-accounts-tracking-private-jets-of-celebs-and-russian-oligarchs-2000514958" },
  { key: "sms", url: "https://arxiv.org/abs/2306.07695" },
  { key: "exif", url: "https://securelist.lat/el-fbi-identifica-a-un-hacker-por-la-foto-de-los-senos-de-su-novia/76377/" },
  { key: "printer", url: "https://www.bitdefender.com/en-us/blog/hotforsecurity/printer-dots-point-fbi-to-contractor-accused-of-leaking-nsa-report-on-russian-cyberattack" },
  { key: "twitter", url: "https://www.businessinsider.com/elon-musk-ending-catching-brand-tweets-promoting-android-sent-iphone-2022-11" },
] as const;

const badgeVariantMap: Record<string, "default" | "secondary" | "outline"> = {
  Correlation: "default",
  Correlación: "default",
  Properties: "secondary",
  Propiedades: "secondary",
  Technical: "outline",
  Técnico: "outline",
  Absence: "secondary",
  Ausencia: "secondary",
};

export function RealWorldCases() {
  const { t } = useLocale();
  return (
    <section className="py-16">
      <div className="mb-10 text-center">
        <h2 className="text-2xl font-bold">{t("landing.cases.title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("landing.cases.subtitle")}</p>
      </div>
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
      >
        {caseDefs.map((c) => {
          const badgeText = t(`landing.case.${c.key}.badge`);
          return (
            <motion.div key={c.key} variants={item}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="gap-3">
                  <Badge variant={badgeVariantMap[badgeText] ?? "default"} className="w-fit">
                    {badgeText}
                  </Badge>
                  <CardTitle className="text-base leading-snug">
                    {t(`landing.case.${c.key}.title`)}
                  </CardTitle>
                  <CardDescription>
                    {t(`landing.case.${c.key}.desc`)}
                  </CardDescription>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("landing.cases.source")} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </CardHeader>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  G) Export Guides                                                    */
/* ------------------------------------------------------------------ */

import type { Platform } from "@/parsers/types";
import { PLATFORM_META } from "@/utils/platform";

function SignalBars({ level, cssVar }: { level: number; cssVar: string }) {
  return (
    <div className="flex items-end gap-[2px]" aria-label={`Signal ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`rounded-sm ${i > level ? "bg-muted-foreground/20" : ""}`}
          style={{
            width: 3,
            height: 4 + i * 2,
            backgroundColor: i <= level ? `var(${cssVar})` : undefined,
          }}
        />
      ))}
    </div>
  );
}

const exportGuideDefs: {
  platform: Platform;
  url: { en: string; es: string };
}[] = [
  {
    platform: "google",
    url: {
      en: "https://support.google.com/accounts/answer/3024190?hl=en",
      es: "https://support.google.com/accounts/answer/3024190?hl=es",
    },
  },
  {
    platform: "spotify",
    url: {
      en: "https://support.spotify.com/us/article/data-rights-and-privacy-settings/",
      es: "https://support.spotify.com/es/article/data-rights-and-privacy-settings/",
    },
  },
  {
    platform: "twitter",
    url: {
      en: "https://help.x.com/en/managing-your-account/how-to-download-your-x-archive",
      es: "https://help.x.com/es/managing-your-account/how-to-download-your-x-archive",
    },
  },
  {
    platform: "tiktok",
    url: {
      en: "https://support.tiktok.com/en/account-and-privacy/personalized-ads-and-data/requesting-your-data",
      es: "https://support.tiktok.com/es/account-and-privacy/personalized-ads-and-data/requesting-your-data",
    },
  },
  {
    platform: "instagram",
    url: {
      en: "https://help.instagram.com/181231772500920",
      es: "https://help.instagram.com/181231772500920/?locale=es_ES",
    },
  },
  {
    platform: "telegram",
    url: {
      en: "https://telegram.org/blog/export-and-more",
      es: "https://telegram.org/blog/export-and-more",
    },
  },
  {
    platform: "garmin",
    url: {
      en: "https://www.garmin.com/en-US/account/datamanagement/",
      es: "https://www.garmin.com/es-ES/account/datamanagement/",
    },
  },
  {
    platform: "whatsapp",
    url: {
      en: "https://faq.whatsapp.com/1180414079177245/",
      es: "https://faq.whatsapp.com/1180414079177245/",
    },
  },
];

export function ExportGuides() {
  const { t, locale } = useLocale();
  return (
    <section id="export-guides" className="py-16">
      <div className="mb-10 text-center">
        <h2 className="text-2xl font-bold">{t("landing.export.title")}</h2>
        <p className="mt-2 text-muted-foreground">
          {t("landing.export.subtitle")}
        </p>
      </div>
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
      >
        {exportGuideDefs.map((g) => {
          const meta = PLATFORM_META[g.platform];
          const Icon = meta.icon;
          const note = t(`landing.export.${g.platform}.note`);
          const hasNote =
            note !== `landing.export.${g.platform}.note` && note !== "";
          return (
            <motion.div key={g.platform} variants={item}>
              <Card className="relative h-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: `var(${meta.cssVar})` }}
                />
                <CardHeader className="gap-3 pl-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon
                        className="h-4 w-4"
                        style={{ color: `var(${meta.cssVar})` }}
                      />
                      <CardTitle className="text-base">{meta.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <SignalBars level={meta.signalLevel} cssVar={meta.cssVar} />
                      <span className="text-xs text-muted-foreground">
                        {t(`platform.${g.platform}.signal`)}
                      </span>
                      <Badge variant="outline" className="text-xs font-mono">
                        {t(`landing.export.${g.platform}.format`)}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(`landing.export.${g.platform}.steps`)}
                  </p>
                  {hasNote && (
                    <p className="text-xs italic text-muted-foreground/70">
                      {note}
                    </p>
                  )}
                  <a
                    href={g.url[locale] ?? g.url.en}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("landing.export.officialGuide")}{" "}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </CardHeader>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  F) CTA Banner                                                      */
/* ------------------------------------------------------------------ */

export function CtaBanner({
  onTryDemo,
  loadingDemo,
}: {
  onTryDemo: () => void;
  loadingDemo: boolean;
}) {
  const { t } = useLocale();
  return (
    <section className="py-16">
      <Card className="bg-muted/50">
        <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <h2 className="text-2xl font-bold">{t("landing.cta.title")}</h2>
          <p className="max-w-xl text-muted-foreground">{t("landing.cta.subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button size="lg" onClick={onTryDemo} disabled={loadingDemo}>
              {loadingDemo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("landing.hero.loading")}
                </>
              ) : (
                t("landing.hero.tryDemo")
              )}
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/import">{t("landing.hero.importData")}</Link>
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
