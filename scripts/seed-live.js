/**
 * seed-live.js — 4 משחקים חיים, ניחושים מגוונים + פנדל ריאל מדריד
 *
 * node scripts/seed-live.js
 *
 * תוצאות חיות:
 *   MAL-LEV  דקה 90 | 0:0
 *   ESP-SEV  דקה 90 | 1:1
 *   ALA-OSA  דקה 90 | 1:1
 *   BET-MAD  דקה 70 | 1:1  + פנדל ריאל דקה 55
 *
 * תרחישים (כולל בונוס פנדל 46-62 = 3נק'):
 *   YAMAL  — 🃏MAL exact(0:0)  | ESP miss(2:0→0)  | ALA miss(0:1→0)   | BET miss(2:1→0) pen33-45  = 6
 *   GAVI   — MAL exact(0:0→3) | 🃏ESP exact(1:1→6) | ALA miss(2:1→0)  | BET draw(0:0→1) pen63-77  = 10
 *   PEDRI  — MAL miss(0:1→0)  | ESP exact(1:1→3)  | ALA draw(0:0→1)  | 🃏BET exact(1:1→6) pen78-90 = 10
 *   MESSI  — MAL draw(1:1→1)  | ESP draw(0:0→1)   | 🃏ALA exact(1:1→6)| BET exact(1:1→3)+pen3 = 14
 *   FCB13  — MAL exact(0:0→3) | ESP miss(1:0→0)   | 🃏ALA miss(2:0→-1)| BET exact(1:1→3)+pen3 = 8
 *   RONI   — 🃏MAL miss(1:0→-1)| ESP draw(2:2→1)  | ALA draw(0:0→1)  | BET miss(0:1→0) pen1-17   = 1
 */

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://jgzscpqnqvymnrpktikf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnenNjcHFucXZ5bW5ycGt0aWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY2MzAzMywiZXhwIjoyMDk4MjM5MDMzfQ.1r4lGIF1tpJ5_jHud0GUElqVdLkdc7giEQPofF9AHto',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const FRIEREN_ID = 'e32b1490-9dd1-49aa-a750-e7768db784b0' // never touched
const YAMAL_ID   = 'd2e3ddc2-9a4c-4afd-acbb-2012833a2521'
const PEDRI_ID   = 'c1d9810a-3ff3-4896-a4ab-01884bf51289'
const GAVI_ID    = 'f2c0c037-acae-4fb3-86fe-06ec017ff1ce'
const MESSI_ID   = '2566de8b-1a39-46c5-83ab-0d6c4eb48813'
const RONI_ID    = '3b8ef263-8cfd-45a9-a526-7a9b7bd3ccf6'
const FCB13_ID   = '8f7d43b2-eb31-4686-821e-ed3c7e573b0f'

async function findMatch(homeQ, awayQ) {
  const { data } = await sb.from('matches')
    .select('id, round, home_team, away_team')
    .ilike('home_team', `%${homeQ}%`)
    .ilike('away_team', `%${awayQ}%`)
    .order('kickoff')
    .limit(1)
  return data?.[0] ?? null
}

async function main() {
  console.log('\n⚽ SEED-LIVE — 4 משחקים + ניחושים + פנדל ריאל מדריד\n')

  const mMal = await findMatch('Malaga',     'Levante')
  const mEsp = await findMatch('Espanyol',   'Sevilla')
  const mAla = await findMatch('Alaves',     'Osasuna')
  const mBet = await findMatch('Real Betis', 'Real Madrid')

  for (const [label, m] of [['MAL-LEV', mMal], ['ESP-SEV', mEsp], ['ALA-OSA', mAla], ['BET-MAD', mBet]]) {
    if (!m) { console.error(`  ✗ לא נמצא: ${label}`); process.exit(1) }
    console.log(`  ✓ ${label}: ${m.home_team} vs ${m.away_team} [round ${m.round}]`)
  }

  const round = mMal.round
  const kickoff90 = new Date(Date.now() - 90 * 60 * 1000).toISOString()
  const kickoff70 = new Date(Date.now() - 70 * 60 * 1000).toISOString()

  // ── 1. שמירת ניחושי FRIEREN לפני הכל ─────────────────────────
  const frierenSaved = {}
  for (const m of [mMal, mEsp, mAla, mBet]) {
    const { data: fp } = await sb.from('predictions')
      .select('home_guess, away_guess, is_joker, penalty_min, penalty_max')
      .eq('match_id', m.id).eq('user_id', FRIEREN_ID).maybeSingle()
    if (fp) frierenSaved[m.id] = fp
  }

  // ── 2. ניקוי ג'וקרים ישנים ב-r4 (מה-seed הקודם) ────────────────
  // כל ניחוש קיים ב-r4 עם is_joker=true מנוקה לפני כן,
  // כדי שה-trigger enforce_joker_uniqueness לא יחסום
  const userIds = [YAMAL_ID, PEDRI_ID, GAVI_ID, MESSI_ID, RONI_ID, FCB13_ID]
  const { data: oldJokers } = await sb.from('predictions')
    .select('id')
    .in('user_id', userIds)
    .eq('round', mMal.round)
    .eq('is_joker', true)
  if (oldJokers?.length) {
    await sb.from('predictions')
      .update({ is_joker: false })
      .in('id', oldJokers.map(p => p.id))
    console.log(`  ✓ נוקו ${oldJokers.length} ג'וקרים ישנים ב-round ${mMal.round}`)
  }

  // ── 3. ניחושים (לפני הפעלת scores כדי שהטריגר ימצא אותם) ────
  const predictions = [
    // YAMAL — 🃏 exact MAL, miss ESP(home-win→wrong), miss ALA(away-win→wrong), miss BET(home-win→wrong) pen33-45
    { user_id: YAMAL_ID, match_id: mMal.id, home_guess: 0, away_guess: 0, is_joker: true  },
    { user_id: YAMAL_ID, match_id: mEsp.id, home_guess: 2, away_guess: 0, is_joker: false },
    { user_id: YAMAL_ID, match_id: mAla.id, home_guess: 0, away_guess: 1, is_joker: false },
    { user_id: YAMAL_ID, match_id: mBet.id, home_guess: 2, away_guess: 1, is_joker: false, penalty_min: 33, penalty_max: 45 },

    // PEDRI — miss MAL(away→wrong), exact ESP, draw ALA(correct), 🃏 exact BET pen78-90
    { user_id: PEDRI_ID, match_id: mMal.id, home_guess: 0, away_guess: 1, is_joker: false },
    { user_id: PEDRI_ID, match_id: mEsp.id, home_guess: 1, away_guess: 1, is_joker: false },
    { user_id: PEDRI_ID, match_id: mAla.id, home_guess: 0, away_guess: 0, is_joker: false },
    { user_id: PEDRI_ID, match_id: mBet.id, home_guess: 1, away_guess: 1, is_joker: true,  penalty_min: 78, penalty_max: 90 },

    // MESSI — draw MAL(correct), draw ESP(correct), 🃏 exact ALA, exact BET pen46-62 ✓
    { user_id: MESSI_ID, match_id: mMal.id, home_guess: 1, away_guess: 1, is_joker: false },
    { user_id: MESSI_ID, match_id: mEsp.id, home_guess: 0, away_guess: 0, is_joker: false },
    { user_id: MESSI_ID, match_id: mAla.id, home_guess: 1, away_guess: 1, is_joker: true  },
    { user_id: MESSI_ID, match_id: mBet.id, home_guess: 1, away_guess: 1, is_joker: false, penalty_min: 46, penalty_max: 62 },

    // GAVI — exact MAL, 🃏 exact ESP, miss ALA(home-win→wrong), draw BET(correct) pen63-77
    { user_id: GAVI_ID,  match_id: mMal.id, home_guess: 0, away_guess: 0, is_joker: false },
    { user_id: GAVI_ID,  match_id: mEsp.id, home_guess: 1, away_guess: 1, is_joker: true  },
    { user_id: GAVI_ID,  match_id: mAla.id, home_guess: 2, away_guess: 1, is_joker: false },
    { user_id: GAVI_ID,  match_id: mBet.id, home_guess: 0, away_guess: 0, is_joker: false, penalty_min: 63, penalty_max: 77 },

    // RONI — 🃏 miss MAL(1:0 vs 0:0 → home-win-wrong → -1), draw ESP, draw ALA, miss BET(away-win→wrong) pen1-17
    { user_id: RONI_ID,  match_id: mMal.id, home_guess: 1, away_guess: 0, is_joker: true  },
    { user_id: RONI_ID,  match_id: mEsp.id, home_guess: 2, away_guess: 2, is_joker: false },
    { user_id: RONI_ID,  match_id: mAla.id, home_guess: 0, away_guess: 0, is_joker: false },
    { user_id: RONI_ID,  match_id: mBet.id, home_guess: 0, away_guess: 1, is_joker: false, penalty_min: 1, penalty_max: 17 },

    // FCB13 — exact MAL, miss ESP(home-win→wrong), 🃏 miss ALA(2:0 vs 1:1 → home-win-wrong → -1), exact BET pen46-62 ✓
    { user_id: FCB13_ID, match_id: mMal.id, home_guess: 0, away_guess: 0, is_joker: false },
    { user_id: FCB13_ID, match_id: mEsp.id, home_guess: 1, away_guess: 0, is_joker: false },
    { user_id: FCB13_ID, match_id: mAla.id, home_guess: 2, away_guess: 0, is_joker: true  },
    { user_id: FCB13_ID, match_id: mBet.id, home_guess: 1, away_guess: 1, is_joker: false, penalty_min: 46, penalty_max: 62 },
  ]

  const { error: pe } = await sb.from('predictions').upsert(predictions, { onConflict: 'user_id,match_id' })
  if (pe) { console.error('  ✗ ניחושים:', pe.message); process.exit(1) }
  else console.log(`\n  ✓ ${predictions.length} ניחושים נשמרו`)

  // ── 3. שחזור FRIEREN (למקרה שנדרס) ────────────────────────────
  for (const [matchId, fp] of Object.entries(frierenSaved)) {
    await sb.from('predictions').upsert({
      user_id: FRIEREN_ID, match_id: matchId,
      home_guess: fp.home_guess, away_guess: fp.away_guess,
      is_joker: fp.is_joker ?? false,
      ...(fp.penalty_min != null ? { penalty_min: fp.penalty_min, penalty_max: fp.penalty_max } : {})
    }, { onConflict: 'user_id,match_id' })
  }

  // ── 4. טראש טוק ────────────────────────────────────────────────
  const trash = [
    { user_id: YAMAL_ID,  round, message: '0:0 ג\'וקר נסיך 🃏' },
    { user_id: GAVI_ID,   round, message: 'ESP-SEV ג\'וקר 🔥'  },
    { user_id: PEDRI_ID,  round, message: 'ריאל ג\'וקר זה 💰'  },
    { user_id: MESSI_ID,  round, message: '1:1 בכל מקום 🐐'    },
    { user_id: FCB13_ID,  round, message: 'ALA ג\'וקר ריסק 🎲'  },
    { user_id: RONI_ID,   round, message: 'MAL ג\'וקר יצא עגול 😅' },
  ]
  const { error: te } = await sb.from('round_messages').upsert(trash, { onConflict: 'user_id,round' })
  if (te) console.error('  ✗ טראש:', te.message)
  else console.log(`  ✓ ${trash.length} הודעות טראש`)

  // ── 5. הפעלת מאטצ'ים לייב (טריגר update_match_points מופעל) ───
  console.log()
  for (const { id, label, score_h, score_a, kickoff } of [
    { id: mMal.id, label: 'MAL-LEV', score_h: 0, score_a: 0, kickoff: kickoff90 },
    { id: mEsp.id, label: 'ESP-SEV', score_h: 1, score_a: 1, kickoff: kickoff90 },
    { id: mAla.id, label: 'ALA-OSA', score_h: 1, score_a: 1, kickoff: kickoff90 },
    { id: mBet.id, label: 'BET-MAD', score_h: 1, score_a: 1, kickoff: kickoff70 },
  ]) {
    const { error } = await sb.from('matches').update({
      status: '2H', home_score: score_h, away_score: score_a, kickoff,
    }).eq('id', id)
    if (error) console.error(`  ✗ ${label}: ${error.message}`)
    else console.log(`  ✓ ${label}: ${score_h}:${score_a} [2H live]`)
  }

  // ── 6. פנדל ריאל מדריד דקה 55 ← טריגר update_penalty_bonus ───
  await new Promise(r => setTimeout(r, 600))
  const { error: penErr } = await sb.from('matches').update({
    penalty_events: [{ e: 55, x: null }],
    penalty_minute: 55,
  }).eq('id', mBet.id)
  if (penErr) console.error('  ✗ פנדל:', penErr.message)
  else console.log('  ✓ פנדל ריאל מדריד דקה 55 → טווח 46-62 מנצח (+3נק\')')

  // ── 7. סיכום ───────────────────────────────────────────────────
  console.log('\n📊 ניחושים ונקודות לייב (ללא בונוס סטרייק):')
  console.log()
  console.log('       MAL 0:0   ESP 1:1   ALA 1:1   BET 1:1   סה"כ  (+pen)')
  console.log('  MESSI  1:1(1)  0:0(1)  1:1🃏(6)  1:1(3)    11   (+3=14)')
  console.log('  PEDRI  0:1(0)  1:1(3)  0:0(1)   1:1🃏(6)   10')
  console.log('  GAVI   0:0(3)  1:1🃏(6) 2:1(0)  0:0(1)    10')
  console.log('  FCB13  0:0(3)  1:0(0)  2:0🃏(-1) 1:1(3)    5   (+3=8)')
  console.log('  YAMAL  0:0🃏(6) 2:0(0)  0:1(0)  2:1(0)     6')
  console.log('  RONI   1:0🃏(-1) 2:2(1) 0:0(1)  0:1(0)    1')
  console.log()
  console.log('  💰 פנדל 46-62 (דקה 55): MESSI +3 | FCB13 +3')
  console.log('  💀 ג\'וקר כיוון שגוי: RONI -1 | FCB13 -1')
}

main().catch(e => { console.error(e); process.exit(1) })
