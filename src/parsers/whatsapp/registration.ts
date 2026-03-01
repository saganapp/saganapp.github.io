import type { MetadataEvent } from "../types";
import { makeWhatsAppEvent, fromUnixSeconds } from "./utils";

interface RegistrationData {
  wa_registration_info?: {
    registration_timestamp?: number;
  };
}

export function parseRegistration(
  data: RegistrationData | null | undefined,
  actor: string,
): MetadataEvent[] {
  const ts = fromUnixSeconds(data?.wa_registration_info?.registration_timestamp);
  if (!ts) return [];

  return [
    makeWhatsAppEvent("login", ts, actor, [], {
      action: "registration",
    }),
  ];
}
