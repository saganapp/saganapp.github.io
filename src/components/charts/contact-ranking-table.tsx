import { useState } from "react";
import { motion } from "framer-motion";
import type { ContactRanking, Platform } from "@/parsers/types";
import { PLATFORMS } from "@/parsers/types";
import { useLocale } from "@/i18n";
import { PLATFORM_META } from "@/utils/platform";
import { formatCompact } from "@/utils/format";

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = (seconds / 3600).toFixed(1);
  return `${hours}h`;
}

interface ContactRankingTableProps {
  rankings: ContactRanking[];
  initialLimit?: number;
}

export function ContactRankingTable({
  rankings,
  initialLimit = 20,
}: ContactRankingTableProps) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">(
    "all",
  );

  const filtered =
    platformFilter === "all"
      ? rankings
      : rankings.filter((r) => r.platforms.includes(platformFilter));

  const shown = expanded ? filtered : filtered.slice(0, initialLimit);
  const hasMore = filtered.length > initialLimit;

  const activePlatforms = PLATFORMS.filter((p) =>
    rankings.some((r) => r.platforms.includes(p)),
  );

  // Max interactions for inline bar scaling
  const maxInteractions =
    shown.length > 0 ? shown[0].totalInteractions : 1;

  return (
    <div className="space-y-3">
      {/* Platform filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setPlatformFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            platformFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {t("dashboard.contacts.filterAll")}
        </button>
        {activePlatforms.map((p) => {
          const meta = PLATFORM_META[p];
          return (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                platformFilter === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {meta.name}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-8 pb-2 pr-3 font-medium">
                {t("dashboard.contacts.rank")}
              </th>
              <th className="pb-2 pr-3 font-medium">
                {t("dashboard.contacts.name")}
              </th>
              <th className="pb-2 pr-3 text-right font-medium">
                {t("dashboard.contacts.interactions")}
              </th>
              <th className="hidden pb-2 pr-3 text-right font-medium sm:table-cell">
                {t("dashboard.contacts.time")}
              </th>
              <th className="pb-2 font-medium">
                {t("dashboard.contacts.platforms")}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((contact, idx) => {
              const barPct = (contact.totalInteractions / maxInteractions) * 100;
              return (
                <motion.tr
                  key={contact.name}
                  className="border-b border-border/50 transition-colors last:border-0 hover:bg-accent/30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: idx * 0.015 }}
                >
                  <td className="py-2 pr-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold tabular-nums text-primary">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-medium">{contact.name}</td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted/30 sm:block">
                        <motion.div
                          className="h-full rounded-full bg-primary/40"
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{
                            duration: 0.6,
                            delay: 0.1 + idx * 0.02,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        />
                      </div>
                      <span className="font-mono tabular-nums">
                        {formatCompact(contact.totalInteractions)}
                      </span>
                    </div>
                    {contact.byCategory &&
                      Object.keys(contact.byCategory).length > 0 && (
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {Object.entries(contact.byCategory)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 3)
                            .map(
                              ([cat, count]) =>
                                `${formatCompact(count)} ${t(cat)}`,
                            )
                            .join(" \u00b7 ")}
                        </div>
                      )}
                  </td>
                  <td className="hidden py-2 pr-3 text-right font-mono tabular-nums text-muted-foreground sm:table-cell">
                    {formatTime(contact.estimatedTimeSeconds)}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1">
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
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Show more/less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline"
        >
          {expanded
            ? t("dashboard.contacts.showLess")
            : t("dashboard.contacts.showMore")}
        </button>
      )}
    </div>
  );
}
