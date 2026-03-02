import type { MetadataEvent } from "../types";
import { makeSpotifyEvent } from "./utils";

interface UserdataEntry {
  username: string;
  email?: string;
  country?: string;
  birthdate?: string;
  gender?: string;
  postalCode?: string | null;
  mobileNumber?: string | null;
  creationTime?: string;
}

export function parseUserdata(data: UserdataEntry): MetadataEvent[] {
  const timestamp = data.creationTime ? new Date(data.creationTime) : new Date();
  if (isNaN(timestamp.getTime())) return [];

  // Count PII fields present
  let piiFieldCount = 0;
  if (data.email) piiFieldCount++;
  if (data.birthdate) piiFieldCount++;
  if (data.gender) piiFieldCount++;
  if (data.postalCode) piiFieldCount++;
  if (data.mobileNumber) piiFieldCount++;
  if (data.country) piiFieldCount++;

  // Calculate account age in years
  const now = new Date();
  const accountAge = Math.round(
    (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24 * 365.25) * 10,
  ) / 10;

  return [
    makeSpotifyEvent("profile_update", timestamp, "You", [], {
      subSource: "userdata",
      username: data.username,
      country: data.country ?? null,
      birthdate: data.birthdate ?? null,
      gender: data.gender ?? null,
      accountAge,
      hasEmail: !!data.email,
      hasMobileNumber: !!data.mobileNumber,
      hasPostalCode: !!data.postalCode,
      piiFieldCount,
    }),
  ];
}
