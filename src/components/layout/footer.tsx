import { SaganLogo } from "@/components/icons/sagan-logo";
import { useLocale } from "@/i18n";

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-border/40 py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between sm:gap-0">
        <SaganLogo size="sm" />
        <p>{t("footer.privacy")}</p>
      </div>
    </footer>
  );
}
