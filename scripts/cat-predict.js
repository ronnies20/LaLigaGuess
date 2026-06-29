// CAT — Barcelona's mascot cat. Auto-predicts all locked matches for every user.
// Runs every 5 minutes via GitHub Actions.

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

const CAT_USER_ID = 'c47c47c4-7c47-4c47-8c47-c47c47c47c47'
const CAT_EMAIL   = 'cat@laligaguess.internal'
const CAT_NAME    = 'CAT'

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// Weighted random goals: 0=15% · 1=35% · 2=30% · 3=20%
// Realistic La Liga range — avoids 5-4 nonsense
function randomGoals() {
  const r = Math.random() * 100
  if (r < 15) return 0
  if (r < 50) return 1
  if (r < 80) return 2
  return 3
}

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

async function ensureCatUser() {
  const profiles = await get(`/profiles?id=eq.${CAT_USER_ID}`)
  if (profiles.length) return

  // Create auth user
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

  // Upsert profile
  await post('/profiles?on_conflict=id', { id: CAT_USER_ID, display_name: CAT_NAME }, 'resolution=merge-duplicates')
  console.log('CAT user created')
}

async function fillMissingPredictions() {
  const now  = new Date()
  // Matches locking within the next 15 minutes (kickoff ≤ now + 15min)
  const soon = new Date(now.getTime() + 15 * 60 * 1000).toISOString()

  const matches = await get(`/matches?kickoff=lte.${soon}&home_score=is.null&select=id`)
  if (!matches.length) return console.log('No matches locking soon')
  console.log(`${matches.length} matches to check`)

  const profiles  = await get('/profiles?select=id')
  const matchIds  = matches.map(m => m.id).join(',')
  const existing  = await get(`/predictions?match_id=in.(${matchIds})&select=user_id,match_id`)
  const existingSet = new Set(existing.map(p => `${p.user_id}:${p.match_id}`))

  const rows = []
  for (const user of profiles) {
    for (const match of matches) {
      if (!existingSet.has(`${user.id}:${match.id}`)) {
        rows.push({ user_id: user.id, match_id: match.id, home_guess: randomGoals(), away_guess: randomGoals() })
      }
    }
  }

  if (!rows.length) return console.log('All predictions already filled')
  console.log(`Inserting ${rows.length} predictions`)

  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    await post('/predictions', rows.slice(i, i + 50), 'resolution=ignore-duplicates')
  }
  console.log('Done')
}

async function main() {
  await ensureCatUser()
  await fillMissingPredictions()
}

main().catch(e => { console.error(e); process.exit(1) })
