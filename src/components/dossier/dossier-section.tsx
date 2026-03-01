import type { LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { useLocale } from "@/i18n";

interface DossierSectionProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}

export function DossierSection({ icon: Icon, title, children }: DossierSectionProps) {
  const demoMode = useAppStore((s) => s.demoMode);
  const { t } = useLocale();

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {demoMode && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">{t("demo.badge")}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {children}
      </CardContent>
    </Card>
  );
}
