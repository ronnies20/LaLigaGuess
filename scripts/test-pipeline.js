/**
 * Pipeline test using La Liga 2024 season (real historical data).
 * Pulls round 1 fixtures + results → upserts to Supabase → prints summary.
 * Run: node scripts/test-pipeline.js
 * Clean up after: node scripts/test-pipeline.js --cleanup
 */

const { API_FOOTBALL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

const LEAGUE  = 140   // La Liga
const SEASON  = 2024  // historical — has real results
const ROUND   = 1

const TEAM_MAP = {
  'Deportivo Alaves': 'Alaves',
  'Real Valladolid':  'Valladolid',
  'Celta de Vigo':    'Celta Vigo',
}
function normalize(name) { return TEAM_MAP[name] || name }
function parseRound(str)  { const m = str.match(/(\d+)$/); return m ? parseInt(m[1]) : null }

async function supabaseFetch(path, method = 'GET', body = null, extra = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${method} ${path}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function cleanup() {
  console.log('\n--- CLEANUP ---')
  // delete predictions for test matches first (FK constraint)
  const matches = await supabaseFetch(`matches?round=eq.${ROUND}&select=id`)
  if (matches?.length) {
    const ids = matches.map(m => m.id)
    for (const id of ids) {
      await supabaseFetch(`predictions?match_id=eq.${id}`, 'DELETE')
    }
    await supabaseFetch(`matches?round=eq.${ROUND}`, 'DELETE')
    console.log(`Deleted ${matches.length} test matches and their predictions`)
  } else {
    console.log('Nothing to clean up')
  }
}

async function main() {
  if (!API_FOOTBALL_KEY) throw new Error('Missing API_FOOTBALL_KEY')
  if (!SUPABASE_URL)     throw new Error('Missing SUPABASE_URL')
  if (!SUPABASE_SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_KEY')

  if (process.argv.includes('--cleanup')) return cleanup()

  // ── 1. Fetch fixtures ──────────────────────────────────────────────────────
  console.log(`\nFetching La Liga ${SEASON} round ${ROUND} fixtures...`)
  const fixturesRes = await fetch(
    `https://v3.football.api-sports.io/fixtures?league=${LEAGUE}&season=${SEASON}&round=Regular Season - ${ROUND}`,
    { headers: { 'x-apisports-key': API_FOOTBALL_KEY } }
  )
  const { response: fixtures, errors } = await fixturesRes.json()
  if (errors && Object.keys(errors).length) throw new Error(JSON.stringify(errors))
  if (!fixtures?.length) throw new Error('No fixtures returned — check API key or season')

  console.log(`Got ${fixtures.length} fixtures`)

  const rows = fixtures.map(f => ({
    external_id: f.fixture.id,
    round:     parseRound(f.league.round),
    home_team: normalize(f.teams.home.name),
    away_team: normalize(f.teams.away.name),
    kickoff:   new Date(f.fixture.timestamp * 1000).toISOString(),
    home_score: f.goals.home,
    away_score: f.goals.away,
  })).filter(r => r.round)

  // ── 2. Upsert matches ──────────────────────────────────────────────────────
  console.log('\nUpserting matches to Supabase...')
  await supabaseFetch('matches?on_conflict=external_id', 'POST', rows, {
    'Prefer': 'resolution=merge-duplicates',
  })
  console.log(`✓ ${rows.length} matches upserted`)

  // ── 3. Verify matches saved ────────────────────────────────────────────────
  const saved = await supabaseFetch(`matches?round=eq.${ROUND}&select=*&order=kickoff`)
  console.log('\n--- MATCHES IN DB ---')
  saved.forEach(m => {
    const score = m.home_score !== null ? `${m.home_score}:${m.away_score}` : 'TBD'
    console.log(`  ${m.home_team} vs ${m.away_team}  [${score}]  external_id=${m.external_id}`)
  })

  // ── 4. Verify points trigger ───────────────────────────────────────────────
  console.log('\n--- CHECKING POINTS TRIGGER ---')
  const predictions = await supabaseFetch(`predictions?match_id=in.(${saved.map(m=>m.id).join(',')})&select=match_id,home_guess,away_guess,points`)
  if (!predictions?.length) {
    console.log('No predictions exist yet — add some via the app then re-run to check points')
  } else {
    predictions.forEach(p => {
      const m = saved.find(x => x.id === p.match_id)
      console.log(`  ${m?.home_team} vs ${m?.away_team}: guessed ${p.home_guess}:${p.away_guess} → ${p.points ?? '?'} pts`)
    })
  }

  // ── 5. API rate limit info ─────────────────────────────────────────────────
  const headers = fixturesRes.headers
  const remaining = headers.get('x-ratelimit-requests-remaining')
  const limit     = headers.get('x-ratelimit-requests-limit')
  if (remaining !== null) {
    console.log(`\n--- API QUOTA ---`)
    console.log(`  Used today: ${parseInt(limit) - parseInt(remaining)} / ${limit}`)
    console.log(`  Remaining:  ${remaining}`)
  }

  console.log('\n✅ Pipeline test complete!')
  console.log('   To clean up test data: node scripts/test-pipeline.js --cleanup')
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1) })
