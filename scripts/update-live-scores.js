import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const API_KEY  = process.env.API_FOOTBALL_KEY
const HEADERS  = { 'x-apisports-key': API_KEY }
const BASE_URL = 'https://v3.football.api-sports.io'

const LIVE_STATUSES     = ['1H','HT','2H','ET','BT','P','INT']
const FINISHED_STATUSES = ['FT','AET','PEN']
const REAL_MADRID_ID    = 541

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
    .select('external_id, home_team, away_team, score_90')
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

    const homeExtId = f.teams?.home?.id
    const awayExtId = f.teams?.away?.id
    const isRMMatch   = homeExtId === REAL_MADRID_ID || awayExtId === REAL_MADRID_ID
    const isActive    = LIVE_STATUSES.includes(status) || FINISHED_STATUSES.includes(status)
    const isFinished  = FINISHED_STATUSES.includes(status)
    const dbMatch     = activeMatches.find(m => m.external_id === extId)
    const needsScore90 = isFinished && dbMatch && dbMatch.score_90 === null

    if ((isRMMatch && isActive) || needsScore90) {
      try {
        const events = await api(`/fixtures/events?fixture=${extId}`)

        // ── Real Madrid penalties ────────────────────────────────
        if (isRMMatch && isActive) {
          const scored = events.filter(e =>
            e.team?.id === REAL_MADRID_ID && (
              (e.type === 'Goal' && (e.detail === 'Penalty' || e.detail === 'Missed Penalty')) ||
              (e.type === 'Miss' && e.detail === 'Missed Penalty')
            )
          )
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
          if (penalties.length > 0) update.penalty_minute = penalties[0].e
        }

        // ── score_90: score before 90+ injury-time goals ─────────
        if (needsScore90) {
          const finalHome = f.goals?.home ?? 0
          const finalAway = f.goals?.away ?? 0

          // A late goal is a Goal event in 2nd-half injury time:
          // elapsed=90 with extra set (90+1, 90+2…) or elapsed>90
          const lateGoals = events.filter(e =>
            e.type === 'Goal' &&
            e.detail !== 'Missed Penalty' &&
            (e.time?.elapsed > 90 || (e.time?.elapsed >= 90 && e.time?.extra != null))
          )

          let s90h = finalHome, s90a = finalAway
          for (const g of lateGoals) {
            const isOwnGoal  = g.detail === 'Own Goal'
            const scorerTeam = g.team?.id
            // Regular goal: scorer's side; Own goal: benefit went to OTHER side
            if (!isOwnGoal) {
              if (scorerTeam === homeExtId) s90h = Math.max(0, s90h - 1)
              else                          s90a = Math.max(0, s90a - 1)
            } else {
              if (scorerTeam === homeExtId) s90a = Math.max(0, s90a - 1)
              else                          s90h = Math.max(0, s90h - 1)
            }
          }

          update.score_90 = { home: s90h, away: s90a }
          if (lateGoals.length > 0) {
            console.log(`  ⏱ score_90 ${s90h}:${s90a} (${lateGoals.length} late goal(s), final ${finalHome}:${finalAway})`)
          }
        }
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
