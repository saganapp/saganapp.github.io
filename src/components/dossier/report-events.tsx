import { CalendarClock } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierEvents, DossierEventItem } from "@/analysis/dossier";
import { ReportSection } from "./report-section";
import { ReportSubsection } from "./report-subsection";
import { ReportList } from "./report-list";

function translateParams(
  params: Record<string, string | number> | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): Record<string, string | number> | undefined {
  if (!params) return params;
  const resolved = { ...params };
  for (const [key, val] of Object.entries(resolved)) {
    if (typeof val !== "string" || val === "") continue;
    const translated = t(val);
    if (translated !== val) resolved[key] = translated;
  }
  return resolved;
}

function EventItems({ items, t }: { items: DossierEventItem[]; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <ReportList
      items={items.map((item, i) => (
        <span key={i}>
          <span className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{item.date}</span>
          {" — "}
          {t(item.descriptionKey, translateParams(item.descriptionParams, t))}
        </span>
      ))}
    />
  );
}

interface Props {
  data: DossierEvents;
}

export function ReportEvents({ data }: Props) {
  const { t } = useLocale();

  const hasAny =
    data.activityGaps.length > 0 ||
    data.deviceChanges.length > 0 ||
    data.platformShifts.length > 0 ||
    data.behavioralChanges.length > 0;

  if (!hasAny) return null;

  let sub = 1;

  return (
    <ReportSection number={6} title={t("dossier.report.events.title")} icon={CalendarClock}>
      {data.activityGaps.length > 0 && (
        <ReportSubsection
          number={`6.${sub++}`}
          title={`${t("dossier.report.events.gaps")} (${data.activityGaps.length})`}
        >
          <EventItems items={data.activityGaps} t={t} />
        </ReportSubsection>
      )}
      {data.deviceChanges.length > 0 && (
        <ReportSubsection
          number={`6.${sub++}`}
          title={`${t("dossier.report.events.devices")} (${data.deviceChanges.length})`}
        >
          <EventItems items={data.deviceChanges} t={t} />
        </ReportSubsection>
      )}
      {data.platformShifts.length > 0 && (
        <ReportSubsection
          number={`6.${sub++}`}
          title={`${t("dossier.report.events.platforms")} (${data.platformShifts.length})`}
        >
          <EventItems items={data.platformShifts} t={t} />
        </ReportSubsection>
      )}
      {data.behavioralChanges.length > 0 && (
        <ReportSubsection
          number={`6.${sub++}`}
          title={`${t("dossier.report.events.behavioral")} (${data.behavioralChanges.length})`}
        >
          <EventItems items={data.behavioralChanges} t={t} />
        </ReportSubsection>
      )}
    </ReportSection>
  );
}
