import { Briefcase } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierWork } from "@/analysis/dossier";
import { ReportSection } from "./report-section";
import { ReportSubsection } from "./report-subsection";
import { ReportFinding } from "./report-finding";
import { ReportList } from "./report-list";

interface Props {
  data: DossierWork;
}

export function ReportWork({ data }: Props) {
  const { t } = useLocale();
  const { workHours, meetings } = data;

  const hasWorkData = workHours.distractionMinPerWeek != null;
  const hasMeetingData = meetings.perWeek != null;

  if (!hasWorkData && !hasMeetingData) return null;

  return (
    <ReportSection number={4} title={t("dossier.report.work.title")} icon={Briefcase}>
      {/* 4.1 Work Hours Impact */}
      {hasWorkData && (
        <ReportSubsection number="4.1" title={t("dossier.report.work.hours.title")}>
          <ReportFinding>
            {t("dossier.report.work.hours.narrative", {
              minutes: workHours.distractionMinPerWeek ?? 0,
              pct: workHours.percentOfWorkHours ?? 0,
            })}
          </ReportFinding>
          {workHours.byPlatform.length > 0 && (
            <ReportList
              items={workHours.byPlatform.map((p) => (
                <span key={p.platform}>
                  <span className="font-medium text-foreground">{p.platform}</span>
                  {" — ~"}{p.minutes} {t("dossier.report.work.hours.minPerWeek")}
                </span>
              ))}
            />
          )}
        </ReportSubsection>
      )}

      {/* 4.2 Meeting Load */}
      {hasMeetingData && (
        <ReportSubsection number={hasWorkData ? "4.2" : "4.1"} title={t("dossier.report.work.meetings.title")}>
          <ReportFinding>
            {t("dossier.report.work.meetings.narrative", {
              perWeek: meetings.perWeek ?? 0,
            })}
          </ReportFinding>
        </ReportSubsection>
      )}
    </ReportSection>
  );
}
