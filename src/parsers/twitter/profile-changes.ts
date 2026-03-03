import type { MetadataEvent } from "../types";
import { parseTwitterJs, makeTwitterEvent } from "./utils";

interface EmailChangeEntry {
  emailChange: {
    changedAt?: string;
    changedFrom?: string;
    changedTo?: string;
  };
}

interface ScreenNameChangeEntry {
  screenNameChange: {
    changedAt?: string;
    changedFrom?: string;
    changedTo?: string;
  };
}

interface ConnectedAppEntry {
  connectedApplication: {
    name?: string;
    permissions?: string[];
    approvedAt?: string;
    id?: string;
  };
}

/**
 * Parse email-address-change.js → profile_update events.
 */
export function parseEmailChanges(data: Uint8Array): MetadataEvent[] {
  const entries = parseTwitterJs<EmailChangeEntry>(data);
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const change = entry.emailChange;
    if (!change?.changedAt) continue;

    const ts = new Date(change.changedAt);
    if (isNaN(ts.getTime())) continue;

    events.push(
      makeTwitterEvent("profile_update", ts, "me", [], {
        changeType: "email",
        from: change.changedFrom,
        to: change.changedTo,
      }),
    );
  }

  return events;
}

/**
 * Parse screen-name-change.js → profile_update events.
 */
export function parseScreenNameChanges(data: Uint8Array): MetadataEvent[] {
  const entries = parseTwitterJs<ScreenNameChangeEntry>(data);
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const change = entry.screenNameChange;
    if (!change?.changedAt) continue;

    const ts = new Date(change.changedAt);
    if (isNaN(ts.getTime())) continue;

    events.push(
      makeTwitterEvent("profile_update", ts, "me", [], {
        changeType: "screen_name",
        from: change.changedFrom,
        to: change.changedTo,
      }),
    );
  }

  return events;
}

/**
 * Parse connected-application.js → profile_update events.
 */
export function parseConnectedApps(data: Uint8Array): MetadataEvent[] {
  const entries = parseTwitterJs<ConnectedAppEntry>(data);
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const app = entry.connectedApplication;
    if (!app?.approvedAt) continue;

    const ts = new Date(app.approvedAt);
    if (isNaN(ts.getTime())) continue;

    events.push(
      makeTwitterEvent("profile_update", ts, "me", [], {
        changeType: "app_authorization",
        appName: app.name,
        permissions: app.permissions,
      }),
    );
  }

  return events;
}
