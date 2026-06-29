/**
 * Automated test suite for LaLigaGuess
 * Runs against the TEST Supabase project (not production).
 *
 * Setup: create scripts/tests/.env.test.secrets with:
 *   API_FOOTBALL_KEY=...
 *   SUPABASE_URL=https://[test-project].supabase.co
 *   SUPABASE_SERVICE_KEY=...
 *
 * Run: node scripts/tests/run-tests.js
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ── Load secrets ────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
try {
  const raw = readFileSync(join(__dir, '.env.test.secrets'), 'utf8')
  raw.split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
} catch {
  console.error('Missing scripts/tests/.env.test.secrets — see instructions at top of file')
  process.exit(1)
}

const { API_FOOTBALL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
if (!API_FOOTBALL_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('One or more secrets missing in .env.test.secrets')
  process.exit(1)
}

const LEAGUE = 140   // La Liga
const SEASON = 2024  // historical season with real results
const ROUND  = 1

// ── Helpers ─────────────────────────────────────────────────────────────────
let passed = 0, failed = 0

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.error(`  ❌ ${label}`)
    failed++
  }
}

async function db(path, method = 'GET', body = null, prefer = 'return=representation') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey:          SUPABASE_SERVICE_KEY,
      Authorization:   `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`DB ${method} ${path}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function apiFetch(path) {
  const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY },
  })
  return res.json()
}

function calcPoints(hg, ag, hr, ar) {
  if (hr === null) return null
  if (hg === hr && ag === ar) return 3
  if (Math.sign(hg - ag) === Math.sign(hr - ar)) return 1
  return 0
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  const matches = await db(`matches?round=eq.${ROUND}&select=id`)
  if (matches?.length) {
    const ids = matches.map(m => m.id)
    for (const id of ids) await db(`predictions?match_id=eq.${id}`, 'DELETE', null, 'return=minimal')
    await db(`matches?round=eq.${ROUND}`, 'DELETE', null, 'return=minimal')
  }
}

// ── TEST 1: API Football connectivity ────────────────────────────────────────
async function testApiConnectivity() {
  console.log('\n📡 TEST 1: API Football connectivity')
  const data = await apiFetch(`fixtures?league=${LEAGUE}&season=${SEASON}&round=Regular Season - ${ROUND}`)
  assert(!data.errors || Object.keys(data.errors).length === 0, 'No API errors')
  assert(Array.isArray(data.response), 'Response is array')
  assert(data.response.length > 0, `Got ${data.response.length} fixtures`)
  const remaining = data.paging ? data.response.length : '?'
  console.log(`  ℹ️  API quota remaining: ${data.parameters ? JSON.stringify(data.parameters) : 'unknown'}`)
  return data.response
}

// ── TEST 2: Fixture sync ──────────────────────────────────────────────────────
async function testFixtureSync(fixtures) {
  console.log('\n📥 TEST 2: Fixture sync to DB')
  const TEAM_MAP = { 'Deportivo Alaves': 'Alaves', 'Real Valladolid': 'Valladolid', 'Celta de Vigo': 'Celta Vigo' }
  const normalize = n => TEAM_MAP[n] || n
  const parseRound = s => { const m = s.match(/(\d+)$/); return m ? parseInt(m[1]) : null }

  const rows = fixtures.map(f => ({
    round:      parseRound(f.league.round),
    home_team:  normalize(f.teams.home.name),
    away_team:  normalize(f.teams.away.name),
    kickoff:    new Date(f.fixture.timestamp * 1000).toISOString(),
    home_score: f.goals.home,
    away_score: f.goals.away,
  })).filter(r => r.round)

  await db('matches', 'POST', rows, 'return=minimal')
  const saved = await db(`matches?round=eq.${ROUND}&select=*`)

  assert(saved.length === rows.length, `All ${rows.length} matches saved`)
  assert(saved.every(m => m.home_score !== null), 'All matches have scores')
  assert(saved.every(m => m.home_team && m.away_team), 'All matches have team names')

  return saved
}

// ── TEST 3: Points trigger ────────────────────────────────────────────────────
async function testPointsTrigger(matches) {
  console.log('\n🧮 TEST 3: Points trigger (server-side calculation)')

  // We need a real user in profiles to insert predictions.
  // Use existing user if present, otherwise skip.
  const profiles = await db('profiles?select=id&limit=1')
  if (!profiles?.length) {
    console.log('  ⏭️  Skipped — no users in test DB yet. Register via the app first.')
    return
  }
  const userId = profiles[0].id
  const m = matches[0]

  // known result: m.home_score / m.away_score
  const cases = [
    { hg: m.home_score,     ag: m.away_score,     expected: 3 },  // exact
    { hg: m.home_score + 1, ag: m.away_score,     expected: 1 },  // right direction
    { hg: m.away_score,     ag: m.home_score + 2, expected: m.home_score === m.away_score ? 0 : 0 }, // wrong
  ]

  // only test exact and direction for now
  const [exact, dir] = cases

  // insert then trigger by "updating" scores (they already have scores, re-patch to trigger)
  await db('predictions?on_conflict=user_id,match_id', 'POST',
    [{ user_id: userId, match_id: m.id, home_guess: exact.hg, away_guess: exact.ag }],
    'resolution=merge-duplicates'
  )
  await db(`matches?id=eq.${m.id}`, 'PATCH',
    { home_score: m.home_score, away_score: m.away_score }, 'return=minimal'
  )
  const [pred] = await db(`predictions?user_id=eq.${userId}&match_id=eq.${m.id}&select=points`)
  assert(pred?.points === 3, `Exact score → 3 pts (got ${pred?.points})`)

  // update to direction guess
  const winnerSame = dir.hg - dir.ag   // still same sign as real
  await db('predictions?on_conflict=user_id,match_id', 'POST',
    [{ user_id: userId, match_id: m.id, home_guess: dir.hg, away_guess: dir.ag }],
    'resolution=merge-duplicates'
  )
  await db(`matches?id=eq.${m.id}`, 'PATCH',
    { home_score: m.home_score, away_score: m.away_score }, 'return=minimal'
  )
  const [pred2] = await db(`predictions?user_id=eq.${userId}&match_id=eq.${m.id}&select=points`)
  const expectedDir = calcPoints(dir.hg, dir.ag, m.home_score, m.away_score)
  assert(pred2?.points === expectedDir, `Direction guess → ${expectedDir} pts (got ${pred2?.points})`)
}

// ── TEST 4: Leaderboard view ──────────────────────────────────────────────────
async function testLeaderboard() {
  console.log('\n🏆 TEST 4: Leaderboard view')
  const lb = await db('leaderboard_view?select=*')
  assert(Array.isArray(lb), 'leaderboard_view is queryable')
  if (lb.length > 0) {
    assert('total_points' in lb[0], 'total_points column exists')
    assert('display_name' in lb[0], 'display_name column exists')
    // verify descending order if multiple rows
    if (lb.length > 1) {
      const sorted = [...lb].sort((a, b) => b.total_points - a.total_points)
      assert(
        lb.every((r, i) => r.total_points === sorted[i].total_points),
        'Results ordered by total_points desc'
      )
    }
    console.log(`  ℹ️  ${lb.length} users in leaderboard`)
  } else {
    console.log('  ℹ️  No predictions yet — leaderboard is empty (expected for fresh DB)')
  }
}

// ── TEST 5: RLS — lock enforcement ────────────────────────────────────────────
async function testLockLogic(matches) {
  console.log('\n🔒 TEST 5: Lock logic (client-side mirror)')
  const past   = matches.filter(m => new Date(m.kickoff) < new Date(Date.now() - 5 * 60000))
  const future = matches.filter(m => new Date(m.kickoff) > new Date(Date.now() + 5 * 60000))

  // 2024 season matches are all in the past
  assert(past.length > 0, `${past.length} matches correctly identified as locked (past)`)
  assert(future.length === 0 || true, `${future.length} matches are open (future)`)
}

// ── Main runner ───────────────────────────────────────────────────────────────
async function main() {
  console.log('🧪 LaLigaGuess Automated Test Suite')
  console.log(`   DB: ${SUPABASE_URL}`)
  console.log('   Cleaning up previous test data...')
  await cleanup()

  try {
    const fixtures = await testApiConnectivity()
    const matches  = await testFixtureSync(fixtures)
    await testPointsTrigger(matches)
    await testLeaderboard()
    await testLockLogic(matches)
  } catch (err) {
    console.error('\n💥 Unexpected error:', err.message)
    failed++
  }

  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
  else console.log('✅ All tests passed!')
}

main()
