/**
 * Adds rounds 22-25 to test DB with future kickoff times.
 * Fills predictions for all users except FRIEREN (same prediction per match).
 * Run: node scripts/tests/seed-rounds-22-25.js
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

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

const FIXTURES = [
  // Round 22 — Jul 5-7 2026
  { round:22, home:'Real Madrid',     away:'Celta Vigo',      kickoff:'2026-07-05 20:00:00+03' },
  { round:22, home:'Barcelona',       away:'Getafe',          kickoff:'2026-07-05 22:30:00+03' },
  { round:22, home:'Atletico Madrid', away:'Alaves',          kickoff:'2026-07-06 20:00:00+03' },
  { round:22, home:'Sevilla',         away:'Real Sociedad',   kickoff:'2026-07-06 22:30:00+03' },
  { round:22, home:'Real Betis',      away:'Mallorca',        kickoff:'2026-07-06 18:30:00+03' },
  { round:22, home:'Valencia',        away:'Girona',          kickoff:'2026-07-07 18:30:00+03' },
  { round:22, home:'Villarreal',      away:'Osasuna',         kickoff:'2026-07-07 20:00:00+03' },
  { round:22, home:'Athletic Club',   away:'Las Palmas',      kickoff:'2026-07-07 20:00:00+03' },
  { round:22, home:'Rayo Vallecano',  away:'Leganes',         kickoff:'2026-07-07 22:30:00+03' },
  { round:22, home:'Espanyol',        away:'Valladolid',      kickoff:'2026-07-07 22:30:00+03' },
  // Round 23 — Jul 12-14 2026
  { round:23, home:'Celta Vigo',      away:'Sevilla',         kickoff:'2026-07-12 20:00:00+03' },
  { round:23, home:'Getafe',          away:'Real Betis',      kickoff:'2026-07-12 22:30:00+03' },
  { round:23, home:'Alaves',          away:'Valencia',        kickoff:'2026-07-13 18:30:00+03' },
  { round:23, home:'Real Sociedad',   away:'Villarreal',      kickoff:'2026-07-13 20:00:00+03' },
  { round:23, home:'Mallorca',        away:'Athletic Club',   kickoff:'2026-07-13 22:30:00+03' },
  { round:23, home:'Girona',          away:'Rayo Vallecano',  kickoff:'2026-07-14 18:30:00+03' },
  { round:23, home:'Osasuna',         away:'Espanyol',        kickoff:'2026-07-14 20:00:00+03' },
  { round:23, home:'Las Palmas',      away:'Real Madrid',     kickoff:'2026-07-14 20:00:00+03' },
  { round:23, home:'Leganes',         away:'Barcelona',       kickoff:'2026-07-14 22:30:00+03' },
  { round:23, home:'Valladolid',      away:'Atletico Madrid', kickoff:'2026-07-14 22:30:00+03' },
  // Round 24 — Jul 19-21 2026
  { round:24, home:'Real Madrid',     away:'Girona',          kickoff:'2026-07-19 20:00:00+03' },
  { round:24, home:'Barcelona',       away:'Osasuna',         kickoff:'2026-07-19 22:30:00+03' },
  { round:24, home:'Atletico Madrid', away:'Athletic Club',   kickoff:'2026-07-20 18:30:00+03' },
  { round:24, home:'Sevilla',         away:'Rayo Vallecano',  kickoff:'2026-07-20 20:00:00+03' },
  { round:24, home:'Real Betis',      away:'Leganes',         kickoff:'2026-07-20 22:30:00+03' },
  { round:24, home:'Valencia',        away:'Las Palmas',      kickoff:'2026-07-21 18:30:00+03' },
  { round:24, home:'Villarreal',      away:'Valladolid',      kickoff:'2026-07-21 20:00:00+03' },
  { round:24, home:'Real Sociedad',   away:'Celta Vigo',      kickoff:'2026-07-21 20:00:00+03' },
  { round:24, home:'Mallorca',        away:'Alaves',          kickoff:'2026-07-21 22:30:00+03' },
  { round:24, home:'Espanyol',        away:'Getafe',          kickoff:'2026-07-21 22:30:00+03' },
  // Round 25 — Jul 26-28 2026
  { round:25, home:'Celta Vigo',      away:'Barcelona',       kickoff:'2026-07-26 20:00:00+03' },
  { round:25, home:'Getafe',          away:'Atletico Madrid', kickoff:'2026-07-26 22:30:00+03' },
  { round:25, home:'Alaves',          away:'Sevilla',         kickoff:'2026-07-27 18:30:00+03' },
  { round:25, home:'Real Sociedad',   away:'Real Betis',      kickoff:'2026-07-27 20:00:00+03' },
  { round:25, home:'Mallorca',        away:'Valencia',        kickoff:'2026-07-27 22:30:00+03' },
  { round:25, home:'Girona',          away:'Villarreal',      kickoff:'2026-07-28 18:30:00+03' },
  { round:25, home:'Las Palmas',      away:'Osasuna',         kickoff:'2026-07-28 20:00:00+03' },
  { round:25, home:'Rayo Vallecano',  away:'Athletic Club',   kickoff:'2026-07-28 20:00:00+03' },
  { round:25, home:'Leganes',         away:'Espanyol',        kickoff:'2026-07-28 22:30:00+03' },
  { round:25, home:'Real Madrid',     away:'Valladolid',      kickoff:'2026-07-28 22:30:00+03' },
]

// Weighted: 0=15% 1=35% 2=30% 3=20%
function randomGoals() {
  const r = Math.random() * 100
  if (r < 15) return 0
  if (r < 50) return 1
  if (r < 80) return 2
  return 3
}

async function get(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function post(path, body, prefer = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: prefer ? { ...headers, Prefer: prefer } : headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function del(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { method: 'DELETE', headers })
  if (!res.ok) throw new Error(await res.text())
}

async function main() {
  // 0. Clean up any existing rounds 22-25 (idempotent)
  await del('/matches?round=gte.22&round=lte.25')
  console.log('Cleaned existing rounds 22-25')

  // 1. Insert matches
  await post('/matches', FIXTURES.map(f => ({
    round: f.round, home_team: f.home, away_team: f.away, kickoff: f.kickoff,
  })), 'resolution=ignore-duplicates')
  console.log(`Inserted ${FIXTURES.length} matches`)

  // 2. Fetch inserted match IDs
  const matches = await get('/matches?round=gte.22&round=lte.25&select=id,round&order=kickoff')
  console.log(`Found ${matches.length} matches in rounds 22-25`)

  // 3. All users except FRIEREN
  const profiles = await get('/profiles?display_name=neq.FRIEREN&select=id,display_name')
  console.log(`Players: ${profiles.map(p => p.display_name).join(', ')}`)

  // 4. One random prediction per match — same for all users (CAT's pick)
  const matchPred = {}
  for (const m of matches) {
    matchPred[m.id] = { home_guess: randomGoals(), away_guess: randomGoals() }
  }

  // 5. Build rows
  const rows = []
  for (const user of profiles) {
    for (const match of matches) {
      rows.push({ user_id: user.id, match_id: match.id, ...matchPred[match.id] })
    }
  }

  // 6. Insert in batches
  console.log(`Inserting ${rows.length} predictions...`)
  for (let i = 0; i < rows.length; i += 50) {
    await post('/predictions', rows.slice(i, i + 50), 'resolution=ignore-duplicates')
  }

  console.log('Done! Rounds 22-25 ready.')
}

main().catch(e => { console.error(e); process.exit(1) })
