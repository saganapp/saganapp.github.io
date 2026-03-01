export const PLATFORMS = [
  "whatsapp",
  "instagram",
  "tiktok",
  "twitter",
  "google",
  "telegram",
  "garmin",
  "spotify",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const EVENT_TYPES = [
  "message_sent",
  "message_received",
  "call_started",
  "call_ended",
  "media_shared",
  "reaction",
  "story_view",
  "login",
  "search",
  "browsing",
  "calendar_event",
  "location",
  "contact_added",
  "group_created",
  "group_joined",
  "group_left",
  "profile_update",
  "wellness_log",
  "notification",
  "ad_interaction",
  "media_played",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// User-triggered event types (exclude message_received, notification, ad_interaction)
export const USER_TRIGGERED_EVENTS: EventType[] = [
  "message_sent", "call_started", "media_shared", "reaction",
  "story_view", "login", "search", "browsing", "calendar_event",
  "location", "contact_added", "group_created", "group_joined",
  "group_left", "profile_update", "wellness_log", "media_played", "other",
];

// Estimated duration in seconds per event type
export const EVENT_DURATION_SECONDS: Record<EventType, number> = {
  message_sent: 45,
  message_received: 0,
  call_started: 300,
  call_ended: 0,
  media_shared: 60,
  reaction: 30,
  story_view: 30,
  login: 15,
  search: 30,
  browsing: 60,
  calendar_event: 180,
  location: 0,
  contact_added: 30,
  group_created: 60,
  group_joined: 15,
  group_left: 15,
  profile_update: 60,
  wellness_log: 15,
  notification: 0,
  ad_interaction: 30,
  media_played: 180,
  other: 30,
};

export interface MetadataEvent {
  id: string;
  source: Platform;
  eventType: EventType;
  timestamp: Date;
  actor: string;
  participants: string[];
  metadata: Record<string, unknown>;
}

export interface MacroEvent {
  id: string;
  source: Platform;
  contact: string;
  startTime: Date;
  endTime: Date;
  eventCount: number;
  eventTypes: EventType[];
  estimatedDurationSeconds: number;
}

export interface DeviceInfo {
  model?: string;
  brand?: string;
  os?: string;
  raw: string;
}

export interface ContactRanking {
  name: string;
  totalInteractions: number;
  platforms: Platform[];
  estimatedTimeSeconds: number;
  byTimeWindow: Record<string, number>;
  nightInteractions: number;
  weekendInteractions: number;
  byCategory: Record<string, number>;
}

export interface DailyAggregate {
  id: string;
  source: Platform;
  category: string;
  date: string;
  count: number;
  hourlyDistribution: number[];
  topParticipants: { name: string; count: number }[];
}

export interface ImportSession {
  id: string;
  platform: Platform;
  importedAt: Date;
  dateRange: { start: Date; end: Date } | null;
  eventCount: number;
  filenames: string[];
}

export interface PlatformParser {
  platform: Platform;
  detect(filenames: string[]): boolean;
  parse(
    files: Map<string, ArrayBuffer>,
  ): AsyncGenerator<MetadataEvent, void, unknown>;
}

export interface DetectedFile {
  file: File;
  platform: Platform | null;
  fileType: "zip" | "mbox" | "json";
  confidence: "filename" | "content" | "none";
}

export type ParseProgressCallback = (progress: {
  phase: "reading" | "extracting" | "parsing" | "storing";
  progress: number;
  eventsProcessed: number;
  currentFile?: string;
}) => void;

export interface InferenceResult {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  supportingEvents: string[];
  metadata: Record<string, unknown>;
}
