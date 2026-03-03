import { useState, useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Loader2, Menu, Trash2 } from "lucide-react";
import { SaganLogo } from "@/components/icons/sagan-logo";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { ModeToggle } from "@/components/mode-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useLocale } from "@/i18n";
import { useAppStore } from "@/store/app-store";
import { clearAllData } from "@/store/db";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/", labelKey: "nav.home" },
  { to: "/import", labelKey: "nav.import" },
  { to: "/dashboard", labelKey: "nav.dashboard" },
  { to: "/dossier", labelKey: "nav.dossier" },
] as const;

const preloadRoute: Record<string, () => void> = {
  "/import": () => import("@/routes/import"),
  "/dashboard": () => import("@/routes/dashboard"),
  "/dossier": () => import("@/routes/dossier"),
};

export function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const { dataSummary, bumpDataVersion, setDataSummary, clearAllImports, resetFilters, setSelectedYear, setSelectedPlatform, hydrateDataSummary } = useAppStore();
  const hasData = dataSummary.totalEvents > 0;
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    hydrateDataSummary();
  }, [hydrateDataSummary]);

  const handleClearAllData = useCallback(async () => {
    setDeleting(true);
    try {
      await clearAllData();
      setDataSummary({ totalEvents: 0, platformCounts: {} });
      clearAllImports();
      resetFilters();
      setSelectedYear(null);
      setSelectedPlatform("all");
      bumpDataVersion();
      setOpen(false);
      navigate("/");
    } finally {
      setDeleting(false);
    }
  }, [setDataSummary, clearAllImports, resetFilters, setSelectedYear, setSelectedPlatform, bumpDataVersion, navigate]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <SaganLogo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ to, labelKey }) => {
            const active =
              to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onMouseEnter={() => preloadRoute[to]?.()}
                onFocus={() => preloadRoute[to]?.()}
                className={cn(
                  "relative px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(labelKey)}
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-x-1 -bottom-[calc(0.5rem+1px)] h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
          <div className="ml-2 flex items-center gap-1">
            {hasData && (
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t("nav.cleanup")}
                        disabled={deleting}
                      >
                        <Trash2 className={cn("h-4 w-4", deleting && "animate-shake")} />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t("nav.cleanup")}</TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("import.clear.confirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("import.clear.confirmDesc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>{t("import.clear.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllData}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("import.clear.deleting")}</> : t("import.clear.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <LocaleToggle />
            <ModeToggle />
          </div>
        </nav>

        {/* Mobile nav */}
        <div className="flex items-center gap-1 md:hidden">
          {hasData && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t("nav.cleanup")}
                  disabled={deleting}
                >
                  <Trash2 className={cn("h-4 w-4", deleting && "animate-shake")} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("import.clear.confirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("import.clear.confirmDesc")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>{t("import.clear.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAllData}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("import.clear.deleting")}</> : t("import.clear.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <LocaleToggle />
          <ModeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("nav.menu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="sr-only">{t("nav.menu")}</SheetTitle>
              <nav className="mt-8 flex flex-col gap-2">
                {NAV_LINKS.map(({ to, labelKey }) => {
                  const active =
                    to === "/" ? pathname === "/" : pathname.startsWith(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setOpen(false)}
                      onFocus={() => preloadRoute[to]?.()}
                      className={cn(
                        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {t(labelKey)}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
