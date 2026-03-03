import { SaganLogo } from "@/components/icons/sagan-logo";
import { useLocale } from "@/i18n";
import { ExternalLink } from "lucide-react";

export function Footer() {
  const { t, locale } = useLocale();

  const bookUrl =
    locale === "es"
      ? "https://ciberdefensavip.es"
      : "https://ciberdefensavip.es/en/";

  return (
    <footer className="border-t border-border/40 py-10">
      <div className="mx-auto max-w-6xl px-4">
        {/* 3-column grid */}
        <div className="grid gap-8 sm:grid-cols-3">
          {/* Column 1 — About */}
          <div className="space-y-3">
            <SaganLogo size="sm" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("footer.about.title")}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("footer.about.blurb")}
            </p>
          </div>

          {/* Column 2 — Book nudge */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("footer.book.question")}
            </p>
            <a
              href={bookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-md p-1 transition-colors hover:bg-muted/50"
            >
              <img
                src="/book-cover.webp"
                alt={t("footer.book.title")}
                className="h-16 shrink-0 rounded-sm"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {t("footer.book.title")}
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {t("footer.book.cta")}
                  <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </a>
          </div>

          {/* Column 3 — Connect */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("footer.connect.title")}
            </h3>
            <a
              href="https://x.com/olemoudi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("footer.connect.twitter")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t border-border/40 pt-4">
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:justify-between sm:gap-0">
            <SaganLogo size="sm" />
            <p>{t("footer.privacy")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
