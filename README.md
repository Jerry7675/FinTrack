# FinTrack

Local-first personal and organization finance app built with Expo SDK 57, React Native, Expo Router, SQLite (Drizzle), and NativeWind.

## Features

- Nested account groups → ledgers with per-account currency
- Income / expense / transfers with categories, icons, notes, and tags
- Dashboard balance, day-wise charts, search + type filters
- Insights (category breakdown, range summaries)
- Budgets, recurring templates, goals, subscriptions, debts (manual — no auto-pay)
- Theme (system / light / dark), app lock, JSON/CSV export
- Expo home-screen widget hook (`FinTrackBalance`) — requires a development build
- Backup-ready schema (UUIDs, `updated_at`, soft deletes) for future cloud sync

## Setup

```bash
bun install
bun run start
```

Native modules (SQLite, widgets, biometrics) need a development build:

```bash
bunx expo run:android
# or
bunx expo run:ios
```

## Project structure

| Path | Role |
|------|------|
| `src/app` | Thin Expo Router routes |
| `src/features/*` | Screens and feature UI |
| `src/lib/db` | Drizzle schema, migrations, queries |
| `src/lib/money` | Minor-unit money helpers |
| `src/lib/backup` | JSON/CSV export + restore hooks |
| `src/components/ui` | Shared primitives |
| `src/providers` | App + DB lifecycle |

## Commands

| Command | Description |
|---------|-------------|
| `bun run start` | Expo dev server |
| `bun run type-check` | TypeScript |
| `bun run check` | Biome CI |
| `bun run db:generate` | Generate Drizzle migrations |

## Cloud backup (later)

v1 exports portable JSON. Later options: user-owned Drive/iCloud files, then optional Supabase free tier for sync — schema is already merge-friendly.
