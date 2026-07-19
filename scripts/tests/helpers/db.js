/**
 * Shared DB client for the test suite.
 * Reads credentials from process.env — caller must load them first (e.g. via loadSecrets.js).
 */

export async function db(path, method = 'GET', body = null, prefer = 'return=representation') {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set — import loadSecrets.js first')

  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer:         prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`DB ${method} /${path} → ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

const FRIEREN_ID = 'e32b1490-9dd1-49aa-a750-e7768db784b0'

/** Returns first non-FRIEREN profile */
export async function getTestUser() {
  const users = await db(`profiles?id=neq.${FRIEREN_ID}&select=id,display_name&limit=1`)
  if (!users?.length) throw new Error('No test user found — run seed-db.js first')
  return users[0]
}

/** Returns up to n non-FRIEREN profiles */
export async function getTestUsers(n = 3) {
  const users = await db(`profiles?id=neq.${FRIEREN_ID}&select=id,display_name&limit=${n}`)
  if (!users?.length) throw new Error('No test users found — run seed-db.js first')
  return users
}

/**
 * Creates matches (without scores), calls fn(matches), then deletes all matches
 * and their predictions in a finally block so cleanup always runs.
 */
export async function withMatches(rows, fn) {
  const matches = await db('matches', 'POST', rows)
  const ids = matches.map(m => m.id)
  try {
    await fn(matches)
  } finally {
    // Delete all predictions for these matches (all users), then the matches themselves
    for (const id of ids) {
      await db(`predictions?match_id=eq.${id}`, 'DELETE', null, 'return=minimal')
    }
    await db(`matches?id=in.(${ids.join(',')})`, 'DELETE', null, 'return=minimal')
  }
}

/** Upsert a prediction (insert or overwrite on user_id + match_id conflict) */
export async function setPred(userId, matchId, hg, ag, opts = {}) {
  const row = {
    user_id:    userId,
    match_id:   matchId,
    home_guess: hg,
    away_guess: ag,
    is_joker:   opts.joker ?? false,
    ...(opts.penMin != null ? { penalty_min: opts.penMin, penalty_max: opts.penMax } : {}),
  }
  await db('predictions?on_conflict=user_id,match_id', 'POST', [row], 'resolution=merge-duplicates')
}

/** Set home_score + away_score on a match (fires update_match_points trigger) */
export async function setScore(matchId, h, a) {
  await db(`matches?id=eq.${matchId}`, 'PATCH', { home_score: h, away_score: a }, 'return=minimal')
}

/** Fetch a prediction's points + penalty_bonus for assertions */
export async function getPred(userId, matchId) {
  const rows = await db(
    `predictions?user_id=eq.${userId}&match_id=eq.${matchId}&select=points,penalty_bonus,is_joker`
  )
  return rows?.[0] ?? null
}

/** Base match template — override any fields as needed */
export function makeMatch(overrides = {}) {
  return {
    home_team:  'Real Madrid',
    away_team:  'Barcelona',
    kickoff:    '2000-01-01T20:00:00Z',
    round:      10,
    home_score: null,
    away_score: null,
    status:     'NS',
    is_special: false,
    ...overrides,
  }
}
