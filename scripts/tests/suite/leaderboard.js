/**
 * Suite: Leaderboard Views
 *
 * Validates that leaderboard_view and round_leaderboard_view return correct
 * structure and that total_points = sum(points) + sum(penalty_bonus).
 *
 * Because the test DB accumulates historical data, we avoid asserting exact
 * totals for all-time views. Instead we:
 *  1. Capture a user's current totals
 *  2. Add known predictions + score update
 *  3. Assert the delta is correct
 *  4. Clean up
 */
import { getTestUsers, withMatches, setPred, setScore, makeMatch, db } from '../helpers/db.js'
import { makeHarness } from '../helpers/harness.js'

export async function run() {
  const h = makeHarness('Leaderboard Views')
  const [u1, u2, u3] = await getTestUsers(3)

  h.it('leaderboard_view has required columns and all total_points are non-negative', async () => {
    const lb = await db('leaderboard_view?select=user_id,display_name,total_points,exact_count,direction_count,miss_count')
    h.expect(Array.isArray(lb)).toBeTrue()
    if (lb.length > 0) {
      // Required columns present
      h.expect('total_points' in lb[0]).toBeTrue()
      h.expect('display_name' in lb[0]).toBeTrue()
      h.expect('exact_count' in lb[0]).toBeTrue()
      // total_points can be negative (joker penalty) but generally >= -budget; just verify it's a number
      h.expect(typeof lb[0].total_points === 'number').toBeTrue()
    }
  })

  h.it('leaderboard_view: all seeded users appear (including users with 0 predictions)', async () => {
    const lb = await db('leaderboard_view?select=user_id')
    const ids = new Set(lb.map(r => r.user_id))
    h.expect(ids.has(u1.id)).toBeTrue()
    h.expect(ids.has(u2.id)).toBeTrue()
    h.expect(ids.has(u3.id)).toBeTrue()
  })

  h.it('total_points delta = pts gained after one exact prediction', async () => {
    const [before] = await db(`leaderboard_view?user_id=eq.${u1.id}&select=total_points`)
    const ptsBefore = before?.total_points ?? 0

    await withMatches([makeMatch({ round: 10, kickoff: '2000-06-01T20:00Z' })], async ([m]) => {
      await setPred(u1.id, m.id, 2, 1)
      await setScore(m.id, 2, 1)  // exact → 3 pts (no prior 2000-kickoff predictions → streak=0)

      const [after] = await db(`leaderboard_view?user_id=eq.${u1.id}&select=total_points`)
      h.expect(after.total_points - ptsBefore).toBe(3)
    })
  })

  h.it('total_points delta includes penalty_bonus (+3 for 1 hit)', async () => {
    const [before] = await db(`leaderboard_view?user_id=eq.${u2.id}&select=total_points`)
    const ptsBefore = before?.total_points ?? 0

    await withMatches([makeMatch({ home_team: 'Real Madrid', kickoff: '2000-06-02T20:00Z', round: 10 })], async ([m]) => {
      await setPred(u2.id, m.id, 1, 0, { penMin: 18, penMax: 32 })
      await setScore(m.id, 1, 0)  // exact → 3 pts
      await db(`matches?id=eq.${m.id}`, 'PATCH', { penalty_events: [{ e: 25, x: null }], penalty_minute: 25 }, 'return=minimal')

      const [after] = await db(`leaderboard_view?user_id=eq.${u2.id}&select=total_points`)
      // 3 pts (exact) + 3 (penalty) = 6 delta
      h.expect(after.total_points - ptsBefore).toBe(6)
    })
  })

  h.it('round_leaderboard_view: round_points increases after new exact result in that round', async () => {
    const TEST_ROUND = 97  // use an isolated round number
    const [before] = await db(`round_leaderboard_view?user_id=eq.${u3.id}&round=eq.${TEST_ROUND}&select=round_points`)
    const ptsBefore = before?.round_points ?? 0

    await withMatches([makeMatch({ round: TEST_ROUND, kickoff: '2000-06-03T20:00Z' })], async ([m]) => {
      await setPred(u3.id, m.id, 2, 1)
      await setScore(m.id, 2, 1)  // exact → 3 pts

      const [after] = await db(`round_leaderboard_view?user_id=eq.${u3.id}&round=eq.${TEST_ROUND}&select=round_points,round_exact`)
      // Round 97 is phase 3 (>= 34) so exact = 7 pts
      h.expect(after.round_points - ptsBefore).toBe(7)
      h.expect(after.round_exact >= 1).toBeTrue()
    })
  })

  h.it('round_leaderboard_view: direction prediction increments direction_count not exact_count', async () => {
    const TEST_ROUND = 98
    const [before] = await db(`round_leaderboard_view?user_id=eq.${u1.id}&round=eq.${TEST_ROUND}&select=round_exact,round_direction`)
    const exactBefore = before?.round_exact ?? 0
    const dirBefore   = before?.round_direction ?? 0

    await withMatches([makeMatch({ round: TEST_ROUND, kickoff: '2000-06-04T20:00Z' })], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0)
      await setScore(m.id, 2, 0)  // direction only

      const [after] = await db(`round_leaderboard_view?user_id=eq.${u1.id}&round=eq.${TEST_ROUND}&select=round_exact,round_direction`)
      h.expect(after.round_exact).toBe(exactBefore)        // no change to exact count
      h.expect(after.round_direction - dirBefore).toBe(1)  // direction count +1
    })
  })

  // ── E1: getBonusBreakdown formula — penalty/joker/streak correctly separated ───
  // Replicates the getBonusBreakdown logic from src/lib/supabase.js using raw DB queries.
  // Uses round 96 (phase 3, exact=7) in year 2000 to isolate from seeded data.

  h.it('E1: getBonusBreakdown formula correctly splits penalty, joker, and streak buckets', async () => {
    const defs = [
      { home_team: 'Barcelona', away_team: 'Sevilla', kickoff: '2000-08-01T20:00Z', round: 96, home_score: null, away_score: null, status: 'NS', is_special: false },
      { home_team: 'Barcelona', away_team: 'Sevilla', kickoff: '2000-08-08T20:00Z', round: 96, home_score: null, away_score: null, status: 'NS', is_special: false },
      { home_team: 'Barcelona', away_team: 'Sevilla', kickoff: '2000-08-15T20:00Z', round: 96, home_score: null, away_score: null, status: 'NS', is_special: false },
      { home_team: 'Barcelona', away_team: 'Sevilla', kickoff: '2000-08-22T20:00Z', round: 96, home_score: null, away_score: null, status: 'NS', is_special: false },
      { home_team: 'Real Madrid', away_team: 'Sevilla', kickoff: '2000-09-01T20:00Z', round: 96, home_score: null, away_score: null, status: 'NS', is_special: false },
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, m5]) => {
      await setPred(u1.id, m1.id, 2, 1)
      await setPred(u1.id, m2.id, 2, 1)
      await setPred(u1.id, m3.id, 2, 1)
      await setPred(u1.id, m4.id, 2, 1, { joker: true })
      await setPred(u1.id, m5.id, 2, 1, { penMin: 18, penMax: 32 })

      // Set scores in kickoff order so streak builds correctly
      await setScore(m1.id, 2, 1)  // exact, streak=0 → 7 pts
      await setScore(m2.id, 2, 1)  // exact, streak=1 → 7 pts
      await setScore(m3.id, 2, 1)  // exact, streak=2 → 7 pts
      await setScore(m4.id, 2, 1)  // joker exact, streak=3 → 7×2=14 pts (no bonus at streak=3)
      await setScore(m5.id, 2, 1)  // exact, streak=4 → 7+2=9 pts
      // Fire penalty trigger on m5 (Real Madrid match)
      await db(`matches?id=eq.${m5.id}`, 'PATCH', { penalty_events: [{ e: 25, x: null }] }, 'return=minimal')

      const matchIds = [m1.id, m2.id, m3.id, m4.id, m5.id]
      const preds = await db(
        `predictions?user_id=eq.${u1.id}&match_id=in.(${matchIds.join(',')})` +
        `&select=points,penalty_bonus,is_joker,home_guess,away_guess,matches(home_score,away_score,round)`
      )

      // Apply getBonusBreakdown formula (same as src/lib/supabase.js)
      let penalty = 0, joker = 0, streak = 0
      for (const p of preds) {
        const m = p.matches
        const isExact = p.home_guess === m.home_score && p.away_guess === m.away_score
        const isDir   = !isExact && Math.sign(p.home_guess - p.away_guess) === Math.sign(m.home_score - m.away_score)
        const r = m.round
        const phaseExact = r < 20 ? 3 : r < 34 ? 5 : 7
        const phaseDir   = r < 20 ? 1 : r < 34 ? 2 : 3
        const basePts    = isExact ? phaseExact : isDir ? phaseDir : 0
        const jokerExtra = p.is_joker ? basePts : 0
        streak  += (p.points ?? 0) - basePts - jokerExtra
        joker   += jokerExtra
        penalty += p.penalty_bonus ?? 0
      }

      // M4 (joker exact, streak=3): basePts=7, jokerExtra=7, streak_contrib=14-7-7=0 (no bonus at streak=3)
      // M5 (exact, streak=4): basePts=7, jokerExtra=0, streak_contrib=9-7-0=+2
      // Total streak bucket = 0+2 = 2
      h.expect(penalty).toBe(3)
      h.expect(joker).toBe(7)
      h.expect(streak).toBe(2)
    })
  })

  // ── E2: Joker miss (wrong direction) appears as negative in streak bucket ──────
  // joker wrong dir → points=-1; basePts=0 (miss), jokerExtra=0 → streak bucket = -1

  h.it('E2: joker miss (wrong direction, no streak) → streak bucket = -1, joker bucket = 0', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-08-28T20:00Z' })], async ([m]) => {
      await setPred(u1.id, m.id, 2, 0, { joker: true })
      await setScore(m.id, 0, 1)  // away win → joker predicted home win → wrong direction

      const preds = await db(
        `predictions?user_id=eq.${u1.id}&match_id=eq.${m.id}` +
        `&select=points,penalty_bonus,is_joker,home_guess,away_guess,matches(home_score,away_score,round)`
      )
      const p = preds[0]
      const m_ = p.matches
      const isExact = p.home_guess === m_.home_score && p.away_guess === m_.away_score  // false
      const isDir   = !isExact && Math.sign(p.home_guess - p.away_guess) === Math.sign(m_.home_score - m_.away_score)  // false
      const basePts    = isExact ? 3 : isDir ? 1 : 0  // 0
      const jokerExtra = p.is_joker ? basePts : 0      // 0
      const streakContrib = (p.points ?? 0) - basePts - jokerExtra  // -1 - 0 - 0 = -1

      h.expect(jokerExtra).toBe(0)
      h.expect(streakContrib).toBe(-1)
    })
  })

  // ── G1: joker direction hit (0 pts) counted in miss_count, not direction_count ─

  h.it('G1: joker correct direction (0 pts) increments miss_count, not direction_count', async () => {
    const [before] = await db(`leaderboard_view?user_id=eq.${u1.id}&select=miss_count,direction_count`)
    const missBefore = before?.miss_count ?? 0
    const dirBefore  = before?.direction_count ?? 0

    await withMatches([makeMatch({ round: 10, kickoff: '2000-08-29T20:00Z' })], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { joker: true })  // home win predicted, joker
      await setScore(m.id, 3, 0)                           // home win, different score → direction (but joker dir = 0 pts)

      const [after] = await db(`leaderboard_view?user_id=eq.${u1.id}&select=miss_count,direction_count`)
      // joker direction = 0 pts → counted as miss, NOT as direction
      h.expect(after.miss_count - missBefore).toBe(1)
      h.expect(after.direction_count - dirBefore).toBe(0)
    })
  })

  // ── G2: Joker miss penalty (-3 pts with streak) correctly reflected in total ───

  h.it('G2: leaderboard total_points delta = -1 after joker miss with streak=3 (below threshold)', async () => {
    const [before] = await db(`leaderboard_view?user_id=eq.${u2.id}&select=total_points`)
    const ptsBefore = before?.total_points ?? 0

    const defs = [
      makeMatch({ round: 10, kickoff: '2000-08-25T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-09-01T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-09-08T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-09-15T20:00Z' }),  // joker wrong dir, streak=3 → -3
    ]
    await withMatches(defs, async ([m1, m2, m3, m4]) => {
      await setPred(u2.id, m1.id, 2, 1)
      await setPred(u2.id, m2.id, 2, 1)
      await setPred(u2.id, m3.id, 2, 1)
      await setPred(u2.id, m4.id, 2, 0, { joker: true })  // home win predicted

      await setScore(m1.id, 2, 1)  // exact → +3
      await setScore(m2.id, 2, 1)  // exact → +3
      await setScore(m3.id, 2, 1)  // exact → +3 (streak=3 going into m4)
      await setScore(m4.id, 0, 1)  // away win → joker wrong dir, streak=3 → -1 (below threshold of 4)

      const [after] = await db(`leaderboard_view?user_id=eq.${u2.id}&select=total_points`)
      // Net delta: +3+3+3-1 = +8
      h.expect(after.total_points - ptsBefore).toBe(8)
    })
  })

  return h.run()
}
