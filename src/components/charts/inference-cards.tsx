import { motion } from "framer-motion";
import {
  Moon,
  Sun,
  Activity,
  Users,
  Calendar,
  Briefcase,
  Pause,
  MessageCircle,
  Hourglass,
  Clock,
  Mail,
  Search,
  BarChart,
  Plane,
  TrendingUp,
  ArrowRightLeft,
  Smartphone,
  Scale,
  TrendingDown,
  Timer,
  CircleDot,
  Headphones,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useLocale } from "@/i18n";
import type { TranslationParams } from "@/i18n";
import type { InferenceCard } from "@/hooks/use-dashboard-data";
import { formatDays } from "@/utils/format-days";

const iconMap = {
  moon: Moon,
  sun: Sun,
  activity: Activity,
  users: Users,
  calendar: Calendar,
  briefcase: Briefcase,
  pause: Pause,
  "message-circle": MessageCircle,
  hourglass: Hourglass,
  clock: Clock,
  mail: Mail,
  search: Search,
  "bar-chart": BarChart,
  plane: Plane,
  "trending-up": TrendingUp,
  "arrow-right-left": ArrowRightLeft,
  smartphone: Smartphone,
  scale: Scale,
  "trending-down": TrendingDown,
  timer: Timer,
  "circle-dot": CircleDot,
  headphones: Headphones,
};

/** Regex matching known i18n key prefixes used as param values */
const I18N_KEY_RE = /(?:direction|pattern|circle|category)\.[a-zA-Z]+/g;

/** Resolve dayIndex → dayName and daysOfWeek → days before passing to t() */
function resolveParams(
  params: TranslationParams | undefined,
  t: (key: string, params?: TranslationParams) => string,
): TranslationParams | undefined {
  if (!params) return params;
  const resolved = { ...params };

  if ("dayIndex" in resolved) {
    resolved.dayName = t(`day.full.${resolved.dayIndex}`);
  }

  if ("daysOfWeek" in resolved && typeof resolved.daysOfWeek === "string") {
    const indices = (resolved.daysOfWeek as string).split(",").map(Number);
    const days = formatDays(indices, (i) => t(`day.short.${i}`));
    resolved.days = days;
  }

  // Pre-translate string param values that are i18n keys
  for (const [key, val] of Object.entries(resolved)) {
    if (typeof val !== "string" || val === "") continue;
    const translated = t(val);
    if (translated !== val) {
      // Simple key match — also pass sibling params for sub-interpolation
      resolved[key] = t(val, resolved);
    } else {
      // Try translating embedded keys (e.g., "circle.nightCircle (3), circle.work (2)")
      const withTranslated = val.replace(I18N_KEY_RE, (match) => {
        const tr = t(match);
        return tr !== match ? tr : match;
      });
      if (withTranslated !== val) {
        resolved[key] = withTranslated;
      }
    }
  }

  return resolved;
}

interface InferenceCardsProps {
  inferences: InferenceCard[];
}

export function InferenceCards({ inferences }: InferenceCardsProps) {
  const { t } = useLocale();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {inferences.map((inf, idx) => {
        const Icon = iconMap[inf.icon];
        const titleParams = resolveParams(inf.titleParams, t);
        const descParams = resolveParams(inf.descParams, t);
        return (
          <motion.div
            key={inf.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.04 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm leading-snug">
                      {t(inf.titleKey, titleParams)}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs leading-relaxed">
                      {t(inf.descKey, descParams)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-destructive">
                  {t(inf.privacyKey)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
