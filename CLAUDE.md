# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                   # production Supabase (VITE_SUPABASE_URL in .env)
npm run dev -- --mode test    # test Supabase (.env.test)
npm run build
npm run preview
```

Test suite (integration + unit):
```bash
node scripts/tests/run-suite.js             # all suites
node scripts/tests/run-suite.js scoring     # one suite by name
node scripts/tests/run-suite.js streak
node scripts/tests/run-suite.js penalty
node scripts/tests/run-suite.js leaderboard
node scripts/tests/run-suite.js calcpoints
npm run test:suite                          # same as run-suite.js (no args)
npm run test:db                             # legacy smoke test (API + fixture sync)
```

There is no linter.

## Architecture

**Single-page React app** with tab-based navigation. Despite `react-router-dom` being installed, navigation is handled manually via a `tab` state string in [App.jsx](src/App.jsx) — there are no URL routes.

**Auth flow**: `AuthProvider` in [src/lib/AuthContext.jsx](src/lib/AuthContext.jsx) wraps the whole app and exposes `{ user, profile, loading, refreshProfile }` via `useAuth()`. Until `loading` resolves, a spinner is shown. If `user` is null, `AuthPage` is rendered; otherwise the main tabbed layout appears.

**Data layer**: All Supabase queries live in [src/lib/supabase.js](src/lib/supabase.js) as named async functions that throw on error. Components call these directly — there is no state management library or caching layer.

**Utilities**: [src/lib/teams.js](src/lib/teams.js) contains:
- `TEAMS` map — team display data (colors, abbreviations, Hebrew initials, API-Football `logoId`)
- `calcPoints(homeGuess, awayGuess, homeReal, awayReal, isJoker, isSpecial, round, streakBefore)` — client-side scoring (mirrors the PostgreSQL `update_match_points()` trigger)
- `isMatchLocked(kickoff)` — client-side lock check (mirrors the PostgreSQL `is_match_locked()` function)
- `getPhaseBase(round)` — returns `{ exact, dir }` for the current scoring phase
- `CURRENT_ROUND` and `TOTAL_ROUNDS` — **must be updated manually** each matchweek

## Scoring System

**Phase-based base points:**
| Rounds | Exact | Direction |
|--------|-------|-----------|
| 1–19   | 3     | 1         |
| 20–33  | 5     | 2         |
| 34–38  | 7     | 3         |

**Streak bonus** (consecutive exact predictions going into this match):
- `streak >= 4` → +2 on exact
- `streak >= 6` → +3 on exact

**Joker** (one per round, on a single match):
- Exact → base_exact × 2 (+ streak bonus if applicable)
- Miss with correct direction → 0
- Miss wrong direction → -1 (or -3 if streak >= 4 before this match)

**`is_special` matches** (doubles both exact and direction points, no joker interaction).

**Penalty bonus** (Real Madrid matches only):
- Each prediction row has `penalty_min` / `penalty_max` — one of six fixed 17-minute windows: `(1,17),(18,32),(33,45),(46,62),(63,77),(78,90)`
- `penalty_bonus = hits × 3` where hits = count of `penalty_events` falling in the predicted window
- Window 33–45 catches all first-half injury time (elapsed ≤ 45 regardless of extra); window 78–90 catches all second-half injury time (elapsed ≥ 78, no upper bound)
- Fires via separate `on_penalty_scored` trigger; independent of the points trigger

**`score_90`** (`jsonb {home, away}` on `matches`): the score before 90+ minute goals, computed by `scripts/update-live-scores.js`. Used in `ProfilePage` to calculate `lateGoalPtsLost` (points lost due to late goals). **Not used in the DB scoring trigger** — predictions are always scored against `home_score`/`away_score`.

## Supabase / Backend

**Schema** is in [supabase-schema.sql](supabase-schema.sql) and must be applied via the Supabase SQL Editor.

**Points are calculated server-side**: when an admin sets `home_score`/`away_score` on a `matches` row, the `on_match_result` trigger fires `update_match_points()`. The client-side `calcPoints()` is only used for live UI preview.

**Prediction locking** is enforced both client-side (`isMatchLocked()`) and in Supabase RLS policies.

**`result_at`** (`timestamptz` on `matches`): set automatically by an `on_result_entered` BEFORE trigger when `home_score` is first written. Used as a tiebreaker in the streak trigger when multiple matches share the same `kickoff` — the match whose result was entered first (i.e., finished first per the API) is treated as earlier.

**Match data entry** is manual via the Supabase Table Editor. `kickoff` timestamps must include Israel timezone offset, e.g. `2026-08-17 21:00:00+03`. When multiple matches in the same round share a kickoff, spread them ≥2 hours apart to avoid streak calculation bugs.

**Admin result entry**: Supabase → Table Editor → `matches` → edit `home_score` and `away_score`. Points recalculate automatically via trigger.

## Scripts

All scripts target the **test DB** by default (hardcoded credentials). Run with `node scripts/<name>.js` from the repo root.

| Script | Purpose |
|--------|---------|
| `close-match.js <homeTeam> <awayTeam> <homeScore> <awayScore>` | Close a single match (ilike search) |
| `close-multi.js` | Close multiple matches in one run |
| `recalc-points.js` | Re-trigger `update_match_points` on all completed matches (kickoff ASC). Run after schema changes. |
| `open-round.js <round>` | Reset a round's matches to NS with spread kickoffs |
| `sync-fixtures.js` | Pull upcoming La Liga fixtures from API-Football and upsert with `external_id` |
| `sync-results.js` | Pull finished La Liga results from API-Football and update scores |
| `update-live-scores.js` | Fetch live scores for active matches (±3h window); updates `home_score`, `away_score`, `status`, `penalty_events`, `score_90` |
| `cat-predict.js` | Auto-fill predictions for the CAT bot user |
| `send-push.js` | Send push notifications |
| `seed-test.js` / `seed-live.js` / `seed-r4.js` | Seed test data |

## GitHub Actions

All workflows run against **production DB** using GitHub Secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `API_FOOTBALL_KEY`):

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `live-scores.yml` | Every minute (runs twice, 30s apart) | Live score updates during matches |
| `sync-results.yml` | Match windows + every 30min | Sync finished results from API |
| `sync-fixtures.yml` | Daily 03:00 UTC | Sync upcoming fixture schedule + `external_id` |
| `cat-predict.yml` | Before match locks | CAT bot predictions |
| `send-push.yml` | Scheduled | Push notifications |

## FRIEREN — Critical Security Constraint

**FRIEREN** (`id = e32b1490-9dd1-49aa-a750-e7768db784b0`) is a protected test user. **Never modify FRIEREN's predictions programmatically.** Any script that touches match data must read FRIEREN's predictions beforehand and restore them afterward. DB triggers may fire and recalculate FRIEREN's `points` / `penalty_bonus` automatically — that is acceptable.

## Test Environment

- Test DB URL: `https://jgzscpqnqvymnrpktikf.supabase.co`
- Start test server: `npm run dev -- --mode test`
- Credentials in `.env.test` (frontend) and `scripts/tests/.env.test.secrets` (scripts)
- Production DB: `https://vufirabiwpfzalidbjtw.supabase.co`

## Testing Infrastructure

**Location**: `scripts/tests/`

```
helpers/
  loadSecrets.js   — loads .env.test.secrets into process.env (import first)
  db.js            — DB client + withMatches / setPred / setScore / getPred helpers
  harness.js       — makeHarness() with it() / expect() / run()
suite/
  scoring.js       — update_match_points trigger: all phases × exact/dir/miss × joker × is_special
  streak.js        — streak accumulation, +2/+3 thresholds, shield, joker interaction
  penalty.js       — penalty_in_range() boundaries, on_penalty_scored trigger
  leaderboard.js   — leaderboard_view + round_leaderboard_view correctness
  calcpoints.js    — calcPoints() unit tests (no DB, all branches)
run-suite.js       — imports loadSecrets first, then runs suites sequentially
```

**Patterns to follow when adding tests:**
- Each test is `h.it('description', async () => { ... })` in a suite file
- Use `withMatches(rows, async (matches) => { ... })` — creates matches, cleans up in `finally`
- Always `await setPred(userId, matchId, hg, ag)` before `await setScore(matchId, h, a)` (score triggers points)
- For streak tests, create matches with kickoffs in year **2000** (avoids collision with 2026 seeded data) and call `setScore` in **kickoff-ascending order**
- For penalty tests, PATCH `penalty_events` (array of `{e, x}`) to fire `on_penalty_scored` — this is separate from the points trigger
- Never touch FRIEREN's predictions in any test

**Client/server streak thresholds are now aligned (no divergence):**
- Both DB trigger and `calcPoints()`: `>= 4 → +2`, `>= 6 → +3` on exact
- Both DB trigger and `calcPoints()`: joker-exact `>= 4 → +2`, `>= 6 → +3` added to base×2
- Both DB trigger and `calcPoints()`: joker miss `>= 4 → -3`, else `-1`
- The DB trigger is authoritative for stored `points`; `calcPoints()` is preview-only

**Non-obvious scoring rules (verified in tests):**
- `is_special` matches do **NOT** receive streak bonus — the trigger uses `calculate_points() * 2` which has no streak logic
- `joker` takes full precedence over `is_special` — if a match is both, joker branch fires and is_special doubling is ignored
- `penalty_bonus` and `points` are **completely independent** columns updated by separate triggers — a joker miss of -3 pts still gets +3 penalty_bonus if the penalty window hits → total = 0
- `livePoints()` in LivePage always passes `streak=0` to `calcPoints()` by design — the footer note "נקודות משוערות — ללא בונוס סטרייק" is intentional
- Streak carries seamlessly across phase boundaries (R19→R20, R33→R34) — only the base points change, not streak_count

**What makes a good test here (philosophy):**
- Test real user flows, not algebra. "User on a 4-streak bets with joker and nails the score" is meaningful. "exact=3" alone is not.
- Prefer multi-step tests: set up state → trigger → assert final state. The trigger is asynchronous (DB-side), so always query back after PATCH.
- For multi-user tests (trigger must update ALL predictions for a match): create 3–5 users with different guesses, set one score, assert each user's points independently.
- For score-correction tests: PATCH score once, assert, PATCH again with different score, assert changed — this validates that the trigger recalculates (doesn't skip existing values).
- Isolate using year-2000 kickoffs. Don't filter by user_id in cleanup — always delete ALL predictions for test match IDs so no orphans accumulate.

**DB objects available for integration tests:**
- `leaderboard_view` — all-time totals per user (`total_points = sum(points) + sum(penalty_bonus)`)
- `round_leaderboard_view` — per-round stats; `cross join (select distinct round from matches)` so every user appears in every round
- `current_streak_view` — live streak count per user; respects `streak_shield_round`
- `get_max_streak(p_user_id uuid)` — RPC, returns historical maximum streak (ignores shield, counts raw exacts)
- `calculate_points(hg, ag, hr, ar, round)` — SQL helper, same as phase logic without joker/streak; callable for sanity-checks
- `penalty_in_range(elapsed, extra, min, max)` — SQL helper, testable directly via `select`
- `count_round_predictions(p_round)` — RPC, counts distinct users who predicted in a round

**Trigger firing rules (critical for test ordering):**
- `on_match_result` (AFTER UPDATE of home_score, away_score) → fires `update_match_points()`
- `on_penalty_scored` (AFTER UPDATE of penalty_minute, penalty_events) → fires `update_penalty_bonus()`
- `on_result_entered` (BEFORE UPDATE) → sets `result_at` when home_score first written (used as same-kickoff tiebreaker)
- These are independent — setting penalty_events does NOT recalculate match points, and vice versa

**Gaps to fill next (see TEST-PLAN.md for details):**
- Multi-user: same match, all prediction types, one score trigger
- Score correction: PATCH → assert → PATCH different → assert recalculated
- Prediction upsert: change guess before result, verify old guess gone
- `current_streak_view`: build streak, break, restart → verify view
- `get_max_streak` RPC: build 5, break, build 2 → should return 5
- Same-kickoff ordering via `result_at`
- `getBonusBreakdown()` accuracy for penalty/joker/streak split
- `score_90` + `lateGoalPtsLost` scenario (unit test of ProfilePage logic)

## Styling

Plain CSS in [src/index.css](src/index.css). RTL Hebrew layout, mobile-first, max-width 480px. No component library. Do not introduce external UI libraries.

## Environment Variables

Required in `.env` (see `.env.example`):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
