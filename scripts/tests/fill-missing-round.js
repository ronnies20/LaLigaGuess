/**
 * Fills missing predictions for a round for ALL users (same pick per match).
 * Use before closing a round to ensure nobody has empty slots.
 * Points are calculated inline if match already has results.
 *
 * Usage: node scripts/tests/fill-missing-round.js <round>
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
const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

const round = parseInt(process.argv[2])
if (!round) { console.error('Usage: node fill-missing-round.js <round>'); process.exit(1) }

function randGoals() {
  const r = Math.random() * 100
  if (r < 15) return 0
  if (r < 50) return 1
  if (r < 80) return 2
  return 3
}

function calcPoints(hg, ag, hs, as_) {
  if (hs === null || hs === undefined) return null
  if (hg === hs && ag === as_) return 3
  if (Math.sign(hg - ag) === Math.sign(hs - as_)) return 1
  return 0
}

async function get(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function main() {
  const matches  = await get(`/matches?round=eq.${round}&select=id,home_team,away_team,home_score,away_score`)
  const profiles = await get('/profiles?select=id,display_name')
  const matchIds = matches.map(m => m.id).join(',')
  const existing = await get(`/predictions?match_id=in.(${matchIds})&select=user_id,match_id`)
  const existingSet = new Set(existing.map(p => `${p.user_id}:${p.match_id}`))

  // One random pick per match for all missing slots
  const matchPred = {}
  for (const m of matches) {
    matchPred[m.id] = { home_guess: randGoals(), away_guess: randGoals() }
  }

  const rows = []
  for (const user of profiles) {
    for (const m of matches) {
      if (!existingSet.has(`${user.id}:${m.id}`)) {
        const { home_guess, away_guess } = matchPred[m.id]
        const points = calcPoints(home_guess, away_guess, m.home_score, m.away_score)
        rows.push({ user_id: user.id, match_id: m.id, home_guess, away_guess, points })
      }
    }
  }

  if (!rows.length) { console.log('No missing predictions.'); return }

  console.log(`Filling ${rows.length} missing predictions for round ${round}...`)
  for (let i = 0; i < rows.length; i += 50) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(rows.slice(i, i + 50)),
    })
    if (!res.ok) console.error(await res.text())
  }

  // List who was missing
  const missing = [...new Set(rows.map(r => profiles.find(p => p.id === r.user_id)?.display_name))]
  console.log(`Filled for: ${missing.join(', ')}`)
}

main().catch(e => { console.error(e); process.exit(1) })
