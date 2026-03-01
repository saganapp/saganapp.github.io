import { motion } from "framer-motion";
import type { ContactRanking } from "@/parsers/types";
import { useLocale } from "@/i18n";
import { PLATFORM_META } from "@/utils/platform";

interface WeekendContactsProps {
  contacts: ContactRanking[];
  limit?: number;
}

export function WeekendContacts({ contacts, limit = 8 }: WeekendContactsProps) {
  const { t } = useLocale();
  const shown = contacts.slice(0, limit);

  if (shown.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {shown.map((contact, idx) => {
        const pct =
          contact.totalInteractions > 0
            ? Math.round(
                (contact.weekendInteractions / contact.totalInteractions) * 100,
              )
            : 0;

        return (
          <motion.div
            key={contact.name}
            className="relative overflow-hidden rounded-lg border border-border/50"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
          >
            {/* Percentage bar background */}
            <div
              className="absolute inset-y-0 left-0 bg-primary/5"
              style={{ width: `${pct}%` }}
            />
            {/* Content */}
            <div className="relative flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex shrink-0 gap-1">
                  {contact.platforms.map((p) => {
                    const Icon = PLATFORM_META[p].icon;
                    return (
                      <Icon
                        key={p}
                        className="h-3.5 w-3.5"
                        style={{ color: `var(--platform-${p})` }}
                      />
                    );
                  })}
                </div>
                <span className="truncate text-sm font-medium">
                  {contact.name}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {t("dashboard.weekendContacts.count", {
                    count: contact.weekendInteractions,
                  })}
                </span>
                <span className="ml-2 text-xs text-muted-foreground/70">
                  {t("dashboard.weekendContacts.pct", { pct })}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
