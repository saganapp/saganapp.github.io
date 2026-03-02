import { FileSearch } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierOverview } from "@/analysis/dossier";
import { ReportSection } from "./report-section";
import { ReportFinding } from "./report-finding";
import { ReportList } from "./report-list";

interface Props {
  data: DossierOverview;
}

export function ReportOverview({ data }: Props) {
  const { t } = useLocale();

  return (
    <ReportSection number={1} title={t("dossier.report.overview.title")} icon={FileSearch}>
      <ReportFinding>
        {t("dossier.report.overview.summary", {
          dateRange: data.dateRange ?? t("dossier.report.unknown"),
          totalEvents: data.totalEvents,
          platforms: data.platforms.length,
          screenHours: data.estimatedScreenHours ?? 0,
          contacts: data.uniqueContacts,
        })}
      </ReportFinding>

      {data.topCategories.length > 0 && (
        <>
          <ReportFinding label={t("dossier.report.overview.categories")} children="" />
          <ReportList
            items={data.topCategories.map((c) => (
              <span key={c.label}>
                <span className="font-medium text-foreground">{c.label}</span>
                {" — "}{c.count.toLocaleString()} ({c.pct}%)
              </span>
            ))}
          />
        </>
      )}
    </ReportSection>
  );
}
