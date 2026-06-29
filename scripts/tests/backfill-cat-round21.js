/**
 * Backfills CAT predictions for round 21 (added after original seed).
 * Uses same random logic: one prediction per match for all missing users.
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
const CAT_USER_ID = 'c47c47c4-7c47-4c47-8c47-c47c47c47c47'

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

function score() {
  const r = Math.random() * 100
  if (r < 15) return 0
  if (r < 50) return 1
  if (r < 80) return 2
  return 3
}

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?round=eq.21&select=id,home_team,away_team,home_score,away_score`, { headers })
  const matches = await res.json()

  const rows = matches.map(m => {
    const home_guess = score()
    const away_guess = score()
    // Calculate points inline (trigger won't fire on insert for already-scored matches)
    let points = null
    if (m.home_score !== null) {
      if (home_guess === m.home_score && away_guess === m.away_score) points = 3
      else if (Math.sign(home_guess - away_guess) === Math.sign(m.home_score - m.away_score)) points = 1
      else points = 0
    }
    console.log(`  ${m.home_team} ${home_guess}-${away_guess} ${m.away_team}  →  ${points ?? '?'} pts`)
    return { user_id: CAT_USER_ID, match_id: m.id, home_guess, away_guess, points }
  })

  const ins = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify(rows),
  })
  if (!ins.ok) { console.error(await ins.text()); process.exit(1) }
  console.log(`\nCAT backfilled ${rows.length} predictions for round 21.`)
}

main().catch(e => { console.error(e); process.exit(1) })
