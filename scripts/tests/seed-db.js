/**
 * Seed test DB with REAL La Liga 2024/25 data shifted 18 months forward
 * → Rounds 1-20 appear as Feb-Jun 2026 (past, with real results)
 * → Round 21 appears as Jul 5-8, 2026 (upcoming, no results)
 * → 6 test users with realistic prediction accuracy profiles
 *
 * Uses 1 API-Football call (all fixtures at once)
 *
 * Run:     node scripts/tests/seed-db.js
 * Cleanup: node scripts/tests/seed-db.js --cleanup
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

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, API_FOOTBALL_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !API_FOOTBALL_KEY) {
  console.error('Missing credentials in scripts/tests/.env.test.secrets')
  process.exit(1)
}

// ─── Config ───────────────────────────────────────────────────────────────────
const PAST_ROUNDS    = 20
const UPCOMING_ROUND = 21
const DATE_SHIFT_MONTHS = 18   // shifts Aug 2024 → Feb 2026, Dec 2024 → Jun 2026

// Upcoming round kickoffs (Jul 5-8, 2026 — after today)
const UPCOMING_SLOTS = [
  '2026-07-05T15:00:00Z', '2026-07-05T17:30:00Z',
  '2026-07-06T11:00:00Z', '2026-07-06T13:15:00Z',
  '2026-07-06T15:30:00Z', '2026-07-06T18:00:00Z',
  '2026-07-07T11:00:00Z', '2026-07-07T13:15:00Z',
  '2026-07-07T15:30:00Z', '2026-07-08T18:00:00Z',
]

// Team name normalization (API → app)
const TEAM_MAP = {
  'Deportivo Alaves': 'Alaves',
  'Real Valladolid':  'Valladolid',
  'Celta de Vigo':    'Celta Vigo',
}
const normalize = n => TEAM_MAP[n] || n
const parseRound = s => { const m = s.match(/(\d+)$/); return m ? parseInt(m[1]) : null }

// ─── Test users ───────────────────────────────────────────────────────────────
const USERS = [
  { email: 'frieren@laliga.test',   name: 'FRIEREN',   exact: 0.33, dir: 0.50 },
  { email: 'roni@laliga.test',      name: 'Roni⚽',     exact: 0.22, dir: 0.40 },
  { email: 'messi10@laliga.test',   name: 'Messi10',   exact: 0.27, dir: 0.43 },
  { email: 'gavikid@laliga.test',   name: 'GaviKid',   exact: 0.15, dir: 0.32 },
  { email: 'pedriking@laliga.test', name: 'PedriKing', exact: 0.30, dir: 0.40 },
  { email: 'yamal27@laliga.test',   name: 'Yamal27',   exact: 0.10, dir: 0.25 },
]

const HW = [[1,0],[2,0],[2,1],[3,0],[3,1],[3,2],[4,1],[1,0],[2,0],[2,1]]
const AW = [[0,1],[0,2],[1,2],[0,3],[1,3],[0,2],[1,2]]
const DW = [[0,0],[1,1],[2,2],[1,1],[0,0]]

// ─── Deterministic random ─────────────────────────────────────────────────────
function rand(a, b = 1) {
  const x = Math.sin(a * 9301 + b * 49297 + 233) * 10000
  return x - Math.floor(x)
}

// ─── Prediction generator ─────────────────────────────────────────────────────
function makePrediction(user, ui, realH, realA, round, matchIdx) {
  const s1 = rand(round * 13 + ui, matchIdx * 17)
  const s2 = rand(round * 11 + ui * 3, matchIdx * 7)
  const s3 = rand(round * 7  + ui * 5, matchIdx * 11 + 1)

  if (s1 < user.exact) return { h: realH, a: realA }   // exact

  if (s1 < user.exact + user.dir) {
    // correct direction, different score
    const dir  = Math.sign(realH - realA)
    const pool = (dir > 0 ? HW : dir < 0 ? AW : DW).filter(s => !(s[0] === realH && s[1] === realA))
    const s    = pool[Math.floor(s2 * pool.length)] || (dir >= 0 ? HW[0] : AW[0])
    return { h: s[0], a: s[1] }
  }

  // wrong direction
  const dir   = Math.sign(realH - realA)
  const wrong = dir > 0 ? [...AW, ...DW] : dir < 0 ? [...HW, ...DW] : [...HW, ...AW]
  const s     = wrong[Math.floor(s3 * wrong.length)]
  return { h: s[0], a: s[1] }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────
async function authApi(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method,
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Auth ${method} /${path}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function dbApi(path, method = 'GET', body = null, prefer = 'return=representation') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: prefer },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`DB ${method} /${path}: ${text}`)
  return text ? JSON.parse(text) : null
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log('\n🗑️  Cleanup...')
  const { users } = await authApi('admin/users?per_page=100')
  const testEmails = new Set(USERS.map(u => u.email))
  for (const u of users?.filter(u => testEmails.has(u.email)) || []) {
    await authApi(`admin/users/${u.id}`, 'DELETE')
    console.log(`   ✅ Deleted ${u.email}`)
  }
  await dbApi(`matches?round=lte.${UPCOMING_ROUND}`, 'DELETE', null, 'return=minimal')
  console.log('   ✅ Matches deleted (predictions cascade)')
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--cleanup')) return cleanup()

  console.log('🌱 Seeding test DB with REAL La Liga 2024/25 data')
  console.log(`   Rounds 1-${PAST_ROUNDS} past (dates shifted +${DATE_SHIFT_MONTHS}mo) · Round ${UPCOMING_ROUND} upcoming`)
  console.log(`   ${USERS.length} test users\n`)

  // 1. Fetch real fixtures from API-Football ──────────────────────────────────
  console.log('📡 Fetching La Liga 2024/25 from API-Football...')
  const apiRes = await fetch(`https://v3.football.api-sports.io/fixtures?league=140&season=2024`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY },
  })
  const { response: fixtures, errors } = await apiRes.json()
  if (errors && Object.keys(errors).length) throw new Error(JSON.stringify(errors))

  const remaining = apiRes.headers.get('x-ratelimit-requests-remaining')
  console.log(`   ✅ ${fixtures.length} fixtures · API quota remaining: ${remaining ?? '?'}`)

  // Group by round
  const byRound = {}
  fixtures.forEach(f => {
    const round = parseRound(f.league.round)
    if (round >= 1 && round <= UPCOMING_ROUND) {
      ;(byRound[round] = byRound[round] || []).push(f)
    }
  })

  // 2. Users ──────────────────────────────────────────────────────────────────
  console.log('\n👥 Creating test users...')
  const { users: existing } = await authApi('admin/users?per_page=100')
  const existingByEmail = Object.fromEntries(existing?.map(u => [u.email, u.id]) || [])
  const userIds = {}

  for (const u of USERS) {
    if (existingByEmail[u.email]) {
      userIds[u.email] = existingByEmail[u.email]
      console.log(`   ↩️  ${u.name} (existing)`)
    } else {
      const created = await authApi('admin/users', 'POST', {
        email: u.email, password: 'Test1234!', email_confirm: true,
        user_metadata: { display_name: u.name },
      })
      userIds[u.email] = created.id
      console.log(`   ✅ ${u.name}`)
    }
  }
  await new Promise(r => setTimeout(r, 2000))

  // 3. Matches ────────────────────────────────────────────────────────────────
  console.log('\n⚽ Inserting matches...')
  await dbApi(`matches?round=lte.${UPCOMING_ROUND}`, 'DELETE', null, 'return=minimal')

  // Build match rows with results stored separately for later
  const matchRows  = []
  const resultMap  = {}   // index → { h, a } real result

  let idx = 0
  for (let round = 1; round <= UPCOMING_ROUND; round++) {
    const roundFixtures = (byRound[round] || []).slice(0, 10)

    roundFixtures.forEach((f, i) => {
      let kickoff
      if (round === UPCOMING_ROUND) {
        kickoff = UPCOMING_SLOTS[i % UPCOMING_SLOTS.length]
      } else {
        const orig = new Date(f.fixture.timestamp * 1000)
        orig.setMonth(orig.getMonth() + DATE_SHIFT_MONTHS)
        kickoff = orig.toISOString()
      }

      // Store real result for later (only past rounds that have a final score)
      const isFinished = f.fixture.status.short === 'FT'
      if (round <= PAST_ROUNDS && isFinished && f.goals.home !== null) {
        resultMap[idx] = { h: f.goals.home, a: f.goals.away }
      }

      matchRows.push({
        round,
        home_team: normalize(f.teams.home.name),
        away_team: normalize(f.teams.away.name),
        kickoff,
      })
      idx++
    })
  }

  await dbApi('matches', 'POST', matchRows, 'return=minimal')
  console.log(`   ✅ ${matchRows.length} matches from real API data`)

  const allMatches = await dbApi(`matches?round=lte.${UPCOMING_ROUND}&select=*&order=round,kickoff`)

  // 4. Predictions ────────────────────────────────────────────────────────────
  console.log('\n🎯 Generating predictions...')
  const pastMatches = allMatches.filter(m => m.round <= PAST_ROUNDS)
  const allPreds = []

  USERS.forEach((user, ui) => {
    pastMatches.forEach((m, mi) => {
      const result = resultMap[mi]
      if (!result) return            // match has no final result yet
      if (rand(ui * 1000 + mi, m.round * 3) > 0.85) return   // skip ~15%

      const pred = makePrediction(user, ui, result.h, result.a, m.round, mi % 10)
      allPreds.push({ user_id: userIds[user.email], match_id: m.id, home_guess: pred.h, away_guess: pred.a })
    })
  })

  for (let i = 0; i < allPreds.length; i += 200) {
    await dbApi('predictions', 'POST', allPreds.slice(i, i + 200), 'return=minimal')
    process.stdout.write(`   📝 ${Math.min(i + 200, allPreds.length)}/${allPreds.length}\r`)
  }
  console.log(`\n   ✅ ${allPreds.length} predictions`)

  // 5. Apply real results → DB trigger calculates points ──────────────────────
  console.log('\n📊 Applying real results (DB trigger calculates points)...')
  const byRoundDb = {}
  pastMatches.forEach((m, mi) => {
    if (!resultMap[mi]) return
    ;(byRoundDb[m.round] = byRoundDb[m.round] || []).push({ m, result: resultMap[mi] })
  })

  let updated = 0
  for (const round of Object.keys(byRoundDb).map(Number).sort((a,b)=>a-b)) {
    await Promise.all(byRoundDb[round].map(({ m, result }) => {
      updated++
      return dbApi(`matches?id=eq.${m.id}`, 'PATCH', { home_score: result.h, away_score: result.a }, 'return=minimal')
    }))
    process.stdout.write(`   🏁 Round ${round}/${PAST_ROUNDS}\r`)
  }
  console.log(`\n   ✅ ${updated} matches updated, points auto-calculated`)

  // 6. Leaderboard preview ────────────────────────────────────────────────────
  console.log('\n🏆 Leaderboard:')
  const lb = await dbApi('leaderboard_view?select=*&order=total_points.desc')
  const medals = ['🥇','🥈','🥉']
  lb?.forEach((r, i) => console.log(
    `   ${medals[i] || ` ${i+1}.`} ${r.display_name.padEnd(14)} ${String(r.total_points).padStart(3)} pts` +
    `  (${r.exact_count} מדויק · ${r.direction_count} כיוון)`
  ))

  console.log(`\n✅ Seed complete! Real 2024/25 data · dates shifted to 2026`)
  console.log('   npm run dev:test')
  console.log('   Login: frieren@laliga.test  /  Test1234!')
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1) })
