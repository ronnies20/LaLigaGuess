/**
 * Closes a round: fills missing predictions (like CAT would), then sets random results.
 * Triggers on_match_result → calculates points for all predictions.
 *
 * Usage: node scripts/tests/close-round.js <round>
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

const round = parseInt(process.argv[2])
if (!round) { console.error('Usage: node close-round.js <round>'); process.exit(1) }

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

function randGoals() {
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

async function main() {
  const matches = await get(`/matches?round=eq.${round}&select=id,home_team,away_team`)
  if (!matches.length) { console.error(`No matches found for round ${round}`); process.exit(1) }

  // 1. Fill missing predictions (same pick per match for all missing users — like CAT)
  const profiles  = await get('/profiles?select=id,display_name')
  const matchIds  = matches.map(m => m.id).join(',')
  const existing  = await get(`/predictions?match_id=in.(${matchIds})&select=user_id,match_id`)
  const existingSet = new Set(existing.map(p => `${p.user_id}:${p.match_id}`))

  const matchPred = {}
  for (const m of matches) {
    matchPred[m.id] = { home_guess: randGoals(), away_guess: randGoals() }
  }

  const missing = []
  for (const user of profiles) {
    for (const match of matches) {
      if (!existingSet.has(`${user.id}:${match.id}`)) {
        missing.push({ user_id: user.id, match_id: match.id, ...matchPred[match.id] })
      }
    }
  }

  if (missing.length) {
    console.log(`Filling ${missing.length} missing predictions...`)
    for (let i = 0; i < missing.length; i += 50) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify(missing.slice(i, i + 50)),
      })
      if (!res.ok) console.error(await res.text())
    }
  } else {
    console.log('All predictions already filled')
  }

  // 2. Set random results (triggers point calculation)
  console.log(`\nSetting results for round ${round}:`)
  for (const m of matches) {
    const home_score = randGoals()
    const away_score = randGoals()
    const upd = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${m.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ home_score, away_score }),
    })
    if (!upd.ok) { console.error(`  Error: ${await upd.text()}`); continue }
    console.log(`  ${m.home_team} ${home_score}-${away_score} ${m.away_team}`)
  }

  console.log(`\nRound ${round} closed.`)
}

main().catch(e => { console.error(e); process.exit(1) })
