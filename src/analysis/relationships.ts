import type { MetadataEvent, Platform, ContactRanking } from "@/parsers/types";
import type { DashboardStats } from "@/hooks/use-dashboard-data";

export interface ReciprocityScore {
  contact: string;
  sent: number;
  received: number;
  ratio: number; // sent / (sent + received), >0.65 = you initiate, <0.35 = they initiate
}

export interface RelationshipTrend {
  contact: string;
  recentCount: number;
  priorCount: number;
  changePct: number; // positive = growing, negative = fading
  direction: "growing" | "fading" | "stable";
}

export interface ResponseLatency {
  contact: string;
  yourMedianMs: number;
  theirMedianMs: number;
  pairCount: number;
}

export interface SocialCircle {
  label: string;
  contacts: string[];
  dominantTimeWindow: string;
  dominantPlatform: string;
  weekdayRatio: number;
}

/**
 * Per-contact sent/(sent+received) ratio.
 * >0.65 = you initiate, <0.35 = they initiate.
 */
export function computeReciprocity(events: MetadataEvent[]): ReciprocityScore[] {
  const contactData = new Map<string, { sent: number; received: number }>();

  for (const e of events) {
    if (e.eventType !== "message_sent" && e.eventType !== "message_received") continue;

    for (const p of e.participants) {
      if (p === "You") continue;
      if (!contactData.has(p)) contactData.set(p, { sent: 0, received: 0 });
      const d = contactData.get(p)!;
      if (e.eventType === "message_sent") d.sent++;
      else d.received++;
    }
  }

  const scores: ReciprocityScore[] = [];
  for (const [contact, data] of contactData) {
    const total = data.sent + data.received;
    if (total < 10) continue;
    scores.push({
      contact,
      sent: data.sent,
      received: data.received,
      ratio: data.sent / total,
    });
  }

  scores.sort((a, b) => Math.abs(b.ratio - 0.5) - Math.abs(a.ratio - 0.5));
  return scores;
}

/**
 * Last-3-months vs prior-3-months interaction count per contact.
 * >+30% = growing, <-30% = fading.
 */
export function computeRelationshipTrends(
  events: MetadataEvent[],
  stats: DashboardStats,
): RelationshipTrend[] {
  if (!stats.effectiveRange) return [];

  const endDate = stats.effectiveRange.end;
  const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
  const recentStart = new Date(endDate.getTime() - threeMonthsMs);
  const priorStart = new Date(recentStart.getTime() - threeMonthsMs);

  const recentCounts = new Map<string, number>();
  const priorCounts = new Map<string, number>();

  for (const e of events) {
    const ts = e.timestamp.getTime();
    for (const p of e.participants) {
      if (p === "You") continue;
      if (ts >= recentStart.getTime() && ts <= endDate.getTime()) {
        recentCounts.set(p, (recentCounts.get(p) ?? 0) + 1);
      } else if (ts >= priorStart.getTime() && ts < recentStart.getTime()) {
        priorCounts.set(p, (priorCounts.get(p) ?? 0) + 1);
      }
    }
  }

  const trends: RelationshipTrend[] = [];
  const allContacts = new Set([...recentCounts.keys(), ...priorCounts.keys()]);

  for (const contact of allContacts) {
    const recent = recentCounts.get(contact) ?? 0;
    const prior = priorCounts.get(contact) ?? 0;
    if (recent + prior < 10) continue;

    const base = Math.max(prior, 1);
    const changePct = Math.round(((recent - prior) / base) * 100);
    let direction: RelationshipTrend["direction"] = "stable";
    if (changePct > 30) direction = "growing";
    else if (changePct < -30) direction = "fading";

    trends.push({ contact, recentCount: recent, priorCount: prior, changePct, direction });
  }

  trends.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  return trends;
}

/**
 * For consecutive send/receive pairs within 24h, compute median reply time.
 */
export function computeResponseLatency(events: MetadataEvent[]): ResponseLatency[] {
  // Group events by contact, sorted by time
  const contactEvents = new Map<string, { timestamp: Date; isSent: boolean }[]>();

  for (const e of events) {
    if (e.eventType !== "message_sent" && e.eventType !== "message_received") continue;
    for (const p of e.participants) {
      if (p === "You") continue;
      if (!contactEvents.has(p)) contactEvents.set(p, []);
      contactEvents.get(p)!.push({
        timestamp: e.timestamp,
        isSent: e.eventType === "message_sent",
      });
    }
  }

  const results: ResponseLatency[] = [];
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const [contact, msgs] of contactEvents) {
    if (msgs.length < 10) continue;
    msgs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const yourDelays: number[] = [];
    const theirDelays: number[] = [];

    for (let i = 0; i < msgs.length - 1; i++) {
      const curr = msgs[i];
      const next = msgs[i + 1];
      const gap = next.timestamp.getTime() - curr.timestamp.getTime();
      if (gap <= 0 || gap > DAY_MS) continue;

      // They sent, you replied
      if (!curr.isSent && next.isSent) yourDelays.push(gap);
      // You sent, they replied
      if (curr.isSent && !next.isSent) theirDelays.push(gap);
    }

    if (yourDelays.length < 3 || theirDelays.length < 3) continue;

    yourDelays.sort((a, b) => a - b);
    theirDelays.sort((a, b) => a - b);

    results.push({
      contact,
      yourMedianMs: yourDelays[Math.floor(yourDelays.length / 2)],
      theirMedianMs: theirDelays[Math.floor(theirDelays.length / 2)],
      pairCount: yourDelays.length + theirDelays.length,
    });
  }

  // Sort by largest asymmetry
  results.sort((a, b) => {
    const aRatio = Math.max(a.yourMedianMs, a.theirMedianMs) / Math.max(Math.min(a.yourMedianMs, a.theirMedianMs), 1);
    const bRatio = Math.max(b.yourMedianMs, b.theirMedianMs) / Math.max(Math.min(b.yourMedianMs, b.theirMedianMs), 1);
    return bRatio - aRatio;
  });

  return results;
}

/**
 * Cluster contacts by dominant time window + platform + weekday ratio.
 * Labels heuristically: "Work", "Night circle", "Weekend group".
 */
export function computeSocialCircles(
  events: MetadataEvent[],
  rankings: ContactRanking[],
): SocialCircle[] {
  if (rankings.length < 5) return [];

  // Only consider contacts with enough interactions
  const significant = rankings.filter((r) => r.totalInteractions >= 5);
  if (significant.length < 5) return [];

  // For each contact, determine dominant traits
  interface ContactProfile {
    name: string;
    dominantWindow: string;
    dominantPlatform: string;
    weekdayRatio: number;
    nightRatio: number;
  }

  const profiles: ContactProfile[] = [];

  for (const r of significant) {
    // Dominant time window
    let maxWindow = "08-12";
    let maxWindowCount = 0;
    for (const [window, count] of Object.entries(r.byTimeWindow)) {
      if (count > maxWindowCount) {
        maxWindow = window;
        maxWindowCount = count;
      }
    }

    // Dominant platform
    const platformCounts = new Map<string, number>();
    for (const e of events) {
      if (e.participants.includes(r.name) && !e.participants.every((p) => p === "You")) {
        platformCounts.set(e.source, (platformCounts.get(e.source) ?? 0) + 1);
      }
    }
    let dominantPlatform: Platform = r.platforms[0] ?? "whatsapp";
    let maxPlatCount = 0;
    for (const [p, c] of platformCounts) {
      if (c > maxPlatCount) {
        dominantPlatform = p as Platform;
        maxPlatCount = c;
      }
    }

    const weekdayRatio = r.totalInteractions > 0
      ? (r.totalInteractions - r.weekendInteractions) / r.totalInteractions
      : 0.5;

    const nightRatio = r.totalInteractions > 0
      ? r.nightInteractions / r.totalInteractions
      : 0;

    profiles.push({
      name: r.name,
      dominantWindow: maxWindow,
      dominantPlatform,
      weekdayRatio,
      nightRatio,
    });
  }

  // Simple clustering by dominant traits
  const circles = new Map<string, ContactProfile[]>();

  for (const p of profiles) {
    let label: string;
    if (p.nightRatio > 0.3) {
      label = "circle.nightCircle";
    } else if (p.weekdayRatio > 0.75 && (p.dominantWindow === "08-12" || p.dominantWindow === "12-16")) {
      label = "circle.work";
    } else if (p.weekdayRatio < 0.4) {
      label = "circle.weekendGroup";
    } else {
      label = "circle.closeFriends";
    }

    if (!circles.has(label)) circles.set(label, []);
    circles.get(label)!.push(p);
  }

  // Filter out circles with fewer than 2 contacts
  const result: SocialCircle[] = [];
  for (const [label, members] of circles) {
    if (members.length < 2) continue;

    // Compute dominant traits for the circle
    const windowCounts = new Map<string, number>();
    const platformCounts = new Map<string, number>();
    let totalWeekdayRatio = 0;

    for (const m of members) {
      windowCounts.set(m.dominantWindow, (windowCounts.get(m.dominantWindow) ?? 0) + 1);
      platformCounts.set(m.dominantPlatform, (platformCounts.get(m.dominantPlatform) ?? 0) + 1);
      totalWeekdayRatio += m.weekdayRatio;
    }

    const topWindow = [...windowCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const topPlatform = [...platformCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    result.push({
      label,
      contacts: members.map((m) => m.name),
      dominantTimeWindow: topWindow,
      dominantPlatform: topPlatform,
      weekdayRatio: totalWeekdayRatio / members.length,
    });
  }

  result.sort((a, b) => b.contacts.length - a.contacts.length);
  return result;
}
