const { API_FOOTBALL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

const LEAGUE = 140  // La Liga
const SEASON = 2025

const TEAM_MAP = {
  'Deportivo Alaves': 'Alaves',
  'Real Valladolid': 'Valladolid',
  'Celta de Vigo': 'Celta Vigo',
}

function normalize(name) {
  return TEAM_MAP[name] || name
}

function parseRound(str) {
  const m = str.match(/(\d+)$/)
  return m ? parseInt(m[1]) : null
}

async function main() {
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?league=${LEAGUE}&season=${SEASON}`,
    { headers: { 'x-apisports-key': API_FOOTBALL_KEY } }
  )
  const { response } = await res.json()

  if (!response?.length) return console.log('No fixtures found')

  console.log(`API returned ${response.length} total fixtures (season ${SEASON})`)

  const rows = response
    .filter(f => f.fixture.status.short === 'NS')
    .map(f => ({
      external_id: f.fixture.id,
      round: parseRound(f.league.round),
      home_team: normalize(f.teams.home.name),
      away_team: normalize(f.teams.away.name),
      kickoff: new Date(f.fixture.timestamp * 1000).toISOString(),
    }))
    .filter(r => r.round)

  console.log(`Upserting ${rows.length} fixtures`)

  const upsert = await fetch(`${SUPABASE_URL}/rest/v1/matches?on_conflict=external_id`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })

  if (!upsert.ok) throw new Error(await upsert.text())
  console.log('Fixtures synced successfully')
}

main().catch(e => { console.error(e); process.exit(1) })
