/**
 * seed-r4.js — הגדרת 3 המשחקים הראשונים של מחזור 4
 *
 * node scripts/seed-r4.js setup   → נועל ב-5 דק', ממלא ניחושים + טראש טוק
 * node scripts/seed-r4.js live88  → מגדיר 3 משחקים כ-live בדקה 90+3 עם ציונים חיים
 * node scripts/seed-r4.js close   → סוגר — score_90 = ציון live88, ציון סופי שונה
 *
 * ציון ב-live88:   M1=2:1 | M2=2:1 | M3=1:2
 * ציון סופי (close): M1=2:2 | M2=2:2 | M3=1:3   ← שעריים בתוספת הזמן
 *
 * מקרי קצה (ציון סופי):
 *   YAMAL  — ג'וקר M1(2:1) vs 2:2 → dir שגוי → -1נק'  |  M3(0:2) כיוון → 1נק' | סה"כ 0
 *   PEDRI  — ג'וקר M2(1:1) vs 2:2 → draw-joker → -1נק' | סה"כ -1
 *   MESSI  — כל 3 ניחוש 2:1 → כולם dir שגוי לציון סופי | סה"כ 0
 *   GAVI   — M2(0:0) vs 2:2 כיוון(draw) + M3(0:2) כיוון | סה"כ 2
 *   RONI   — ג'וקר M1(1:0) vs 2:2 → dir שגוי → -1נק' | סה"כ -1
 *   FCB13  — M3(0:3) כיוון | סה"כ 1
 *
 * 💀 lateGoalPtsLost:
 *   YAMAL  7נק' (joker exact 6 → -1)
 *   MESSI  3נק' (exact 3 → 0)
 *   GAVI   3נק' (exact 3 → 0)
 *   FCB13  3נק' (exact 3 → 0)
 */

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://jgzscpqnqvymnrpktikf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnenNjcHFucXZ5bW5ycGt0aWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY2MzAzMywiZXhwIjoyMDk4MjM5MDMzfQ.1r4lGIF1tpJ5_jHud0GUElqVdLkdc7giEQPofF9AHto',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const FRIEREN_ID = 'e32b1490-9dd1-49aa-a750-e7768db784b0'
const YAMAL_ID   = 'd2e3ddc2-9a4c-4afd-acbb-2012833a2521'
const PEDRI_ID   = 'c1d9810a-3ff3-4896-a4ab-01884bf51289'
const GAVI_ID    = 'f2c0c037-acae-4fb3-86fe-06ec017ff1ce'
const MESSI_ID   = '2566de8b-1a39-46c5-83ab-0d6c4eb48813'
const RONI_ID    = '3b8ef263-8cfd-45a9-a526-7a9b7bd3ccf6'
const FCB13_ID   = '8f7d43b2-eb31-4686-821e-ed3c7e573b0f'

// ── חיפוש 3 משחקים לפי שם קבוצת הבית ──────────────────────────
async function findMatch(homeQ) {
  const { data } = await sb.from('matches')
    .select('id, round, home_team, away_team, kickoff')
    .ilike('home_team', `%${homeQ}%`)
    .is('home_score', null)
    .order('kickoff')
    .limit(1)
  return data?.[0] ?? null
}

// ── setup: נועל ב-5 דק' + ניחושים + טראש טוק ───────────────────
async function modeSetup() {
  console.log('\n🔧 SETUP — נועל 3 משחקים ב-5 דקות, ממלא ניחושים\n')

  const kickoff5min = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const m1 = await findMatch('Athletic')
  const m2 = await findMatch('Valencia')
  const m3 = await findMatch('Villarreal')

  if (!m1 || !m2 || !m3) {
    console.error('✗ לא נמצאו כל 3 המשחקים')
    if (!m1) console.error('  חסר: Athletic Club')
    if (!m2) console.error('  חסר: Valencia')
    if (!m3) console.error('  חסר: Villarreal')
    return
  }

  const round = m1.round
  console.log(`מחזור ${round}`)
  console.log(`  M1: ${m1.home_team} vs ${m1.away_team} [${m1.id}]`)
  console.log(`  M2: ${m2.home_team} vs ${m2.away_team} [${m2.id}]`)
  console.log(`  M3: ${m3.home_team} vs ${m3.away_team} [${m3.id}]`)

  // עדכון kickoff ל-5 דקות מעכשיו
  for (const m of [m1, m2, m3]) {
    const { error } = await sb.from('matches').update({ kickoff: kickoff5min }).eq('id', m.id)
    if (error) console.error(`  ✗ kickoff ${m.home_team}: ${error.message}`)
    else console.log(`  ✓ ${m.home_team} ← kickoff עוד 5 דק'`)
  }

  // ── ניחושים לכל יוזר (חוץ מ-FRIEREN) ───────────────────────────
  // תוצאות מתוכננות: M1=2:1, M2=0:0, M3=1:2
  //
  // YAMAL: ג'וקר M1(2:1 exact), M2(1:0 כיוון-שגוי), M3(0:2 כיוון-נכון)
  // PEDRI: M1(2:0 כיוון-נכון), ג'וקר M2(1:1 כיוון-נכון-לא-מדויק→-1), M3(1:0 כיוון-שגוי)
  // MESSI: M1(2:1 exact), M2(2:1 כיוון-שגוי), M3(2:1 כיוון-שגוי+הפוך)
  // GAVI:  M1(2:1 exact), M2(0:0 exact), M3(0:2 כיוון-נכון)
  // RONI:  ג'וקר M1(1:0 כיוון-נכון-לא-מדויק→-1), M2(2:0 כיוון-שגוי), M3(2:1 כיוון-שגוי)
  // FCB13: M1(2:1 exact), M2=ריק, M3(0:3 כיוון-נכון)

  const predictions = [
    // YAMAL — joker exact + כיוון נכון
    { user_id: YAMAL_ID, match_id: m1.id, home_guess: 2, away_guess: 1, is_joker: true  },
    { user_id: YAMAL_ID, match_id: m2.id, home_guess: 1, away_guess: 0, is_joker: false },
    { user_id: YAMAL_ID, match_id: m3.id, home_guess: 0, away_guess: 2, is_joker: false },

    // PEDRI — joker על כיוון-נכון-לא-מדויק → -1נק'
    { user_id: PEDRI_ID, match_id: m1.id, home_guess: 2, away_guess: 0, is_joker: false },
    { user_id: PEDRI_ID, match_id: m2.id, home_guess: 1, away_guess: 1, is_joker: true  },
    { user_id: PEDRI_ID, match_id: m3.id, home_guess: 1, away_guess: 0, is_joker: false },

    // MESSI — אותו ניחוש 2:1 לכל 3 (exact, כיוון-שגוי, הפוך)
    { user_id: MESSI_ID, match_id: m1.id, home_guess: 2, away_guess: 1, is_joker: false },
    { user_id: MESSI_ID, match_id: m2.id, home_guess: 2, away_guess: 1, is_joker: false },
    { user_id: MESSI_ID, match_id: m3.id, home_guess: 2, away_guess: 1, is_joker: false },

    // GAVI — שני exact ואחד כיוון נכון
    { user_id: GAVI_ID, match_id: m1.id, home_guess: 2, away_guess: 1, is_joker: false },
    { user_id: GAVI_ID, match_id: m2.id, home_guess: 0, away_guess: 0, is_joker: false },
    { user_id: GAVI_ID, match_id: m3.id, home_guess: 0, away_guess: 2, is_joker: false },

    // RONI — joker על כיוון-נכון-לא-מדויק → -1נק'
    { user_id: RONI_ID, match_id: m1.id, home_guess: 1, away_guess: 0, is_joker: true  },
    { user_id: RONI_ID, match_id: m2.id, home_guess: 2, away_guess: 0, is_joker: false },
    { user_id: RONI_ID, match_id: m3.id, home_guess: 2, away_guess: 1, is_joker: false },

    // FCB13 — מדלג על M2 (לא ניחש)
    { user_id: FCB13_ID, match_id: m1.id, home_guess: 2, away_guess: 1, is_joker: false },
    { user_id: FCB13_ID, match_id: m3.id, home_guess: 0, away_guess: 3, is_joker: false },
  ]

  const { error: pe } = await sb.from('predictions')
    .upsert(predictions, { onConflict: 'user_id,match_id' })
  if (pe) console.error('  ✗ ניחושים:', pe.message)
  else console.log(`\n  ✓ ${predictions.length} ניחושים נשמרו`)

  // ── טראש טוק ─────────────────────────────────────────────────
  const trash = [
    { user_id: YAMAL_ID,  round, message: 'ג\'וקר 2:1 מי עוצר 🃏' },
    { user_id: PEDRI_ID,  round, message: '0:0 בטוח 🤞'            },
    { user_id: MESSI_ID,  round, message: 'כולם 2:1 מצחיק 😏'      },
    { user_id: GAVI_ID,   round, message: 'שניים מדויקות לפחות'    },
    { user_id: RONI_ID,   round, message: 'ג\'וקר כאב אחרון 😭'    },
    { user_id: FCB13_ID,  round, message: 'M1 מדויק וסגרנו 🎯'     },
  ]

  const { error: te } = await sb.from('round_messages')
    .upsert(trash, { onConflict: 'user_id,round' })
  if (te) console.error('  ✗ טראש:', te.message)
  else console.log(`  ✓ ${trash.length} הודעות טראש טוק`)

  console.log('\n📋 ציפיות לאחר סגירה:')
  console.log('  YAMAL  — 7נק\' (joker exact 6 + כיוון 1)')
  console.log('  GAVI   — 7נק\' (exact 3 + exact 3 + כיוון 1)')
  console.log('  FCB13  — 4נק\' (exact 3 + כיוון 1)')
  console.log('  MESSI  — 3נק\' (exact M1 בלבד)')
  console.log('  PEDRI  — 0נק\' (כיוון 1 + joker כיוון -1 + שגוי 0)')
  console.log('  RONI   — -1נק\' (joker כיוון-לא-מדויק)')
  console.log('  FRIEREN — לפי מה שניחשת')
}

// ── live88: 3 משחקים בדקה 88 עם תוצאות חיות ────────────────────
async function modeLive88() {
  console.log('\n⚽ LIVE88 — מגדיר 3 משחקים כ-live דקה 88\n')

  // kickoff לפני 93 דקות → elapsed = 93 (= דקה 90+3, תוספת זמן)
  const kickoff88 = new Date(Date.now() - 93 * 60 * 1000).toISOString()

  const live = [
    { homeQ: 'Athletic',  home_score: 2, away_score: 1 },  // ATH 2:1 ATM
    { homeQ: 'Valencia',  home_score: 2, away_score: 1 },  // VAL 2:1 BAR
    { homeQ: 'Villarreal',home_score: 1, away_score: 2 },  // VIL 1:2 DEP
  ]

  for (const c of live) {
    const { data: rows } = await sb.from('matches')
      .select('id, home_team, away_team')
      .ilike('home_team', `%${c.homeQ}%`)
      .is('home_score', null)
      .order('kickoff')
      .limit(1)
    const match = rows?.[0]

    if (!match) { console.error(`  ✗ לא נמצא: ${c.homeQ}`); continue }

    const { error } = await sb.from('matches').update({
      status:     '2H',
      home_score:  c.home_score,
      away_score:  c.away_score,
      kickoff:     kickoff88,
    }).eq('id', match.id)

    if (error) console.error(`  ✗ ${match.home_team}: ${error.message}`)
    else console.log(`  ✓ ${match.home_team} ${c.home_score}:${c.away_score} ${match.away_team} → 2H דקה 88`)
  }

  console.log('\n  🔄 רענן את הדף — 3 כרטיסי Live יופיעו עם תוצאות חיות')
}

// ── close: סוגר עם ציון סופי + שומר score_90 מהציון החי ─────────
async function modeClose() {
  console.log('\n🏁 CLOSE — score_90 = ציון live88, ציון סופי = תוספת זמן\n')

  // ציון סופי (אחרי שערים בתוספת) — homeQ+awayQ לזיהוי ייחודי
  const toClose = [
    { homeQ: 'Athletic',   awayQ: 'Atletico',  home_score: 2, away_score: 2 },
    { homeQ: 'Valencia',   awayQ: 'Barcelona', home_score: 2, away_score: 2 },
    { homeQ: 'Villarreal', awayQ: 'Deportivo', home_score: 1, away_score: 3 },
  ]

  const closedIds = []

  for (const c of toClose) {
    // סינון לפי בית + חוץ כדי להימנע מכפל עם מחזורים אחרים
    const { data: rows } = await sb.from('matches')
      .select('id, home_team, away_team, home_score, away_score')
      .ilike('home_team', `%${c.homeQ}%`)
      .ilike('away_team', `%${c.awayQ}%`)
      .eq('status', '2H')
      .limit(1)
    const match = rows?.[0]

    if (!match) { console.error(`  ✗ לא נמצא בסטטוס 2H: ${c.homeQ}`); continue }

    // שמירת ניחוש FRIEREN
    const { data: fp } = await sb.from('predictions')
      .select('home_guess, away_guess, is_joker, penalty_min, penalty_max')
      .eq('match_id', match.id).eq('user_id', FRIEREN_ID).maybeSingle()

    // score_90 = ציון ה-live88 (לפני שעריים בתוספת)
    const { error } = await sb.from('matches').update({
      score_90:   { home: match.home_score, away: match.away_score },
      home_score: c.home_score,
      away_score: c.away_score,
      status:     'FT',
      kickoff:    new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    }).eq('id', match.id)

    if (error) { console.error(`  ✗ ${match.home_team}: ${error.message}`); continue }
    console.log(`  ✓ ${match.home_team}  score_90=${match.home_score}:${match.away_score}  →  final ${c.home_score}:${c.away_score} [FT]`)
    closedIds.push(match.id)

    if (fp) {
      await sb.from('predictions').upsert({
        user_id: FRIEREN_ID, match_id: match.id,
        home_guess: fp.home_guess, away_guess: fp.away_guess,
        is_joker: fp.is_joker ?? false,
        ...(fp.penalty_min != null ? { penalty_min: fp.penalty_min, penalty_max: fp.penalty_max } : {})
      }, { onConflict: 'user_id,match_id' })
      console.log(`    ✓ FRIEREN שמור`)
    }
  }

  await new Promise(r => setTimeout(r, 2000))

  if (!closedIds.length) return

  const { data: preds } = await sb.from('predictions')
    .select('user_id, home_guess, away_guess, is_joker, points, profiles!inner(display_name), matches!inner(home_team, home_score, away_score, score_90)')
    .in('match_id', closedIds)

  console.log('\n📊 נקודות לפי שחקן (ציון סופי):\n')
  const byUser = {}
  ;(preds || []).forEach(p => {
    if (!byUser[p.user_id]) byUser[p.user_id] = { name: p.profiles.display_name, pts: 0 }
    byUser[p.user_id].pts += p.points ?? 0
  })
  Object.values(byUser).sort((a,b) => b.pts - a.pts).forEach(u => {
    console.log(`  ${u.name}: ${u.pts >= 0 ? '+' : ''}${u.pts}נק'`)
  })

  console.log('\n💀 ציפייה לאיבוד נקודות בתוספת (ProfilePage):')
  console.log('  YAMAL  — 💀7  (joker exact 6 → dir-שגוי -1)')
  console.log('  MESSI  — 💀3  (exact 3 → dir-שגוי 0)')
  console.log('  GAVI   — 💀3  (exact 3 → dir-שגוי 0)')
  console.log('  FCB13  — 💀3  (exact 3 → dir-שגוי 0)')
  console.log('  PEDRI, RONI — —  (לא היו exact ב-score_90)')
}

// ── dispatcher ───────────────────────────────────────────────────
const mode = process.argv[2]
if      (mode === 'setup')   modeSetup().catch(e => { console.error(e); process.exit(1) })
else if (mode === 'live88')  modeLive88().catch(e => { console.error(e); process.exit(1) })
else if (mode === 'close')   modeClose().catch(e => { console.error(e); process.exit(1) })
else console.log('שימוש: node scripts/seed-r4.js setup | live88 | close')
