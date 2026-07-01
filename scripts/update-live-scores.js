import { createClient } from '@supabase/supabase-js'

const supabase          = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY
const BASE_URL          = 'https://api.football-data.org/v4'
const COMP              = 'PD'
const SEASON            = 2026

const STATUS_MAP = {
  'IN_PLAY':           '1H',
  'PAUSED':            'HT',
  'EXTRA_TIME':        'ET',
  'PENALTY_SHOOTOUT':  'P',
  'FINISHED':          'FT',
  'AWARDED':           'AET',
}

async function getActiveMatchIds() {
  const now         = new Date()
  const windowStart = new Date(now - 3 * 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now + 30 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('matches')
    .select('external_id')
    .not('external_id', 'is', null)
    .gte('kickoff', windowStart)
    .lte('kickoff', windowEnd)
  return data || []
}

async function main() {
  console.log('update-live-scores started', new Date().toISOString())

  const activeMatches = await getActiveMatchIds()
  if (!activeMatches.length) {
    console.log('No matches in active window — skipping API call')
    return
  }

  const from = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to   = new Date().toISOString().split('T')[0]

  const res = await fetch(
    `${BASE_URL}/competitions/${COMP}/matches?season=${SEASON}&dateFrom=${from}&dateTo=${to}`,
    { headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY } }
  )

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  const json     = await res.json()
  const fixtures = json.matches || []

  console.log(`Fetched ${fixtures.length} fixtures`)

  const activeIds = new Set(activeMatches.map(m => m.external_id))

  for (const f of fixtures) {
    if (!activeIds.has(f.id)) continue

    const status = STATUS_MAP[f.status] || f.status
    const home   = f.score?.fullTime?.home
    const away   = f.score?.fullTime?.away

    const update = { status }
    if (home !== null && home !== undefined && away !== null && away !== undefined) {
      update.home_score = home
      update.away_score = away
    }

    const { error } = await supabase
      .from('matches')
      .update(update)
      .eq('external_id', f.id)

    if (error) console.error(`Error updating ${f.id}:`, error.message)
    else console.log(`Updated ${f.id}: ${home}:${away} [${status}]`)
  }

  console.log('Done', new Date().toISOString())
}

main().catch(err => { console.error(err); process.exit(1) })
