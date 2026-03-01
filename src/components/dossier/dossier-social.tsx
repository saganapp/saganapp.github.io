import { Users } from "lucide-react";
import { useLocale } from "@/i18n";
import type { DossierProfile } from "@/analysis";
import { DossierSection } from "./dossier-section";

interface Props {
  social: DossierProfile["socialNetwork"];
}

function DossierRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ContactList({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-muted-foreground">—</span>;
  return <span className="font-medium">{names.join(", ")}</span>;
}

export function DossierSocial({ social }: Props) {
  const { t } = useLocale();

  return (
    <DossierSection icon={Users} title={t("dossier.social.title")}>
      <DossierRow
        label={t("dossier.social.totalContacts")}
        value={String(social.totalContacts)}
      />
      <div className="text-sm">
        <span className="text-muted-foreground">{t("dossier.social.innerCircle")}: </span>
        <ContactList names={social.innerCircle} />
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">{t("dossier.social.lateNightContacts")}: </span>
        <ContactList names={social.lateNightContacts} />
      </div>
      {social.socialCircles.length > 0 ? (
        <div className="text-sm">
          <span className="text-muted-foreground">{t("dossier.social.circles")}: </span>
          <span className="font-medium">
            {social.socialCircles.map((c) => `${c.label} (${c.contacts.length})`).join(", ")}
          </span>
        </div>
      ) : (
        <DossierRow label={t("dossier.social.circles")} value={t("dossier.social.noCircles")} />
      )}
      {social.mostImbalanced && (
        <DossierRow
          label={t("dossier.social.mostImbalanced")}
          value={`${social.mostImbalanced.contact} (${Math.round(social.mostImbalanced.ratio * 100)}%)`}
        />
      )}
      {social.fadingContacts.length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">{t("dossier.social.fadingContacts")}: </span>
          <ContactList names={social.fadingContacts} />
        </div>
      )}
      {social.growingContacts.length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">{t("dossier.social.growingContacts")}: </span>
          <ContactList names={social.growingContacts} />
        </div>
      )}
    </DossierSection>
  );
}
