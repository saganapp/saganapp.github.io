import { Smartphone } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierDigital } from "@/analysis/dossier";
import { ReportSection } from "./report-section";
import { ReportSubsection } from "./report-subsection";
import { ReportFinding } from "./report-finding";
import { ReportList } from "./report-list";

interface Props {
  data: DossierDigital;
}

export function ReportDigital({ data }: Props) {
  const { t } = useLocale();
  const { platforms, devices } = data;

  return (
    <ReportSection number={5} title={t("dossier.report.digital.title")} icon={Smartphone}>
      {/* 5.1 Platform Ecosystem */}
      <ReportSubsection number="5.1" title={t("dossier.report.digital.platforms.title")}>
        {platforms.primary && (
          <ReportFinding label={t("dossier.report.digital.platforms.primary")}>
            {platforms.primary}
            {platforms.primaryPct != null && (
              <> (<span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono font-semibold text-primary text-xs">{platforms.primaryPct}%</span> {t("dossier.report.digital.platforms.ofActivity")})</>
            )}
          </ReportFinding>
        )}
        {platforms.all.length > 0 && (
          <ReportFinding label={t("dossier.report.digital.platforms.all")}>
            {platforms.all.join(", ")}
          </ReportFinding>
        )}
        {platforms.migration && (
          <ReportFinding label={t("dossier.report.digital.platforms.migration")}>
            {platforms.migration}
          </ReportFinding>
        )}
        {platforms.timeByPlatform.length > 0 && (
          <>
            <ReportFinding label={t("dossier.report.digital.platforms.timeBreakdown")} children="" />
            <ReportList
              items={platforms.timeByPlatform.map((p) => (
                <span key={p.platform}>
                  <span className="font-medium text-foreground">{p.platform}</span>
                  {" — ~"}{p.hours}h
                </span>
              ))}
            />
          </>
        )}
      </ReportSubsection>

      {/* 5.2 Device History */}
      {devices.records.length > 0 && (
        <ReportSubsection number="5.2" title={t("dossier.report.digital.devices.title")}>
          <ReportList
            items={devices.records.map((d) => (
              <span key={d.name}>
                <span className="font-medium text-foreground">{d.name}</span>
                {" "}({d.firstSeen} – {d.lastSeen})
              </span>
            ))}
          />
          {devices.totalEstimatedHours != null && (
            <ReportFinding label={t("dossier.report.digital.devices.totalHours")}>
              {t("dossier.report.digital.devices.totalHoursDesc", {
                hours: devices.totalEstimatedHours,
              })}
            </ReportFinding>
          )}
        </ReportSubsection>
      )}
    </ReportSection>
  );
}
