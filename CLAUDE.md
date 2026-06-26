# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start local dev server (Vite)
npm run build    # production build
npm run preview  # preview production build locally
```

There is no linter and no test suite configured.

## Architecture

**Single-page React app** with tab-based navigation. Despite `react-router-dom` being installed, navigation is handled manually via a `tab` state string in [App.jsx](src/App.jsx) — there are no URL routes.

**Auth flow**: `AuthProvider` in [src/lib/AuthContext.jsx](src/lib/AuthContext.jsx) wraps the whole app and exposes `{ user, profile, loading, refreshProfile }` via `useAuth()`. Until `loading` resolves, a spinner is shown. If `user` is null, `AuthPage` is rendered; otherwise the main tabbed layout appears.

**Data layer**: All Supabase queries live in [src/lib/supabase.js](src/lib/supabase.js) as named async functions that throw on error. Components call these directly — there is no state management library or caching layer.

**Utilities**: [src/lib/teams.js](src/lib/teams.js) contains:
- `TEAMS` map — team display data (colors, abbreviations, Hebrew initials)
- `calcPoints(homeGuess, awayGuess, homeReal, awayReal)` — client-side scoring (mirrors the PostgreSQL `calculate_points()` function)
- `isMatchLocked(kickoff)` — client-side lock check (mirrors the PostgreSQL `is_match_locked()` function)
- `CURRENT_ROUND` and `TOTAL_ROUNDS` — **must be updated manually** each matchweek

## Supabase / Backend

**Schema** is in [supabase-schema.sql](supabase-schema.sql) and must be applied via the Supabase SQL Editor.

**Points are calculated server-side**: when an admin updates `home_score`/`away_score` on a `matches` row in Supabase, the `on_match_result` trigger fires `update_match_points()`, which recalculates and writes `points` to all related `predictions` rows. The client-side `calcPoints()` in teams.js is only used for local UI display before results are official.

**Prediction locking** is enforced both client-side (`isMatchLocked()`) and in Supabase RLS policies — users cannot insert/update a prediction if `is_match_locked(kickoff)` returns true.

**Match data entry** is manual via the Supabase Table Editor. `kickoff` timestamps must include Israel timezone offset, e.g. `2026-08-17 21:00:00+03`.

**Admin result entry**: go to Supabase → Table Editor → `matches` → edit `home_score` and `away_score`. Points recalculate automatically via trigger.

## Styling

Plain CSS in [src/index.css](src/index.css). RTL Hebrew layout, mobile-first, max-width 480px. No component library. Do not introduce external UI libraries.

## Environment Variables

Required in `.env` (see `.env.example`):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
