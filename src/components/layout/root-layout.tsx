import { Outlet } from "react-router";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { DecorativeBackground } from "@/components/layout/decorative-background";
import { useLocale } from "@/i18n";

export function RootLayout() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip">
      <DecorativeBackground />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium focus:shadow-lg"
      >
        {t("a11y.skipToContent")}
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
