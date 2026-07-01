const { API_FOOTBALL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

const LEAGUE = 140  // La Liga
const SEASON = 2026

function shouldRun() {
  const now = new Date()
  const day  = now.getUTCDay()   // 0=Sun 1=Mon 5=Fri 6=Sat
  const hour = now.getUTCHours()
  const min  = now.getUTCMinutes()

  // Israel match windows (UTC = Israel - 3):
  // Fri/Mon 21:00-24:00 IST = 18:00-21:00 UTC
  // Sat/Sun 14:00-24:00 IST = 11:00-21:00 UTC
  const inMatchWindow =
    ([5, 1].includes(day) && hour >= 18 && hour < 21) ||
    ([0, 6].includes(day) && hour >= 11 && hour < 21)

  if (inMatchWindow) return true
  return min === 0 || min === 30  // outside match window: every 30 min
}

async function main() {
  if (!shouldRun()) return console.log('Outside match window — skipping')
  const from = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to = new Date().toISOString().split('T')[0]

  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?league=${LEAGUE}&season=${SEASON}&from=${from}&to=${to}&status=FT`,
    { headers: { 'x-apisports-key': API_FOOTBALL_KEY } }
  )
  const { response } = await res.json()

  if (!response?.length) return console.log('No finished matches')

  console.log(`Updating ${response.length} results`)

  for (const f of response) {
    const update = await fetch(
      `${SUPABASE_URL}/rest/v1/matches?external_id=eq.${f.fixture.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          home_score: f.goals.home,
          away_score: f.goals.away,
        }),
      }
    )
    if (!update.ok) {
      console.error(`Failed ${f.fixture.id}: ${await update.text()}`)
    } else {
      console.log(`${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name}`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
