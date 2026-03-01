import { ShieldAlert } from "lucide-react";
import { useLocale } from "@/i18n";

export function DossierWarning() {
  const { t } = useLocale();

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-destructive">
            {t("dossier.warning.title")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-destructive/90">
            {t("dossier.warning.body")}
          </p>
        </div>
      </div>
    </div>
  );
}
