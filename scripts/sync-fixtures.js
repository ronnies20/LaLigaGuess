const { FOOTBALL_DATA_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

const BASE_URL  = 'https://api.football-data.org/v4'
const COMP      = 'PD'   // La Liga
const SEASON    = 2026   // 2026/27

const TEAM_MAP = {
  'Athletic Club':                  'Athletic Club',
  'Club Atlético de Madrid':        'Atletico Madrid',
  'FC Barcelona':                   'Barcelona',
  'Real Madrid CF':                 'Real Madrid',
  'Sevilla FC':                     'Sevilla',
  'Valencia CF':                    'Valencia',
  'Villarreal CF':                  'Villarreal',
  'Real Betis Balompié':            'Real Betis',
  'Real Sociedad de Fútbol':        'Real Sociedad',
  'CA Osasuna':                     'Osasuna',
  'Getafe CF':                      'Getafe',
  'Rayo Vallecano de Madrid':       'Rayo Vallecano',
  'RC Celta de Vigo':               'Celta Vigo',
  'Celta de Vigo':                  'Celta Vigo',
  'RCD Mallorca':                   'Mallorca',
  'UD Las Palmas':                  'Las Palmas',
  'Girona FC':                      'Girona',
  'RCD Espanyol de Barcelona':      'Espanyol',
  'Deportivo Alavés':               'Alaves',
  'CD Leganés':                     'Leganes',
  'Real Valladolid CF':             'Valladolid',
  'Real Valladolid':                'Valladolid',
}

function normalize(name) {
  return TEAM_MAP[name] || name
}

async function main() {
  const res = await fetch(
    `${BASE_URL}/competitions/${COMP}/matches?season=${SEASON}`,
    { headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY } }
  )

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)

  const json = await res.json()
  const matches = json.matches || []

  if (!matches.length) return console.log('No fixtures found')

  console.log(`Found ${matches.length} total fixtures`)

  const rows = matches
    .filter(m => ['SCHEDULED', 'TIMED'].includes(m.status))
    .map(m => ({
      external_id: m.id,
      round:       m.matchday,
      home_team:   normalize(m.homeTeam.name),
      away_team:   normalize(m.awayTeam.name),
      kickoff:     m.utcDate,
    }))
    .filter(r => r.round)

  console.log(`Upserting ${rows.length} fixtures`)

  const upsert = await fetch(`${SUPABASE_URL}/rest/v1/matches?on_conflict=external_id`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })

  if (!upsert.ok) throw new Error(await upsert.text())
  console.log('Fixtures synced successfully')
}

main().catch(e => { console.error(e); process.exit(1) })
