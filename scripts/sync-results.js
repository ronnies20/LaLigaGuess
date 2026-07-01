const { FOOTBALL_DATA_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

const BASE_URL = 'https://api.football-data.org/v4'
const COMP     = 'PD'
const SEASON   = 2026

function shouldRun() {
  const now  = new Date()
  const day  = now.getUTCDay()
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
  const to   = new Date().toISOString().split('T')[0]

  const res = await fetch(
    `${BASE_URL}/competitions/${COMP}/matches?season=${SEASON}&status=FINISHED&dateFrom=${from}&dateTo=${to}`,
    { headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY } }
  )

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)

  const json = await res.json()
  const matches = json.matches || []

  if (!matches.length) return console.log('No finished matches')

  console.log(`Updating ${matches.length} results`)

  for (const m of matches) {
    const update = await fetch(
      `${SUPABASE_URL}/rest/v1/matches?external_id=eq.${m.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey':        SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          home_score: m.score.fullTime.home,
          away_score: m.score.fullTime.away,
          status:     'FT',
        }),
      }
    )
    if (!update.ok) console.error(`Failed ${m.id}: ${await update.text()}`)
    else console.log(`${m.homeTeam.name} ${m.score.fullTime.home}-${m.score.fullTime.away} ${m.awayTeam.name}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
