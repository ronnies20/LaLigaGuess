/**
 * Sets predetermined results for round 22.
 * Run: node scripts/tests/close-round-22.js
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

const RESULTS = {
  'Real Madrid':     { away: 'Celta Vigo',     h: 2, a: 0 },
  'Barcelona':       { away: 'Getafe',          h: 3, a: 1 },
  'Atletico Madrid': { away: 'Alaves',          h: 1, a: 0 },
  'Sevilla':         { away: 'Real Sociedad',   h: 1, a: 1 },
  'Real Betis':      { away: 'Mallorca',        h: 2, a: 1 },
  'Valencia':        { away: 'Girona',          h: 0, a: 1 },
  'Villarreal':      { away: 'Osasuna',         h: 2, a: 2 },
  'Athletic Club':   { away: 'Las Palmas',      h: 3, a: 0 },
  'Rayo Vallecano':  { away: 'Leganes',         h: 1, a: 1 },
  'Espanyol':        { away: 'Valladolid',      h: 0, a: 2 },
}

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?round=eq.22&select=id,home_team,away_team`, { headers })
  const matches = await res.json()
  console.log(`Closing round 22 — ${matches.length} matches`)

  for (const m of matches) {
    const r = RESULTS[m.home_team]
    if (!r) { console.warn(`  No result defined for ${m.home_team}`); continue }
    const upd = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${m.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ home_score: r.h, away_score: r.a }),
    })
    if (!upd.ok) console.error(`  Error: ${await upd.text()}`)
    else console.log(`  ✓ ${m.home_team} ${r.h}-${r.a} ${m.away_team}`)
  }

  console.log('\nRound 22 closed. Points calculated via trigger.')
}

main().catch(e => { console.error(e); process.exit(1) })
