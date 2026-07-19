/**
 * seed-test.js — בניית סביבת טסט מלאה לשרת הטסטים
 *
 * שימוש:
 *   node seed-test.js                → ניקוי + seed מלא (ריצה ראשונה)
 *   node seed-test.js streak=3       → מאפס את frieren ל-streak=3
 *   node seed-test.js streak=4       → מאפס את frieren ל-streak=4
 *   node seed-test.js streak=5       → מאפס את frieren ל-streak=5
 *   node seed-test.js live           → מציב משחק R3M2 כ-live (מחצית שנייה)
 *   node seed-test.js finish_live    → מסיים את המשחק live → מפעיל קונפטי לפריירן
 *   node seed-test.js critical       → מעביר R3M3 לנעילה בעוד 45 דקות
 *   node seed-test.js playbook       → מדפיס את הפלייבוק המלא
 *   node seed-test.js round1         → מכין מחזור 1 עם 5 דקות לפתיחה
 *   node seed-test.js live_r1        → מגדיר משחק ראשון במחזור 1 כ-live (דקה 37)
 *   node seed-test.js cat_now        → ממלא ניחושים חסרים למחזור 1 (מדמה Cat)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://jgzscpqnqvymnrpktikf.supabase.co'
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnenNjcHFucXZ5bW5ycGt0aWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY2MzAzMywiZXhwIjoyMDk4MjM5MDMzfQ.1r4lGIF1tpJ5_jHud0GUElqVdLkdc7giEQPofF9AHto'

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const H = 60 * 60 * 1000
const D = 24 * H

// ── IDs קבועים ──────────────────────────────────────────────────
const FRIEREN_ID   = 'e32b1490-9dd1-49aa-a750-e7768db784b0'
const YAMAL_ID     = 'd2e3ddc2-9a4c-4afd-acbb-2012833a2521'
const PEDRI_ID     = 'c1d9810a-3ff3-4896-a4ab-01884bf51289'
const GAVI_ID      = 'f2c0c037-acae-4fb3-86fe-06ec017ff1ce'
const MESSI_ID     = '2566de8b-1a39-46c5-83ab-0d6c4eb48813'
const RONI_ID      = '3b8ef263-8cfd-45a9-a526-7a9b7bd3ccf6'
const FCB13_ID     = '8f7d43b2-eb31-4686-821e-ed3c7e573b0f'  // 2008ronel@gmail.com

// ── 12 יוזרי טסט חדשים ─────────────────────────────────────────
const NEW_USERS = [
  { email: 'u_s0@laliga.test',    name: 'Fresh_Zero'     },  // streak 0, לא ניחש
  { email: 'u_s3@laliga.test',    name: 'Streak3'        },  // streak 3
  { email: 'u_s5@laliga.test',    name: 'Streak5plus'    },  // streak 5+
  { email: 'u_jw@laliga.test',    name: 'JokerWin'       },  // joker + נכון
  { email: 'u_jl@laliga.test',    name: 'JokerLoss'      },  // joker + שגוי (streak<4)
  { email: 'u_jl4@laliga.test',   name: 'JokerLossS4'    },  // joker + שגוי (streak≥4) → -3
  { email: 'u_near@laliga.test',  name: 'NearMiss'       },  // כמעט — פספס ב-1 גול
  { email: 'u_rev@laliga.test',   name: 'Reversed'       },  // הפוך — ניחש 1:2 כשהיה 2:1
  { email: 'u_spec@laliga.test',  name: 'SpecialExact'   },  // משחק מיוחד → x2
  { email: 'u_ph@laliga.test',    name: 'PenHit'         },  // פנדל ריאל — פגע
  { email: 'u_pm@laliga.test',    name: 'PenMiss'        },  // פנדל ריאל — החטיא
  { email: 'u_miss@laliga.test',  name: 'MissedRound'    },  // דילג על מחזור
]

// ── הגדרות משחקים ───────────────────────────────────────────────
// Round 1 (14 ימים אחורה, סיים) — בסיס ל-streak של כולם
// Round 2 (7 ימים אחורה, סיים) — frieren דילג! (missed-round)
// Round 3 (נוכחי) — מגוון מצבים לבדיקה

function buildMatches(now) {
  return [
    // ── ROUND 1 ─────────────────────────────────────────────────
    { round:1, home:'Sevilla',       away:'Real Madrid',   kickoff: new Date(now - 14*D),          label:'R1M1' },
    { round:1, home:'Barcelona',     away:'Atletico Madrid',kickoff: new Date(now - 14*D + 1*H),   label:'R1M2' },
    { round:1, home:'Athletic Club', away:'Valencia',       kickoff: new Date(now - 14*D + 2*H),   label:'R1M3' },
    { round:1, home:'Rayo Vallecano',away:'Osasuna',        kickoff: new Date(now - 14*D + 18*H),  label:'R1M4' },
    { round:1, home:'Real Betis',    away:'Getafe',         kickoff: new Date(now - 14*D + 20*H),  label:'R1M5' },

    // ── ROUND 2 ─────────────────────────────────────────────────
    { round:2, home:'Real Madrid',   away:'Malaga',         kickoff: new Date(now - 7*D),           label:'R2M1', is_special:false },
    { round:2, home:'Espanyol',      away:'Barcelona',      kickoff: new Date(now - 7*D + 1*H),     label:'R2M2' },
    { round:2, home:'Levante',       away:'Alaves',         kickoff: new Date(now - 7*D + 2*H),     label:'R2M3' },
    { round:2, home:'Celta Vigo',    away:'Real Sociedad',  kickoff: new Date(now - 7*D + 18*H),    label:'R2M4' },
    { round:2, home:'Racing Santander',away:'Elche',        kickoff: new Date(now - 7*D + 20*H),    label:'R2M5' },

    // ── ROUND 3 — נוכחי ─────────────────────────────────────────
    // R3M1: סיים לפני 3 ימים — frieren ניחש נכון → קונפטי בטעינה
    { round:3, home:'Villarreal',    away:'Deportivo La Coruna', kickoff: new Date(now - 3*D),      label:'R3M1' },
    // R3M2: live עכשיו — כדור שני (יוגדר ב-live mode)
    { round:3, home:'Osasuna',       away:'Levante',        kickoff: new Date(now - 90*60*1000),    label:'R3M2' },
    // R3M3: נועל בעוד 45 דקות (countdown critical)
    { round:3, home:'Getafe',        away:'Racing Santander',kickoff: new Date(now + 1.75*H),       label:'R3M3' },
    // R3M4: ריאל מדריד — מיוחד — נועל בעוד 3 שעות (countdown urgent)
    { round:3, home:'Real Madrid',   away:'Elche',           kickoff: new Date(now + 4*H), is_special:true, label:'R3M4' },
    // R3M5-10: משחקים רגילים שבוע קדימה
    { round:3, home:'Barcelona',     away:'Sevilla',         kickoff: new Date(now + 5*D),           label:'R3M5' },
    { round:3, home:'Atletico Madrid',away:'Villarreal',     kickoff: new Date(now + 5*D + 1*H),    label:'R3M6' },
    { round:3, home:'Valencia',      away:'Alaves',          kickoff: new Date(now + 5*D + 2*H),    label:'R3M7' },
    { round:3, home:'Athletic Club', away:'Malaga',          kickoff: new Date(now + 5*D + 18*H),   label:'R3M8' },
    { round:3, home:'Celta Vigo',    away:'Espanyol',        kickoff: new Date(now + 5*D + 20*H),   label:'R3M9' },
    { round:3, home:'Real Betis',    away:'Real Sociedad',   kickoff: new Date(now + 6*D),           label:'R3M10'},
  ]
}

// ── תוצאות Round 1 ─────────────────────────────────────────────
const R1_RESULTS = {
  R1M1: { home:1, away:2 },  // RM ניצח 2:1 (away)
  R1M2: { home:2, away:1 },  // Barca ניצח 2:1
  R1M3: { home:0, away:0 },  // תיקו
  R1M4: { home:2, away:0 },  // Rayo ניצח 2:0
  R1M5: { home:3, away:1 },  // Betis ניצח 3:1
}

// ── תוצאות Round 2 ─────────────────────────────────────────────
const R2_RESULTS = {
  R2M1: { home:3, away:0, penalty_events: [{e:23,x:null}] },  // RM 3:0 + פנדל בדקה 23
  R2M2: { home:1, away:2 },
  R2M3: { home:0, away:0 },
  R2M4: { home:2, away:1 },
  R2M5: { home:1, away:0 },
}

// ── תוצאות Round 3 Match 1 ─────────────────────────────────────
const R3M1_RESULT = { home:2, away:0 }  // Villarreal 2:0

// ────────────────────────────────────────────────────────────────
// פונקציית עזר: יצירת יוזר אדמין
// ────────────────────────────────────────────────────────────────
async function ensureUser(email, name) {
  // בדוק אם קיים
  const { data: existing } = await sb.auth.admin.listUsers()
  const found = existing?.users?.find(u => u.email === email)
  if (found) return found.id

  const { data, error } = await sb.auth.admin.createUser({
    email, password: 'Test1234!',
    email_confirm: true,
    user_metadata: { display_name: name }
  })
  if (error) { console.error(`  ✗ ${email}:`, error.message); return null }
  // profile נוצר ע"י trigger — חכה רגע
  await new Promise(r => setTimeout(r, 300))
  return data.user.id
}

// ────────────────────────────────────────────────────────────────
// בניית predictions עבור כל יוזר (לפני הזנת תוצאות)
// ────────────────────────────────────────────────────────────────
function buildPredictions(matchMap, userIds) {
  const {
    U_S0, U_S3, U_S5, U_JW, U_JL, U_JL4,
    U_NEAR, U_REV, U_SPEC, U_PH, U_PM, U_MISS
  } = userIds

  const rows = []

  // helper
  const p = (uid, label, h, a, opts = {}) => {
    const mid = matchMap[label]
    if (!mid) return
    rows.push({ user_id: uid, match_id: mid, home_guess: h, away_guess: a,
      is_joker: opts.joker||false,
      penalty_min: opts.penMin||null, penalty_max: opts.penMax||null })
  }

  // ── FRIEREN (המשתמש שלך) ─────────────────────────────────────
  // Round 1: 5 ניחושים מדויקים → streak=5 נכנסים ל-round 3
  p(FRIEREN_ID,'R1M1',1,2)  // exact: Sevilla 1:2 Real Madrid
  p(FRIEREN_ID,'R1M2',2,1)  // exact: Barca 2:1 Atleti
  p(FRIEREN_ID,'R1M3',0,0)  // exact: תיקו
  p(FRIEREN_ID,'R1M4',2,0)  // exact: Rayo 2:0
  p(FRIEREN_ID,'R1M5',3,1)  // exact: Betis 3:1
  // Round 2: לא ניחש! → missed-round banner
  // Round 3 M1: מדויק → קונפטי עם streak=5 → 6 נקודות
  p(FRIEREN_ID,'R3M1',2,0)  // exact Villarreal 2:0

  // ── u_s0: אין ניחושים בכלל ───────────────────────────────────
  // (ריק בכוונה)

  // ── u_s3: streak=3 ───────────────────────────────────────────
  p(U_S3,'R1M3',0,0)  // exact
  p(U_S3,'R1M4',2,0)  // exact
  p(U_S3,'R1M5',3,1)  // exact → streak=3
  p(U_S3,'R3M1',2,0)  // מנסה מדויק בנוכחי

  // ── u_s5: streak=5 ───────────────────────────────────────────
  p(U_S5,'R1M1',1,2)  // exact
  p(U_S5,'R1M2',2,1)  // exact
  p(U_S5,'R1M3',0,0)  // exact
  p(U_S5,'R1M4',2,0)  // exact
  p(U_S5,'R1M5',3,1)  // exact → streak=5
  p(U_S5,'R3M1',2,0)  // מדויק בנוכחי → 6 נק׳ (streak=5 bonus)

  // ── u_jw: joker + נכון ───────────────────────────────────────
  p(U_JW,'R1M1',1,2)  // exact (ר1)
  p(U_JW,'R1M2',2,1)  // exact
  p(U_JW,'R3M1',2,0, {joker:true}) // joker + נכון → 3*2=6 נק׳

  // ── u_jl: joker + שגוי, streak<4 → -1 ───────────────────────
  p(U_JL,'R1M1',1,2)  // exact
  p(U_JL,'R1M2',2,1)  // exact
  p(U_JL,'R3M1',0,2, {joker:true}) // joker + שגוי (ניחש 0:2 במקום 2:0) → -1

  // ── u_jl4: joker + שגוי, streak≥4 → -3 ──────────────────────
  p(U_JL4,'R1M1',1,2)  // exact
  p(U_JL4,'R1M2',2,1)  // exact
  p(U_JL4,'R1M3',0,0)  // exact
  p(U_JL4,'R1M4',2,0)  // exact → streak=4
  p(U_JL4,'R3M1',0,2, {joker:true}) // joker + שגוי + streak≥4 → -3

  // ── u_near: כמעט — פספס ב-1 גול ─────────────────────────────
  p(U_NEAR,'R3M1',2,1)  // ניחש 2:1, היה 2:0 → diff=1 → near-miss anim

  // ── u_rev: הפוך — ניחש 0:2 כשהיה 2:0 ───────────────────────
  p(U_REV,'R3M1',0,2)  // reversed → reversed anim

  // ── u_spec: משחק מיוחד (R3M4) ── נציג אחרי שנגדיר תוצאה
  // (מוכנס ב-set_special_result)

  // ── u_ph: פנדל ריאל — פגע (R2M1 RM 3:0, penalty in min 23) ──
  // טווח 18-32 כולל דקה 23
  p(U_PH,'R2M1',3,0, {penMin:18, penMax:32})  // פנדל בטווח → +3

  // ── u_pm: פנדל ריאל — החטיא ──────────────────────────────────
  p(U_PM,'R2M1',3,0, {penMin:1, penMax:17})   // פנדל בדקה 23, ניחש 1-17 → miss

  // ── u_miss: דילג על round 2 לגמרי ────────────────────────────
  // רק round 1
  p(U_MISS,'R1M1',1,2)
  p(U_MISS,'R1M2',2,1)

  // ── שאר המשתמשים הישנים (מילוי כללי) ────────────────────────
  for (const uid of [YAMAL_ID, PEDRI_ID, GAVI_ID, MESSI_ID, RONI_ID, FCB13_ID]) {
    p(uid,'R1M1',1,2); p(uid,'R1M2',2,1); p(uid,'R1M3',0,0)
    p(uid,'R1M4',2,0); p(uid,'R1M5',3,1)
    p(uid,'R2M2',1,2); p(uid,'R2M3',0,0); p(uid,'R2M4',2,1)
    p(uid,'R3M1',2,0)
  }
  // Yamal עם Joker בround 3
  const yamalIdx = rows.findIndex(r => r.user_id === YAMAL_ID && r.match_id === matchMap['R3M1'])
  if (yamalIdx >= 0) rows[yamalIdx].is_joker = true

  return rows
}

// ────────────────────────────────────────────────────────────────
async function setResults(matchMap, results) {
  for (const [label, res] of Object.entries(results)) {
    const mid = matchMap[label]
    if (!mid) continue
    const update = { home_score: res.home, away_score: res.away }
    if (res.penalty_events) update.penalty_events = res.penalty_events
    const { error } = await sb.from('matches').update(update).eq('id', mid)
    if (error) console.error(`  ✗ set result ${label}:`, error.message)
    else process.stdout.write(`  ✓ ${label} → ${res.home}:${res.away}\n`)
  }
}

// ────────────────────────────────────────────────────────────────
// MODES
// ────────────────────────────────────────────────────────────────

async function modeSetStreak(n) {
  console.log(`\n📊 מגדיר streak=${n} ל-frieren...`)
  // מחיקת כל predictions של frieren
  await sb.from('predictions').delete().eq('user_id', FRIEREN_ID)

  // קח את ה-IDs של match labels הנדרשים
  const labels = ['R1M1','R1M2','R1M3','R1M4','R1M5','R3M1']
  const { data: matches } = await sb.from('matches')
    .select('id,home_team,away_team,round')
    .or(labels.map(l => `and(round.eq.${l.startsWith('R1')?1:3})`).join(','))
    .order('kickoff')

  // פשוט: queries מפורטות לפי round
  const { data: r1 } = await sb.from('matches').select('id,home_team').eq('round',1).order('kickoff')
  const { data: r3 } = await sb.from('matches').select('id,home_team').eq('round',3).order('kickoff')

  const r1ids = (r1||[]).slice(0,5).map(m => m.id)
  const r3m1id = (r3||[])[0]?.id

  // בנה predictions לפי n
  const exactGuesses = {
    [r1ids[0]]: {h:1,a:2},  // R1M1 exact
    [r1ids[1]]: {h:2,a:1},  // R1M2 exact
    [r1ids[2]]: {h:0,a:0},  // R1M3 exact
    [r1ids[3]]: {h:2,a:0},  // R1M4 exact
    [r1ids[4]]: {h:3,a:1},  // R1M5 exact
  }
  if (r3m1id) exactGuesses[r3m1id] = {h:2,a:0}

  const all5 = Object.entries(exactGuesses)
  // streak=n: לקח את ה-n האחרונים כ-exact, השאר — בלי prediction
  const toUse = n === 5
    ? all5
    : n === 4
    ? all5.slice(1)   // skip R1M1
    : n === 3
    ? all5.slice(2)   // skip R1M1+R1M2
    : n === 2
    ? all5.slice(3)
    : all5.slice(4)   // רק 1 exact

  const rows = toUse.map(([mid, g]) => ({
    user_id: FRIEREN_ID, match_id: mid,
    home_guess: g.h, away_guess: g.a, is_joker: false
  }))

  if (rows.length) {
    const { error } = await sb.from('predictions').insert(rows)
    if (error) console.error('  ✗', error.message)
    else console.log(`  ✓ הוכנסו ${rows.length} predictions → streak=${n}`)
  }
  console.log(`\n🎯 פריירן עכשיו עם streak=${n} — רענן את הדף\n`)
}

async function modeSetLive() {
  console.log('\n⚽ מגדיר R3M2 כ-live (מחצית שנייה)...')
  const { data } = await sb.from('matches').select('id').eq('round',3).order('kickoff').limit(2)
  const r3m2 = data?.[1]?.id
  if (!r3m2) return console.log('  ✗ R3M2 לא נמצא')
  const { error } = await sb.from('matches')
    .update({ status:'2H', home_score:1, away_score:0 })
    .eq('id', r3m2)
  if (error) console.error('  ✗', error.message)
  else console.log('  ✓ R3M2 הוגדר live — 1:0 מחצית שנייה\n  🎯 עכשיו רענן את הדף ותראה Live card')
}

async function modeFinishLive() {
  console.log('\n🏁 מסיים את המשחק live...')
  const { data } = await sb.from('matches').select('id').eq('round',3).order('kickoff').limit(2)
  const r3m2 = data?.[1]?.id
  if (!r3m2) return
  const { error } = await sb.from('matches')
    .update({ status:'FT', home_score:2, away_score:1 })
    .eq('id', r3m2)
  if (error) console.error('  ✗', error.message)
  else console.log('  ✓ R3M2 הסתיים 2:1 → trigger יחשב נקודות + קונפטי לפריירן')
}

async function modeCritical() {
  console.log('\n⏰ מעביר R3M3 לנעילה בעוד 45 דקות...')
  const { data } = await sb.from('matches').select('id').eq('round',3).order('kickoff').limit(3)
  const r3m3 = data?.[2]?.id
  if (!r3m3) return
  const newKickoff = new Date(Date.now() + 1.75 * H).toISOString()
  const { error } = await sb.from('matches').update({ kickoff: newKickoff }).eq('id', r3m3)
  if (error) console.error('  ✗', error.message)
  else console.log(`  ✓ R3M3 kickoff → ${newKickoff}\n  🎯 רענן — תראה countdown critical (אדום)`)
}

function modePlaybook() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   📋 PLAYBOOK — מדריך טסטים                 ║
╚══════════════════════════════════════════════════════════════╝

▶ מה קיים בשרת הטסטים:
  Round 1 (14 ימים אחורה): 5 משחקים — תוצאות הוזנו
  Round 2 (7 ימים אחורה):  5 משחקים — תוצאות הוזנו (frieren דילג)
  Round 3 (נוכחי):         10 משחקים — מצבים שונים

▶ מצב frieren בהתחלה:
  - streak=5 (5 מדויקים ב-round 1)
  - דילג על round 2 לגמרי
  - ניחש נכון ב-R3M1 (Villarreal 2:0)

══════════════════════════════════════════════════════════════

🧪 SCENARIO 1 — streak-risk banner
  מה לעשות: פתח את האפליקציה, לך ל"ניחושים"
  מה תראה: "⚠️ יש לך סטרייק של 5 — נחש לפני הנעילה!"
  כי: יש לך streak=5 אבל לא מילאת ניחושים ב-round 3 (חוץ מ-R3M1)

🧪 SCENARIO 2 — missed-round banner
  מה לעשות: מלא ניחוש אחד כלשהו (R3M3 למשל)
  מה תראה: "😤 פספסת מחזור 2 — היו אפשריים עד 15 נק׳"
  כי: round 2 יש לו תוצאות ולך אין predictions שם

🧪 SCENARIO 3 — streak5 banner
  מה לעשות: סגור את missed-round (לחץ ✕)
  מה תראה: "🔥🔥🔥🔥🔥 5 ברצף! ניחוש מדויק = 6 נקודות"

🧪 SCENARIO 4 — confetti + קונפטי מ-R3M1
  מה לעשות: לך ל-round 3 עם frieren
  מה תראה: קונפטי ו-jackpot sound על Villarreal 2:0
  (R3M1 כבר יש לו תוצאה + frieren ניחש נכון 2:0)
  נק׳: 3 (exact) + 3 (streak bonus streak=5) = 6 ✨

🧪 SCENARIO 5 — countdown critical (45 דקות)
  הרץ: node seed-test.js critical
  מה תראה: 🔒 ננעל בעוד 0m 45s ← ספירה לאחור אדומה

🧪 SCENARIO 6 — Live match
  הרץ: node seed-test.js live
  רענן את הדף
  מה תראה: כרטיס עם LIVE badge, "1:0 מחצית שנייה"

🧪 SCENARIO 7 — goal flash + real-time
  כשהמשחק live: הרץ: node seed-test.js finish_live
  מה תראה: הבזק צהוב על הכרטיס + תוצאה מתעדכנת
  ואחרי כמה שניות: confetti/sound על הניחוש שלך

🧪 SCENARIO 8 — streak banners (3, 4, 5)
  הרץ: node seed-test.js streak=3
  רענן → banner "🔥🔥🔥 3 ברצף!"
  הרץ: node seed-test.js streak=4
  רענן → banner "🔥🔥🔥🔥 4 ברצף!"
  (streak=5 — כבר ראית)

🧪 SCENARIO 9 — near-miss animation
  לך ל-round 3 עם יוזר u_near@laliga.test (Test1234!)
  ניחש 2:1 כשהתוצאה היתה 2:0 → אנימציית "כמעט!"

🧪 SCENARIO 10 — reversed score animation
  יוזר u_rev@laliga.test — ניחש 0:2 כשהיה 2:0 → "הפוך! 💀"

🧪 SCENARIO 11 — Joker
  יוזר u_jw@laliga.test  → joker + נכון → 6 נק׳ (2x)
  יוזר u_jl@laliga.test  → joker + שגוי → -1
  יוזר u_jl4@laliga.test → joker + שגוי + streak≥4 → -3

🧪 SCENARIO 12 — penalty ריאל מדריד
  יוזר u_ph@laliga.test  → ניחש 18-32, פנדל בדקה 23 → +3 bonus
  יוזר u_pm@laliga.test  → ניחש 1-17, פנדל בדקה 23 → miss ❌

🧪 SCENARIO 13 — leaderboard
  עבור לטאב "טבלה" — תראה את כל 18 המשתמשים עם נקודות
  בדוק סדר, streak badges, rival banner

══════════════════════════════════════════════════════════════
👤 כל יוזרי הטסט: סיסמה = Test1234!
══════════════════════════════════════════════════════════════
`)
}

// ────────────────────────────────────────────────────────────────
// MODE: round1 — 5 דקות לפני פתיחת מחזור 1
// כל היוזרים (חוץ מ-frieren) ניחשו. kickoff ראשון עוד 5 דקות.
// ────────────────────────────────────────────────────────────────
async function modeRound1Open() {
  const now = Date.now()
  const MIN = 60 * 1000

  console.log('\n⏰ round1 — מכין מחזור 1 עם 5 דקות לפתיחה\n')

  // 1. טען את משחקי round 1 מהמסד (fixtures אמיתיים)
  const { data: matches, error: mErr } = await sb
    .from('matches').select('id, home_team, away_team').eq('round', 1).order('kickoff')
  if (mErr || !matches?.length) {
    console.error('לא נמצאו משחקי round 1:', mErr?.message || 'ריק')
    return
  }
  console.log(`✓ נמצאו ${matches.length} משחקים במחזור 1`)

  // 2. עדכן kickoffs: ראשון עוד 5 דקות, כל הבא +2 שעות
  for (let i = 0; i < matches.length; i++) {
    const ko = new Date(now + 5 * MIN + i * 2 * 60 * MIN)
    const { error } = await sb.from('matches').update({
      kickoff: ko.toISOString(),
      home_score: null,
      away_score: null,
      status: 'NS',
    }).eq('id', matches[i].id)
    if (error) console.error(`  ✗ ${matches[i].home_team}: ${error.message}`)
    else console.log(`  ✓ ${matches[i].home_team} vs ${matches[i].away_team} → ${ko.toLocaleTimeString('he-IL')}`)
  }

  // 3. נקה ניחושים קיימים למחזור 1
  const matchIds = matches.map(m => m.id)
  await sb.from('predictions').delete().in('match_id', matchIds)
  console.log('\n✓ ניחושים ישנים נוקו')

  // 4. טען את כל היוזרים (חוץ מ-frieren)
  const { data: profiles } = await sb.from('profiles').select('id, display_name')
  if (!profiles?.length) { console.error('לא נמצאו פרופילים'); return }
  // frieren נשאר ריק — Cat ימלא אותו (ובכל מי שנשאר ריק) בזמן אמת
  const predictors = profiles.filter(p => p.id !== FRIEREN_ID)
  console.log(`\n👤 מכין ניחושים ל-${predictors.length} יוזרים (frieren ריק)`)

  // 5. כל יוזר מקבל ניחוש רנדומלי אישי שונה לכל משחק
  function rnd() {
    const r = Math.random() * 100
    return r < 15 ? 0 : r < 50 ? 1 : r < 80 ? 2 : 3
  }

  const preds = []
  for (const user of predictors) {
    for (const match of matches) {
      preds.push({ user_id: user.id, match_id: match.id, home_guess: rnd(), away_guess: rnd(), is_joker: false })
    }
  }
  console.log(`  ✓ ${preds.length} ניחושים אישיים רנדומליים (frieren ריק לקאט)`)

  // 6. הכנס בבאצ'ים של 500
  for (let i = 0; i < preds.length; i += 500) {
    const batch = preds.slice(i, i + 500)
    const { error } = await sb.from('predictions').insert(batch)
    if (error) console.error(`  ✗ batch ${i}: ${error.message}`)
    else console.log(`  ✓ batch ${i}-${i + batch.length}`)
  }

  console.log(`\n✅ סיום! ${preds.length} ניחושים נוצרו.`)
  console.log(`   מחזור 1 נפתח בעוד 5 דקות. frieren ריק — Cat ימלא בזמן אמת.`)
  console.log(`   כדי למלא עכשיו: node seed-test.js fix_missing_preds\n`)
}

async function modeCatNow() {
  console.log('\n🐱 cat_now — ממלא ניחושים חסרים (עד 15 דקות לפני קיקאוף, מדמה Cat בפרודקשן)...')
  const soon = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const { data: matches, error: mErr } = await sb.from('matches')
    .select('id, home_team, away_team')
    .lte('kickoff', soon)       // נועל בעוד ≤15 דקות
    .is('home_score', null)     // עדיין לא התחיל
    .order('kickoff')
  if (mErr) return console.error('  ✗ שגיאה בשליפת משחקים:', mErr.message)
  if (!matches?.length) return console.log('  ✗ אין משחקים בחלון 15 דקות')
  console.log(`  📋 ${matches.length} משחקים בחלון 15 דקות`)

  const { data: profiles, error: pErr } = await sb.from('profiles').select('id, display_name')
  if (pErr) return console.error('  ✗ שגיאה בשליפת פרופילים:', pErr.message)
  if (!profiles?.length) return console.log('  ✗ לא נמצאו פרופילים')
  console.log(`  👤 ${profiles.length} פרופילים`)

  const matchIds = matches.map(m => m.id)
  const { data: existing, error: eErr } = await sb.from('predictions')
    .select('user_id, match_id').in('match_id', matchIds)
  if (eErr) return console.error('  ✗ שגיאה בשליפת ניחושים קיימים:', eErr.message)
  const existingSet = new Set((existing || []).map(p => `${p.user_id}:${p.match_id}`))
  console.log(`  ✓ ${existingSet.size} ניחושים קיימים`)

  // ניחוש אחד לכל משחק — "דעת קאט" = מה שיש לקאט-יוזר, אחרת רנדומלי
  const CAT_USER_ID = 'c47c47c4-7c47-4c47-8c47-c47c47c47c47'
  const { data: catPreds } = await sb.from('predictions')
    .select('match_id, home_guess, away_guess')
    .eq('user_id', CAT_USER_ID)
    .in('match_id', matchIds)
  const catMap = {}
  for (const cp of (catPreds || [])) catMap[cp.match_id] = { home_guess: cp.home_guess, away_guess: cp.away_guess }

  const matchPred = {}
  for (const m of matches) {
    if (catMap[m.id]) {
      matchPred[m.id] = catMap[m.id]
    } else {
      const rh = Math.random() * 100, ra = Math.random() * 100
      matchPred[m.id] = {
        home_guess: rh < 15 ? 0 : rh < 50 ? 1 : rh < 80 ? 2 : 3,
        away_guess: ra < 15 ? 0 : ra < 50 ? 1 : ra < 80 ? 2 : 3,
      }
    }
  }

  const rows = []
  for (const user of profiles) {
    for (const match of matches) {
      if (!existingSet.has(`${user.id}:${match.id}`)) {
        rows.push({ user_id: user.id, match_id: match.id, ...matchPred[match.id] })
      }
    }
  }

  if (!rows.length) {
    console.log('  ✓ לכולם כבר יש ניחושים — אין מה למלא')
    return
  }

  // הצג מי חסר
  const missingByUser = {}
  for (const r of rows) {
    if (!missingByUser[r.user_id]) missingByUser[r.user_id] = 0
    missingByUser[r.user_id]++
  }
  console.log('\n  📋 חסרים ניחושים ל:')
  for (const p of profiles) {
    const cnt = missingByUser[p.id]
    if (cnt) console.log(`    ${p.display_name}: ${cnt} משחקים → ${matchPred[rows.find(r => r.user_id === p.id)?.match_id]?.home_guess ?? '?'}:${matchPred[rows.find(r => r.user_id === p.id)?.match_id]?.away_guess ?? '?'}`)
  }

  // upsert עם ignoreDuplicates למקרה שיש כפילות
  let inserted = 0
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await sb.from('predictions')
      .upsert(rows.slice(i, i + 50), { onConflict: 'user_id,match_id', ignoreDuplicates: true })
    if (error) console.error(`  ✗ batch ${i}:`, error.message)
    else inserted += rows.slice(i, i + 50).length
  }
  console.log(`\n  ✓ הוכנסו ${inserted} ניחושים אוטומטיים`)
  console.log('  🎯 הרץ debug_cat לאימות, ואז רענן את הדף')
}

async function modeLiveR1() {
  console.log('\n⚽ מגדיר המשחק הראשון של מחזור 1 כ-live (דקה 37, מחצית ראשונה)...')
  const { data: matches } = await sb.from('matches')
    .select('id, home_team, away_team')
    .eq('round', 1)
    .order('kickoff')
    .limit(1)
  const m = matches?.[0]
  if (!m) return console.log('  ✗ לא נמצא משחק ראשון במחזור 1')
  const kickoff = new Date(Date.now() - 37 * 60 * 1000).toISOString()
  const { error } = await sb.from('matches')
    .update({ kickoff, status: '1H', home_score: 0, away_score: 0 })
    .eq('id', m.id)
  if (error) console.error('  ✗', error.message)
  else console.log(`  ✓ ${m.home_team} vs ${m.away_team} → live, דקה 37, מחצית ראשונה\n`)
}

// מתקן ידנית נקודות ג'וקר שגויות — כל ניחוש עם is_joker=true שמיקבל 0 במקום -1
async function modeFixJokerPts() {
  console.log('\n🃏 fix_joker_pts — מתקן נקודות ג\'וקר שגויות...')
  const { data: matches } = await sb.from('matches')
    .select('id, home_team, away_team, home_score, away_score, round')
    .not('home_score', 'is', null)
  if (!matches?.length) return console.log('  ✗ אין משחקים עם תוצאה')

  const matchMap = {}
  for (const m of matches) matchMap[m.id] = m

  const { data: jokerPreds } = await sb.from('predictions')
    .select('id, user_id, match_id, home_guess, away_guess, points')
    .eq('is_joker', true)
    .in('match_id', Object.keys(matchMap))

  let fixed = 0
  for (const p of (jokerPreds || [])) {
    const m = matchMap[p.match_id]
    const isExact = p.home_guess === m.home_score && p.away_guess === m.away_score
    if (isExact) continue  // joker + exact: trigger probably correct (≥6 pts)
    // joker + wrong → should be -1 (simplified: no streak check here, streak=0)
    const expected = -1
    if (p.points === expected) continue
    const { error } = await sb.from('predictions').update({ points: expected }).eq('id', p.id)
    if (error) console.error(`  ✗ ${p.id}: ${error.message}`)
    else { fixed++; console.log(`  ✓ user ${p.user_id.slice(0,8)} → match ${m.home_team} vs ${m.away_team}: pts ${p.points} → ${expected}`) }
  }
  console.log(`\n  ✅ תוקנו ${fixed} ניחושים`)
}

// מפעיל מחדש את הטריגר לכל משחקי round 1 שסיימו → מחשב נקודות מחדש
async function modeRetriggerPts() {
  console.log('\n🔄 retrigger_pts — מחשב נקודות מחדש לכל משחקי round 1 שסיימו...')
  const { data: matches } = await sb.from('matches')
    .select('id, home_team, away_team, home_score, away_score')
    .eq('round', 1)
    .not('home_score', 'is', null)
    .order('kickoff')
  if (!matches?.length) return console.log('  ✗ אין משחקים שסיימו')

  for (const m of matches) {
    // touch away_score → trigger יחשב מחדש
    const { error } = await sb.from('matches')
      .update({ home_score: m.home_score, away_score: m.away_score })
      .eq('id', m.id)
    if (error) console.error(`  ✗ ${m.home_team}: ${error.message}`)
    else console.log(`  ✓ ${m.home_team} vs ${m.away_team} → ${m.home_score}:${m.away_score} (ריטריגר)`)
  }
  console.log('\n  ✅ חישוב נקודות הושלם — רענן את הדף')
}

async function modeDebugJoker() {
  console.log('\n🃏 debug_joker — בדיקת ניחוש ג\'וקר של FRIEREN בכל המשחקים שסיימו...')
  const { data: matches } = await sb.from('matches')
    .select('id, home_team, away_team, home_score, away_score, round')
    .eq('round', 1)
    .not('home_score', 'is', null)
    .order('kickoff')
  if (!matches?.length) return console.log('  ✗ אין משחקים שסיימו')

  const matchIds = matches.map(m => m.id)
  const { data: preds } = await sb.from('predictions')
    .select('match_id, home_guess, away_guess, is_joker, points')
    .eq('user_id', FRIEREN_ID)
    .in('match_id', matchIds)

  const predMap = {}
  for (const p of (preds || [])) predMap[p.match_id] = p

  console.log('\n  משחק'.padEnd(30) + 'תוצאה'.padEnd(8) + 'ניחוש'.padEnd(8) + 'ג\'וקר'.padEnd(8) + 'נקודות')
  console.log('  ' + '-'.repeat(60))
  for (const m of matches) {
    const p = predMap[m.id]
    const matchStr = `${m.home_team.slice(0,10)} vs ${m.away_team.slice(0,7)}`
    const result = `${m.home_score}:${m.away_score}`
    const guess  = p ? `${p.home_guess}:${p.away_guess}` : '—'
    const joker  = p?.is_joker ? '✅ כן' : '❌ לא'
    const pts    = p?.points != null ? String(p.points) : '?'
    console.log(`  ${matchStr.padEnd(28)} ${result.padEnd(8)} ${guess.padEnd(8)} ${joker.padEnd(8)} ${pts}`)
  }
}

// מטריצת ניחושים vs משחקים — כלי דיאגנוסטי
async function modeDebugCat() {
  console.log('\n🔍 debug_cat — מטריצת ניחושים למחזור 1\n')
  const { data: profiles } = await sb.from('profiles').select('id, display_name').order('display_name')
  const { data: matches }  = await sb.from('matches').select('id, home_team, home_score, status').eq('round', 1).order('kickoff')
  if (!profiles?.length || !matches?.length) return console.log('חסרים נתונים')

  const matchIds = matches.map(m => m.id)
  const { data: preds, error } = await sb.from('predictions')
    .select('user_id, match_id, home_guess, away_guess')
    .in('match_id', matchIds)
  if (error) return console.error('  ✗', error.message)

  const predMap = {}
  for (const p of (preds || [])) predMap[`${p.user_id}:${p.match_id}`] = `${p.home_guess}:${p.away_guess}`

  // header
  const heads = matches.map(m => {
    const label = m.home_team.substring(0, 5)
    const score = m.home_score !== null ? `(${m.home_score})` : '( )'
    return (label + score).padEnd(9)
  })
  console.log('משתמש'.padEnd(16) + heads.join(' '))
  console.log('-'.repeat(16 + heads.length * 10))

  let totalMissing = 0
  for (const p of profiles) {
    const cells = matches.map(m => {
      const v = predMap[`${p.id}:${m.id}`]
      return (v || '  —  ').padEnd(9)
    })
    const missingCount = matches.filter(m => !predMap[`${p.id}:${m.id}`]).length
    totalMissing += missingCount
    const flag = missingCount ? ` ← ${missingCount} חסר` : ''
    console.log(p.display_name.substring(0, 15).padEnd(16) + cells.join(' ') + flag)
  }
  console.log(`\n📊 סה"כ חסרים: ${totalMissing} ניחושים (${profiles.length} יוזרים × ${matches.length} משחקים)`)
}

// מכין ניחושים ממוקדים למשחק 2 — כל מקרי קצה, תוצאה מתוכננת 2:1
async function modeSetupM2R1() {
  console.log('\n🎯 setup_m2_r1 — מכין ניחושים למשחק 2 (תוצאה מתוכננת: 2:1 ניצחון בית)')
  const { data: ms } = await sb.from('matches').select('id,home_team,away_team').eq('round',1).order('kickoff').limit(2)
  const m = ms?.[1]
  if (!m) return console.log('  ✗ לא נמצא משחק 2')
  console.log(`  📌 ${m.home_team} vs ${m.away_team}`)

  await sb.from('predictions').delete().eq('match_id', m.id)
  console.log('  ✓ ניחושים ישנים נוקו')

  // שלוף IDs של NEW_USERS לפי display_name
  const { data: nuProfs } = await sb.from('profiles')
    .select('id, display_name')
    .in('display_name', NEW_USERS.map(u => u.name))
  const byName = Object.fromEntries((nuProfs || []).map(p => [p.display_name, p.id]))

  // תוצאה מתוכננת: 2:1 (ניצחון קבוצת בית)
  // uid=null → קאט ימלא (FRIEREN, Fresh_Zero, MissedRound)
  const plan = [
    { uid: YAMAL_ID,                    h:2,a:1,j:true,  note:'✓ exact + 🃏'          },
    { uid: PEDRI_ID,                    h:2,a:1,j:false, note:'✓ exact'               },
    { uid: GAVI_ID,                     h:0,a:1,j:false, note:'✗ wrong dir (away win)' },
    { uid: MESSI_ID,                    h:3,a:2,j:false, note:'→ right dir'            },
    { uid: RONI_ID,                     h:1,a:0,j:false, note:'→ right dir'            },
    { uid: FCB13_ID,                    h:2,a:1,j:false, note:'✓ exact (fcb13)'        },
    // FRIEREN_ID: no pred → Cat fills
    { uid: byName['Streak3'],           h:1,a:0,j:false, note:'→ right dir, streak=3'  },
    { uid: byName['Streak5plus'],       h:2,a:1,j:true,  note:'✓ exact + 🃏, streak=5+'},
    { uid: byName['JokerWin'],          h:2,a:1,j:true,  note:'✓ exact + 🃏'           },
    { uid: byName['JokerLoss'],         h:0,a:2,j:true,  note:'✗ wrong + 🃏 → -1'      },
    { uid: byName['JokerLossS4'],       h:0,a:1,j:true,  note:'✗ wrong + 🃏 + s4 → -3' },
    { uid: byName['NearMiss'],          h:3,a:1,j:false, note:'→ right dir, off by 1'  },
    { uid: byName['Reversed'],          h:1,a:2,j:false, note:'✗ reversed (1:2 vs 2:1)'},
    { uid: byName['SpecialExact'],      h:2,a:1,j:false, note:'✓ exact'               },
    { uid: byName['PenHit'],            h:2,a:1,j:false, note:'✓ exact'               },
    { uid: byName['PenMiss'],           h:0,a:0,j:false, note:'✗ wrong dir (draw)'    },
    // Fresh_Zero → no pred, Cat fills
    // MissedRound → no pred, Cat fills
  ].filter(d => d.uid)

  const rows = plan.map(d => ({
    user_id: d.uid, match_id: m.id,
    home_guess: d.h, away_guess: d.a, is_joker: d.j,
  }))

  const { error } = await sb.from('predictions').insert(rows)
  if (error) return console.error('  ✗', error.message)

  console.log(`\n  ✓ ${rows.length} ניחושים הוכנסו:`)
  plan.forEach(d => console.log(`    ${d.h}:${d.a}${d.j?' 🃏':'  '} — ${d.note}`))
  console.log('\n  — FRIEREN, Fresh_Zero, MissedRound: ללא ניחוש → קאט ימלא')
  console.log('  — fcb13 (2008ronel): 2:1 exact')
  console.log('  ⏩ הרץ cat_now ואז debug_cat לאימות')
}

// שני המשחקים הראשונים של מחזור 1 רצים במקביל במחצית ראשונה
async function modeLive2R1() {
  console.log('\n⚽ live2_r1 — מחצית ראשונה לשני המשחקים הראשונים במחזור 1...')
  const { data: matches } = await sb.from('matches')
    .select('id, home_team, away_team')
    .eq('round', 1)
    .order('kickoff')
    .limit(2)
  if (!matches?.length) return console.log('  ✗ לא נמצאו משחקים')

  // משחק 1: דקה 37, שער → 1:0 | משחק 2: דקה 8, עדיין 0:0
  const updates = [
    { id: matches[0].id, kickoff: new Date(Date.now() - 37 * 60 * 1000).toISOString(), home_score: 1, away_score: 0, note: 'דקה ~37, 1:0 ⚽' },
    { id: matches[1].id, kickoff: new Date(Date.now() -  8 * 60 * 1000).toISOString(), home_score: 0, away_score: 0, note: 'דקה ~8,  0:0'   },
  ]
  for (const u of updates) {
    const m = matches.find(x => x.id === u.id)
    const { error } = await sb.from('matches')
      .update({ kickoff: u.kickoff, status: '1H', home_score: u.home_score, away_score: u.away_score })
      .eq('id', u.id)
    if (error) console.error(`  ✗ ${m.home_team}:`, error.message)
    else console.log(`  ✓ ${m.home_team} vs ${m.away_team} → 1H, ${u.note}`)
  }
  console.log('\n  🎯 רענן — חדר מלחמה יציג שני משחקים (1:0 ו-0:0)')
}

// מוסיף שערים למשחק 2 → 2:1 (trigger יחשב נקודות לניחושים שהוכנסו ב-setup_m2_r1)
async function modeGoalR1M2() {
  console.log('\n⚽ goal_r1m2 — מגדיר תוצאת משחק 2 → 2:1...')
  const { data: ms } = await sb.from('matches').select('id,home_team,away_team').eq('round',1).order('kickoff').limit(2)
  const m = ms?.[1]
  if (!m) return console.log('  ✗ לא נמצא')
  const { error } = await sb.from('matches')
    .update({ home_score: 2, away_score: 1, status: 'FT' })
    .eq('id', m.id)
  if (error) console.error('  ✗', error.message)
  else {
    console.log(`  ✓ ${m.home_team} vs ${m.away_team} → FT 2:1\n  🎯 trigger יחשב נקודות (exact=+3, right dir=+1, wrong=0, joker×2/-1/-3)`)
    await modeCatNow()
  }
}

// סגירת משחקים 3+4, פתיחת 5+6+7 בזמנים שונים
async function modeFinishM34LiveM567() {
  console.log('\n⚽ finish_m34_live_m567 — סוגר 3+4, פותח 5+6+7 בזמנים שונים...')
  const { data: matches } = await sb.from('matches')
    .select('id, home_team, away_team')
    .eq('round', 1).order('kickoff')
  if (!matches?.length) return console.log('  ✗ לא נמצאו משחקים')

  const now = Date.now()
  const MIN = 60 * 1000

  // משחק 3 → FT 1:1
  const m3 = matches[2]
  if (m3) {
    const { error } = await sb.from('matches')
      .update({ home_score: 1, away_score: 1, status: 'FT' }).eq('id', m3.id)
    if (error) console.error('  ✗ m3:', error.message)
    else console.log(`  ✓ ${m3.home_team} vs ${m3.away_team} → FT 1:1`)
  }

  // משחק 4 → FT 0:2
  const m4 = matches[3]
  if (m4) {
    const { error } = await sb.from('matches')
      .update({ home_score: 0, away_score: 2, status: 'FT' }).eq('id', m4.id)
    if (error) console.error('  ✗ m4:', error.message)
    else console.log(`  ✓ ${m4.home_team} vs ${m4.away_team} → FT 0:2`)
  }

  // משחק 5 → 1H דקה 62 (kickoff לפני 62 דקות)
  const m5 = matches[4]
  if (m5) {
    const ko5 = new Date(now - 62 * MIN).toISOString()
    const { error } = await sb.from('matches')
      .update({ kickoff: ko5, home_score: 1, away_score: 0, status: '1H' }).eq('id', m5.id)
    if (error) console.error('  ✗ m5:', error.message)
    else console.log(`  ✓ ${m5.home_team} vs ${m5.away_team} → 1H דקה 62, 1:0`)
  }

  // משחק 6 → 1H דקה 28 (kickoff לפני 28 דקות)
  const m6 = matches[5]
  if (m6) {
    const ko6 = new Date(now - 28 * MIN).toISOString()
    const { error } = await sb.from('matches')
      .update({ kickoff: ko6, home_score: 0, away_score: 0, status: '1H' }).eq('id', m6.id)
    if (error) console.error('  ✗ m6:', error.message)
    else console.log(`  ✓ ${m6.home_team} vs ${m6.away_team} → 1H דקה 28, 0:0`)
  }

  // משחק 7 → 1H דקה 8 (kickoff לפני 8 דקות)
  const m7 = matches[6]
  if (m7) {
    const ko7 = new Date(now - 8 * MIN).toISOString()
    const { error } = await sb.from('matches')
      .update({ kickoff: ko7, home_score: 0, away_score: 0, status: '1H' }).eq('id', m7.id)
    if (error) console.error('  ✗ m7:', error.message)
    else console.log(`  ✓ ${m7.home_team} vs ${m7.away_team} → 1H דקה 8, 0:0`)
  }

  console.log('\n  🎯 3 משחקים live בזמנים שונים, 2 הסתיימו')
  await modeCatNow()
}

// סגירת משחקים 5+6+7, פתיחת 8+9 בזמנים שונים
async function modeFinishM567LiveM89() {
  console.log('\n⚽ finish_m567_live_m89 — סוגר 5+6+7, פותח 8+9 בזמנים שונים...')
  const { data: matches } = await sb.from('matches')
    .select('id, home_team, away_team')
    .eq('round', 1).order('kickoff')
  if (!matches?.length) return console.log('  ✗ לא נמצאו משחקים')

  const now = Date.now()
  const MIN = 60 * 1000

  // משחק 5 → FT 1:0
  const m5 = matches[4]
  if (m5) {
    const { error } = await sb.from('matches')
      .update({ home_score: 1, away_score: 0, status: 'FT' }).eq('id', m5.id)
    if (error) console.error('  ✗ m5:', error.message)
    else console.log(`  ✓ ${m5.home_team} vs ${m5.away_team} → FT 1:0`)
  }

  // משחק 6 → FT 0:0
  const m6 = matches[5]
  if (m6) {
    const { error } = await sb.from('matches')
      .update({ home_score: 0, away_score: 0, status: 'FT' }).eq('id', m6.id)
    if (error) console.error('  ✗ m6:', error.message)
    else console.log(`  ✓ ${m6.home_team} vs ${m6.away_team} → FT 0:0`)
  }

  // משחק 7 → FT 0:1
  const m7 = matches[6]
  if (m7) {
    const { error } = await sb.from('matches')
      .update({ home_score: 0, away_score: 1, status: 'FT' }).eq('id', m7.id)
    if (error) console.error('  ✗ m7:', error.message)
    else console.log(`  ✓ ${m7.home_team} vs ${m7.away_team} → FT 0:1`)
  }

  // משחק 8 → 1H דקה 45 (kickoff לפני 45 דקות), 1:1
  const m8 = matches[7]
  if (m8) {
    const ko8 = new Date(now - 45 * MIN).toISOString()
    const { error } = await sb.from('matches')
      .update({ kickoff: ko8, home_score: 1, away_score: 1, status: '1H' }).eq('id', m8.id)
    if (error) console.error('  ✗ m8:', error.message)
    else console.log(`  ✓ ${m8.home_team} vs ${m8.away_team} → 1H דקה 45, 1:1`)
  }

  // משחק 9 → 1H דקה 18 (kickoff לפני 18 דקות), 0:0
  const m9 = matches[8]
  if (m9) {
    const ko9 = new Date(now - 18 * MIN).toISOString()
    const { error } = await sb.from('matches')
      .update({ kickoff: ko9, home_score: 0, away_score: 0, status: '1H' }).eq('id', m9.id)
    if (error) console.error('  ✗ m9:', error.message)
    else console.log(`  ✓ ${m9.home_team} vs ${m9.away_team} → 1H דקה 18, 0:0`)
  }

  console.log('\n  🎯 2 משחקים live, 3 הסתיימו')
  await modeCatNow()
}

// סגירת משחקים 8+9, פתיחת 10 (האחרון)
async function modeFinishM89LiveM10() {
  console.log('\n⚽ finish_m89_live_m10 — סוגר 8+9, פותח את המשחק האחרון...')
  const { data: matches } = await sb.from('matches')
    .select('id, home_team, away_team')
    .eq('round', 1).order('kickoff')
  if (!matches?.length) return console.log('  ✗ לא נמצאו משחקים')

  const now = Date.now()
  const MIN = 60 * 1000

  // משחק 8 → FT 1:1 (שמור את הסקור הנוכחי)
  const m8 = matches[7]
  if (m8) {
    const { error } = await sb.from('matches')
      .update({ home_score: 1, away_score: 1, status: 'FT' }).eq('id', m8.id)
    if (error) console.error('  ✗ m8:', error.message)
    else console.log(`  ✓ ${m8.home_team} vs ${m8.away_team} → FT 1:1`)
  }

  // משחק 9 → FT 0:0
  const m9 = matches[8]
  if (m9) {
    const { error } = await sb.from('matches')
      .update({ home_score: 0, away_score: 0, status: 'FT' }).eq('id', m9.id)
    if (error) console.error('  ✗ m9:', error.message)
    else console.log(`  ✓ ${m9.home_team} vs ${m9.away_team} → FT 0:0`)
  }

  // משחק 10 → קודם kickoff בלבד (score=null) כדי שקאט ימלא ניחושים
  const m10 = matches[9]
  if (m10) {
    const ko10 = new Date(now - 22 * MIN).toISOString()
    const { error: koErr } = await sb.from('matches')
      .update({ kickoff: ko10, status: 'NS', home_score: null, away_score: null }).eq('id', m10.id)
    if (koErr) console.error('  ✗ m10 kickoff:', koErr.message)
    else console.log(`  ✓ ${m10.home_team} vs ${m10.away_team} → kickoff עודכן (score=null)`)
  }

  // קאט ממלא ניחושים חסרים לפני שמשחק 10 הופך ל-live
  await modeCatNow()

  // עכשיו הפוך ל-live
  if (m10) {
    const { error } = await sb.from('matches')
      .update({ home_score: 0, away_score: 1, status: '1H' }).eq('id', m10.id)
    if (error) console.error('  ✗ m10 live:', error.message)
    else console.log(`  ✓ ${m10.home_team} vs ${m10.away_team} → 1H דקה 22, 0:1`)
  }

  console.log('\n  🎯 1 משחק live, 2 הסתיימו')
}

// מעתיק ניחושי CAT לכל יוזר שחסר ניחוש — לכל משחקי round 1 (ללא מגבלת kickoff)
async function modeFixMissingPreds() {
  console.log('\n🔧 fix_missing_preds — מעתיק ניחושי CAT לכל מי שחסר במחזור 1...')
  const CAT_USER_ID = 'c47c47c4-7c47-4c47-8c47-c47c47c47c47'

  const { data: matches } = await sb.from('matches').select('id, home_team, away_team').eq('round', 1).order('kickoff')
  if (!matches?.length) return console.log('  ✗ לא נמצאו משחקי round 1')
  const matchIds = matches.map(m => m.id)

  const { data: catPreds } = await sb.from('predictions')
    .select('match_id, home_guess, away_guess')
    .eq('user_id', CAT_USER_ID).in('match_id', matchIds)
  if (!catPreds?.length) return console.log('  ✗ CAT אין ניחושים — הרץ round1 קודם')
  const catMap = Object.fromEntries(catPreds.map(p => [p.match_id, { home_guess: p.home_guess, away_guess: p.away_guess }]))

  const { data: profiles } = await sb.from('profiles').select('id, display_name')
  const { data: existing } = await sb.from('predictions').select('user_id, match_id').in('match_id', matchIds)
  const existingSet = new Set((existing || []).map(p => `${p.user_id}:${p.match_id}`))

  const rows = []
  for (const user of (profiles || [])) {
    for (const mid of matchIds) {
      if (!existingSet.has(`${user.id}:${mid}`) && catMap[mid]) {
        rows.push({ user_id: user.id, match_id: mid, ...catMap[mid] })
      }
    }
  }

  if (!rows.length) return console.log('  ✓ אין ניחושים חסרים — הכל מלא')
  console.log(`  📝 מוסיף ${rows.length} ניחושים חסרים...`)
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await sb.from('predictions').insert(rows.slice(i, i + 100))
    if (error) console.error('  ✗ batch:', error.message)
  }
  console.log('  ✓ סיום')
}

// מגדיר את המשחק השני במחזור 1 לפתיחה בעוד 2 דקות (לבדיקת נעילה)
async function modePreLockR1() {
  console.log('\n⏰ prelive_r1 — מגדיר משחק 2 במחזור 1 לפתיחה בעוד 2 דקות...')
  const { data: matches } = await sb.from('matches')
    .select('id, home_team, away_team')
    .eq('round', 1)
    .order('kickoff')
    .limit(2)
  const m = matches?.[1]
  if (!m) return console.log('  ✗ לא נמצא משחק שני במחזור 1')
  const kickoff = new Date(Date.now() + 2 * 60 * 1000).toISOString()
  const { error } = await sb.from('matches')
    .update({ kickoff, status: 'NS', home_score: null, away_score: null })
    .eq('id', m.id)
  if (error) console.error('  ✗', error.message)
  else console.log(`  ✓ ${m.home_team} vs ${m.away_team} → kickoff בעוד 2 דקות\n  🔒 נעילה בעוד ~1 דקה`)
}

// סוגר את כל המשחקים הפתוחים במחזור 1 (לפי הסקור הנוכחי) ומכין מחזור 2
async function modeFinishR1StartR2() {
  console.log('\n⚽ finish_r1_start_r2 — סוגר מחזור 1 ופותח מחזור 2...')

  // 1. שלוף כל משחקי round 1 שאינם FT
  const { data: open1 } = await sb.from('matches')
    .select('id, home_team, away_team, home_score, away_score')
    .eq('round', 1).neq('status', 'FT')
  for (const m of (open1 || [])) {
    const hs = m.home_score ?? 0
    const as_ = m.away_score ?? 0
    const { error } = await sb.from('matches').update({ home_score: hs, away_score: as_, status: 'FT' }).eq('id', m.id)
    if (error) console.error(`  ✗ ${m.home_team}: ${error.message}`)
    else console.log(`  ✓ ${m.home_team} vs ${m.away_team} → FT ${hs}:${as_}`)
  }
  if (!open1?.length) console.log('  ✓ כל משחקי מחזור 1 כבר FT')

  // 2. שלוף משחקי round 2 ועדכן kickoffs: ראשון עוד 5 דקות, כל הבא +2 שעות
  const now = Date.now()
  const MIN = 60 * 1000
  const { data: m2 } = await sb.from('matches')
    .select('id, home_team, away_team').eq('round', 2).order('kickoff')
  if (!m2?.length) return console.log('  ✗ לא נמצאו משחקי מחזור 2')
  console.log(`\n📋 ${m2.length} משחקים במחזור 2`)

  // 3. ניחוש Cat (דעה אחת לכל משחק) + ניחושים שונים לכל יוזר
  function catRandom() { const r = Math.random() * 100; return r < 15 ? 0 : r < 50 ? 1 : r < 80 ? 2 : 3 }
  const CAT_USER_ID = 'c47c47c4-7c47-4c47-8c47-c47c47c47c47'
  const catPred = {}
  for (const m of m2) catPred[m.id] = { home_guess: catRandom(), away_guess: catRandom() }

  // ניחושים מיוחדים ל-FRIEREN — מדמה הפוך וכמעט כשתוצאות יוכנסו
  // R2M1 (RM 3:0): FRIEREN מנחש 0:3 → הפוך
  // R2M3 (0:0): FRIEREN מנחש 0:1 → כמעט (מרחק=1, pts=0)
  const m2ByHome = {}
  for (const m of m2) m2ByHome[m.home_team] = m.id
  const FRIEREN_R2_PREDS = {
    [m2ByHome['Real Madrid']]:  { home_guess: 0, away_guess: 3 },  // הפוך
    [m2ByHome['Levante']]:      { home_guess: 0, away_guess: 1 },  // כמעט
  }

  // 4. נקה ניחושים ישנים למחזור 2 והכנס חדשים
  const m2ids = m2.map(m => m.id)
  await sb.from('predictions').delete().in('match_id', m2ids)

  const { data: profiles } = await sb.from('profiles').select('id')
  const rows = []
  for (const user of (profiles || [])) {
    for (const m of m2) {
      let pred
      if (user.id === FRIEREN_ID) {
        pred = FRIEREN_R2_PREDS[m.id] ?? { home_guess: catRandom(), away_guess: catRandom() }
      } else if (user.id === CAT_USER_ID) {
        pred = catPred[m.id]
      } else {
        pred = { home_guess: catRandom(), away_guess: catRandom() }
      }
      rows.push({ user_id: user.id, match_id: m.id, ...pred, is_joker: false })
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await sb.from('predictions').insert(rows.slice(i, i + 500))
  }
  console.log(`  ✓ ${rows.length} ניחושים (FRIEREN: הפוך+כמעט, שאר: רנדומלי אישי)`)

  // 5. עדכן kickoffs: ראשון עוד 5 דקות, כל הבא +2 שעות
  for (let i = 0; i < m2.length; i++) {
    const ko = new Date(now + 5 * MIN + i * 2 * 60 * MIN)
    const { error } = await sb.from('matches').update({
      kickoff: ko.toISOString(), home_score: null, away_score: null, status: 'NS'
    }).eq('id', m2[i].id)
    if (error) console.error(`  ✗ ${m2[i].home_team}: ${error.message}`)
    else console.log(`  ✓ ${m2[i].home_team} vs ${m2[i].away_team} → ${ko.toLocaleTimeString('he-IL')}`)
  }

  console.log(`\n✅ מחזור 2 נפתח בעוד 5 דקות. frieren ריק — הרץ fix_missing_preds למלא עכשיו.`)
}

// מריץ את כל משחקי מחזור 2 לדקה ~85 (לפני סיום) ומתקן ניחושי FRIEREN
async function modeLiveR2() {
  console.log('\n⚽ live_r2 — מעביר משחקי מחזור 2 לדקה 85...')
  const now = Date.now()
  const MIN = 60 * 1000

  // תוצאות לכל משחק
  const RESULTS = {
    'Athletic Club':   { hs:2, as_:0 },  // FRIEREN מנחש 0:2 → הפוך
    'Atletico Madrid': { hs:2, as_:1 },
    'Espanyol':        { hs:0, as_:2 },
    'Valencia':        { hs:1, as_:1 },
    'Malaga':          { hs:0, as_:1 },
    'Real Betis':      { hs:2, as_:0 },
    'Getafe':          { hs:1, as_:0 },
    'Osasuna':         { hs:0, as_:0 },  // FRIEREN מנחש 0:1 → כמעט
    'Rayo Vallecano':  { hs:2, as_:1 },
    'Elche':           { hs:0, as_:2 },
  }

  const { data: m2 } = await sb.from('matches')
    .select('id, home_team, away_team, status')
    .eq('round', 2).neq('status', 'FT').order('kickoff')
  if (!m2?.length) return console.log('  ✗ אין משחקי מחזור 2 פתוחים')

  // תקן ניחושי FRIEREN: הפוך ב-Athletic Club, כמעט ב-Osasuna
  const frierenFixes = []
  for (const m of m2) {
    if (m.home_team === 'Athletic Club') {
      frierenFixes.push({ match_id: m.id, home_guess: 0, away_guess: 2 })  // הפוך (תוצאה 2:0)
    } else if (m.home_team === 'Osasuna') {
      frierenFixes.push({ match_id: m.id, home_guess: 0, away_guess: 1 })  // כמעט (תוצאה 0:0)
    }
  }
  for (const fix of frierenFixes) {
    const { error } = await sb.from('predictions')
      .update({ home_guess: fix.home_guess, away_guess: fix.away_guess })
      .eq('user_id', FRIEREN_ID).eq('match_id', fix.match_id)
    if (error) console.error('  ✗ תיקון FRIEREN:', error.message)
    else {
      const m = m2.find(x => x.id === fix.match_id)
      console.log(`  ✓ FRIEREN ${m?.home_team}: ניחוש → ${fix.home_guess}:${fix.away_guess}`)
    }
  }

  // הכנס לדקה 85
  const ko = new Date(now - 85 * MIN)
  for (const m of m2) {
    const r = RESULTS[m.home_team] ?? { hs: 1, as_: 0 }
    const { error } = await sb.from('matches').update({
      kickoff: ko.toISOString(), home_score: r.hs, away_score: r.as_, status: '2H'
    }).eq('id', m.id)
    if (error) console.error(`  ✗ ${m.home_team}: ${error.message}`)
    else console.log(`  ✓ ${m.home_team} vs ${m.away_team} → ${r.hs}:${r.as_} דקה 85`)
  }
  console.log(`\n✅ ${m2.length} משחקים live דקה 85. הרץ finish_r2 לסגירה.`)
}

// סוגר את כל משחקי מחזור 2 כ-FT (עם הסקור הנוכחי)
async function modeFinishR2() {
  console.log('\n🏁 finish_r2 — מסיים את כל משחקי מחזור 2...')
  const { data: open } = await sb.from('matches')
    .select('id, home_team, away_team, home_score, away_score')
    .eq('round', 2).neq('status', 'FT')
  if (!open?.length) return console.log('  ✓ כל משחקי מחזור 2 כבר FT')

  for (const m of open) {
    const hs = m.home_score ?? 0
    const as_ = m.away_score ?? 0
    const { error } = await sb.from('matches').update({ home_score: hs, away_score: as_, status: 'FT' }).eq('id', m.id)
    if (error) console.error(`  ✗ ${m.home_team}: ${error.message}`)
    else console.log(`  ✓ ${m.home_team} vs ${m.away_team} → FT ${hs}:${as_}`)
  }
  console.log(`\n✅ מחזור 2 הסתיים.`)
}

// הגדרת ג'וקרים + טראש טוק למחזור 3 לפני סגירה
async function modeSetupR3() {
  console.log('\n🃏 setup_r3 — מגדיר ג\'וקרים, ניחושים מיוחדים וטראש טוק למחזור 3...')

  const { data: m3 } = await sb.from('matches')
    .select('id,home_team,away_team').eq('round', 3).order('kickoff')
  if (!m3?.length) return console.log('  ✗ לא נמצאו משחקי מחזור 3')

  const byHome = Object.fromEntries(m3.map(m => [m.home_team, m.id]))
  const barId  = byHome['Barcelona']
  const sevId  = byHome['Sevilla']
  const celId  = byHome['Celta Vigo']

  if (!barId || !sevId || !celId) {
    console.log('  ✗ לא נמצאו כל 3 המשחקים (ברצה/סביליה/סלטה)')
    return
  }

  // ── ניחושים מיוחדים לפי יוזר ───────────────────────────────────
  // תוצאות אמיתיות: Barcelona 3:0 | Sevilla 0:3 Atletico | Celta 1:1
  const preds = [
    // YAMAL: ג'וקר מנצח על ברצה (exact 3:0) + כיוון על שאר
    { user_id: YAMAL_ID, match_id: barId, home_guess: 3, away_guess: 0, is_joker: true  },
    { user_id: YAMAL_ID, match_id: sevId, home_guess: 0, away_guess: 2, is_joker: false },
    { user_id: YAMAL_ID, match_id: celId, home_guess: 1, away_guess: 0, is_joker: false },
    // PEDRI: ג'וקר כושל על סביליה (ניחש ביתי 2:1, יפסיד 0:3) + exact על סלטה
    { user_id: PEDRI_ID, match_id: barId, home_guess: 2, away_guess: 0, is_joker: false },
    { user_id: PEDRI_ID, match_id: sevId, home_guess: 2, away_guess: 1, is_joker: true  },
    { user_id: PEDRI_ID, match_id: celId, home_guess: 1, away_guess: 1, is_joker: false },
    // GAVI: הפוך על ברצה (ניחש 0:3 כשתהיה 3:0)
    { user_id: GAVI_ID,  match_id: barId, home_guess: 0, away_guess: 3, is_joker: false },
    { user_id: GAVI_ID,  match_id: sevId, home_guess: 1, away_guess: 0, is_joker: false },
    { user_id: GAVI_ID,  match_id: celId, home_guess: 2, away_guess: 0, is_joker: false },
    // MESSI: exact על סביליה (0:3) + ג'וקר
    { user_id: MESSI_ID, match_id: barId, home_guess: 3, away_guess: 1, is_joker: false },
    { user_id: MESSI_ID, match_id: sevId, home_guess: 0, away_guess: 3, is_joker: true  },
    { user_id: MESSI_ID, match_id: celId, home_guess: 0, away_guess: 1, is_joker: false },
    // FRIEREN: כמעט על סלטה (1:2 במקום 1:1 → dist=1)
    { user_id: FRIEREN_ID, match_id: barId, home_guess: 2, away_guess: 1, is_joker: false },
    { user_id: FRIEREN_ID, match_id: sevId, home_guess: 0, away_guess: 2, is_joker: false },
    { user_id: FRIEREN_ID, match_id: celId, home_guess: 1, away_guess: 2, is_joker: false },
    // RONI: כיוון על ברצה, exact על סלטה
    { user_id: RONI_ID, match_id: barId, home_guess: 2, away_guess: 0, is_joker: false },
    { user_id: RONI_ID, match_id: sevId, home_guess: 0, away_guess: 1, is_joker: false },
    { user_id: RONI_ID, match_id: celId, home_guess: 1, away_guess: 1, is_joker: false },
  ]

  const { error: pErr } = await sb.from('predictions')
    .upsert(preds, { onConflict: 'user_id,match_id' })
  if (pErr) console.error('  ✗ ניחושים:', pErr.message)
  else console.log(`  ✓ ${preds.length} ניחושים הוגדרו`)

  // ── טראש טוק מחזור 3 ────────────────────────────────────────────
  const msgs = [
    { user_id: YAMAL_ID,   round: 3, message: 'ג\'וקר 3:0 זה פשוט 🔥' },
    { user_id: PEDRI_ID,   round: 3, message: 'ברצה תשחק כדורגל 💪' },
    { user_id: GAVI_ID,    round: 3, message: 'הג\'וקר שלי מנצח!' },
    { user_id: MESSI_ID,   round: 3, message: 'אטל 0:3 תבכו 😈' },
    { user_id: FRIEREN_ID, round: 3, message: '...' },
    { user_id: RONI_ID,    round: 3, message: 'סלטה 1:1 קלאסיק 🤝' },
  ]

  const { error: mErr } = await sb.from('round_messages')
    .upsert(msgs, { onConflict: 'user_id,round' })
  if (mErr) console.error('  ✗ הודעות:', mErr.message)
  else console.log(`  ✓ ${msgs.length} הודעות טראש טוק הוגדרו`)

  console.log('\n✅ setup_r3 הושלם. הרץ close_r3 לסגירת המשחקים.')
}

// סגירת 3 משחקי מחזור 3 + בדיקת חישובים
async function modeCloseR3() {
  console.log('\n🏁 close_r3 — סוגר 3 משחקי מחזור 3...')

  const { data: m3 } = await sb.from('matches')
    .select('id,home_team,away_team,status').eq('round', 3).order('kickoff')
  if (!m3?.length) return console.log('  ✗ לא נמצאו משחקי מחזור 3')

  const byHome = Object.fromEntries(m3.map(m => [m.home_team, m.id]))
  const results = [
    { id: byHome['Barcelona'],  home_score: 3, away_score: 0 },  // ברצה 3:0 ריאיו
    { id: byHome['Sevilla'],    home_score: 0, away_score: 3 },  // סביליה 0:3 אטלטיקו
    { id: byHome['Celta Vigo'], home_score: 1, away_score: 1 },  // סלטה 1:1 אתלטיק
  ]

  for (const r of results) {
    if (!r.id) { console.log('  ✗ משחק לא נמצא'); continue }
    const m = m3.find(x => x.id === r.id)
    const { error } = await sb.from('matches').update({
      home_score: r.home_score, away_score: r.away_score, status: 'FT'
    }).eq('id', r.id)
    if (error) console.error(`  ✗ ${m?.home_team}: ${error.message}`)
    else console.log(`  ✓ ${m?.home_team} ${r.home_score}:${r.away_score} ${m?.away_team} → FT`)
  }

  // המתנה לטריגר
  await new Promise(r => setTimeout(r, 1500))

  // ── בדיקות ─────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════')
  console.log('  בדיקת מחזור 3 — נקודות, ג\'וקרים')
  console.log('══════════════════════════════════════════════\n')

  const matchIds = results.map(r => r.id).filter(Boolean)
  const { data: preds } = await sb.from('predictions')
    .select('user_id,match_id,home_guess,away_guess,is_joker,points')
    .in('match_id', matchIds)
  const { data: profiles } = await sb.from('profiles').select('id,display_name')
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name]))
  const finalMatches = await sb.from('matches').select('id,home_team,away_team,home_score,away_score').in('id', matchIds).then(r => r.data)
  const mMap = Object.fromEntries((finalMatches || []).map(m => [m.id, m]))

  console.log('📋 תוצאות:')
  for (const m of finalMatches) {
    console.log(`  ${m.home_team} ${m.home_score}:${m.away_score} ${m.away_team}`)
  }

  console.log('\n🃏 ג\'וקרים:')
  const jokers = (preds || []).filter(p => p.is_joker)
  if (!jokers.length) console.log('  אין ג\'וקרים')
  for (const j of jokers) {
    const m = mMap[j.match_id]
    const name = (nameMap[j.user_id] ?? j.user_id.slice(0,8)).padEnd(12)
    const exact = j.home_guess === m.home_score && j.away_guess === m.away_score
    const dir   = Math.sign(j.home_guess - j.away_guess) === Math.sign(m.home_score - m.away_score)
    const tag   = exact ? '✅ exact' : dir ? '🟡 כיוון' : '❌ שגוי'
    console.log(`  ${name} ${j.home_guess}:${j.away_guess} vs ${m.home_score}:${m.away_score} → ${tag} | pts=${j.points}`)
  }

  console.log('\n📊 נקודות מחזור 3 (5 יוזרים עיקריים):')
  const KEY_USERS = [YAMAL_ID, PEDRI_ID, GAVI_ID, MESSI_ID, FRIEREN_ID, RONI_ID, FCB13_ID]
  const byUser = {}
  for (const p of (preds || [])) {
    if (!KEY_USERS.includes(p.user_id)) continue
    if (!byUser[p.user_id]) byUser[p.user_id] = { total: 0, exact: 0, dir: 0, miss: 0 }
    byUser[p.user_id].total += (p.points ?? 0)
    const m = mMap[p.match_id]
    if (!m) continue
    if (p.home_guess === m.home_score && p.away_guess === m.away_score) byUser[p.user_id].exact++
    else if (Math.sign(p.home_guess - p.away_guess) === Math.sign(m.home_score - m.away_score) && m.home_score !== m.away_score) byUser[p.user_id].dir++
    else byUser[p.user_id].miss++
  }
  const sorted = Object.entries(byUser).sort((a,b) => b[1].total - a[1].total)
  for (const [uid, s] of sorted) {
    const name = (nameMap[uid] ?? uid.slice(0,8)).padEnd(14)
    const j = jokers.some(j => j.user_id === uid) ? '🃏' : '  '
    console.log(`  ${j} ${name} ${String(s.total).padStart(3)}נק\'  exact:${s.exact} כיוון:${s.dir} miss:${s.miss}`)
  }

  const nullPts = (preds || []).filter(p => p.points === null && matchIds.includes(p.match_id))
  if (nullPts.length) console.log(`\n⚠️  ${nullPts.length} predictions עם points=null`)
  else console.log('\n✅ כל predictions קיבלו נקודות')
}

// Real Madrid vs Malaga — הגדרת ניחושי פנדל וג'וקרים לפני סגירה
// תוצאה: 1:0, פנדל דקה 68 (בתוך טווח 63-77)
async function modeSetupRM() {
  console.log('\n⚡ setup_rm — ניחושי פנדל + ג\'וקרים ל-Real Madrid vs Malaga...')

  const { data: match } = await sb.from('matches')
    .select('id,home_team,away_team').eq('round', 3)
    .ilike('home_team', '%Real Madrid%').single()
  if (!match) return console.log('  ✗ לא נמצא Real Madrid vs Malaga במחזור 3')
  console.log(`  📋 ${match.home_team} vs ${match.away_team} [${match.id}]`)

  // תוצאה אמיתית: 1:0 ריאל. פנדל בדקה 68.
  // penalty_bonus = 3 לכל פגיעה בטווח. נפרד מג'וקר (ג'וקר מכפיל רק points).
  // YAMAL/PEDRI/MESSI כבר השתמשו בג'וקר במחזור 3 (ברצה/סביליה) → is_joker: false
  // GAVI ו-RONI פנויים → is_joker: true
  const preds = [
    // YAMAL: exact 1:0 (no joker, כבר נוצל) + פנדל 63-77 (HIT 68) → pts=3 + bonus=3 → total=6
    { user_id: YAMAL_ID,   match_id: match.id, home_guess: 1, away_guess: 0, is_joker: false, penalty_min: 63, penalty_max: 77 },
    // PEDRI: exact 1:0 (no joker, כבר נוצל) + פנדל 60-80 (HIT) → pts=3 + bonus=3 → total=6
    { user_id: PEDRI_ID,   match_id: match.id, home_guess: 1, away_guess: 0, is_joker: false, penalty_min: 60, penalty_max: 80 },
    // GAVI: ניחש 0:1 (wrong) + joker + פנדל 63-77 (HIT) → pts=-1 (joker wrong) + bonus=3 → total=2
    { user_id: GAVI_ID,    match_id: match.id, home_guess: 0, away_guess: 1, is_joker: true,  penalty_min: 63, penalty_max: 77 },
    // MESSI: כיוון 2:0 (no joker, כבר נוצל) + פנדל 80-90 (MISS) → pts=1 + bonus=0 → total=1
    { user_id: MESSI_ID,   match_id: match.id, home_guess: 2, away_guess: 0, is_joker: false, penalty_min: 80, penalty_max: 90 },
    // FRIEREN: ניחש 1:1 (wrong) + פנדל 50-70 (HIT! 68≤70) → pts=0 + bonus=3 → total=3
    { user_id: FRIEREN_ID, match_id: match.id, home_guess: 1, away_guess: 1, is_joker: false, penalty_min: 50, penalty_max: 70 },
    // RONI: exact 1:0 + joker + פנדל 40-60 (MISS) → pts=6 (exact×2) + bonus=0 → total=6
    { user_id: RONI_ID,    match_id: match.id, home_guess: 1, away_guess: 0, is_joker: true,  penalty_min: 40, penalty_max: 60 },
  ]

  const { error } = await sb.from('predictions').upsert(preds, { onConflict: 'user_id,match_id' })
  if (error) return console.error('  ✗ upsert:', error.message)
  console.log(`  ✓ ${preds.length} ניחושים הוגדרו`)
  console.log('\n  📊 ניחושי פנדל:')
  const labels = [
    ['YAMAL  ', '63-77', '✅ פגיעה', 'exact+pen (ג\'וקר כבר נוצל)'],
    ['PEDRI  ', '60-80', '✅ פגיעה', 'exact+pen'],
    ['GAVI   ', '63-77', '✅ פגיעה', '🃏 joker wrong-pts+pen'],
    ['MESSI  ', '80-90', '❌ החטאה', 'dir, no pen'],
    ['FRIEREN', '50-70', '✅ פגיעה', '0pts+pen'],
    ['RONI   ', '40-60', '❌ החטאה', '🃏 joker exact, no pen'],
  ]
  labels.forEach(([n,r,hit,exp]) => console.log(`  ${hit} ${n}  טווח ${r}  — ${exp}`))
  console.log('\n✅ הרץ close_rm לסגירה עם פנדל דקה 68')
}

// סגירת Real Madrid 1:0 + פנדל דקה 68 + בדיקה
async function modeCloseRM() {
  console.log('\n🏁 close_rm — Real Madrid 1:0 Malaga + פנדל דקה 68...')

  const { data: match } = await sb.from('matches')
    .select('id,home_team,away_team').eq('round', 3)
    .ilike('home_team', '%Real Madrid%').single()
  if (!match) return console.log('  ✗ לא נמצא Real Madrid במחזור 3')

  // שלב 1: סגירה עם תוצאה (מפעיל on_match_result → חישוב points)
  const { error: e1 } = await sb.from('matches').update({
    home_score: 1, away_score: 0, status: 'FT'
  }).eq('id', match.id)
  if (e1) return console.error('  ✗ סגירה:', e1.message)
  console.log('  ✓ Real Madrid 1:0 Malaga → FT')

  // שלב 2: פנדל (מפעיל on_penalty_scored → חישוב penalty_bonus)
  const { error: e2 } = await sb.from('matches').update({
    penalty_events: [{ e: 68, x: null }]
  }).eq('id', match.id)
  if (e2) return console.error('  ✗ פנדל:', e2.message)
  console.log('  ✓ penalty_events ← דקה 68')

  await new Promise(r => setTimeout(r, 2000))

  // ── בדיקה ──
  console.log('\n══════════════════════════════════════════════')
  console.log('  בדיקת Real Madrid — פנדל + ג\'וקרים')
  console.log('══════════════════════════════════════════════\n')

  const { data: preds } = await sb.from('predictions')
    .select('user_id,home_guess,away_guess,is_joker,points,penalty_min,penalty_max,penalty_bonus')
    .eq('match_id', match.id)
  const { data: profiles } = await sb.from('profiles').select('id,display_name')
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name]))

  const KEY = [YAMAL_ID, PEDRI_ID, GAVI_ID, MESSI_ID, FRIEREN_ID, RONI_ID]
  console.log('שחקן          ניחוש  טווח       pts  pen  total  🃏')
  console.log('─────────────────────────────────────────────────────')
  for (const uid of KEY) {
    const p = preds?.find(x => x.user_id === uid)
    if (!p) continue
    const name = (nameMap[uid] ?? '???').padEnd(12)
    const guess = `${p.home_guess}:${p.away_guess}`.padEnd(5)
    const range = p.penalty_min != null ? `${p.penalty_min}-${p.penalty_max}`.padEnd(10) : '—         '
    const pts   = String(p.points ?? '?').padStart(3)
    const pen   = String(p.penalty_bonus ?? 0).padStart(3)
    const total = String((p.points ?? 0) + (p.penalty_bonus ?? 0)).padStart(5)
    const j     = p.is_joker ? '🃏' : ''
    console.log(`${name}  ${guess}  ${range}  ${pts}  ${pen}  ${total}  ${j}`)
  }

  const nulls = preds?.filter(p => p.points === null)
  if (nulls?.length) console.log(`\n⚠️  ${nulls.length} עם points=null`)
  else console.log('\n✅ כל הנקודות חושבו')
}

// פותח 3 משחקים ראשונים של מחזור 3 בעוד 21 דקות
async function modeOpenR3() {
  console.log('\n⏰ open_r3 — פותח 3 משחקי מחזור 3 בעוד 21 דקות...')
  const now = Date.now()
  const MIN = 60 * 1000

  const { data: m3 } = await sb.from('matches')
    .select('id, home_team, away_team, status, home_score')
    .eq('round', 3).order('kickoff')
  if (!m3?.length) return console.log('  ✗ לא נמצאו משחקי מחזור 3')

  // רק משחקים שטרם התחילו (לא FT, לא live עם סקור)
  const open = m3.filter(m => m.status !== 'FT' && m.home_score === null)
  const toOpen = open.slice(0, 3)
  if (!toOpen.length) return console.log('  ✗ אין משחקי מחזור 3 פתוחים')

  const ko = new Date(now + 21 * MIN)  // כולם אותו kickoff — 21 דקות מעכשיו
  for (const m of toOpen) {
    const { error } = await sb.from('matches').update({
      kickoff: ko.toISOString(), home_score: null, away_score: null, status: 'NS'
    }).eq('id', m.id)
    if (error) console.error(`  ✗ ${m.home_team}: ${error.message}`)
    else console.log(`  ✓ ${m.home_team} vs ${m.away_team} → ${ko.toLocaleTimeString('he-IL')}`)
  }
  console.log(`\n✅ 3 משחקי מחזור 3 נועלים בעוד ~20 דקות (${ko.toLocaleTimeString('he-IL')}).`)
}

// בדיקת חישובי נקודות מחזור 2
async function modeCheckR2() {
  console.log('\n══════════════════════════════════════════')
  console.log('  בדיקת מחזור 2 — תוצאות, נקודות, ג׳וקרים, פנדלים')
  console.log('══════════════════════════════════════════\n')

  const { data: matches } = await sb.from('matches')
    .select('id,home_team,away_team,home_score,away_score,is_special,penalty_events')
    .eq('round', 2).order('kickoff')
  const matchIds = matches.map(m => m.id)
  const { data: preds } = await sb.from('predictions')
    .select('user_id,match_id,home_guess,away_guess,is_joker,points,penalty_bonus,penalty_min,penalty_max')
    .in('match_id', matchIds)
  const { data: profiles } = await sb.from('profiles').select('id,display_name')
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name]))

  // תוצאות
  console.log('📋 תוצאות:')
  for (const m of matches) {
    const pen = m.penalty_events?.length ? ` 🟡 פנדל דקה ${m.penalty_events[0]?.e}` : ''
    const sp = m.is_special ? ' ⭐' : ''
    console.log(`  ${m.home_team} ${m.home_score}:${m.away_score} ${m.away_team}${sp}${pen}`)
  }

  // ג'וקרים
  console.log('\n🃏 ג׳וקרים:')
  const jokers = preds.filter(p => p.is_joker)
  if (!jokers.length) { console.log('  אין ג׳וקרים') }
  for (const j of jokers) {
    const m = matches.find(x => x.id === j.match_id)
    const name = nameMap[j.user_id] ?? '???'
    const exact = j.home_guess === m.home_score && j.away_guess === m.away_score
    const baseExpected = exact ? 3 : 0
    const expectedJokerPts = exact ? baseExpected * 2 : (j.points < 0 ? j.points : 0)
    const ok = j.points === expectedJokerPts ? '✅' : '❌'
    console.log(`  ${ok} ${name}: ${j.home_guess}:${j.away_guess} vs ${m.home_score}:${m.away_score} → pts=${j.points} (צפוי ${expectedJokerPts})`)
  }

  // פנדלים
  console.log('\n⚡ פנדל ריאל מדריד:')
  const rmM = matches.filter(m => m.home_team === 'Real Madrid' || m.away_team === 'Real Madrid')
  if (!rmM.length) { console.log('  אין משחק ריאל מדריד') }
  for (const m of rmM) {
    if (!m.penalty_events?.length) { console.log(`  ${m.home_team} vs ${m.away_team} — אין פנדל`); continue }
    const penMin = m.penalty_events[0].e
    console.log(`  פנדל בדקה ${penMin} | ${m.home_team} ${m.home_score}:${m.away_score} ${m.away_team}`)
    const mPreds = preds.filter(p => p.match_id === m.id && p.penalty_min != null)
    if (!mPreds.length) { console.log('  אין הימורי פנדל'); continue }
    for (const p of mPreds) {
      const hit = penMin >= p.penalty_min && penMin <= p.penalty_max
      const expectedBonus = hit ? 3 : 0
      const ok = p.penalty_bonus === expectedBonus ? '✅' : '❌'
      console.log(`  ${ok} ${nameMap[p.user_id] ?? '???'}: טווח ${p.penalty_min}-${p.penalty_max} → bonus=${p.penalty_bonus} (צפוי ${expectedBonus})`)
    }
  }

  // סיכום נקודות
  console.log('\n📊 סיכום נקודות מחזור 2:')
  const byUser = {}
  for (const p of preds) {
    if (!byUser[p.user_id]) byUser[p.user_id] = { total: 0, exact: 0, dir: 0, miss: 0, penBonus: 0, joker: false, nullCount: 0 }
    if (p.points === null) { byUser[p.user_id].nullCount++; continue }
    byUser[p.user_id].total += (p.points ?? 0) + (p.penalty_bonus ?? 0)
    byUser[p.user_id].penBonus += (p.penalty_bonus ?? 0)
    if (p.is_joker) byUser[p.user_id].joker = true
    const m = matches.find(x => x.id === p.match_id)
    if (!m || m.home_score === null) continue
    if (p.home_guess === m.home_score && p.away_guess === m.away_score) byUser[p.user_id].exact++
    else if (Math.sign(p.home_guess - p.away_guess) === Math.sign(m.home_score - m.away_score) && m.home_score !== m.away_score) byUser[p.user_id].dir++
    else byUser[p.user_id].miss++
  }
  const sorted = Object.entries(byUser).sort((a, b) => b[1].total - a[1].total)
  for (const [uid, s] of sorted) {
    const name = (nameMap[uid] ?? uid.slice(0, 8)).padEnd(15)
    const j = s.joker ? '🃏' : '  '
    const pen = s.penBonus > 0 ? ` +${s.penBonus}פנדל` : ''
    const nullW = s.nullCount > 0 ? ` ⚠️null:${s.nullCount}` : ''
    console.log(`  ${j} ${name} ${String(s.total).padStart(3)}נק׳  מדויק:${s.exact} כיוון:${s.dir} פספס:${s.miss}${pen}${nullW}`)
  }

  // null check
  const nullPts = preds.filter(p => p.points === null)
  if (nullPts.length) {
    console.log(`\n⚠️  ${nullPts.length} predictions עם points=null:`)
    for (const p of nullPts.slice(0, 10))
      console.log(`  ${nameMap[p.user_id] ?? '???'} → ${matches.find(m => m.id === p.match_id)?.home_team}`)
  } else {
    console.log('\n✅ כל predictions קיבלו נקודות')
  }

  // FRIEREN הפוך + כמעט
  console.log('\n🔍 FRIEREN — הפוך + כמעט:')
  const frP = preds.filter(p => p.user_id === FRIEREN_ID)
  let found = 0
  for (const p of frP) {
    const m = matches.find(x => x.id === p.match_id)
    if (!m) continue
    const isRev = p.home_guess === m.away_score && p.away_guess === m.home_score
    const dist = Math.abs(p.home_guess - m.home_score) + Math.abs(p.away_guess - m.away_score)
    const isNear = !isRev && dist === 1 && (p.points === 0 || p.points === null)
    if (isRev)  { console.log(`  🔄 הפוך: ${m.home_team} — ניחש ${p.home_guess}:${p.away_guess} vs ${m.home_score}:${m.away_score} pts=${p.points}`); found++ }
    if (isNear) { console.log(`  😤 כמעט: ${m.home_team} — ניחש ${p.home_guess}:${p.away_guess} vs ${m.home_score}:${m.away_score} pts=${p.points}`); found++ }
  }
  if (!found) console.log('  לא נמצאו הפוך/כמעט ל-FRIEREN')
}

// פותח מחזור 2 מחדש — דוחף kickoffs לעתיד (ראשון בעוד 5 דקות)
async function modeOpenR2() {
  console.log('\n⏰ open_r2 — פותח מחזור 2 מחדש...')
  const now = Date.now()
  const MIN = 60 * 1000

  const { data: m2 } = await sb.from('matches')
    .select('id, home_team, away_team, status')
    .eq('round', 2).neq('status', 'FT').order('kickoff')
  if (!m2?.length) return console.log('  ✗ אין משחקי מחזור 2 פתוחים')

  for (let i = 0; i < m2.length; i++) {
    const ko = new Date(now + 5 * MIN + i * 2 * 60 * MIN)
    const { error } = await sb.from('matches').update({
      kickoff: ko.toISOString(), home_score: null, away_score: null, status: 'NS'
    }).eq('id', m2[i].id)
    if (error) console.error(`  ✗ ${m2[i].home_team}: ${error.message}`)
    else console.log(`  ✓ ${m2[i].home_team} vs ${m2[i].away_team} → ${ko.toLocaleTimeString('he-IL')}`)
  }
  console.log(`\n✅ ${m2.length} משחקים נפתחו להימור. ראשון נועל בעוד 5 דקות.`)
}

// ────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────
const arg = process.argv[2] || ''

if (arg.startsWith('streak=')) {
  const n = parseInt(arg.split('=')[1])
  await modeSetStreak(n)
  process.exit(0)
}
if (arg === 'live')         { await modeSetLive();    process.exit(0) }
if (arg === 'finish_live')  { await modeFinishLive(); process.exit(0) }
if (arg === 'critical')     { await modeCritical();   process.exit(0) }
if (arg === 'playbook')     { modePlaybook();         process.exit(0) }
if (arg === 'round1')       { await modeRound1Open(); process.exit(0) }
if (arg === 'live_r1')      { await modeLiveR1();     process.exit(0) }
if (arg === 'cat_now')      { await modeCatNow();       process.exit(0) }
if (arg === 'debug_cat')    { await modeDebugCat();    process.exit(0) }
if (arg === 'setup_m2_r1')  { await modeSetupM2R1();   process.exit(0) }
if (arg === 'prelive_r1')   { await modePreLockR1();   process.exit(0) }
if (arg === 'live2_r1')     { await modeLive2R1();     process.exit(0) }
if (arg === 'goal_r1m2')         { await modeGoalR1M2();           process.exit(0) }
if (arg === 'finish_m34_live_m567') { await modeFinishM34LiveM567(); process.exit(0) }
if (arg === 'finish_m567_live_m89') { await modeFinishM567LiveM89(); process.exit(0) }
if (arg === 'debug_joker')          { await modeDebugJoker();        process.exit(0) }
if (arg === 'retrigger_pts')        { await modeRetriggerPts();      process.exit(0) }
if (arg === 'fix_joker_pts')        { await modeFixJokerPts();       process.exit(0) }
if (arg === 'finish_m89_live_m10')  { await modeFinishM89LiveM10();  process.exit(0) }
if (arg === 'fix_missing_preds')    { await modeFixMissingPreds();   process.exit(0) }
if (arg === 'finish_r1_start_r2')  { await modeFinishR1StartR2();  process.exit(0) }
if (arg === 'open_r2')             { await modeOpenR2();            process.exit(0) }
if (arg === 'live_r2')             { await modeLiveR2();            process.exit(0) }
if (arg === 'finish_r2')           { await modeFinishR2();          process.exit(0) }
if (arg === 'check_r2')            { await modeCheckR2();           process.exit(0) }
if (arg === 'open_r3')             { await modeOpenR3();            process.exit(0) }
if (arg === 'setup_r3')            { await modeSetupR3();           process.exit(0) }
if (arg === 'close_r3')            { await modeCloseR3();           process.exit(0) }
if (arg === 'setup_rm')            { await modeSetupRM();           process.exit(0) }
if (arg === 'close_rm')            { await modeCloseRM();           process.exit(0) }

// ── FULL SETUP ──────────────────────────────────────────────────
console.log('\n🌱 seed-test.js — התחלת setup מלא\n')

// 1. ניקוי
console.log('🧹 מנקה matches + predictions...')
await sb.from('predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
await sb.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
console.log('  ✓ טבלאות נוקו\n')

// 2. יצירת יוזרים חדשים
console.log('👤 יוצר יוזרי טסט...')
const userIds = {}
const userKeys = ['U_S0','U_S3','U_S5','U_JW','U_JL','U_JL4','U_NEAR','U_REV','U_SPEC','U_PH','U_PM','U_MISS']
for (let i = 0; i < NEW_USERS.length; i++) {
  const u = NEW_USERS[i]
  const id = await ensureUser(u.email, u.name)
  userIds[userKeys[i]] = id
  if (id) console.log(`  ✓ ${u.email} → ${id}`)
}

// 3. הכנסת matches
console.log('\n📅 מכניס משחקים...')
const now = Date.now()
const matchDefs = buildMatches(now)
const matchMap = {}  // label → id

let hasIsSpecial = true  // assume column exists until proven otherwise

for (const m of matchDefs) {
  const row = {
    round: m.round,
    home_team: m.home,
    away_team: m.away,
    kickoff: m.kickoff.toISOString(),
  }
  if (m.is_special && hasIsSpecial) row.is_special = true

  const { data, error } = await sb.from('matches').insert(row).select('id').single()
  if (error) {
    if (error.message.includes('is_special') && hasIsSpecial) {
      // column doesn't exist yet — retry without it
      hasIsSpecial = false
      delete row.is_special
      const { data: d2, error: e2 } = await sb.from('matches').insert(row).select('id').single()
      if (e2) { console.error(`  ✗ ${m.label}:`, e2.message); continue }
      matchMap[m.label] = d2.id
      console.warn(`  ⚠ is_special column missing — run schema migration in Supabase SQL Editor`)
    } else {
      console.error(`  ✗ ${m.label}:`, error.message); continue
    }
  } else {
    matchMap[m.label] = data.id
  }
  process.stdout.write(`  ✓ ${m.label} (${m.home} vs ${m.away})\n`)
}
if (!hasIsSpecial) {
  console.log('\n  ℹ כדי להפעיל משחקים מיוחדים, הרץ בסופרבייס SQL Editor:')
  console.log('    alter table matches add column if not exists is_special boolean default false;')
}

// 4. הכנסת predictions
console.log('\n🎯 מכניס predictions...')
const predRows = buildPredictions(matchMap, userIds)
// חלק ל-chunks (Supabase מגביל גודל request)
const CHUNK = 50
for (let i = 0; i < predRows.length; i += CHUNK) {
  const chunk = predRows.slice(i, i + CHUNK)
  const { error } = await sb.from('predictions').insert(chunk)
  if (error) console.error(`  ✗ predictions chunk:`, error.message)
}
console.log(`  ✓ ${predRows.length} predictions הוכנסו`)

// 5. הזנת תוצאות Round 1 (trigger יחשב נקודות)
console.log('\n📊 מזין תוצאות Round 1...')
await setResults(matchMap, R1_RESULTS)

// 6. הזנת תוצאות Round 2
console.log('\n📊 מזין תוצאות Round 2...')
await setResults(matchMap, R2_RESULTS)

// 7. הזנת תוצאת R3M1 (Villarreal 2:0)
console.log('\n📊 מזין תוצאת R3M1...')
await setResults(matchMap, { R3M1: R3M1_RESULT })

// 8. סיכום
console.log('\n✅ Setup הסתיים בהצלחה!\n')
modePlaybook()
