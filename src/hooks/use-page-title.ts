import { useEffect } from "react";
import { useLocale } from "@/i18n";

export function usePageTitle(titleKey: string) {
  const { t } = useLocale();
  useEffect(() => {
    document.title = `${t(titleKey)} — SAGAN`;
    return () => {
      document.title = "SAGAN";
    };
  }, [t, titleKey]);
}
