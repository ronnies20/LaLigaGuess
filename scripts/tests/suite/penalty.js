/**
 * Suite: Penalty Bonus
 *
 * Tests the on_penalty_scored trigger (update_penalty_bonus) and the
 * penalty_in_range() function. When penalty_events is updated on a match,
 * the trigger recalculates penalty_bonus for each prediction that has a window
 * (penalty_min / penalty_max).
 *
 * Windows: (1,17)(18,32)(33,45)(46,62)(63,77)(78,90)
 * Special boundary behaviour:
 *   range_max=45  → p_elapsed >= 33 AND p_elapsed <= 45  (no upper limit on extra time)
 *   range_max=90  → p_elapsed >= 78                       (catches 90+, 93', 97', etc.)
 *   Other windows → p_elapsed within [min, max] strictly
 *
 * Key principle: points and penalty_bonus are COMPLETELY INDEPENDENT columns.
 * Two separate triggers: update_match_points and update_penalty_bonus.
 * Total in leaderboard = sum(points) + sum(penalty_bonus).
 */
import { getTestUsers, withMatches, setPred, setScore, getPred, makeMatch, db } from '../helpers/db.js'
import { makeHarness } from '../helpers/harness.js'

async function setPenaltyEvents(matchId, events) {
  // Fires the on_penalty_scored trigger (UPDATE of penalty_events)
  await db(
    `matches?id=eq.${matchId}`,
    'PATCH',
    { penalty_events: events, penalty_minute: events[0]?.e ?? null },
    'return=minimal'
  )
}

export async function run() {
  const h = makeHarness('Penalty Bonus')
  const [u1, u2, u3] = await getTestUsers(3)

  function rmMatch(kickoff, overrides = {}) {
    return makeMatch({ home_team: 'Real Madrid', away_team: 'Atletico Madrid', kickoff, round: 10, ...overrides })
  }

  // ── Baseline 8 tests ──────────────────────────────────────────────────────────

  h.it('1 penalty in predicted window → +3 bonus', async () => {
    await withMatches([rmMatch('2000-04-01T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 1, { penMin: 18, penMax: 32 })
      await setScore(m.id, 1, 1)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('2 penalties in same predicted window → +6 bonus', async () => {
    await withMatches([rmMatch('2000-04-02T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 18, penMax: 32 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 22, x: null }, { e: 29, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(6)
    })
  })

  h.it('penalty outside predicted window → 0 bonus', async () => {
    await withMatches([rmMatch('2000-04-03T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 2, 0, { penMin: 63, penMax: 77 })
      await setScore(m.id, 2, 0)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(0)
    })
  })

  h.it('45+3 (elapsed=45, extra=3): counted in 33-45 window, NOT in 46-62 window', async () => {
    await withMatches([rmMatch('2000-04-04T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 33, penMax: 45 })
      await setPred(u2.id, m.id, 1, 0, { penMin: 46, penMax: 62 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 45, x: 3 }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
      h.expect((await getPred(u2.id, m.id)).penalty_bonus).toBe(0)
    })
  })

  h.it('90+3 (elapsed=93): counted in 78-90 window (no upper bound)', async () => {
    await withMatches([rmMatch('2000-04-05T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 2, 1, { penMin: 78, penMax: 90 })
      await setScore(m.id, 2, 1)
      await setPenaltyEvents(m.id, [{ e: 93, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('penalty at minute 46 (in range 46-62) → +3', async () => {
    await withMatches([rmMatch('2000-04-06T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 46, penMax: 62 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 46, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('no penalty_min/max on prediction → 0 bonus even if penalty scored', async () => {
    await withMatches([rmMatch('2000-04-07T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 1)
      await setScore(m.id, 1, 1)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(0)
    })
  })

  h.it('1 hit + 1 miss (one in window, one outside) → +3 (only hits count)', async () => {
    await withMatches([rmMatch('2000-04-08T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 63, penMax: 77 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 70, x: null }, { e: 25, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  // ── A1: All 6 windows — first and last minute of each ────────────────────────

  h.it('A1.1: penalty minute 1 (first of window 1-17) → +3', async () => {
    await withMatches([rmMatch('2000-05-01T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 1, penMax: 17 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 1, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.2: penalty minute 17 (last of window 1-17) → +3', async () => {
    await withMatches([rmMatch('2000-05-02T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 1, penMax: 17 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 17, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.3: penalty minute 18 (first of window 18-32) → +3', async () => {
    await withMatches([rmMatch('2000-05-03T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 18, penMax: 32 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 18, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.4: penalty minute 32 (last of window 18-32) → +3', async () => {
    await withMatches([rmMatch('2000-05-04T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 18, penMax: 32 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 32, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.5: penalty minute 33 (first of window 33-45) → +3', async () => {
    await withMatches([rmMatch('2000-05-05T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 33, penMax: 45 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 33, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.6: penalty 45+5 (elapsed=45, extra=5) — in window 33-45 (no upper bound for extra time)', async () => {
    await withMatches([rmMatch('2000-05-06T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 33, penMax: 45 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 45, x: 5 }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.7: penalty minute 46 (first of window 46-62) → +3', async () => {
    await withMatches([rmMatch('2000-05-07T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 46, penMax: 62 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 46, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.8: penalty minute 62 (last of window 46-62) → +3', async () => {
    await withMatches([rmMatch('2000-05-08T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 46, penMax: 62 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 62, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.9: penalty minute 63 (first of window 63-77) → +3', async () => {
    await withMatches([rmMatch('2000-05-09T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 63, penMax: 77 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 63, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.10: penalty minute 77 (last of window 63-77) → +3', async () => {
    await withMatches([rmMatch('2000-05-10T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 63, penMax: 77 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 77, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.11: penalty minute 78 (first of window 78-90) → +3', async () => {
    await withMatches([rmMatch('2000-05-11T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 78, penMax: 90 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 78, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.12: penalty 90+7 (elapsed=97) — in window 78-90 (no upper bound)', async () => {
    await withMatches([rmMatch('2000-05-12T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 78, penMax: 90 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 97, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)
    })
  })

  h.it('A1.13: penalty minute 18, window 1-17 — just outside boundary → 0', async () => {
    await withMatches([rmMatch('2000-05-13T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 1, penMax: 17 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 18, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(0)
    })
  })

  h.it('A1.14: penalty minute 46, window 33-45 — just outside boundary → 0', async () => {
    await withMatches([rmMatch('2000-05-14T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 33, penMax: 45 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 46, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(0)
    })
  })

  h.it('A1.15: penalty minute 78, window 63-77 — just outside boundary → 0', async () => {
    await withMatches([rmMatch('2000-05-15T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 63, penMax: 77 })
      await setScore(m.id, 1, 0)
      await setPenaltyEvents(m.id, [{ e: 78, x: null }])
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(0)
    })
  })

  // ── A2: Penalty bonus is independent of prediction outcome ────────────────────

  h.it('A2.1: exact prediction + penalty hit → points=3, penalty=3 (total 6)', async () => {
    await withMatches([rmMatch('2000-06-01T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 2, 1, { penMin: 18, penMax: 32 })
      await setScore(m.id, 2, 1)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, m.id)
      h.expect(p.points).toBe(3)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A2.2: direction prediction + penalty hit → points=1, penalty=3 (total 4)', async () => {
    await withMatches([rmMatch('2000-06-02T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 18, penMax: 32 })
      await setScore(m.id, 3, 0)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, m.id)
      h.expect(p.points).toBe(1)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A2.3: miss prediction + penalty hit → points=0, penalty=3 (penalty helps even on miss)', async () => {
    await withMatches([rmMatch('2000-06-03T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 2, 0, { penMin: 18, penMax: 32 })
      await setScore(m.id, 0, 1)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, m.id)
      h.expect(p.points).toBe(0)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A2.4: exact prediction + no penalty window → penalty=0', async () => {
    await withMatches([rmMatch('2000-06-04T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 2, 1)
      await setScore(m.id, 2, 1)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, m.id)
      h.expect(p.points).toBe(3)
      h.expect(p.penalty_bonus).toBe(0)
    })
  })

  h.it('A2.5: exact prediction + wrong penalty window → penalty=0', async () => {
    await withMatches([rmMatch('2000-06-05T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 2, 1, { penMin: 63, penMax: 77 })
      await setScore(m.id, 2, 1)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, m.id)
      h.expect(p.points).toBe(3)
      h.expect(p.penalty_bonus).toBe(0)
    })
  })

  // ── A3: Joker × penalty_bonus combinations ────────────────────────────────────

  h.it('A3.1: joker exact + penalty hit → points=6 (3×2), penalty=3 (total 9)', async () => {
    await withMatches([rmMatch('2000-07-01T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 2, 1, { joker: true, penMin: 18, penMax: 32 })
      await setScore(m.id, 2, 1)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, m.id)
      h.expect(p.points).toBe(6)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A3.2: joker direction (correct) + penalty hit → points=0, penalty=3 (total 3)', async () => {
    await withMatches([rmMatch('2000-07-02T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { joker: true, penMin: 18, penMax: 32 })
      await setScore(m.id, 3, 0)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, m.id)
      h.expect(p.points).toBe(0)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A3.3: joker wrong direction (no streak) + penalty hit → points=-1, penalty=3 (total 2)', async () => {
    await withMatches([rmMatch('2000-07-03T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 2, 0, { joker: true, penMin: 18, penMax: 32 })
      await setScore(m.id, 0, 1)
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, m.id)
      h.expect(p.points).toBe(-1)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A3.4: joker wrong direction + streak_count=4 + penalty → points=-3, penalty=3 (total 0)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-08-01T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-08T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-15T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-22T20:00Z' }),
      rmMatch('2000-09-01T20:00Z'),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, rm]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 0, { joker: true, penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 1, 1)  // draw — joker predicted home win → wrong dir, streak=4 → -3
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(-3)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  // ── A4: Streak bonus stacks independently with penalty_bonus ──────────────────

  h.it('A4.1: exact + streak_count=4 + penalty hit → points=5 (3+2), penalty=3 (total 8)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-08-02T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-09T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-16T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-23T20:00Z' }),
      rmMatch('2000-09-02T20:00Z'),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, rm]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 1, { penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 2, 1)  // exact, streak=4 → 3+2=5
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(5)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A4.2: exact + streak_count=4 + penalty hit → points=5 (3+2), penalty=3 (total 8)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-08-03T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-10T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-17T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-24T20:00Z' }),
      rmMatch('2000-09-03T20:00Z'),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, rm]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 1, { penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 2, 1)  // exact, streak=4 → 3+2=5
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(5)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A4.3: exact + streak_count=2 (no bonus yet) + penalty hit → points=3, penalty=3 (total 6)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-08-04T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-11T20:00Z' }),
      rmMatch('2000-09-04T20:00Z'),
    ]
    await withMatches(defs, async ([m1, m2, rm]) => {
      await setPred(u1.id, m1.id, 2, 1)
      await setPred(u1.id, m2.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 1, { penMin: 18, penMax: 32 })
      await setScore(m1.id, 2, 1)
      await setScore(m2.id, 2, 1)
      await setScore(rm.id, 2, 1)  // exact, streak=2 → 3 (no bonus)
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(3)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  // ── A5: Full combo: joker + streak + penalty ──────────────────────────────────

  h.it('A5.1: joker exact R10 + streak=4 + penalty → points=8 (3×2+2), penalty=3 (total 11)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-08-05T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-12T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-19T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-26T20:00Z' }),
      rmMatch('2000-09-05T20:00Z'),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, rm]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 1, { joker: true, penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 2, 1)  // joker exact, streak=4 → 3×2+2=8
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(8)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A5.2: joker exact R10 + streak=4 + penalty → points=8 (3×2+2), penalty=3 (total 11)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-08-06T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-13T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-20T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-08-27T20:00Z' }),
      rmMatch('2000-09-06T20:00Z'),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, rm]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 1, { joker: true, penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 2, 1)  // joker exact, streak=4 → 3×2+2=8
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(8)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A5.3: joker exact R20 + streak=4 + penalty → points=12 (5×2+2), penalty=3 (total 15)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-10-01T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-08T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-15T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-22T20:00Z' }),
      rmMatch('2000-11-01T20:00Z', { round: 20 }),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, rm]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 1, { joker: true, penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 2, 1)  // joker exact R20, streak=4 → 5×2+2=12
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(12)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A5.4: joker exact R20 + streak=4 + penalty → points=12 (5×2+2), penalty=3 (total 15)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-10-02T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-09T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-16T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-23T20:00Z' }),
      rmMatch('2000-11-02T20:00Z', { round: 20 }),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, rm]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 1, { joker: true, penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 2, 1)  // joker exact R20, streak=4 → 5×2+2=12
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(12)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A5.5: joker wrong direction + streak=4 + 1 penalty hit → points=-3, penalty=3 (total 0)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-10-03T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-10T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-17T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-24T20:00Z' }),
      rmMatch('2000-11-03T20:00Z'),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, rm]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 0, { joker: true, penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 0, 1)  // away win — joker predicted home win, streak=4 → -3
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(-3)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A5.6: joker wrong direction + streak=4 + 2 penalty hits → points=-3, penalty=6 (total 3)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-10-04T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-11T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-18T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-10-25T20:00Z' }),
      rmMatch('2000-11-04T20:00Z'),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, rm]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 0, { joker: true, penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 0, 1)
      await setPenaltyEvents(rm.id, [{ e: 22, x: null }, { e: 28, x: null }])  // 2 hits in window
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(-3)
      h.expect(p.penalty_bonus).toBe(6)
    })
  })

  // ── A4.4: streak=6 + penalty (max streak bonus on regular exact) ──────────────

  h.it('A4.4: exact + streak_count=6 + penalty hit → points=6 (3+3), penalty=3 (total 9)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2004-12-01T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2004-12-08T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2004-12-15T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2004-12-22T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2004-12-29T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2005-01-05T20:00Z' }),
      rmMatch('2005-01-12T20:00Z'),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, m5, m6, rm]) => {
      for (const m of [m1, m2, m3, m4, m5, m6]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 1, { penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4, m5, m6]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 2, 1)  // exact, streak=6 → 3+3=6
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(6)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  // ── A5.7-A5.8: joker + streak=6 / phase 3 + penalty ─────────────────────────

  h.it('A5.7: joker exact R10 + streak=6 + penalty → points=9 (3×2+3), penalty=3 (total 12)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2005-01-20T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2005-01-27T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2005-02-03T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2005-02-10T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2005-02-17T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2005-02-24T20:00Z' }),
      rmMatch('2005-03-03T20:00Z'),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, m5, m6, rm]) => {
      for (const m of [m1, m2, m3, m4, m5, m6]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 1, { joker: true, penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4, m5, m6]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 2, 1)  // joker exact R10, streak=6 → 3×2+3=9
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(9)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A5.8: joker exact R34 + streak=4 + penalty → points=16 (7×2+2), penalty=3 (total 19)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2005-03-10T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2005-03-17T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2005-03-24T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2005-03-31T20:00Z' }),
      rmMatch('2005-04-07T20:00Z', { round: 34 }),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, rm]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(u1.id, m.id, 2, 1)
      await setPred(u1.id, rm.id, 2, 1, { joker: true, penMin: 18, penMax: 32 })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(rm.id, 2, 1)  // joker exact R34, streak=4 → 7×2+2=16
      await setPenaltyEvents(rm.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, rm.id)
      h.expect(p.points).toBe(16)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  // ── A6: is_special × penalty (Real Madrid + is_special) ──────────────────────

  h.it('A6.1: is_special exact (Real Madrid) + penalty hit → points=6 (3×2), penalty=3 (total 9)', async () => {
    await withMatches([rmMatch('2005-04-14T20:00Z', { is_special: true })], async ([m]) => {
      await setPred(u1.id, m.id, 2, 1, { penMin: 18, penMax: 32 })
      await setScore(m.id, 2, 1)  // is_special exact R10 → 3×2=6
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, m.id)
      h.expect(p.points).toBe(6)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  h.it('A6.2: is_special direction (Real Madrid) + penalty hit → points=2 (1×2), penalty=3 (total 5)', async () => {
    await withMatches([rmMatch('2005-04-21T20:00Z', { is_special: true })], async ([m]) => {
      await setPred(u1.id, m.id, 1, 0, { penMin: 18, penMax: 32 })
      await setScore(m.id, 3, 0)  // is_special direction R10 → 1×2=2
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])
      const p = await getPred(u1.id, m.id)
      h.expect(p.points).toBe(2)
      h.expect(p.penalty_bonus).toBe(3)
    })
  })

  // ── A7: Multi-user — each user gets their own independent penalty calculation ──

  h.it('A7: multi-user on same match, different penalty windows → each gets independent bonus', async () => {
    await withMatches([rmMatch('2005-05-01T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 2, 1, { penMin: 18, penMax: 32 })  // will hit
      await setPred(u2.id, m.id, 2, 1, { penMin: 46, penMax: 62 })  // will miss
      await setPred(u3.id, m.id, 2, 1, { penMin: 63, penMax: 77 })  // will miss
      await setScore(m.id, 2, 1)  // all exact → 3 pts each
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])  // only hits window 18-32
      h.expect((await getPred(u1.id, m.id)).penalty_bonus).toBe(3)  // hit
      h.expect((await getPred(u2.id, m.id)).penalty_bonus).toBe(0)  // miss (46-62)
      h.expect((await getPred(u3.id, m.id)).penalty_bonus).toBe(0)  // miss (63-77)
    })
  })

  // ── A8: Score correction after penalty — penalty_bonus is trigger-independent ──

  h.it('A8: score correction after penalty — penalty_bonus stays, points recalculate', async () => {
    await withMatches([rmMatch('2005-05-08T20:00Z')], async ([m]) => {
      await setPred(u1.id, m.id, 2, 1, { penMin: 18, penMax: 32 })
      await setScore(m.id, 2, 1)            // exact → 3 pts
      await setPenaltyEvents(m.id, [{ e: 25, x: null }])

      const before = await getPred(u1.id, m.id)
      h.expect(before.points).toBe(3)
      h.expect(before.penalty_bonus).toBe(3)

      await setScore(m.id, 0, 1)             // score corrected → miss (wrong direction) → 0 pts
      const after = await getPred(u1.id, m.id)
      h.expect(after.points).toBe(0)         // points recalculated
      h.expect(after.penalty_bonus).toBe(3)  // penalty_bonus unchanged (independent trigger)
    })
  })

  return h.run()
}
