import { ShieldAlert } from "lucide-react";
import { useLocale } from "@/i18n";
import { ReportSection } from "./report-section";

export function DossierWarning() {
  const { t } = useLocale();

  return (
    <ReportSection number={7} title={t("dossier.warning.title")} icon={ShieldAlert}>
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <p className="text-sm leading-relaxed text-destructive/90">
            {t("dossier.warning.body")}
          </p>
        </div>
      </div>
    </ReportSection>
  );
}
