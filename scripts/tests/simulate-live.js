/**
 * Simulate live matches for round 21 in the test DB.
 *
 * What it does:
 *  1. Loads round 21 matches from the test DB
 *  2. Auto-generates predictions for all 6 test users (if not already there)
 *  3. Makes 2 matches go LIVE with different scores (so colors vary per user)
 *
 * Run: node scripts/tests/simulate-live.js
 * Undo: node scripts/tests/simulate-live.js --reset
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const raw = readFileSync(join(__dir, '.env.test.secrets'), 'utf8')
raw.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k?.trim()) process.env[k.trim()] = v.join('=').trim()
})

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing credentials in scripts/tests/.env.test.secrets')
  process.exit(1)
}

async function db(path, method = 'GET', body = null, prefer = 'return=representation') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`DB ${method} /${path}: ${text}`)
  return text ? JSON.parse(text) : null
}

// ─── Deterministic "varied" predictions per user per match ────────────────────
// Each user gets a different guess so we see green/yellow/red variety
const USER_GUESSES = [
  (h, a) => ({ h, a }),                                              // FRIEREN — exact
  (h, a) => ({ h: h + 1, a }),                                      // Roni⚽  — home wins but wrong score
  (h, a) => ({ h: a, a: h }),                                       // Messi10 — reversed (wrong direction)
  (h, a) => h > a ? { h: 0, a: 1 } : h < a ? { h: 1, a: 0 } : { h: 1, a: 0 }, // GaviKid — wrong direction
  (h, a) => ({ h: h > 0 ? h - 1 : 0, a }),                         // PedriKing — close but not exact
  (h, a) => ({ h: 0, a: 0 }),                                       // Yamal27  — always 0:0
]

// ─── Reset: put matches back to NS ────────────────────────────────────────────
async function reset() {
  console.log('\n🔄 Resetting round 21 to NS...')
  const matches = await db('matches?round=eq.21&select=id')
  await Promise.all(matches.map(m =>
    db(`matches?id=eq.${m.id}`, 'PATCH', { status: 'NS', home_score: null, away_score: null }, 'return=minimal')
  ))
  console.log(`   ✅ ${matches.length} matches reset to NS\n`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--reset')) return reset()

  // 1. Load round 21 matches
  const matches = await db('matches?round=eq.21&select=*&order=kickoff')
  if (!matches?.length) {
    console.error('❌ No round 21 matches found. Run npm run seed:test first.')
    process.exit(1)
  }
  console.log(`\n⚽ Found ${matches.length} round 21 matches`)

  // Pick first 3 for the simulation (2 live, 1 still NS)
  const [m1, m2, m3] = matches

  // 2. Load test users
  const users = await db('profiles?select=id,display_name&order=display_name')
  if (!users?.length) {
    console.error('❌ No users found. Run npm run seed:test first.')
    process.exit(1)
  }
  console.log(`👥 ${users.length} users found`)

  // 3. Auto-generate predictions for matches 1 & 2 (the ones going live)
  // Live score we're about to set — predictions are based on it so colors vary nicely
  const live1 = { h: 2, a: 1 }   // Barcelona 2:1 Real Madrid (home winning)
  const live2 = { h: 0, a: 0 }   // match 2 draw currently

  console.log('\n🎯 Inserting predictions for round 21...')
  const preds = []
  users.forEach((user, ui) => {
    const guessFn = USER_GUESSES[ui % USER_GUESSES.length]

    if (m1) {
      const g1 = guessFn(live1.h, live1.a)
      preds.push({ user_id: user.id, match_id: m1.id, home_guess: g1.h, away_guess: g1.a })
    }
    if (m2) {
      const g2 = guessFn(live2.h, live2.a)
      preds.push({ user_id: user.id, match_id: m2.id, home_guess: g2.h, away_guess: g2.a })
    }
    if (m3) {
      // Third match (still NS) — everyone predicts 1:0
      preds.push({ user_id: user.id, match_id: m3.id, home_guess: 1, away_guess: 0 })
    }
  })

  // Upsert (safe to re-run)
  await db('predictions', 'POST', preds, 'resolution=merge-duplicates,return=minimal')
  console.log(`   ✅ ${preds.length} predictions upserted`)

  // 4. Make 2 matches go live
  console.log('\n🔴 Going live...')

  if (m1) {
    await db(`matches?id=eq.${m1.id}`, 'PATCH',
      { status: '1H', home_score: live1.h, away_score: live1.a },
      'return=minimal')
    console.log(`   🔴 ${m1.home_team} ${live1.h}:${live1.a} ${m1.away_team}  [1H]`)
  }

  if (m2) {
    await db(`matches?id=eq.${m2.id}`, 'PATCH',
      { status: 'HT', home_score: live2.h, away_score: live2.a },
      'return=minimal')
    console.log(`   🔴 ${m2.home_team} ${live2.h}:${live2.a} ${m2.away_team}  [HT]`)
  }

  if (m3) {
    console.log(`   ⚪ ${m3.home_team} vs ${m3.away_team}  [NS — not started yet]`)
  }

  // 5. Show expected colors per user
  console.log('\n🎨 Expected live column colors:')
  users.forEach((user, ui) => {
    const guessFn = USER_GUESSES[ui % USER_GUESSES.length]
    const g1 = m1 ? guessFn(live1.h, live1.a) : null
    const g2 = m2 ? guessFn(live2.h, live2.a) : null

    const color1 = !g1 ? '—' :
      g1.h === live1.h && g1.a === live1.a ? '🟢 מדויק' :
      Math.sign(g1.h - g1.a) === Math.sign(live1.h - live1.a) ? '🟡 כיוון' : '🔴 טועה'

    const color2 = !g2 ? '—' :
      g2.h === live2.h && g2.a === live2.a ? '🟢 מדויק' :
      Math.sign(g2.h - g2.a) === Math.sign(live2.h - live2.a) ? '🟡 כיוון' : '🔴 טועה'

    const g1str = g1 ? `${g1.h}:${g1.a}` : '—'
    const g2str = g2 ? `${g2.h}:${g2.a}` : '—'
    console.log(`   ${user.display_name.padEnd(12)} match1: ${g1str} ${color1}   match2: ${g2str} ${color2}`)
  })

  console.log('\n✅ Done! Open the test server and check the leaderboard:')
  console.log('   npm run dev:test  →  http://localhost:3000')
  console.log('   Login: frieren@laliga.test / Test1234!')
  console.log('\n   To reset back to NS:')
  console.log('   node scripts/tests/simulate-live.js --reset\n')
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1) })
