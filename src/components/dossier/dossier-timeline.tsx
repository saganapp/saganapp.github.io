import { Calendar, Smartphone, ArrowRightLeft, Moon } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierLifeEvent } from "@/analysis";

interface Props {
  events: DossierLifeEvent[];
}

const EVENT_ICONS = {
  gap: Calendar,
  "device-switch": Smartphone,
  "platform-shift": ArrowRightLeft,
  "sleep-change": Moon,
} as const;

const EVENT_LABEL_KEYS = {
  gap: "dossier.timeline.gap",
  "device-switch": "dossier.timeline.deviceSwitch",
  "platform-shift": "dossier.timeline.platformShift",
  "sleep-change": "dossier.timeline.sleepChange",
} as const;

export function DossierTimeline({ events }: Props) {
  const { t } = useLocale();

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("dossier.timeline.noEvents")}</p>
    );
  }

  return (
    <div className="relative ml-4 border-l border-border/50 pl-6 space-y-4">
      {events.map((event, idx) => {
        const Icon = EVENT_ICONS[event.type];
        return (
          <div key={idx} className="relative">
            <div className="absolute -left-[calc(1.5rem+0.5px)] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-3 w-3 text-primary" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-muted-foreground">{event.date}</span>
                <span className="text-xs font-semibold text-primary">{t(EVENT_LABEL_KEYS[event.type])}</span>
              </div>
              <p className="text-sm text-foreground mt-0.5">{t(event.descriptionKey, event.type === "sleep-change"
                ? { ...event.descriptionParams, direction: t(`dossier.timeline.direction.${event.descriptionParams.direction}`) }
                : event.descriptionParams)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
