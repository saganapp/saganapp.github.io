import { PLATFORMS, type Platform, type EventType, type MetadataEvent } from "@/parsers/types";
import { getDateKey } from "@/utils/time";
import { DEMO_CONTACTS } from "./contacts";
import { HOURLY_WEIGHTS, EVENT_TYPE_WEIGHTS, WEEKEND_MULTIPLIERS } from "./distributions";

const TRACK_CATALOG: Record<string, { tracks: string[]; album: string }[]> = {
  "Arctic Monkeys": [
    { tracks: ["Do I Wanna Know?", "R U Mine?"], album: "AM" },
    { tracks: ["There'd Better Be a Mirrorball", "Body Paint"], album: "The Car" },
  ],
  "Tame Impala": [
    { tracks: ["The Less I Know the Better", "Let It Happen"], album: "Currents" },
    { tracks: ["Borderline", "Lost in Yesterday"], album: "The Slow Rush" },
  ],
  "Rosalía": [
    { tracks: ["MALAMENTE", "Pienso en tu mirá"], album: "El Mal Querer" },
    { tracks: ["SAOKO", "CHICKEN TERIYAKI"], album: "MOTOMAMI" },
  ],
  "Bad Bunny": [
    { tracks: ["Tití Me Preguntó", "Me Porto Bonito"], album: "Un Verano Sin Ti" },
    { tracks: ["Monaco", "WHERE SHE GOES"], album: "nadie sabe lo que va a pasar mañana" },
  ],
  "Radiohead": [
    { tracks: ["Karma Police", "No Surprises"], album: "OK Computer" },
    { tracks: ["Everything in Its Right Place", "Idioteque"], album: "Kid A" },
  ],
  "Daft Punk": [
    { tracks: ["Get Lucky", "Instant Crush"], album: "Random Access Memories" },
    { tracks: ["Around the World", "Da Funk"], album: "Homework" },
  ],
};

const AUDIOBOOK_CATALOG = [
  { title: "Sapiens", author: "Yuval Noah Harari" },
  { title: "Atomic Habits", author: "James Clear" },
  { title: "The Midnight Library", author: "Matt Haig" },
];

// Mulberry32 seeded PRNG — deterministic, fast, good distribution
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T>(items: T[], weights: number[], rand: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Device simulation: switch from Samsung to iPhone mid-range
const DEVICES = {
  phone1: "Samsung Galaxy S22",
  phone2: "iPhone 15 Pro",
  laptop: "MacBook Pro",
} as const;

// Switch date: ~60% through the date range
function getDevice(timestamp: Date, startMs: number, endMs: number, platform: Platform, rand: () => number): string {
  const switchPoint = startMs + (endMs - startMs) * 0.6;
  const isAfterSwitch = timestamp.getTime() > switchPoint;

  // Garmin events come from Garmin Connect
  if (platform === "garmin") {
    return rand() < 0.7 ? "Garmin Connect Web" : "Garmin Connect API";
  }

  // Spotify uses mobile, desktop, and web
  if (platform === "spotify") {
    const r = rand();
    if (r < 0.5) return isAfterSwitch ? "iOS" : "Android";
    if (r < 0.8) return "macOS";
    return "Web Player";
  }

  // Google/Twitter events are more likely laptop
  if ((platform === "google" || platform === "twitter") && rand() < 0.6) {
    return DEVICES.laptop;
  }

  return isAfterSwitch ? DEVICES.phone2 : DEVICES.phone1;
}

// Time-varying platform weights: Instagram declines, Telegram rises
function getTimeVaryingPlatformWeights(progress: number): number[] {
  // Smooth ramp centered at midpoint (ramps between 30% and 70% of timeline)
  const t = Math.max(0, Math.min(1, (progress - 0.3) / 0.4));
  return [
    0.02,                // whatsapp (constant, minimal — account events only)
    0.24 - 0.19 * t,    // instagram: 24% → 5%
    0.13,                // tiktok (constant)
    0.12,                // twitter (constant)
    0.20,                // google (constant)
    0.09 + 0.19 * t,    // telegram: 9% → 28%
    0.08,                // garmin (constant)
    0.12,                // spotify (constant)
  ];
}

// Time-varying contact weight multipliers for relationship trends
function contactWeightMultiplier(name: string, progress: number): number {
  if (name === "Sophie Laurent") {
    // Growing: quiet early, obsessive late
    return progress < 0.6 ? 0.15 : 0.15 + ((progress - 0.6) / 0.4) * 4.85; // 0.15 → 5.0 (33× increase)
  }
  if (name === "Priya Sharma") {
    // Fading: active early, abandoned late
    return progress < 0.5 ? 2.0 : 2.0 - ((progress - 0.5) / 0.5) * 1.9; // 2.0 → 0.1 (20× decrease)
  }
  return 1.0;
}

export interface GenerateConfig {
  seed?: number;
  totalEvents?: number;
  startDate?: Date;
  endDate?: Date;
}

export function generateDemoData(config?: GenerateConfig): MetadataEvent[] {
  const seed = config?.seed ?? 42;
  const totalEvents = config?.totalEvents ?? 3100;
  const endDate = config?.endDate ?? new Date(2025, 7, 15); // Aug 15, 2025
  const startDate = config?.startDate ?? new Date(2024, 3, 1); // Apr 1, 2024

  const rand = mulberry32(seed);
  const events: MetadataEvent[] = [];
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const platforms = [...PLATFORMS];

  const counters: Record<string, number> = {};

  // Phase 1: Generate regular events
  for (let i = 0; i < totalEvents; i++) {
    const event = generateSingleEvent(
      platforms, startMs, endMs, counters, rand,
    );
    if (event) events.push(event);
  }

  // Phase 2: Generate burst patterns (conversational clusters)
  const burstContacts = ["Alex Chen", "Maria Santos", "James Wilson"];
  const burstCount = 15; // number of burst sessions to generate
  for (let b = 0; b < burstCount; b++) {
    const contact = burstContacts[b % burstContacts.length];
    const contactData = DEMO_CONTACTS.find((c) => c.name === contact);
    if (!contactData) continue;

    // Pick a random day and evening hour for the burst
    const burstDayMs = startMs + rand() * (endMs - startMs);
    const burstDay = new Date(burstDayMs);
    const burstHour = 18 + Math.floor(rand() * 4); // 18-21
    const burstPlatform = contactData.platforms[Math.floor(rand() * contactData.platforms.length)];

    // Generate 6-12 messages in rapid succession (1-5 min gaps)
    const burstSize = 6 + Math.floor(rand() * 7);
    let burstMinute = Math.floor(rand() * 30);
    for (let j = 0; j < burstSize; j++) {
      const timestamp = new Date(
        burstDay.getFullYear(), burstDay.getMonth(), burstDay.getDate(),
        burstHour, burstMinute, Math.floor(rand() * 60),
      );
      burstMinute += 1 + Math.floor(rand() * 4);
      if (burstMinute >= 60) break;

      const prefix = burstPlatform.slice(0, 2);
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;

      const eventType: EventType = rand() < 0.8 ? "message_sent" : "reaction";
      const device = getDevice(timestamp, startMs, endMs, burstPlatform, rand);

      events.push({
        id,
        source: burstPlatform,
        eventType,
        timestamp,
        actor: "You",
        participants: [contact],
        metadata: { device },
      });
    }
  }

  // Phase 3: Suppress ~85% of weekday 12:00–12:59 events to create a lunch lull
  const lullRand = mulberry32(seed + 999);
  const filtered = events.filter((e) => {
    const day = e.timestamp.getDay();
    const hour = e.timestamp.getHours();
    if (day >= 1 && day <= 5 && hour === 12) {
      return lullRand() < 0.15; // keep only 15%
    }
    return true;
  });

  // Phase 4: Suppress overnight events with sleep drift
  // Early months: last activity ~22:00. Late months: drifts to ~23:30.
  const sleepRand = mulberry32(seed + 888);
  const afterSleep = filtered.filter((e) => {
    const hour = e.timestamp.getHours();
    const progress = (e.timestamp.getTime() - startMs) / (endMs - startMs);

    if (hour >= 1 && hour <= 6) {
      return sleepRand() < 0.03; // deep sleep: minimal activity
    }
    if (hour === 0) {
      // Only allow in later part of timeline
      const keepRate = progress > 0.5 ? 0.25 * (progress - 0.5) * 2 : 0.02;
      return sleepRand() < keepRate;
    }
    if (hour === 23) {
      // Early timeline: suppress most. Late timeline: allow more.
      const keepRate = 0.10 + progress * 0.75; // 0.10 → 0.85
      return sleepRand() < keepRate;
    }
    return true;
  });

  // Phase 5: Vacation gap — suppress activity for 6 days in July 2024
  const vacationStart = new Date(2024, 6, 1).getTime(); // Jul 1
  const vacationEnd = new Date(2024, 6, 7).getTime();   // Jul 7 (exclusive)
  const vacationRand = mulberry32(seed + 777);
  const afterVacation = afterSleep.filter((e) => {
    const ts = e.timestamp.getTime();
    if (ts >= vacationStart && ts < vacationEnd) {
      return vacationRand() < 0.03; // keep only ~3%
    }
    return true;
  });

  // Phase 6: Link Google email replies (for email-response-time inference)
  const googleReceived = afterVacation
    .filter((e) => e.source === "google" && e.eventType === "message_received" && e.metadata.messageId)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const googleSent = afterVacation
    .filter((e) => e.source === "google" && e.eventType === "message_sent" && !e.metadata.inReplyTo);

  let replyCount = 0;
  const replyRand = mulberry32(seed + 333);
  for (const received of googleReceived) {
    if (replyCount >= 30) break;
    const minReplyMs = received.timestamp.getTime() + 30 * 60 * 1000;     // 30 min
    const maxReplyMs = received.timestamp.getTime() + 24 * 60 * 60 * 1000; // 24 hours

    const candidate = googleSent.find((s) =>
      s.timestamp.getTime() > minReplyMs &&
      s.timestamp.getTime() < maxReplyMs &&
      !s.metadata.inReplyTo,
    );

    if (candidate && replyRand() < 0.4) {
      candidate.metadata.inReplyTo = received.metadata.messageId as string;
      replyCount++;
    }
  }

  // Phase 7: Inject late-night Maria Santos events in second half (late-night-correlation)
  const lateNightRand = mulberry32(seed + 555);
  const midpointMs = startMs + (endMs - startMs) * 0.5;
  for (let i = 0; i < 80; i++) {
    const dayMs = midpointMs + lateNightRand() * (endMs - midpointMs);
    const day = new Date(dayMs);
    const rawHour = 23 + Math.floor(lateNightRand() * 3); // 23, 0, 1
    const adjustedHour = rawHour >= 24 ? rawHour - 24 : rawHour;
    const minute = Math.floor(lateNightRand() * 60);
    const timestamp = new Date(
      day.getFullYear(), day.getMonth(), day.getDate(),
      adjustedHour, minute, Math.floor(lateNightRand() * 60),
    );

    const platform: Platform = lateNightRand() < 0.6 ? "telegram" : "instagram";
    const prefix = platform.slice(0, 2);
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;
    const device = getDevice(timestamp, startMs, endMs, platform, lateNightRand);

    afterVacation.push({
      id,
      source: platform,
      eventType: "message_sent",
      timestamp,
      actor: "You",
      participants: ["Maria Santos"],
      metadata: { device },
    });
  }

  // Phase 8: Structured conversations for response-latency inference
  const latencyContacts: { name: string; platform: Platform }[] = [
    { name: "James Wilson", platform: "telegram" },
    { name: "Lena Müller", platform: "telegram" },
  ];
  const latencyRand = mulberry32(seed + 444);

  for (const { name, platform } of latencyContacts) {
    for (let t = 0; t < 15; t++) {
      const threadDayMs = startMs + latencyRand() * (endMs - startMs);
      const threadDay = new Date(threadDayMs);
      const baseHour = 9 + Math.floor(latencyRand() * 8); // 9am-4pm
      const baseMinute = Math.floor(latencyRand() * 60);

      // They send a message
      const theyTime = new Date(
        threadDay.getFullYear(), threadDay.getMonth(), threadDay.getDate(),
        baseHour, baseMinute,
      );
      // You reply fast: 2-8 minutes later
      const yourReplyDelay = (2 + Math.floor(latencyRand() * 7)) * 60 * 1000;
      const yourTime = new Date(theyTime.getTime() + yourReplyDelay);
      // They reply slow: 45-120 minutes later
      const theirReplyDelay = (45 + Math.floor(latencyRand() * 76)) * 60 * 1000;
      const theirTime = new Date(yourTime.getTime() + theirReplyDelay);

      const prefix = platform.slice(0, 2);
      const triplet: [Date, EventType, string][] = [
        [theyTime, "message_received", name],
        [yourTime, "message_sent", "You"],
        [theirTime, "message_received", name],
      ];

      for (const [ts, evtType, actor] of triplet) {
        counters[prefix] = (counters[prefix] ?? 0) + 1;
        const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;
        const device = getDevice(ts, startMs, endMs, platform, latencyRand);
        afterVacation.push({
          id,
          source: platform,
          eventType: evtType,
          timestamp: ts,
          actor,
          participants: [name],
          metadata: { device },
        });
      }
    }
  }

  // Phase 9: Doom-scrolling nights (late-screen-early-start)
  const doomRand = mulberry32(seed + 222);
  const halfwayMs = startMs + (endMs - startMs) * 0.5;
  const doomDates: string[] = [];
  for (let i = 0; i < 20; i++) {
    const dayMs = halfwayMs + doomRand() * (endMs - halfwayMs);
    const d = new Date(dayMs);
    const key = getDateKey(d);
    if (!doomDates.includes(key)) doomDates.push(key);
  }

  // Filter out events after 03:59 on doom-scroll dates, and before 10:00 on the next day
  const doomNextDates = new Set<string>();
  for (const dk of doomDates) {
    const [y, m, d] = dk.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    doomNextDates.add(getDateKey(next));
  }
  const doomDateSet = new Set(doomDates);

  const finalEvents = afterVacation.filter((e) => {
    const key = getDateKey(e.timestamp);
    const hour = e.timestamp.getHours();
    // On doom-scroll dates, remove events after 03:59 (keep 00-03 only from injected ones below)
    if (doomDateSet.has(key) && hour >= 4) return true; // keep daytime events, we only inject night ones
    // On next-day dates, suppress events before 10:00
    if (doomNextDates.has(key) && hour < 10) return false;
    return true;
  });

  // Inject doom-scroll TikTok events at 00:30-02:30 on doom dates
  for (const dk of doomDates) {
    const [y, m, d] = dk.split("-").map(Number);
    const eventCount = 3 + Math.floor(doomRand() * 3); // 3-5 events
    for (let j = 0; j < eventCount; j++) {
      const hour = Math.floor(doomRand() * 2); // 0 or 1
      const minute = 30 + Math.floor(doomRand() * 60); // 30-89 → wraps naturally
      const actualHour = hour + Math.floor(minute / 60);
      const actualMinute = minute % 60;
      const timestamp = new Date(y, m - 1, d, actualHour, actualMinute, Math.floor(doomRand() * 60));

      const prefix = "ti";
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;
      const evtType: EventType = doomRand() < 0.6 ? "browsing" : "story_view";
      const device = getDevice(timestamp, startMs, endMs, "tiktok", doomRand);

      finalEvents.push({
        id,
        source: "tiktok",
        eventType: evtType,
        timestamp,
        actor: "You",
        participants: [],
        metadata: { device },
      });
    }

    // Inject one late-start event on the next day at 10:00-11:30
    const [ny, nm, nd] = [y, m - 1, d + 1];
    const nextDay = new Date(ny, nm, nd);
    const lateHour = 10 + Math.floor(doomRand() * 2); // 10 or 11
    const lateMinute = Math.floor(doomRand() * (lateHour === 11 ? 30 : 60));
    const lateTimestamp = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), lateHour, lateMinute, Math.floor(doomRand() * 60));

    const latePrefix = "go";
    counters[latePrefix] = (counters[latePrefix] ?? 0) + 1;
    const lateId = `demo-${latePrefix}-${String(counters[latePrefix]).padStart(4, "0")}`;
    const lateDevice = getDevice(lateTimestamp, startMs, endMs, "google", doomRand);

    finalEvents.push({
      id: lateId,
      source: "google",
      eventType: "login",
      timestamp: lateTimestamp,
      actor: "You",
      participants: [],
      metadata: { device: lateDevice },
    });
  }

  // Phase 10: Work-hours social media injection (~200 Instagram events during Mon-Fri 9-17)
  const workRand = mulberry32(seed + 111);
  for (let i = 0; i < 200; i++) {
    const dayMs = startMs + workRand() * (endMs - startMs);
    const day = new Date(dayMs);
    const dow = day.getDay();
    // Only weekdays
    if (dow === 0 || dow === 6) { i--; continue; }

    let hour = 9 + Math.floor(workRand() * 7); // 9-15
    if (hour >= 12) hour++; // skip lunch hour (12) to preserve lunch lull pattern
    const minute = Math.floor(workRand() * 60);
    const timestamp = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, Math.floor(workRand() * 60));

    const prefix = "in";
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;
    const evtType: EventType = workRand() < 0.5 ? "browsing" : "story_view";
    const device = getDevice(timestamp, startMs, endMs, "instagram", workRand);

    finalEvents.push({
      id,
      source: "instagram",
      eventType: evtType,
      timestamp,
      actor: "You",
      participants: [],
      metadata: { device },
    });
  }

  // Phase 11: Wind-Down Listening Sessions — Spotify last activity of the night
  const windDownRand = mulberry32(seed + 660);
  const windDownDates: string[] = [];
  // Pick ~40 dates from 30% through end of timeline, prefer weeknights
  for (let attempts = 0; attempts < 200 && windDownDates.length < 40; attempts++) {
    const dayMs = startMs + (endMs - startMs) * (0.3 + windDownRand() * 0.7);
    const d = new Date(dayMs);
    const dow = d.getDay();
    // Prefer weeknights (Mon-Thu)
    if (dow === 0 || dow === 5 || dow === 6) {
      if (windDownRand() > 0.3) continue;
    }
    const key = getDateKey(d);
    if (!windDownDates.includes(key)) windDownDates.push(key);
  }

  for (const dk of windDownDates) {
    const [y, m, d] = dk.split("-").map(Number);
    const sessionSize = 3 + Math.floor(windDownRand() * 4); // 3-6 tracks
    for (let j = 0; j < sessionSize; j++) {
      const hour = 22;
      const minute = Math.floor(windDownRand() * 60);
      const timestamp = new Date(y, m - 1, d, hour, minute, Math.floor(windDownRand() * 60));

      const prefix = "sp";
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;

      // Pick a track from catalog — calm full listen
      const artists = Object.keys(TRACK_CATALOG);
      const artist = artists[Math.floor(windDownRand() * artists.length)];
      const albums = TRACK_CATALOG[artist];
      const albumEntry = albums[Math.floor(windDownRand() * albums.length)];
      const track = albumEntry.tracks[Math.floor(windDownRand() * albumEntry.tracks.length)];
      const device = windDownRand() < 0.5 ? (timestamp.getTime() > startMs + (endMs - startMs) * 0.6 ? "iOS" : "Android") : "macOS";

      finalEvents.push({
        id,
        source: "spotify",
        eventType: "media_played",
        timestamp,
        actor: "You",
        participants: [],
        metadata: {
          device,
          contentType: "track",
          artistName: artist,
          albumName: albumEntry.album,
          trackName: track,
          contentName: track,
          msPlayed: 180_000 + Math.floor(windDownRand() * 120_000), // 3-5 min, full listens
          connCountry: windDownRand() < 0.95 ? "ES" : (windDownRand() < 0.5 ? "FR" : "PT"),
          skipped: false,
          shuffle: false,
          incognitoMode: false,
          offline: windDownRand() < 0.1,
        },
      });
    }
  }

  // Phase 12: Work-Hours Background Listening — Spotify during weekday 9-17
  const workListenRand = mulberry32(seed + 770);
  for (let i = 0; i < 500; i++) {
    const dayMs = startMs + workListenRand() * (endMs - startMs);
    const day = new Date(dayMs);
    const dow = day.getDay();
    // Only weekdays
    if (dow === 0 || dow === 6) { i--; continue; }

    let hour = 9 + Math.floor(workListenRand() * 7); // 9-15
    if (hour >= 12) hour++; // skip lunch hour
    const minute = Math.floor(workListenRand() * 60);
    const timestamp = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, Math.floor(workListenRand() * 60));

    const prefix = "sp";
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;

    const artists = Object.keys(TRACK_CATALOG);
    const artist = artists[Math.floor(workListenRand() * artists.length)];
    const albums = TRACK_CATALOG[artist];
    const albumEntry = albums[Math.floor(workListenRand() * albums.length)];
    const track = albumEntry.tracks[Math.floor(workListenRand() * albumEntry.tracks.length)];
    // Work devices: macOS or Web Player
    const device = workListenRand() < 0.6 ? "macOS" : "Web Player";

    finalEvents.push({
      id,
      source: "spotify",
      eventType: "media_played",
      timestamp,
      actor: "You",
      participants: [],
      metadata: {
        device,
        contentType: "track",
        artistName: artist,
        albumName: albumEntry.album,
        trackName: track,
        contentName: track,
        msPlayed: 600_000 + Math.floor(workListenRand() * 1_500_000), // 10-35 min, avg ~22 min
        connCountry: workListenRand() < 0.95 ? "ES" : (workListenRand() < 0.5 ? "FR" : "DE"),
        skipped: workListenRand() < 0.05,
        shuffle: workListenRand() < 0.60,
        incognitoMode: false,
        offline: false,
      },
    });
  }

  // Phase 12a: TikTok work-hours browsing (100 events during Mon-Fri 9-17)
  const workTikTokRand = mulberry32(seed + 780);
  for (let i = 0; i < 100; i++) {
    const dayMs = startMs + workTikTokRand() * (endMs - startMs);
    const day = new Date(dayMs);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) { i--; continue; }

    let hour = 9 + Math.floor(workTikTokRand() * 7);
    if (hour >= 12) hour++;
    const minute = Math.floor(workTikTokRand() * 60);
    const timestamp = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, Math.floor(workTikTokRand() * 60));

    const prefix = "ti";
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;
    const evtType: EventType = workTikTokRand() < 0.6 ? "browsing" : "story_view";
    const device = getDevice(timestamp, startMs, endMs, "tiktok", workTikTokRand);

    finalEvents.push({
      id,
      source: "tiktok",
      eventType: evtType,
      timestamp,
      actor: "You",
      participants: [],
      metadata: { device },
    });
  }

  // Phase 12b: Telegram work-hours messages (80 events during Mon-Fri 9-17)
  const workTelegramRand = mulberry32(seed + 790);
  const telegramContacts = DEMO_CONTACTS.filter((c) => c.platforms.includes("telegram"));
  for (let i = 0; i < 80; i++) {
    const dayMs = startMs + workTelegramRand() * (endMs - startMs);
    const day = new Date(dayMs);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) { i--; continue; }

    let hour = 9 + Math.floor(workTelegramRand() * 7);
    if (hour >= 12) hour++;
    const minute = Math.floor(workTelegramRand() * 60);
    const timestamp = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, Math.floor(workTelegramRand() * 60));

    const prefix = "te";
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;
    const evtType: EventType = workTelegramRand() < 0.7 ? "message_sent" : "reaction";
    const contact = telegramContacts[Math.floor(workTelegramRand() * telegramContacts.length)];
    const device = getDevice(timestamp, startMs, endMs, "telegram", workTelegramRand);

    finalEvents.push({
      id,
      source: "telegram",
      eventType: evtType,
      timestamp,
      actor: "You",
      participants: [contact.name],
      metadata: { device },
    });
  }

  // Phase 12c: Three quiet-period windows (12–18h of near-silence)
  const quietPeriodRand = mulberry32(seed + 1200);
  const quietWindows: { start: Date; endExclusive: Date }[] = [
    // 1) Sat Jun 15 2024 06:00 – Sun Jun 16 00:00 (18h)
    { start: new Date(2024, 5, 15, 6, 0), endExclusive: new Date(2024, 5, 16, 0, 0) },
    // 2) Tue Mar 18 2025 07:00 – Wed Mar 19 01:00 (18h)
    { start: new Date(2025, 2, 18, 7, 0), endExclusive: new Date(2025, 2, 19, 1, 0) },
  ];
  const afterQuietPeriods = finalEvents.filter((e) => {
    const ts = e.timestamp.getTime();
    for (const w of quietWindows) {
      if (ts >= w.start.getTime() && ts < w.endExclusive.getTime()) {
        return quietPeriodRand() < 0.03; // keep only ~3%
      }
    }
    return true;
  });

  // Phase 13: Recurring quiet periods — Tue/Thu 17:00 and Fri 21:00
  const quietRand = mulberry32(seed + 1300);
  const afterQuiet = afterQuietPeriods.filter((e) => {
    const dow = e.timestamp.getDay();
    const hour = e.timestamp.getHours();
    // Tue (2) + Thu (4), hour 17: keep only 10%
    if ((dow === 2 || dow === 4) && hour === 17) {
      return quietRand() < 0.10;
    }
    // Fri (5), hour 21: keep only 30%
    if (dow === 5 && hour === 21) {
      return quietRand() < 0.30;
    }
    return true;
  });

  // Phase 14: Fill zero-count days with 1–2 filler events so only the intentional
  // quiet windows (Phase 12c) register as quiet periods in the analysis.
  const quietDateKeys = new Set<string>();
  for (const w of quietWindows) {
    const c = new Date(w.start);
    while (c < w.endExclusive) {
      quietDateKeys.add(getDateKey(c));
      c.setDate(c.getDate() + 1);
    }
  }

  const fillerDayCounts = new Map<string, number>();
  for (const e of afterQuiet) {
    const k = getDateKey(e.timestamp);
    fillerDayCounts.set(k, (fillerDayCounts.get(k) ?? 0) + 1);
  }

  const fillerRand = mulberry32(seed + 1400);
  const fillerCursor = new Date(startDate);
  fillerCursor.setHours(12, 0, 0, 0);
  while (fillerCursor <= endDate) {
    const k = getDateKey(fillerCursor);
    if (!quietDateKeys.has(k) && (fillerDayCounts.get(k) ?? 0) === 0) {
      // Inject 2 filler events at reasonable hours
      const y = fillerCursor.getFullYear();
      const m = fillerCursor.getMonth();
      const d = fillerCursor.getDate();
      for (let j = 0; j < 2; j++) {
        const hour = 9 + Math.floor(fillerRand() * 10); // 9-18
        const minute = Math.floor(fillerRand() * 60);
        const timestamp = new Date(y, m, d, hour, minute, Math.floor(fillerRand() * 60));
        const platform: Platform = fillerRand() < 0.5 ? "telegram" : "google";
        const prefix = platform.slice(0, 2);
        counters[prefix] = (counters[prefix] ?? 0) + 1;
        const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;
        const device = getDevice(timestamp, startMs, endMs, platform, fillerRand);
        afterQuiet.push({
          id,
          source: platform,
          eventType: "message_sent",
          timestamp,
          actor: "You",
          participants: ["Alex Chen"],
          metadata: { device },
        });
      }
    }
    fillerCursor.setDate(fillerCursor.getDate() + 1);
  }

  // Phase 15: Garmin detailed data — activities, sleep, daily summaries
  const garminRand = mulberry32(seed + 1500);
  const ACTIVITY_TYPES = [
    { type: "strength_training", sport: "TRAINING", durationRange: [1800000, 3600000], calRange: [200, 600], hasGps: false },
    { type: "running", sport: "RUNNING", durationRange: [1200000, 3600000], calRange: [300, 800], hasGps: true },
    { type: "walking", sport: "STEPS", durationRange: [1800000, 5400000], calRange: [100, 400], hasGps: true },
    { type: "hiit", sport: "FITNESS_EQUIPMENT", durationRange: [900000, 2400000], calRange: [250, 500], hasGps: false },
  ];

  // Generate ~25 activities spread across the timeline
  for (let i = 0; i < 25; i++) {
    const dayMs = startMs + garminRand() * (endMs - startMs);
    const day = new Date(dayMs);
    let hour = 7 + Math.floor(garminRand() * 11); // 7am-5pm
    if (hour >= 12) hour++; // skip lunch hour to preserve lunch lull
    const minute = Math.floor(garminRand() * 60);
    const timestamp = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0);

    const actConfig = ACTIVITY_TYPES[Math.floor(garminRand() * ACTIVITY_TYPES.length)];
    const duration = actConfig.durationRange[0] + garminRand() * (actConfig.durationRange[1] - actConfig.durationRange[0]);
    const calories = actConfig.calRange[0] + garminRand() * (actConfig.calRange[1] - actConfig.calRange[0]);
    const avgHr = 100 + Math.floor(garminRand() * 60);

    counters["ga"] = (counters["ga"] ?? 0) + 1;
    const id = `demo-ga-${String(counters["ga"]).padStart(4, "0")}`;

    const metadata: Record<string, unknown> = {
      garminEventType: "ACTIVITY",
      activityType: actConfig.type,
      sportType: actConfig.sport,
      name: actConfig.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      durationMs: Math.round(duration),
      calories: Math.round(calories),
      avgHr,
      maxHr: avgHr + 15 + Math.floor(garminRand() * 20),
      minHr: avgHr - 20 - Math.floor(garminRand() * 15),
      steps: actConfig.type === "running" || actConfig.type === "walking" ? Math.round(duration / 600) : Math.round(garminRand() * 20),
    };

    if (actConfig.hasGps) {
      metadata.distanceMeters = Math.round(duration / 300 * 100) / 100;
      // Madrid area coordinates
      metadata.startLatitude = 40.42 + garminRand() * 0.03;
      metadata.startLongitude = -3.68 + garminRand() * 0.04;
      metadata.locationName = "Madrid";
    }

    afterQuiet.push({
      id,
      source: "garmin",
      eventType: "wellness_log",
      timestamp,
      actor: "You",
      participants: [],
      metadata,
    });

    // Also emit location event for GPS activities
    if (actConfig.hasGps) {
      counters["ga"] = (counters["ga"] ?? 0) + 1;
      afterQuiet.push({
        id: `demo-ga-${String(counters["ga"]).padStart(4, "0")}`,
        source: "garmin",
        eventType: "location",
        timestamp,
        actor: "You",
        participants: [],
        metadata: {
          garminEventType: "ACTIVITY_LOCATION",
          latitude: metadata.startLatitude,
          longitude: metadata.startLongitude,
          locationName: "Madrid",
          activityType: actConfig.type,
        },
      });
    }
  }

  // Generate ~40 sleep records
  const sleepRand2 = mulberry32(seed + 1510);
  for (let i = 0; i < 40; i++) {
    const dayMs = startMs + sleepRand2() * (endMs - startMs);
    const day = new Date(dayMs);
    // Bedtime: 22:00-00:30
    const bedHour = 22 + Math.floor(sleepRand2() * 3);
    const bedMin = Math.floor(sleepRand2() * 60);
    const sleepStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), bedHour >= 24 ? bedHour - 24 : bedHour, bedMin, 0);
    if (bedHour >= 24) sleepStart.setDate(sleepStart.getDate() + 1);

    // Duration: 5-9 hours
    const durationH = 5 + sleepRand2() * 4;
    const sleepEnd = new Date(sleepStart.getTime() + durationH * 3600000);

    // Most records are UNCONFIRMED with basic data, some OFF_WRIST
    const isWorn = sleepRand2() < 0.8;
    const confirmation = isWorn ? "UNCONFIRMED" : "OFF_WRIST";
    const deepSleep = isWorn ? Math.round(durationH * 0.2 * 3600) : 0;
    const lightSleep = isWorn ? Math.round(durationH * 0.5 * 3600) : 0;
    const awakeSleep = isWorn ? Math.round(durationH * 0.1 * 3600) : 0;

    counters["gs"] = (counters["gs"] ?? 0) + 1;
    afterQuiet.push({
      id: `demo-gs-${String(counters["gs"]).padStart(4, "0")}`,
      source: "garmin",
      eventType: "wellness_log",
      timestamp: sleepEnd,
      actor: "You",
      participants: [],
      metadata: {
        garminEventType: "SLEEP",
        sleepStartGmt: sleepStart.toISOString(),
        sleepEndGmt: sleepEnd.toISOString(),
        calendarDate: getDateKey(sleepEnd),
        confirmationType: confirmation,
        deepSleepSeconds: deepSleep,
        lightSleepSeconds: lightSleep,
        awakeSleepSeconds: awakeSleep,
        isWorn,
      },
    });
  }

  // Generate ~50 daily summaries (one per day for recent ~2 months worth)
  const udsRand = mulberry32(seed + 1520);
  const udsStartMs = endMs - 60 * 24 * 60 * 60 * 1000; // last ~60 days
  for (let d = 0; d < 50; d++) {
    const dayMs = udsStartMs + (d / 50) * (endMs - udsStartMs);
    const day = new Date(dayMs);
    const calendarDate = getDateKey(day);
    // Place at 23:59 to avoid affecting lunch lull detection (these are daily summaries, not user actions)
    const timestamp = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 0);

    const steps = 3000 + Math.floor(udsRand() * 12000);
    const stepGoal = 5000 + Math.floor(udsRand() * 3000);
    const restingHr = 55 + Math.floor(udsRand() * 25);
    const avgStress = 20 + Math.floor(udsRand() * 50);
    const bbHigh = 60 + Math.floor(udsRand() * 40);
    const bbLow = 5 + Math.floor(udsRand() * 30);

    counters["gu"] = (counters["gu"] ?? 0) + 1;
    afterQuiet.push({
      id: `demo-gu-${String(counters["gu"]).padStart(4, "0")}`,
      source: "garmin",
      eventType: "wellness_log",
      timestamp,
      actor: "You",
      participants: [],
      metadata: {
        garminEventType: "DAILY_SUMMARY",
        calendarDate,
        totalSteps: steps,
        dailyStepGoal: stepGoal,
        totalCalories: 1800 + Math.floor(udsRand() * 800),
        activeCalories: 200 + Math.floor(udsRand() * 500),
        minHr: 45 + Math.floor(udsRand() * 15),
        maxHr: 90 + Math.floor(udsRand() * 50),
        restingHr,
        activeSeconds: 1800 + Math.floor(udsRand() * 5000),
        moderateIntensityMinutes: Math.floor(udsRand() * 60),
        vigorousIntensityMinutes: Math.floor(udsRand() * 30),
        avgStressLevel: avgStress,
        maxStressLevel: avgStress + 10 + Math.floor(udsRand() * 30),
        bodyBatteryHigh: bbHigh,
        bodyBatteryLow: bbLow,
        bodyBatteryCharged: bbHigh - bbLow,
        bodyBatteryDrained: bbHigh - bbLow - Math.floor(udsRand() * 10),
        avgWakingRespiration: 14 + Math.floor(udsRand() * 6),
      },
    });
  }

  // Sort by timestamp
  afterQuiet.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return afterQuiet;
}

function generateSingleEvent(
  platforms: Platform[],
  startMs: number,
  endMs: number,
  counters: Record<string, number>,
  rand: () => number,
): MetadataEvent | null {
  // Pick timestamp first (needed for time-varying weights)
  const dayMs = startMs + rand() * (endMs - startMs);
  const day = new Date(dayMs);
  const dayOfWeek = day.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const progress = (dayMs - startMs) / (endMs - startMs);

  // Pick platform with time-varying weights
  const timeWeights = getTimeVaryingPlatformWeights(progress);
  const platform = weightedPick(platforms, timeWeights, rand);

  // Skip some events on weekends/weekdays based on multiplier
  const mult = WEEKEND_MULTIPLIERS[platform];
  if (isWeekend) {
    if (mult < 1.5 && rand() > mult / 1.5) return null;
  } else {
    if (mult > 1.5 && rand() > 1.5 / mult) return null;
  }

  // Pick hour using platform-specific distribution
  const hourWeights = HOURLY_WEIGHTS[platform];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hour = weightedPick(hours, hourWeights, rand);
  const minute = Math.floor(rand() * 60);
  const second = Math.floor(rand() * 60);

  const timestamp = new Date(
    day.getFullYear(), day.getMonth(), day.getDate(),
    hour, minute, second,
  );

  // Pick event type
  const eventTypeMap = EVENT_TYPE_WEIGHTS[platform];
  const eventTypes = Object.keys(eventTypeMap) as EventType[];
  const eventWeights = eventTypes.map((t) => eventTypeMap[t] ?? 0);
  const eventType = weightedPick(eventTypes, eventWeights, rand);

  // Pick contact(s) with time-varying weights
  const platformContacts = DEMO_CONTACTS.filter((c) =>
    c.platforms.includes(platform),
  );
  const contactWeights = platformContacts.map((c) =>
    c.weight * contactWeightMultiplier(c.name, progress),
  );
  const contact = platformContacts.length > 0
    ? weightedPick(platformContacts, contactWeights, rand)
    : null;

  const actor = eventType.includes("received") ? (contact?.name ?? "Unknown") : "You";
  const participants = contact ? [contact.name] : [];

  // Build ID like demo-wa-0001
  const prefix = platform.slice(0, 2);
  counters[prefix] = (counters[prefix] ?? 0) + 1;
  const id = `demo-${prefix}-${String(counters[prefix]).padStart(4, "0")}`;

  // Build metadata with device info
  const device = getDevice(timestamp, startMs, endMs, platform, rand);
  const metadata: Record<string, unknown> = { device };
  if (contact?.isGroup) metadata.group = contact.name;

  // Connection country for non-Spotify, non-Garmin platforms (makes map multi-platform in demo)
  if (platform !== "spotify" && platform !== "garmin") {
    metadata.connCountry = rand() < 0.92 ? "ES" : (rand() < 0.5 ? "FR" : "PT");
  }

  // Email metadata for Google messages (enables email-volume + email-response-time)
  if (platform === "google" && (eventType === "message_sent" || eventType === "message_received")) {
    metadata.subSource = "Gmail";
    if (eventType === "message_received") {
      const msgNum = (counters["gmail-msg"] = (counters["gmail-msg"] ?? 0) + 1);
      metadata.messageId = `msg-${String(msgNum).padStart(4, "0")}`;
    }
  }

  // Spotify metadata for media_played events
  if (platform === "spotify" && eventType === "media_played") {
    // Content type: 80% music, 15% podcasts, 5% audiobooks
    const contentRoll = rand();
    const isAudiobook = contentRoll > 0.95;
    const isPodcast = !isAudiobook && contentRoll > 0.80;

    if (isAudiobook) {
      metadata.contentType = "audiobook";
      const book = AUDIOBOOK_CATALOG[Math.floor(rand() * AUDIOBOOK_CATALOG.length)];
      metadata.bookName = book.title;
      metadata.authorName = book.author;
      metadata.contentName = `${book.title} — ${book.author}`;
      metadata.msPlayed = 600_000 + Math.floor(rand() * 1_800_000); // 10-40 min
    } else if (isPodcast) {
      metadata.contentType = "podcast";
      const shows = ["The Daily", "Huberman Lab", "Lex Fridman Podcast", "Radiolab"];
      metadata.showName = shows[Math.floor(rand() * shows.length)];
      metadata.contentName = `Episode — ${metadata.showName as string}`;
      metadata.msPlayed = 300_000 + Math.floor(rand() * 2_700_000); // 5-50 min
    } else {
      metadata.contentType = "track";
      const artists = Object.keys(TRACK_CATALOG);
      const artist = artists[Math.floor(rand() * artists.length)];
      const albums = TRACK_CATALOG[artist];
      const albumEntry = albums[Math.floor(rand() * albums.length)];
      const track = albumEntry.tracks[Math.floor(rand() * albumEntry.tracks.length)];
      metadata.artistName = artist;
      metadata.albumName = albumEntry.album;
      metadata.trackName = track;
      metadata.contentName = track;
      metadata.msPlayed = 30_000 + Math.floor(rand() * 270_000); // 0.5-5 min
    }

    // Connection country (mostly Spain, occasionally travel)
    const ccRoll = rand();
    metadata.connCountry = ccRoll < 0.88 ? "ES" : ccRoll < 0.92 ? "FR" : ccRoll < 0.95 ? "PT" : ccRoll < 0.98 ? "DE" : "GB";

    // Flags
    metadata.skipped = rand() < 0.25;
    metadata.shuffle = rand() < 0.40;
    metadata.incognitoMode = rand() < 0.05;
    metadata.offline = rand() < 0.15;
    metadata.ipAddr = `83.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}`;
  }

  return {
    id,
    source: platform,
    eventType,
    timestamp,
    actor,
    participants,
    metadata,
  };
}
