import { Briefcase } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierProfile } from "@/analysis";
import { DossierSection } from "./dossier-section";

interface Props {
  work: DossierProfile["workProfile"];
}

function DossierRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function DossierWork({ work }: Props) {
  const { t } = useLocale();

  return (
    <DossierSection icon={Briefcase} title={t("dossier.work.title")}>
      <DossierRow
        label={t("dossier.work.estimatedHours")}
        value={work.estimatedWorkHours != null ? t("dossier.format.hours", { value: work.estimatedWorkHours.toFixed(1) }) : "—"}
      />
      <DossierRow
        label={t("dossier.work.distractionMinutes")}
        value={work.distractionMinutesPerWeek != null ? t("dossier.format.approxMinutes", { value: work.distractionMinutesPerWeek }) : "—"}
      />
      <DossierRow
        label={t("dossier.work.meetingsPerWeek")}
        value={work.meetingsPerWeek != null ? `~${work.meetingsPerWeek}` : "—"}
      />
      <DossierRow
        label={t("dossier.work.busiestDay")}
        value={work.busiestDay != null ? t(`day.full.${work.busiestDay}`) : "—"}
      />
    </DossierSection>
  );
}
