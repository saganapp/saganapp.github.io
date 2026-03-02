import { Activity } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierBehavioral } from "@/analysis/dossier";
import { ReportSection } from "./report-section";
import { ReportSubsection } from "./report-subsection";
import { ReportFinding } from "./report-finding";
import { ReportList } from "./report-list";

interface Props {
  data: DossierBehavioral;
}

export function ReportBehavioral({ data }: Props) {
  const { t } = useLocale();
  const { sleep, lulls, rhythm } = data;

  return (
    <ReportSection number={2} title={t("dossier.report.behavioral.title")} icon={Activity}>
      {/* 2.1 Sleep & Circadian */}
      <ReportSubsection number="2.1" title={t("dossier.report.behavioral.sleep.title")}>
        {sleep.schedule ? (
          <ReportFinding>
            {t("dossier.report.behavioral.sleep.narrative", {
              schedule: sleep.schedule,
              chronotype: sleep.chronotype
                ? t(`dossier.report.behavioral.sleep.${sleep.chronotype}`)
                : t("dossier.report.behavioral.sleep.undetermined"),
              confidence: sleep.confidence != null ? Math.round(sleep.confidence * 100) : 0,
            })}
          </ReportFinding>
        ) : (
          <ReportFinding>{t("dossier.report.noData")}</ReportFinding>
        )}

        {sleep.drift && (
          <ReportFinding label={t("dossier.report.behavioral.sleep.drift")}>
            {t("dossier.report.behavioral.sleep.driftDesc", {
              minutes: sleep.drift.minutes,
              direction: t(`dossier.report.direction.${sleep.drift.direction}`),
            })}
          </ReportFinding>
        )}

        {(sleep.firstActivity || sleep.lastActivity) && (
          <ReportFinding label={t("dossier.report.behavioral.sleep.window")}>
            {t("dossier.report.behavioral.sleep.windowDesc", {
              first: sleep.firstActivity ?? "—",
              last: sleep.lastActivity ?? "—",
            })}
          </ReportFinding>
        )}
      </ReportSubsection>

      {/* 2.2 Recurring Lulls */}
      {lulls.length > 0 && (
        <ReportSubsection number="2.2" title={t("dossier.report.behavioral.lulls.title")}>
          <ReportList
            items={lulls.map((lull) => {
              const days = lull.daysOfWeek
                .map((d) => t(`day.short.${d}`))
                .join(", ");
              return (
                <span key={`${lull.startHour}-${lull.endHour}`}>
                  <span className="font-medium text-foreground">{days}</span>
                  {" "}{lull.startHour}:00–{lull.endHour}:00
                  {" "}({Math.round(lull.confidence * 100)}% {t("dossier.report.behavioral.lulls.confidence")}, {lull.weekCount} {t("dossier.report.behavioral.lulls.weeks")})
                </span>
              );
            })}
          />
        </ReportSubsection>
      )}

      {/* 2.3 Activity Rhythm */}
      <ReportSubsection number={lulls.length > 0 ? "2.3" : "2.2"} title={t("dossier.report.behavioral.rhythm.title")}>
        {rhythm.busiestDay != null && (
          <ReportFinding label={t("dossier.report.behavioral.rhythm.busiestDay")}>
            {t("dossier.report.behavioral.rhythm.busiestDayDesc", {
              day: t(`day.full.${rhythm.busiestDay}`),
              pct: rhythm.busiestDayPct ?? 0,
            })}
          </ReportFinding>
        )}
        {rhythm.weekendWeekdayRatio != null && (
          <ReportFinding label={t("dossier.report.behavioral.rhythm.ratio")}>
            {t("dossier.report.behavioral.rhythm.ratioDesc", {
              ratio: rhythm.weekendWeekdayRatio,
            })}
          </ReportFinding>
        )}
        {rhythm.peakHour != null && (
          <ReportFinding label={t("dossier.report.behavioral.rhythm.peakHour")}>
            {t("dossier.report.behavioral.rhythm.peakHourDesc", {
              hour: `${rhythm.peakHour}:00`,
            })}
          </ReportFinding>
        )}
      </ReportSubsection>
    </ReportSection>
  );
}
