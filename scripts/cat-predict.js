// CAT — Barcelona's mascot cat. Auto-predicts locking matches for every user who hasn't predicted.
// Runs every 5 minutes via GitHub Actions.
// Uses La Liga standings + Poisson model: home advantage, table position, goals scored/conceded.
// Predictions are per-match (CAT's "opinion") — same score given to all missing users.

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, API_FOOTBALL_KEY } = process.env

const CAT_USER_ID = 'c47c47c4-7c47-4c47-8c47-c47c47c47c47'
const CAT_EMAIL   = 'cat@laligaguess.internal'
const CAT_NAME    = 'CAT'
const CAT_AVATAR  = 'https://vufirabiwpfzalidbjtw.supabase.co/storage/v1/object/public/cat/cat'

const LEAGUE_ID   = 140   // La Liga
const SEASON      = 2026
const HOME_FACTOR = 1.15  // home-field advantage multiplier on expected goals

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// ── Poisson model ────────────────────────────────────────────────
// P(X=k) computed iteratively to avoid factorial overflow
function poissonProb(lambda, k) {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

// Sample goals clamped 0-3 using Poisson(λ) weights
function sampleGoals(lambda) {
  const lam = Math.max(0.3, Math.min(3.5, lambda))
  const w = [0, 1, 2, 3].map(k => poissonProb(lam, k))
  const total = w.reduce((s, x) => s + x, 0)  // prob mass for 0-3
  let r = Math.random() * total
  for (let i = 0; i < w.length; i++) {
    r -= w[i]
    if (r <= 0) return i
  }
  return 3
}

// Fallback: historical La Liga distribution (no API data)
function randomGoals() {
  const r = Math.random() * 100
  if (r < 15) return 0
  if (r < 50) return 1
  if (r < 80) return 2
  return 3
}

// ── Standings fetch ──────────────────────────────────────────────
async function fetchStandings() {
  if (!API_FOOTBALL_KEY) {
    console.log('  ⚠ API_FOOTBALL_KEY not set — using weighted random fallback')
    return null
  }
  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/standings?league=${LEAGUE_ID}&season=${SEASON}`,
      {
        headers: {
          'x-rapidapi-key': API_FOOTBALL_KEY,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
      }
    )
    if (!res.ok) { console.warn(`  ⚠ Standings HTTP ${res.status}`); return null }
    const data = await res.json()
    const rows = data.response?.[0]?.league?.standings?.[0]
    if (!rows?.length) { console.warn('  ⚠ Empty standings response'); return null }
    console.log(`  📊 Standings: ${rows.length} teams, ${rows[0]?.all?.played ?? 0} games played`)
    return rows
  } catch (e) {
    console.warn('  ⚠ Could not fetch standings:', e.message)
    return null
  }
}

// ── Strength map ─────────────────────────────────────────────────
// Returns { teams: { [name]: { attack, defense } }, leagueAvg } or null

function buildPositionModel(standings) {
  // Early-season fallback: map rank → estimated attack/defense
  // Rank 1 (best): attack ~2.0, defense ~0.8 | Rank 20 (worst): attack ~0.7, defense ~1.8
  const n = Math.max(standings.length, 20)
  const leagueAvg = 1.3
  const teams = {}
  for (const t of standings) {
    const ratio = (t.rank - 1) / (n - 1)   // 0 = best, 1 = worst
    teams[t.team.name] = {
      attack:  2.0 - ratio * 1.3,
      defense: 0.8 + ratio * 1.0,
    }
  }
  return { teams, leagueAvg }
}

function buildStrengthMap(standings) {
  if (!standings) return null

  const gamesPlayed = standings[0]?.all?.played ?? 0
  if (gamesPlayed < 3) {
    console.log('  ℹ < 3 games played — using position-based model')
    return buildPositionModel(standings)
  }

  // League average goals/game across all teams
  let totalGoals = 0, totalGames = 0
  for (const t of standings) {
    totalGoals += t.all.goals.for
    totalGames += t.all.played
  }
  const leagueAvg = totalGames > 0 ? totalGoals / totalGames : 1.3

  const teams = {}
  for (const t of standings) {
    const played = Math.max(1, t.all.played)
    // Regress toward league average for teams with few games played
    const confidence = Math.min(1, played / 10)
    const rawAttack  = t.all.goals.for  / played
    const rawDefense = t.all.goals.against / played
    teams[t.team.name] = {
      attack:  confidence * rawAttack  + (1 - confidence) * leagueAvg,
      defense: confidence * rawDefense + (1 - confidence) * leagueAvg,
    }
  }
  return { teams, leagueAvg }
}

// ── Prediction engine ─────────────────────────────────────────────
// Dixon-Coles-inspired expected goals:
//   home_xG = (home_attack / avgGoals) * (avgGoals / away_defense) * avgGoals * HOME_FACTOR
//           = home_attack * avgGoals / away_defense * HOME_FACTOR
//   away_xG = away_attack * avgGoals / home_defense / HOME_FACTOR
function predictMatch(homeTeam, awayTeam, strengthMap) {
  if (!strengthMap) {
    return { home_guess: randomGoals(), away_guess: randomGoals() }
  }

  const { teams, leagueAvg } = strengthMap
  const home = teams[homeTeam]
  const away = teams[awayTeam]

  if (!home || !away) {
    console.warn(`  ⚠ Unknown team: "${homeTeam}" or "${awayTeam}" — using random`)
    return { home_guess: randomGoals(), away_guess: randomGoals() }
  }

  const homeXG = (home.attack / leagueAvg) * (leagueAvg / away.defense) * leagueAvg * HOME_FACTOR
  const awayXG = (away.attack / leagueAvg) * (leagueAvg / home.defense) * leagueAvg / HOME_FACTOR

  return {
    home_guess: sampleGoals(homeXG),
    away_guess: sampleGoals(awayXG),
  }
}

// ── Supabase helpers ─────────────────────────────────────────────
async function get(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers })
  if (!res.ok) throw new Error(`GET ${path}: ${await res.text()}`)
  return res.json()
}

async function post(path, body, prefer = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: prefer ? { ...headers, Prefer: prefer } : headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path}: ${await res.text()}`)
}

// ── Ensure CAT user exists ────────────────────────────────────────
async function ensureCatUser() {
  const profiles = await get(`/profiles?id=eq.${CAT_USER_ID}`)
  if (profiles.length) return

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: CAT_USER_ID,
      email: CAT_EMAIL,
      password: 'CatBarca_2627_!xX',
      email_confirm: true,
      user_metadata: { display_name: CAT_NAME },
    }),
  })
  if (!authRes.ok) {
    const txt = await authRes.text()
    if (!txt.includes('already been registered')) throw new Error(`Auth: ${txt}`)
  }

  await post(
    '/profiles?on_conflict=id',
    { id: CAT_USER_ID, display_name: CAT_NAME, avatar_url: CAT_AVATAR },
    'resolution=merge-duplicates'
  )
  console.log('  ✓ CAT user created')
}

// ── Main fill logic ───────────────────────────────────────────────
async function fillMissingPredictions(strengthMap) {
  const now  = new Date()
  // Fill for matches kicking off in the next 15 minutes that haven't started yet
  const soon = new Date(now.getTime() + 15 * 60 * 1000).toISOString()

  const matches = await get(
    `/matches?kickoff=lte.${soon}&home_score=is.null&select=id,home_team,away_team`
  )
  if (!matches.length) return console.log('No matches locking soon')
  console.log(`${matches.length} match(es) in 15-min window`)

  const profiles = await get('/profiles?select=id')
  const matchIds = matches.map(m => m.id).join(',')
  const existing = await get(`/predictions?match_id=in.(${matchIds})&select=user_id,match_id`)
  const existingSet = new Set(existing.map(p => `${p.user_id}:${p.match_id}`))

  // One prediction per match — CAT's single "opinion" shared with all missing users
  const matchPred = {}
  for (const m of matches) {
    matchPred[m.id] = predictMatch(m.home_team, m.away_team, strengthMap)
    console.log(`  🐱 ${m.home_team} vs ${m.away_team} → ${matchPred[m.id].home_guess}:${matchPred[m.id].away_guess}`)
  }

  const rows = []
  for (const user of profiles) {
    for (const match of matches) {
      if (!existingSet.has(`${user.id}:${match.id}`)) {
        rows.push({ user_id: user.id, match_id: match.id, ...matchPred[match.id] })
      }
    }
  }

  if (!rows.length) return console.log('All predictions already filled')
  console.log(`Inserting ${rows.length} auto-predictions`)

  for (let i = 0; i < rows.length; i += 50) {
    await post('/predictions', rows.slice(i, i + 50), 'resolution=ignore-duplicates')
  }
  console.log('Done')
}

async function main() {
  await ensureCatUser()
  const standings  = await fetchStandings()
  const strengthMap = buildStrengthMap(standings)
  await fillMissingPredictions(strengthMap)
}

main().catch(e => { console.error(e); process.exit(1) })
