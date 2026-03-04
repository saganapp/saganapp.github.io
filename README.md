# Sagan

**What your metadata reveals about your life.**

Sagan is a privacy-first metadata analyzer that runs entirely in your browser. Upload your GDPR data exports and discover what timestamps, contacts, and activity patterns reveal about your habits, relationships, and daily routines — without ever reading a single message.

Live at **[saganapp.github.io](https://saganapp.github.io)**

## Features

- **100% Private** — All processing happens locally in the browser. No data is ever uploaded or sent anywhere.
- **Metadata Only** — Never reads message content. Analyzes timestamps, participants, event types, and patterns.
- **8 Platforms** — WhatsApp, Instagram, TikTok, X (Twitter), Google (Gmail/Chrome/Calendar/YouTube), Telegram, Garmin, and Spotify.
- **20+ Analysis Modules** — Sleep patterns, recurring quiet periods, work-hours impact, device tracking, contact ranking, social circles, cross-platform inferences, and more.
- **Rich Visualizations** — Timelines, heatmaps, bar charts, device timelines, and inference cards.
- **Dossier View** — See what a third party could build about you from metadata alone.
- **Bilingual** — English and Spanish, with auto-detection from browser locale.
- **Demo Mode** — Try the full dashboard with deterministic synthetic data before importing your own exports.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 5.9 |
| Routing | React Router 7 (HashRouter for static hosting) |
| Build | Vite 7 with SWC |
| Styling | Tailwind CSS 4 + shadcn/ui (Radix primitives) |
| State | Zustand |
| Storage | Dexie (IndexedDB) — fully offline |
| Animation | Framer Motion |
| Charts | D3 |
| ZIP Parsing | fflate |
| Workers | Comlink (infrastructure ready) |
| Testing | Vitest |
| Deployment | GitHub Pages via GitHub Actions |

## Architecture

### Data Flow

```
GDPR Export Files (.zip, .json, .mbox)
        |
        v
  File Detection ──── 3-tier: filename regex → ZIP content scan → manual
        |
        v
  Platform Parsers ── async generators yield normalized MetadataEvent batches
        |
        v
  IndexedDB (Dexie) ─ events, imports, dailyAggregates tables
        |
        v
  Analysis Pipeline ─ 20+ modules: contacts, sleep, lulls, devices, inferences...
        |
        v
  Dashboard / Dossier ─ React components with chart visualizations
```

### Key Design Decisions

- **HashRouter** — Enables deployment on any static host (GitHub Pages, S3, Netlify) without server-side rewrites.
- **IndexedDB via Dexie** — Keeps all data offline and persistent across sessions. Compound indexes for efficient querying by platform, date, and event type.
- **Async Generator Parsers** — Each platform parser yields batches of events, enabling incremental processing with progress feedback and bounded memory usage.
- **3-Tier File Detection** — Instant filename regex, then fast ZIP central directory scan (no decompression), then manual user selection as fallback.
- **Normalized Event Schema** — All 8 platforms normalize to a single `MetadataEvent` type with common fields (id, source, eventType, timestamp, actor, participants, metadata). Platform-specific data preserved in the `metadata` object.
- **Code Splitting** — Lazy-loaded routes + manual chunk splitting (react, motion, d3, ui, data) for fast initial load.
- **Deterministic Demo** — Seed-based PRNG (Mulberry32) generates 3,100+ events across 12 phases (burst patterns, sleep drift, vacation gaps, device switches, platform migration) for reproducible demo data.
- **Context-based i18n** — Lightweight custom system with parameterized translations, pluralization (`_one`/`_other` suffixes), and localStorage persistence. No heavy i18n library dependency.
- **Year Hints** — When combined "All years" analysis misses patterns due to threshold dilution, individual years are checked and hinted to the user.

### Project Structure

```
src/
├── main.tsx                  # Entry point
├── App.tsx                   # Router + providers (I18n, Theme, Tooltip)
├── index.css                 # Tailwind + custom CSS variables
│
├── parsers/                  # GDPR data parsers
│   ├── types.ts              # Core types (Platform, EventType, MetadataEvent)
│   ├── detect.ts             # 3-tier file auto-detection
│   ├── import-orchestrator.ts
│   └── {platform}/           # Per-platform parser modules
│
├── store/
│   ├── app-store.ts          # Zustand (filters, demo mode, data version)
│   └── db.ts                 # Dexie IndexedDB schema
│
├── analysis/                 # 20+ analysis modules
│   ├── contacts.ts           # Ranking, night owls, weekend contacts
│   ├── sleep.ts              # Overnight inactivity detection
│   ├── lulls.ts              # Recurring quiet period detection
│   ├── devices.ts            # Device extraction & timeline
│   ├── inferences.ts         # Combine analyses → inference cards
│   ├── cross-platform.ts     # Multi-source pattern detection
│   ├── relationships.ts      # Reciprocity, trends, social circles
│   ├── spotify-inferences.ts # Skip rate, incognito, listening countries
│   ├── garmin-inferences.ts  # Activity summary, sleep, steps, body battery, stress, hydration
│   └── dossier.ts            # Life event compilation
│
├── hooks/
│   ├── use-dashboard-data.ts # Main data computation (stats, charts, inferences)
│   └── use-dossier-data.ts   # Dossier-specific computations
│
├── routes/
│   ├── landing.tsx           # Home page with feature showcase
│   ├── import.tsx            # File upload + detection flow
│   ├── dashboard.tsx         # Analytics dashboard (10+ sections)
│   └── dossier.tsx           # Third-party profile view
│
├── components/
│   ├── ui/                   # shadcn/ui base components
│   ├── charts/               # Dashboard visualizations
│   ├── dossier/              # Dossier view components
│   └── layout/               # Header, footer, root layout
│
├── i18n/                     # English + Spanish translations
├── demo/                     # Deterministic synthetic data generator
├── utils/                    # Formatting, time, platform metadata
└── workers/                  # Web Worker infrastructure (Comlink)
```

## Development

```bash
npm install
npm run dev          # Vite dev server with HMR
```

### Commands

All commands can also run through `./run.sh` (sources nvm automatically):

```bash
./run.sh typecheck   # TypeScript type checking
./run.sh lint        # ESLint
./run.sh build       # Vite production build
./run.sh test        # Vitest (run once)
./run.sh verify      # typecheck + lint + build
```

### Testing

Tests live in `/tests/` and cover parsers (all 8 platforms), analysis modules, and inference logic.

```bash
npx vitest           # Watch mode
npx vitest run       # Single run
```

## Deployment

The app deploys to **GitHub Pages** via a GitHub Actions workflow (`.github/workflows/deploy.yml`). On every push to `main`:

1. Install dependencies (`npm ci`)
2. Type-check (`npx tsc -b`)
3. Run tests (`npx vitest run`)
4. Build (`npm run build`)
5. Deploy `dist/` to GitHub Pages

The site is served at [saganapp.github.io](https://saganapp.github.io).

## Supported GDPR Exports

| Platform | What's Analyzed | Signal Level |
|----------|----------------|-------------|
| WhatsApp | Account registration, profile changes, device sessions | Minimal |
| Instagram | Sent DMs, liked posts | Moderate |
| TikTok | Watch history, likes, follows, searches, off-app activity | Detailed |
| X (Twitter) | Tweets, DMs, likes, ad engagement | Detailed |
| Google | Search, Gmail, Chrome, YouTube, Calendar, location history | Very detailed |
| Telegram | Sent messages across all chats and groups | Moderate |
| Garmin | Activities, sleep, daily health (steps/HR/stress/body battery), hydration, wellness goals | Very detailed |
| Spotify | Full play history, IP addresses, devices, skip patterns, incognito | Very detailed |

## License

Private.
