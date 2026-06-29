import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dir = dirname(fileURLToPath(import.meta.url))
const raw = readFileSync(join(__dir, '.env.test.secrets'), 'utf8')
raw.split('\n').forEach(line => { const [k,...v]=line.split('='); if(k?.trim()) process.env[k.trim()]=v.join('=').trim() })
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' }

const RESULTS = {
  'Celta Vigo':      { h:1, a:2 },
  'Getafe':          { h:0, a:1 },
  'Alaves':          { h:1, a:0 },
  'Real Sociedad':   { h:2, a:2 },
  'Mallorca':        { h:1, a:1 },
  'Girona':          { h:2, a:0 },
  'Las Palmas':      { h:1, a:1 },
  'Rayo Vallecano':  { h:0, a:2 },
  'Leganes':         { h:1, a:0 },
  'Real Madrid':     { h:4, a:1 },
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?round=eq.25&select=id,home_team,away_team`, { headers })
const matches = await res.json()
console.log(`Closing round 25 — ${matches.length} matches`)
for (const m of matches) {
  const r = RESULTS[m.home_team]
  if (!r) { console.warn(`  No result for ${m.home_team}`); continue }
  const upd = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${m.id}`, {
    method: 'PATCH', headers, body: JSON.stringify({ home_score: r.h, away_score: r.a }),
  })
  if (!upd.ok) console.error(`  Error: ${await upd.text()}`)
  else console.log(`  ✓ ${m.home_team} ${r.h}-${r.a} ${m.away_team}`)
}
console.log('\nRound 25 closed.')
