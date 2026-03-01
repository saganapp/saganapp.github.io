import { BedDouble } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierProfile } from "@/analysis";
import { DossierSection } from "./dossier-section";

interface Props {
  habits: DossierProfile["personalHabits"];
}

function DossierRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function DossierHabits({ habits }: Props) {
  const { t } = useLocale();

  const chronotypeLabel = habits.chronotype === "night-owl"
    ? t("dossier.habits.nightOwl")
    : habits.chronotype === "early-bird"
    ? t("dossier.habits.earlyBird")
    : t("dossier.habits.noData");

  const driftLabel = habits.sleepDrift
    ? habits.sleepDrift.direction === "later"
      ? t("dossier.habits.driftLater", { minutes: habits.sleepDrift.minutes })
      : t("dossier.habits.driftEarlier", { minutes: habits.sleepDrift.minutes })
    : t("dossier.habits.noDrift");

  return (
    <DossierSection icon={BedDouble} title={t("dossier.habits.title")}>
      <DossierRow
        label={t("dossier.habits.sleepSchedule")}
        value={habits.sleepSchedule ?? t("dossier.habits.noData")}
      />
      <DossierRow
        label={t("dossier.habits.chronotype")}
        value={chronotypeLabel}
      />
      <DossierRow
        label={t("dossier.habits.sleepDrift")}
        value={driftLabel}
      />
      <DossierRow
        label={t("dossier.habits.firstActivity")}
        value={habits.firstActivity ?? t("dossier.habits.noData")}
      />
      <DossierRow
        label={t("dossier.habits.lastActivity")}
        value={habits.lastActivity ?? t("dossier.habits.noData")}
      />
    </DossierSection>
  );
}
