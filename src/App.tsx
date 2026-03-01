import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Link } from "react-router";
import { I18nProvider, useLocale } from "@/i18n";
import { usePageTitle } from "@/hooks/use-page-title";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/error-boundary";
import { RootLayout } from "@/components/layout/root-layout";
import { LandingPage } from "@/routes/landing";

// Lazy-loaded routes — kept out of the initial bundle
const ImportPage = lazy(() =>
  import("@/routes/import").then((m) => ({ default: m.ImportPage })),
);
const DashboardPage = lazy(() =>
  import("@/routes/dashboard").then((m) => ({ default: m.DashboardPage })),
);
const DossierPage = lazy(() =>
  import("@/routes/dossier").then((m) => ({ default: m.DossierPage })),
);

function RouteSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function NotFoundPage() {
  usePageTitle("notFound.pageTitle");
  const { t } = useLocale();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-6xl font-bold tabular-nums text-muted-foreground/50">404</h1>
      <p className="text-muted-foreground">{t("notFound.message")}</p>
      <Button asChild variant="outline">
        <Link to="/">{t("notFound.home")}</Link>
      </Button>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <TooltipProvider>
          <HashRouter>
            <Routes>
              <Route element={<RootLayout />}>
                <Route index element={<LandingPage />} />
                <Route
                  path="import"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<RouteSpinner />}>
                        <ImportPage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="dashboard"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<RouteSpinner />}>
                        <DashboardPage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="dossier"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<RouteSpinner />}>
                        <DossierPage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
              <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </TooltipProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
