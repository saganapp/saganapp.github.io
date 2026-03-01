import { Smartphone } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierProfile } from "@/analysis";
import { DossierSection } from "./dossier-section";

interface Props {
  digital: DossierProfile["digitalProfile"];
}

function DossierRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function DossierDigital({ digital }: Props) {
  const { t } = useLocale();

  return (
    <DossierSection icon={Smartphone} title={t("dossier.digital.title")}>
      <DossierRow
        label={t("dossier.digital.primaryPlatform")}
        value={digital.primaryPlatform ?? "—"}
      />
      <DossierRow
        label={t("dossier.digital.platforms")}
        value={digital.platforms.length > 0 ? digital.platforms.join(", ") : "—"}
      />
      <DossierRow
        label={t("dossier.digital.devices")}
        value={digital.devices.length > 0 ? digital.devices.join(", ") : "—"}
      />
      <DossierRow
        label={t("dossier.digital.migration")}
        value={digital.platformMigration ?? t("dossier.digital.noMigration")}
      />
      <DossierRow
        label={t("dossier.digital.totalHours")}
        value={digital.totalEstimatedHours != null ? t("dossier.format.hours", { value: digital.totalEstimatedHours.toFixed(1) }) : "—"}
      />
    </DossierSection>
  );
}
