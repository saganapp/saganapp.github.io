import type { MetadataEvent } from "../types";
import { parseTwitterJs, makeTwitterEvent } from "./utils";

interface IpAuditEntry {
  ipAudit: {
    accountId?: string;
    createdAt?: string;
    loginIp?: string;
    loginPortNumber?: number;
  };
}

/**
 * Parse ip-audit.js → login events.
 * Each entry contains a login timestamp, IP address, and port.
 */
export function parseIpAudit(data: Uint8Array): MetadataEvent[] {
  const entries = parseTwitterJs<IpAuditEntry>(data);
  const events: MetadataEvent[] = [];

  for (const entry of entries) {
    const audit = entry.ipAudit;
    if (!audit?.createdAt) continue;

    const ts = new Date(audit.createdAt);
    if (isNaN(ts.getTime())) continue;

    events.push(
      makeTwitterEvent("login", ts, "me", [], {
        ip: audit.loginIp,
        port: audit.loginPortNumber,
      }),
    );
  }

  return events;
}
