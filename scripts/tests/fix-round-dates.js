/**
 * Shifts round 22-25 kickoff times from July to August/September 2026
 * to avoid collision with seeded round 20 dates (also July 2026).
 * Predictions and results are preserved.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dir = dirname(fileURLToPath(import.meta.url))
const raw = readFileSync(join(__dir, '.env.test.secrets'), 'utf8')
raw.split('\n').forEach(line => { const [k,...v]=line.split('='); if(k?.trim()) process.env[k.trim()]=v.join('=').trim() })
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' }

// New kickoff times — August/September 2026, well after seeded rounds
const NEW_KICKOFFS = {
  22: {
    'Real Madrid':     '2026-08-01 20:00:00+03',
    'Barcelona':       '2026-08-01 22:30:00+03',
    'Atletico Madrid': '2026-08-02 20:00:00+03',
    'Sevilla':         '2026-08-02 22:30:00+03',
    'Real Betis':      '2026-08-02 18:30:00+03',
    'Valencia':        '2026-08-03 18:30:00+03',
    'Villarreal':      '2026-08-03 20:00:00+03',
    'Athletic Club':   '2026-08-03 20:00:00+03',
    'Rayo Vallecano':  '2026-08-03 22:30:00+03',
    'Espanyol':        '2026-08-03 22:30:00+03',
  },
  23: {
    'Celta Vigo':    '2026-08-08 20:00:00+03',
    'Getafe':        '2026-08-08 22:30:00+03',
    'Alaves':        '2026-08-09 18:30:00+03',
    'Real Sociedad': '2026-08-09 20:00:00+03',
    'Mallorca':      '2026-08-09 22:30:00+03',
    'Girona':        '2026-08-10 18:30:00+03',
    'Osasuna':       '2026-08-10 20:00:00+03',
    'Las Palmas':    '2026-08-10 20:00:00+03',
    'Leganes':       '2026-08-10 22:30:00+03',
    'Valladolid':    '2026-08-10 22:30:00+03',
  },
  24: {
    'Real Madrid':     '2026-08-15 20:00:00+03',
    'Barcelona':       '2026-08-15 22:30:00+03',
    'Atletico Madrid': '2026-08-16 18:30:00+03',
    'Sevilla':         '2026-08-16 20:00:00+03',
    'Real Betis':      '2026-08-16 22:30:00+03',
    'Valencia':        '2026-08-17 18:30:00+03',
    'Villarreal':      '2026-08-17 20:00:00+03',
    'Real Sociedad':   '2026-08-17 20:00:00+03',
    'Mallorca':        '2026-08-17 22:30:00+03',
    'Espanyol':        '2026-08-17 22:30:00+03',
  },
  25: {
    'Celta Vigo':    '2026-08-22 20:00:00+03',
    'Getafe':        '2026-08-22 22:30:00+03',
    'Alaves':        '2026-08-23 18:30:00+03',
    'Real Sociedad': '2026-08-23 20:00:00+03',
    'Mallorca':      '2026-08-23 22:30:00+03',
    'Girona':        '2026-08-24 18:30:00+03',
    'Las Palmas':    '2026-08-24 20:00:00+03',
    'Rayo Vallecano':'2026-08-24 20:00:00+03',
    'Leganes':       '2026-08-24 22:30:00+03',
    'Real Madrid':   '2026-08-24 22:30:00+03',
  },
}

for (const [round, teams] of Object.entries(NEW_KICKOFFS)) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?round=eq.${round}&select=id,home_team`, { headers })
  const matches = await res.json()
  for (const m of matches) {
    const kickoff = teams[m.home_team]
    if (!kickoff) { console.warn(`No new kickoff for R${round} ${m.home_team}`); continue }
    const upd = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${m.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ kickoff }),
    })
    if (!upd.ok) console.error(`Error: ${await upd.text()}`)
    else console.log(`  R${round} ${m.home_team} → ${kickoff}`)
  }
}
console.log('\nDone — rounds 22-25 shifted to Aug/Sep 2026.')
