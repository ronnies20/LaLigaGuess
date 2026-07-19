/**
 * Suite: Scoring Trigger
 *
 * Tests the update_match_points() PostgreSQL trigger that fires when home_score
 * or away_score changes. Verifies all scoring branches:
 *   - Phase points (R1/R20/R34 boundaries)
 *   - Exact / direction / miss
 *   - Joker (exact, direction, wrong direction)
 *   - is_special doubling
 *
 * Uses kickoffs in year 2000 so no existing test-DB predictions interfere with
 * streak calculations (all seeded data uses 2026 kickoffs).
 */
import { getTestUser, getTestUsers, withMatches, setPred, setScore, getPred, makeMatch, db } from '../helpers/db.js'
import { makeHarness } from '../helpers/harness.js'

export async function run() {
  const h = makeHarness('Scoring Trigger')
  const user = await getTestUser()

  // ── Phase 1: rounds 1-19 (exact=3, dir=1) ───────────────────────────────────

  h.it('R10 exact score → 3 pts', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-01T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 2, 1)
      await setScore(m.id, 2, 1)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(3)
    })
  })

  h.it('R10 correct direction (home win predicted, home win real, different score) → 1 pt', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-02T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 1, 0)  // home win
      await setScore(m.id, 3, 1)           // home win, different margin
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(1)
    })
  })

  h.it('R10 correct direction: draw predicted, draw real → 1 pt', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-03T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 1, 1)
      await setScore(m.id, 2, 2)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(1)
    })
  })

  h.it('R10 wrong direction (home win predicted, away win real) → 0 pts', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-04T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 2, 0)   // home win
      await setScore(m.id, 0, 1)            // away win
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(0)
    })
  })

  h.it('R10 draw predicted, home win real → 0 pts', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-05T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 1, 1)
      await setScore(m.id, 2, 0)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(0)
    })
  })

  // ── Phase 2: round 20 boundary (exact=5, dir=2) ──────────────────────────────

  h.it('R20 exact → 5 pts (phase 2 boundary)', async () => {
    await withMatches([makeMatch({ round: 20, kickoff: '2000-01-06T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 1, 1)
      await setScore(m.id, 1, 1)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(5)
    })
  })

  h.it('R20 direction → 2 pts', async () => {
    await withMatches([makeMatch({ round: 20, kickoff: '2000-01-07T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 2, 0)
      await setScore(m.id, 1, 0)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(2)
    })
  })

  h.it('R19 exact → 3 pts (still phase 1)', async () => {
    await withMatches([makeMatch({ round: 19, kickoff: '2000-01-08T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 2, 1)
      await setScore(m.id, 2, 1)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(3)
    })
  })

  // ── Phase 3: round 34 boundary (exact=7, dir=3) ──────────────────────────────

  h.it('R34 exact → 7 pts (phase 3 boundary)', async () => {
    await withMatches([makeMatch({ round: 34, kickoff: '2000-01-09T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 0, 0)
      await setScore(m.id, 0, 0)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(7)
    })
  })

  h.it('R34 direction → 3 pts', async () => {
    await withMatches([makeMatch({ round: 34, kickoff: '2000-01-10T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 0, 1)
      await setScore(m.id, 0, 2)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(3)
    })
  })

  h.it('R33 exact → 5 pts (still phase 2)', async () => {
    await withMatches([makeMatch({ round: 33, kickoff: '2000-01-11T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 1, 0)
      await setScore(m.id, 1, 0)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(5)
    })
  })

  // ── Joker ────────────────────────────────────────────────────────────────────

  h.it('Joker exact (no streak) → 6 pts (3×2, R10)', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-12T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 2, 1, { joker: true })
      await setScore(m.id, 2, 1)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(6)
    })
  })

  h.it('Joker correct direction (not exact) → 0 pts (not penalised)', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-13T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 1, 0, { joker: true })  // home win
      await setScore(m.id, 3, 0)                             // home win, different score
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(0)
    })
  })

  h.it('Joker wrong direction (no streak) → -1 pt', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-14T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 2, 0, { joker: true })  // home win
      await setScore(m.id, 0, 1)                             // away win
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(-1)
    })
  })

  h.it('Joker exact R20 → 10 pts (5×2)', async () => {
    await withMatches([makeMatch({ round: 20, kickoff: '2000-01-15T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 1, 0, { joker: true })
      await setScore(m.id, 1, 0)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(10)
    })
  })

  // ── is_special ───────────────────────────────────────────────────────────────

  h.it('is_special exact → 6 pts (3×2, R10)', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-16T20:00Z', is_special: true })], async ([m]) => {
      await setPred(user.id, m.id, 1, 0)
      await setScore(m.id, 1, 0)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(6)
    })
  })

  h.it('is_special direction → 2 pts (1×2, R10)', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-17T20:00Z', is_special: true })], async ([m]) => {
      await setPred(user.id, m.id, 1, 0)
      await setScore(m.id, 2, 0)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(2)
    })
  })

  h.it('is_special miss → 0 pts', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-01-18T20:00Z', is_special: true })], async ([m]) => {
      await setPred(user.id, m.id, 0, 1)
      await setScore(m.id, 2, 0)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(0)
    })
  })

  h.it('is_special exact R20 → 10 pts (5×2)', async () => {
    await withMatches([makeMatch({ round: 20, kickoff: '2000-01-19T20:00Z', is_special: true })], async ([m]) => {
      await setPred(user.id, m.id, 2, 1)
      await setScore(m.id, 2, 1)
      const p = await getPred(user.id, m.id)
      h.expect(p.points).toBe(10)
    })
  })

  // ── B4: is_special exact does NOT receive streak bonus ────────────────────────
  // DB trigger: `elsif new.is_special then final_pts := calculate_points()*2`
  // calculate_points() returns base only — NO streak logic in that branch.

  h.it('B4.2: is_special exact R10 + streak_count=3 → 6 pts (3×2), NOT 8', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-03-01T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-08T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-15T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-22T20:00Z', is_special: true }),
    ]
    await withMatches(defs, async ([m1, m2, m3, ms]) => {
      for (const m of [m1, m2, m3]) await setPred(user.id, m.id, 2, 1)
      await setPred(user.id, ms.id, 2, 1)
      for (const m of [m1, m2, m3]) await setScore(m.id, 2, 1)
      await setScore(ms.id, 2, 1)  // is_special exact, streak=3 → 3×2=6 (no bonus!)
      h.expect((await getPred(user.id, ms.id)).points).toBe(6)
    })
  })

  h.it('B4.3: is_special exact R10 + streak_count=4 → 6 pts (3×2), NOT 9', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-03-03T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-10T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-17T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-24T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-31T20:00Z', is_special: true }),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, ms]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(user.id, m.id, 2, 1)
      await setPred(user.id, ms.id, 2, 1)
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(ms.id, 2, 1)  // is_special exact, streak=4 → 3×2=6 (no bonus!)
      h.expect((await getPred(user.id, ms.id)).points).toBe(6)
    })
  })

  h.it('B4.4: is_special exact R20 + streak_count=4 → 10 pts (5×2), NOT 13', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-03-04T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-11T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-18T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-25T20:00Z' }),
      makeMatch({ round: 20, kickoff: '2000-04-01T20:00Z', is_special: true }),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, ms]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(user.id, m.id, 2, 1)
      await setPred(user.id, ms.id, 2, 1)
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(ms.id, 2, 1)  // is_special R20 exact, streak=4 → 5×2=10 (no bonus!)
      h.expect((await getPred(user.id, ms.id)).points).toBe(10)
    })
  })

  // ── B5: Joker takes precedence over is_special ────────────────────────────────
  // DB trigger: `if rec.is_joker then ... elsif new.is_special then`
  // → is_special doubling is COMPLETELY SKIPPED when is_joker=true

  h.it('B5.1: joker exact + is_special R10, streak=0 → 6 pts (3×2, joker logic)', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-03-05T20:00Z', is_special: true })], async ([m]) => {
      await setPred(user.id, m.id, 2, 1, { joker: true })
      await setScore(m.id, 2, 1)  // joker exact on is_special → joker branch = 3×2=6
      h.expect((await getPred(user.id, m.id)).points).toBe(6)
    })
  })

  h.it('B5.2: joker direction + is_special match → 0 pts (joker dir = 0, not dir×4=4)', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-03-06T20:00Z', is_special: true })], async ([m]) => {
      await setPred(user.id, m.id, 1, 0, { joker: true })
      await setScore(m.id, 3, 0)  // home win, different score → direction
      h.expect((await getPred(user.id, m.id)).points).toBe(0)
    })
  })

  h.it('B5.3: joker exact + is_special R10 + streak=4 → 8 pts (3×2+2, joker branch applies)', async () => {
    const defs = [
      makeMatch({ round: 10, kickoff: '2000-03-02T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-09T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-16T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-23T20:00Z' }),
      makeMatch({ round: 10, kickoff: '2000-03-30T20:00Z', is_special: true }),
    ]
    await withMatches(defs, async ([m1, m2, m3, m4, ms]) => {
      for (const m of [m1, m2, m3, m4]) await setPred(user.id, m.id, 2, 1)
      await setPred(user.id, ms.id, 2, 1, { joker: true })
      for (const m of [m1, m2, m3, m4]) await setScore(m.id, 2, 1)
      await setScore(ms.id, 2, 1)  // joker exact, is_special ignored, streak=4 → 3×2+2=8
      h.expect((await getPred(user.id, ms.id)).points).toBe(8)
    })
  })

  // ── B4.5-B4.6: is_special at phase 3 (R34) ───────────────────────────────────

  h.it('B4.5: is_special exact R34 → 14 pts (7×2), no streak bonus applied', async () => {
    await withMatches([makeMatch({ round: 34, kickoff: '2000-04-01T20:00Z', is_special: true })], async ([m]) => {
      await setPred(user.id, m.id, 2, 1)
      await setScore(m.id, 2, 1)  // is_special exact R34 → 7×2=14
      h.expect((await getPred(user.id, m.id)).points).toBe(14)
    })
  })

  h.it('B4.6: is_special direction R34 → 6 pts (3×2)', async () => {
    await withMatches([makeMatch({ round: 34, kickoff: '2000-04-02T20:00Z', is_special: true })], async ([m]) => {
      await setPred(user.id, m.id, 1, 0)
      await setScore(m.id, 3, 0)  // is_special direction R34 → 3×2=6
      h.expect((await getPred(user.id, m.id)).points).toBe(6)
    })
  })

  // ── C1: 5 users on same match — all prediction types in one trigger run ───────

  h.it('C1: 5 users on same match (result 2-1) all scored correctly in single trigger run', async () => {
    const users = await getTestUsers(5)
    if (users.length < 5) throw new Error('Need at least 5 test users')
    const [ua, ub, uc, ud, ue] = users

    await withMatches([makeMatch({ round: 10, kickoff: '2000-03-26T20:00Z' })], async ([m]) => {
      await setPred(ua.id, m.id, 2, 1)  // exact
      await setPred(ub.id, m.id, 1, 0)  // direction (home win → home win)
      await setPred(uc.id, m.id, 1, 1)  // miss (draw vs home win)
      await setPred(ud.id, m.id, 0, 2)  // miss (away win vs home win)
      await setPred(ue.id, m.id, 3, 0)  // direction (home win, different score)

      await setScore(m.id, 2, 1)

      h.expect((await getPred(ua.id, m.id)).points).toBe(3)  // exact
      h.expect((await getPred(ub.id, m.id)).points).toBe(1)  // direction
      h.expect((await getPred(uc.id, m.id)).points).toBe(0)  // miss (draw)
      h.expect((await getPred(ud.id, m.id)).points).toBe(0)  // miss (wrong dir)
      h.expect((await getPred(ue.id, m.id)).points).toBe(1)  // direction (home win)
    })
  })

  // ── C2: Score correction recalculates all predictions correctly ───────────────

  h.it('C2: score correction — exact→miss and miss→exact after result update', async () => {
    const [ua, ub] = await getTestUsers(2)

    await withMatches([makeMatch({ round: 10, kickoff: '2000-03-27T20:00Z' })], async ([m]) => {
      await setPred(ua.id, m.id, 2, 1)  // will be exact with first result
      await setPred(ub.id, m.id, 1, 2)  // will be exact with corrected result

      // First result: 2-1 → ua exact (3), ub wrong dir (0)
      await setScore(m.id, 2, 1)
      h.expect((await getPred(ua.id, m.id)).points).toBe(3)
      h.expect((await getPred(ub.id, m.id)).points).toBe(0)

      // Corrected result: 1-2 → ua wrong dir (0), ub exact (3)
      await setScore(m.id, 1, 2)
      h.expect((await getPred(ua.id, m.id)).points).toBe(0)
      h.expect((await getPred(ub.id, m.id)).points).toBe(3)
    })
  })

  // ── C3: Prediction upsert — latest guess replaces old, no duplicate rows ──────

  h.it('C3: upsert replaces old prediction and single row exists after two setPreds', async () => {
    await withMatches([makeMatch({ round: 10, kickoff: '2000-03-28T20:00Z' })], async ([m]) => {
      await setPred(user.id, m.id, 2, 1)   // initial guess
      await setPred(user.id, m.id, 1, 0)   // change guess to 1-0

      await setScore(m.id, 2, 1)           // 2-1 result → 1-0 is direction (1 pt)

      const rows = await db(`predictions?user_id=eq.${user.id}&match_id=eq.${m.id}&select=id,points`)
      h.expect(rows.length).toBe(1)         // exactly one row (no duplicate)
      h.expect(rows[0].points).toBe(1)      // direction (1-0 vs 2-1 = home win→home win)
    })
  })

  return h.run()
}
