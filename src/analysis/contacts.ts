import type { MetadataEvent, Platform, ContactRanking, EventType } from "@/parsers/types";
import { EVENT_DURATION_SECONDS } from "@/parsers/types";
import { filterUserTriggered } from "./filters";

function getContactCategory(e: MetadataEvent): string {
  if (e.source === "twitter") {
    if (e.metadata.conversationId) return "DMs";
    if (e.metadata.tweetId) return "Mentions";
  }
  const categoryMap: Partial<Record<EventType, string>> = {
    message_sent: "Messages",
    message_received: "Messages",
    reaction: "Reactions",
    media_shared: "Media",
    call_started: "Calls",
    call_ended: "Calls",
  };
  return categoryMap[e.eventType] ?? "Other";
}

const TIME_WINDOWS = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"] as const;

function getTimeWindow(hour: number): string {
  if (hour < 4) return "00-04";
  if (hour < 8) return "04-08";
  if (hour < 12) return "08-12";
  if (hour < 16) return "12-16";
  if (hour < 20) return "16-20";
  return "20-24";
}

function isNightHour(hour: number): boolean {
  return hour >= 22 || hour < 6;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function rankContacts(events: MetadataEvent[]): ContactRanking[] {
  const userTriggered = filterUserTriggered(events);

  const contactMap = new Map<string, {
    totalInteractions: number;
    platforms: Set<Platform>;
    estimatedTimeSeconds: number;
    byTimeWindow: Record<string, number>;
    nightInteractions: number;
    weekendInteractions: number;
    byCategory: Record<string, number>;
  }>();

  for (const e of userTriggered) {
    const category = getContactCategory(e);

    for (const p of e.participants) {
      if (p === "You") continue;

      if (!contactMap.has(p)) {
        contactMap.set(p, {
          totalInteractions: 0,
          platforms: new Set(),
          estimatedTimeSeconds: 0,
          byTimeWindow: Object.fromEntries(TIME_WINDOWS.map((w) => [w, 0])),
          nightInteractions: 0,
          weekendInteractions: 0,
          byCategory: {},
        });
      }

      const data = contactMap.get(p)!;
      data.totalInteractions++;
      data.platforms.add(e.source);
      data.estimatedTimeSeconds += EVENT_DURATION_SECONDS[e.eventType];
      data.byCategory[category] = (data.byCategory[category] ?? 0) + 1;

      const hour = e.timestamp.getHours();
      data.byTimeWindow[getTimeWindow(hour)]++;

      if (isNightHour(hour)) data.nightInteractions++;
      if (isWeekend(e.timestamp)) data.weekendInteractions++;
    }
  }

  const rankings: ContactRanking[] = [];
  for (const [name, data] of contactMap) {
    rankings.push({
      name,
      totalInteractions: data.totalInteractions,
      platforms: [...data.platforms],
      estimatedTimeSeconds: data.estimatedTimeSeconds,
      byTimeWindow: data.byTimeWindow,
      nightInteractions: data.nightInteractions,
      weekendInteractions: data.weekendInteractions,
      byCategory: data.byCategory,
    });
  }

  rankings.sort((a, b) => b.totalInteractions - a.totalInteractions);
  return rankings;
}

export function getTopContactsByTimeWindow(
  rankings: ContactRanking[],
  window: string,
): ContactRanking[] {
  return [...rankings]
    .filter((r) => (r.byTimeWindow[window] ?? 0) > 0)
    .sort((a, b) => (b.byTimeWindow[window] ?? 0) - (a.byTimeWindow[window] ?? 0));
}

export function getNightOwlContacts(
  rankings: ContactRanking[],
  minInteractions: number = 5,
): ContactRanking[] {
  return rankings
    .filter((r) => r.nightInteractions >= minInteractions)
    .sort((a, b) => b.nightInteractions - a.nightInteractions);
}

export function getWeekendContacts(
  rankings: ContactRanking[],
  minInteractions: number = 5,
): ContactRanking[] {
  return rankings
    .filter((r) => r.weekendInteractions >= minInteractions)
    .sort((a, b) => b.weekendInteractions - a.weekendInteractions);
}
