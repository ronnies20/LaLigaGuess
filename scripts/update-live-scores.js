const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const API_KEY  = process.env.API_FOOTBALL_KEY
const HEADERS  = { 'x-apisports-key': API_KEY }
const BASE_URL = 'https://v3.football.api-sports.io'

const LIVE_STATUSES     = ['1H','HT','2H','ET','BT','P','INT']
const FINISHED_STATUSES = ['FT','AET','PEN']
const REAL_MADRID_ID    = 541  // API-Football team id

async function api(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length) {
    console.warn('API errors:', json.errors)
  }
  return json.response || []
}

async function getActiveMatchIds() {
  const now = new Date()
  const windowStart = new Date(now - 3 * 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now + 30 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('matches')
    .select('external_id, home_team, away_team')
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

  const externalIds = activeMatches.map(m => m.external_id).join('-')
  const fixtures = await api(`/fixtures?ids=${externalIds}`)
  console.log(`Fetched ${fixtures.length} fixtures`)

  for (const f of fixtures) {
    const extId  = f.fixture?.id
    const status = f.fixture?.status?.short
    const home   = f.goals?.home
    const away   = f.goals?.away

    if (!extId) continue

    const update = { status: status || 'NS' }

    if (home !== null && home !== undefined && away !== null && away !== undefined) {
      update.home_score = home
      update.away_score = away
    }

    // Real Madrid penalty detection (only for live/finished RM matches)
    const isRMMatch = f.teams?.home?.id === REAL_MADRID_ID || f.teams?.away?.id === REAL_MADRID_ID
    const isActive  = LIVE_STATUSES.includes(status) || FINISHED_STATUSES.includes(status)

    if (isRMMatch && isActive) {
      try {
        const events = await api(`/fixtures/events?fixture=${extId}`)

        // All Real Madrid penalties (scored OR missed — points awarded regardless of outcome)
        // api-football: scored → type:"Goal" detail:"Penalty"
        //               missed → type:"Goal" detail:"Missed Penalty"  OR  type:"Miss"
        const scored = events.filter(e =>
          e.team?.id === REAL_MADRID_ID && (
            (e.type === 'Goal' && (e.detail === 'Penalty' || e.detail === 'Missed Penalty')) ||
            (e.type === 'Miss' && e.detail === 'Missed Penalty')
          )
        )

        // De-duplicate by elapsed+extra (guards against API duplicate events;
        // retaken penalties appear as Missed then Scored — Scored fires only once)
        const seen = new Set()
        const penalties = []
        for (const pen of scored) {
          const key = `${pen.time?.elapsed}-${pen.time?.extra ?? ''}`
          if (!seen.has(key)) {
            seen.add(key)
            penalties.push({ e: pen.time?.elapsed, x: pen.time?.extra ?? null })
          }
        }

        update.penalty_events = JSON.stringify(penalties)
        // Keep penalty_minute (first scored) for backward compat
        if (penalties.length > 0) update.penalty_minute = penalties[0].e
      } catch (e) {
        console.warn(`Could not fetch events for ${extId}:`, e.message)
      }
    }

    const { error } = await supabase
      .from('matches')
      .update(update)
      .eq('external_id', extId)

    if (error) console.error(`Error updating ${extId}:`, error.message)
    else console.log(`Updated ${extId}: ${home}:${away} [${status}]`)
  }

  console.log('Done', new Date().toISOString())
}

main().catch(err => { console.error(err); process.exit(1) })
