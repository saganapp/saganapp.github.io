import type { Platform, EventType } from "@/parsers/types";

// Per-platform hour-of-day probability weights (24 values, index = hour)
// Values are relative — they get normalized during selection
export const HOURLY_WEIGHTS: Record<Platform, number[]> = {
  whatsapp: [
    2, 1, 1, 0.5, 0.5, 1, 2, 4, 6, 7, 6, 5,
    5, 6, 5, 5, 6, 7, 8, 9, 10, 9, 7, 4,
  ],
  instagram: [
    1, 0.5, 0.5, 0.3, 0.3, 0.5, 1, 2, 4, 5, 4, 4,
    5, 5, 4, 4, 5, 6, 8, 10, 10, 9, 6, 3,
  ],
  tiktok: [
    3, 2, 1.5, 1, 0.5, 0.5, 1, 2, 3, 3, 3, 3,
    4, 4, 4, 5, 6, 7, 9, 10, 10, 9, 7, 5,
  ],
  twitter: [
    1, 0.5, 0.3, 0.2, 0.2, 0.5, 2, 5, 7, 8, 7, 6,
    7, 7, 6, 5, 5, 6, 7, 7, 6, 5, 3, 2,
  ],
  google: [
    0.5, 0.3, 0.2, 0.1, 0.2, 0.5, 2, 5, 8, 10, 9, 8,
    7, 7, 7, 7, 6, 5, 4, 3, 3, 2, 1, 0.5,
  ],
  telegram: [
    2, 1, 0.5, 0.5, 0.5, 1, 2, 4, 5, 6, 6, 5,
    5, 5, 5, 6, 7, 7, 8, 8, 7, 6, 5, 3,
  ],
  garmin: [
    0.5, 0.3, 0.2, 0.1, 0.2, 0.5, 2, 5, 8, 10, 9, 7,
    6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 0.5, 0.3,
  ],
  spotify: [
    1, 0.5, 0.3, 0.2, 0.2, 0.5, 2, 5, 8, 7, 5, 4,
    4, 4, 5, 5, 6, 7, 8, 9, 8, 6, 4, 2,
  ],
  apple: [
    0.5, 0.3, 0.2, 0.1, 0.2, 0.3, 0.5, 1, 2, 4, 5, 4,
    3, 3, 4, 5, 6, 7, 8, 9, 10, 8, 5, 2,
  ],
};

// Per-platform event type probability weights
export const EVENT_TYPE_WEIGHTS: Record<Platform, Partial<Record<EventType, number>>> = {
  whatsapp: {
    login: 70,
    profile_update: 30,
  },
  instagram: {
    message_sent: 25,
    reaction: 45,
    story_view: 30,
  },
  tiktok: {
    browsing: 40,
    reaction: 15,
    search: 15,
    story_view: 20,
    contact_added: 5,
    ad_interaction: 5,
  },
  twitter: {
    message_sent: 20,
    message_received: 15,
    reaction: 40,
    ad_interaction: 25,
  },
  google: {
    message_sent: 10,
    message_received: 12,
    search: 22,
    login: 5,
    location: 10,
    notification: 6,
    ad_interaction: 5,
    browsing: 10,
    calendar_event: 10,
    other: 10,
  },
  telegram: {
    message_sent: 100,
  },
  garmin: {
    wellness_log: 90,
    profile_update: 5,
    login: 3,
    reaction: 2,
  },
  spotify: {
    media_played: 100,
  },
  apple: {
    browsing: 40,
    search: 15,
    other: 35,
    ad_interaction: 10,
  },
};

// Weekend activity multipliers (1.0 = same as weekday)
export const WEEKEND_MULTIPLIERS: Record<Platform, number> = {
  whatsapp: 1.0,
  instagram: 1.5,
  tiktok: 4.0,
  twitter: 0.9,
  google: 0.3,
  telegram: 1.1,
  garmin: 0.7,
  spotify: 1.3,
  apple: 1.4,
};
