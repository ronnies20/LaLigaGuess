/**
 * Suite: calcPoints() unit tests (no DB, no async)
 *
 * Tests the client-side scoring preview in src/lib/teams.js.
 *
 * Streak thresholds match the DB trigger exactly:
 *   streak >= 4 → +2 on exact, joker exact: base*2+2
 *   streak >= 6 → +3 on exact, joker exact: base*2+3
 *   joker miss (wrong dir): streak >= 4 → -3, else -1
 */
import { makeHarness } from '../helpers/harness.js'
import { calcPoints, isMatchLocked } from '../../../src/lib/teams.js'

export async function run() {
  const h = makeHarness('calcPoints() (client-side unit)')

  // ── Phase boundaries ──────────────────────────────────────────────────────────
  h.it('R1  exact → 3',  () => h.expect(calcPoints(2, 1, 2, 1)).toBe(3))
  h.it('R1  dir   → 1',  () => h.expect(calcPoints(1, 0, 2, 0)).toBe(1))
  h.it('R1  miss  → 0',  () => h.expect(calcPoints(2, 0, 0, 1)).toBe(0))
  h.it('R19 exact → 3',  () => h.expect(calcPoints(2, 1, 2, 1, false, false, 19)).toBe(3))
  h.it('R20 exact → 5',  () => h.expect(calcPoints(2, 1, 2, 1, false, false, 20)).toBe(5))
  h.it('R20 dir   → 2',  () => h.expect(calcPoints(1, 0, 2, 0, false, false, 20)).toBe(2))
  h.it('R33 exact → 5',  () => h.expect(calcPoints(1, 0, 1, 0, false, false, 33)).toBe(5))
  h.it('R34 exact → 7',  () => h.expect(calcPoints(1, 0, 1, 0, false, false, 34)).toBe(7))
  h.it('R34 dir   → 3',  () => h.expect(calcPoints(0, 1, 0, 2, false, false, 34)).toBe(3))

  // ── Direction edge cases ──────────────────────────────────────────────────────
  h.it('draw predicted, draw real (different score) → 1', () => h.expect(calcPoints(1, 1, 2, 2)).toBe(1))
  h.it('draw predicted, home win real → 0',               () => h.expect(calcPoints(1, 1, 2, 0)).toBe(0))
  h.it('home win predicted, away win real → 0',           () => h.expect(calcPoints(2, 0, 0, 1)).toBe(0))

  // ── No result / no prediction ─────────────────────────────────────────────────
  h.it('no result (null) → null',              () => h.expect(calcPoints(1, 0, null, null)).toBeNull())
  h.it('no prediction, no joker → 0',          () => h.expect(calcPoints(null, null, 2, 1)).toBe(0))
  h.it('no prediction, joker active → -1',     () => h.expect(calcPoints(null, null, 2, 1, true)).toBe(-1))

  // ── Streak bonuses (client-side thresholds: >= 4 → +2, >= 5 → +3) ────────────
  h.it('exact, streak=2 → 3  (no bonus yet)',  () => h.expect(calcPoints(1, 0, 1, 0, false, false, 1, 2)).toBe(3))
  h.it('exact, streak=3 → 3  (no bonus yet)',  () => h.expect(calcPoints(1, 0, 1, 0, false, false, 1, 3)).toBe(3))
  h.it('exact, streak=4 → 5  (+2 at >=4)',     () => h.expect(calcPoints(1, 0, 1, 0, false, false, 1, 4)).toBe(5))
  h.it('exact, streak=5 → 5  (+2 at 4-5)',      () => h.expect(calcPoints(1, 0, 1, 0, false, false, 1, 5)).toBe(5))
  h.it('exact, streak=6 → 6  (+3 at >=6)',     () => h.expect(calcPoints(1, 0, 1, 0, false, false, 1, 6)).toBe(6))
  h.it('R20 exact, streak=4 → 7  (5+2)',       () => h.expect(calcPoints(1, 0, 1, 0, false, false, 20, 4)).toBe(7))
  h.it('direction never gets streak bonus → 1',() => h.expect(calcPoints(1, 0, 2, 0, false, false, 1, 5)).toBe(1))

  // ── Joker (exact) ─────────────────────────────────────────────────────────────
  h.it('joker exact, streak=0 → 6  (3×2)',     () => h.expect(calcPoints(1, 0, 1, 0, true, false, 1, 0)).toBe(6))
  h.it('joker exact, streak=3 → 6  (no bonus)',() => h.expect(calcPoints(1, 0, 1, 0, true, false, 1, 3)).toBe(6))
  h.it('joker exact, streak=4 → 8  (3×2+2)',   () => h.expect(calcPoints(1, 0, 1, 0, true, false, 1, 4)).toBe(8))
  h.it('joker exact, streak=5 → 8  (3×2+2)',   () => h.expect(calcPoints(1, 0, 1, 0, true, false, 1, 5)).toBe(8))
  h.it('joker exact, streak=6 → 9  (3×2+3)',   () => h.expect(calcPoints(1, 0, 1, 0, true, false, 1, 6)).toBe(9))
  h.it('joker exact R20, streak=0 → 10 (5×2)', () => h.expect(calcPoints(1, 0, 1, 0, true, false, 20, 0)).toBe(10))

  // ── Joker (miss) ──────────────────────────────────────────────────────────────
  h.it('joker dir-correct → 0 (no pts, no penalty)',       () => h.expect(calcPoints(2, 0, 3, 0, true)).toBe(0))
  h.it('joker wrong dir, streak=0 → -1',                  () => h.expect(calcPoints(1, 1, 2, 0, true, false, 1, 0)).toBe(-1))
  h.it('joker wrong dir, streak=3 → -1 (below threshold of 4)', () => h.expect(calcPoints(1, 1, 2, 0, true, false, 1, 3)).toBe(-1))
  h.it('joker wrong dir, streak=4 → -3 (client threshold)', () => h.expect(calcPoints(1, 1, 2, 0, true, false, 1, 4)).toBe(-3))

  // ── is_special ────────────────────────────────────────────────────────────────
  h.it('is_special exact R1 → 6  (3×2)',   () => h.expect(calcPoints(1, 0, 1, 0, false, true, 1)).toBe(6))
  h.it('is_special dir   R1 → 2  (1×2)',   () => h.expect(calcPoints(1, 0, 2, 0, false, true, 1)).toBe(2))
  h.it('is_special miss  R1 → 0',          () => h.expect(calcPoints(0, 1, 2, 0, false, true, 1)).toBe(0))
  h.it('is_special exact R20 → 10 (5×2)',  () => h.expect(calcPoints(1, 0, 1, 0, false, true, 20)).toBe(10))
  h.it('is_special dir   R20 → 4  (2×2)',  () => h.expect(calcPoints(1, 0, 2, 0, false, true, 20)).toBe(4))
  h.it('is_special draw exact (1-1 vs 1-1) → 6', () => h.expect(calcPoints(1, 1, 1, 1, false, true, 1)).toBe(6))
  h.it('is_special draw direction (1-1 vs 0-0) → 2', () => h.expect(calcPoints(1, 1, 0, 0, false, true, 1)).toBe(2))

  // ── F: lateGoalPtsLost — ProfilePage.jsx lines 262-271 ───────────────────────
  // Logic: if user's guess matches score_90 (exact) but score changed by final → lost pts.
  // Extracted inline for unit testing (no DB). Uses streak=0 per design.

  function lateGoalPtsLost(history) {
    return history.reduce((total, p) => {
      const s90 = p.matches?.score_90
      if (!s90) return total
      const wouldBeExact = p.home_guess === s90.home && p.away_guess === s90.away
      if (!wouldBeExact) return total
      const resultChanged = p.home_guess !== p.matches.home_score || p.away_guess !== p.matches.away_score
      if (!resultChanged) return total
      const wouldHaveGot = calcPoints(p.home_guess, p.away_guess, s90.home, s90.away, p.is_joker, p.matches.is_special ?? false, p.matches.round, 0)
      return total + Math.max(0, wouldHaveGot - (p.points ?? 0))
    }, 0)
  }

  h.it('F.1: exact at score_90 then late goal changes result → lateGoalPtsLost=3', () => {
    const history = [{
      home_guess: 2, away_guess: 2, is_joker: false, points: 0,
      matches: { score_90: { home: 2, away: 2 }, home_score: 3, away_score: 2, round: 10, is_special: false },
    }]
    h.expect(lateGoalPtsLost(history)).toBe(3)
  })

  h.it('F.2: guess does not match score_90 → lateGoalPtsLost=0 (no loss to attribute)', () => {
    const history = [{
      home_guess: 2, away_guess: 1, is_joker: false, points: 0,
      matches: { score_90: { home: 2, away: 2 }, home_score: 3, away_score: 2, round: 10, is_special: false },
    }]
    h.expect(lateGoalPtsLost(history)).toBe(0)
  })

  h.it('F.3: no score_90 on match → lateGoalPtsLost=0', () => {
    const history = [{
      home_guess: 2, away_guess: 2, is_joker: false, points: 0,
      matches: { score_90: null, home_score: 3, away_score: 2, round: 10, is_special: false },
    }]
    h.expect(lateGoalPtsLost(history)).toBe(0)
  })

  h.it('F.4: exact at score_90 with joker, late goal → lateGoalPtsLost=6 (joker doubling)', () => {
    const history = [{
      home_guess: 2, away_guess: 2, is_joker: true, points: 0,
      matches: { score_90: { home: 2, away: 2 }, home_score: 3, away_score: 2, round: 10, is_special: false },
    }]
    h.expect(lateGoalPtsLost(history)).toBe(6)  // joker exact R10 = 3×2=6, actual=0 → lost 6
  })

  // ── H1: guessResult() — LivePage.jsx classification ──────────────────────────
  // Replicates src/pages/LivePage.jsx guessResult() for unit testing.

  function guessResult(g, m) {
    if (!g || m.home_score === null) return 'none'
    if (g.home_guess === m.home_score && g.away_guess === m.away_score) return 'exact'
    const gDir = Math.sign(g.home_guess - g.away_guess)
    const mDir = Math.sign(m.home_score - m.away_score)
    return gDir === mDir ? 'dir' : 'miss'
  }

  h.it('H1.1: exact score → "exact"', () => {
    h.expect(guessResult({ home_guess: 2, away_guess: 1 }, { home_score: 2, away_score: 1 })).toBe('exact')
  })

  h.it('H1.2: same direction, different score → "dir"', () => {
    h.expect(guessResult({ home_guess: 1, away_guess: 0 }, { home_score: 2, away_score: 0 })).toBe('dir')
  })

  h.it('H1.3: wrong direction → "miss"', () => {
    h.expect(guessResult({ home_guess: 0, away_guess: 1 }, { home_score: 2, away_score: 0 })).toBe('miss')
  })

  h.it('H1.4: draw predicted, draw real (different score) → "dir"', () => {
    h.expect(guessResult({ home_guess: 1, away_guess: 1 }, { home_score: 0, away_score: 0 })).toBe('dir')
  })

  h.it('H1.5: no guess → "none"', () => {
    h.expect(guessResult(null, { home_score: 2, away_score: 0 })).toBe('none')
  })

  h.it('H1.6: score not yet set (null) → "none"', () => {
    h.expect(guessResult({ home_guess: 2, away_guess: 1 }, { home_score: null, away_score: null })).toBe('none')
  })

  // ── H2: livePoints() — always uses streak=0 (by design) ──────────────────────
  // LivePage.jsx calls calcPoints(..., streak=0). This means no streak bonus in preview.
  // The UI notes "נקודות משוערות — ללא בונוס סטרייק".

  function livePoints(g, m) {
    if (!g || m.home_score === null) return 0
    return calcPoints(g.home_guess, g.away_guess, m.home_score, m.away_score, g.is_joker, m.is_special, m.round, 0)
  }

  h.it('H2.1: joker exact R10 → 6 pts regardless of actual streak (streak always 0 in livePoints)', () => {
    const m = { home_score: 2, away_score: 1, is_special: false, round: 10 }
    h.expect(livePoints({ home_guess: 2, away_guess: 1, is_joker: true }, m)).toBe(6)
    // Even if user has streak=10, livePoints uses streak=0 → no bonus beyond joker doubling
  })

  h.it('H2.2: is_special exact R10 → 6 pts (streak=0 makes no difference for is_special)', () => {
    const m = { home_score: 2, away_score: 1, is_special: true, round: 10 }
    h.expect(livePoints({ home_guess: 2, away_guess: 1, is_joker: false }, m)).toBe(6)
  })

  h.it('H2.3: joker wrong direction → -1 pts (never -3, because streak=0 in livePoints)', () => {
    const m = { home_score: 0, away_score: 1, is_special: false, round: 10 }
    h.expect(livePoints({ home_guess: 2, away_guess: 0, is_joker: true }, m)).toBe(-1)
    // With streak=0: joker wrong dir = -1. With streak=3 in real trigger: would be -3.
  })

  // ── H3: War Room ranking — livePts desc, seasonRank asc as tiebreak ───────────

  function rankWar(players) {
    // Replicates LivePage.jsx sort logic (line ~136):
    // .sort((a,b) => b.livePts - a.livePts || a.seasonRank - b.seasonRank)
    return [...players].sort((a, b) => b.livePts - a.livePts || a.seasonRank - b.seasonRank)
  }

  h.it('H3.1: lower seasonRank wins tiebreak when livePts are equal', () => {
    const players = [
      { user_id: 'a', livePts: 6, seasonRank: 3 },
      { user_id: 'b', livePts: 6, seasonRank: 1 },
      { user_id: 'c', livePts: 3, seasonRank: 0 },
    ]
    const ranked = rankWar(players)
    h.expect(ranked[0].user_id).toBe('b')  // ties on livePts=6, but seasonRank 1 < 3
    h.expect(ranked[1].user_id).toBe('a')
    h.expect(ranked[2].user_id).toBe('c')  // livePts=3 is last
  })

  h.it('H3.2: user with 0 livePts comes after all users with positive livePts', () => {
    const players = [
      { user_id: 'x', livePts: 0,  seasonRank: 0 },
      { user_id: 'y', livePts: 10, seasonRank: 1 },
      { user_id: 'z', livePts: -1, seasonRank: 2 },
    ]
    const ranked = rankWar(players)
    h.expect(ranked[0].user_id).toBe('y')
    h.expect(ranked[1].user_id).toBe('x')
    h.expect(ranked[2].user_id).toBe('z')
  })

  // ── L: isMatchLocked() — 1-minute boundary ────────────────────────────────────
  // isMatchLocked(kickoff): returns true if kickoff - 1min <= now()

  h.it('L1: 2 minutes before kickoff → not locked', () => {
    const kickoff = new Date(Date.now() + 2 * 60 * 1000).toISOString()
    h.expect(isMatchLocked(kickoff)).toBe(false)
  })

  h.it('L2: 61 seconds before kickoff → not locked', () => {
    const kickoff = new Date(Date.now() + 61 * 1000).toISOString()
    h.expect(isMatchLocked(kickoff)).toBe(false)
  })

  h.it('L3: 60 seconds before kickoff → locked (exactly at lock boundary)', () => {
    const kickoff = new Date(Date.now() + 60 * 1000).toISOString()
    h.expect(isMatchLocked(kickoff)).toBe(true)
  })

  h.it('L4: 30 seconds before kickoff → locked', () => {
    const kickoff = new Date(Date.now() + 30 * 1000).toISOString()
    h.expect(isMatchLocked(kickoff)).toBe(true)
  })

  h.it('L5: kickoff exactly now → locked', () => {
    const kickoff = new Date(Date.now()).toISOString()
    h.expect(isMatchLocked(kickoff)).toBe(true)
  })

  return h.run()
}
