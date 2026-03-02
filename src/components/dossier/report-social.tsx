import { Users } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierSocial } from "@/analysis/dossier";
import { ReportSection } from "./report-section";
import { ReportSubsection } from "./report-subsection";
import { ReportFinding } from "./report-finding";
import { ReportList } from "./report-list";

function formatMs(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

interface Props {
  data: DossierSocial;
}

export function ReportSocial({ data }: Props) {
  const { t } = useLocale();
  const { network, dynamics, trends, circles } = data;

  return (
    <ReportSection number={3} title={t("dossier.report.social.title")} icon={Users}>
      {/* 3.1 Network Overview */}
      <ReportSubsection number="3.1" title={t("dossier.report.social.network.title")}>
        <ReportFinding label={t("dossier.report.social.network.total")}>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono font-semibold text-primary">{network.totalContacts}</span>
        </ReportFinding>
        {network.innerCircle.length > 0 && (
          <ReportFinding label={t("dossier.report.social.network.innerCircle")}>
            {network.innerCircle.join(", ")}
          </ReportFinding>
        )}
        {network.socialCircles.length > 0 && (
          <ReportList
            items={network.socialCircles.map((c) => (
              <span key={c.label}>
                <span className="font-medium text-foreground">{c.label}</span>
                {" — "}{c.contacts.length} {t("dossier.report.social.network.members")}
              </span>
            ))}
          />
        )}
      </ReportSubsection>

      {/* 3.2 Relationship Dynamics */}
      {(dynamics.mostImbalanced || dynamics.responseLatency || dynamics.burstContact) && (
        <ReportSubsection number="3.2" title={t("dossier.report.social.dynamics.title")}>
          {dynamics.mostImbalanced && (
            <ReportFinding label={t("dossier.report.social.dynamics.imbalanced")}>
              {t("dossier.report.social.dynamics.imbalancedDesc", {
                contact: dynamics.mostImbalanced.contact,
                pct: Math.round(dynamics.mostImbalanced.ratio * 100),
              })}
            </ReportFinding>
          )}
          {dynamics.responseLatency && (
            <ReportFinding label={t("dossier.report.social.dynamics.latency")}>
              {t("dossier.report.social.dynamics.latencyDesc", {
                contact: dynamics.responseLatency.contact,
                yours: formatMs(dynamics.responseLatency.yourMedianMs),
                theirs: formatMs(dynamics.responseLatency.theirMedianMs),
              })}
            </ReportFinding>
          )}
          {dynamics.burstContact && (
            <ReportFinding label={t("dossier.report.social.dynamics.burst")}>
              {t("dossier.report.social.dynamics.burstDesc", {
                contact: dynamics.burstContact.contact,
                bursts: dynamics.burstContact.bursts,
                avg: dynamics.burstContact.avgMessages,
              })}
            </ReportFinding>
          )}
        </ReportSubsection>
      )}

      {/* 3.3 Relationship Trends */}
      {(trends.growing.length > 0 || trends.fading.length > 0) && (
        <ReportSubsection number="3.3" title={t("dossier.report.social.trends.title")}>
          {trends.growing.length > 0 && (
            <>
              <ReportFinding label={t("dossier.report.social.trends.growing")} children="" />
              <ReportList
                items={trends.growing.map((c) => (
                  <span key={c.contact}>
                    {c.contact} <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">+{c.changePct}%</span>
                  </span>
                ))}
              />
            </>
          )}
          {trends.fading.length > 0 && (
            <>
              <ReportFinding label={t("dossier.report.social.trends.fading")} children="" />
              <ReportList
                items={trends.fading.map((c) => (
                  <span key={c.contact}>
                    {c.contact} <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">{c.changePct}%</span>
                  </span>
                ))}
              />
            </>
          )}
        </ReportSubsection>
      )}

      {/* 3.4 Night & Weekend Circles */}
      {(circles.lateNightContacts.length > 0 || circles.weekendContacts.length > 0) && (
        <ReportSubsection number="3.4" title={t("dossier.report.social.circles.title")}>
          {circles.lateNightContacts.length > 0 && (
            <ReportFinding label={t("dossier.report.social.circles.night")}>
              {circles.lateNightContacts.join(", ")}
            </ReportFinding>
          )}
          {circles.weekendContacts.length > 0 && (
            <ReportFinding label={t("dossier.report.social.circles.weekend")}>
              {circles.weekendContacts.join(", ")}
            </ReportFinding>
          )}
        </ReportSubsection>
      )}
    </ReportSection>
  );
}
