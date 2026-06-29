/**
 * Debug: show FRIEREN's predictions in kickoff order with points
 * Run: node scripts/tests/debug-streak.js
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dir = dirname(fileURLToPath(import.meta.url))
const raw = readFileSync(join(__dir, '.env.test.secrets'), 'utf8')
raw.split('\n').forEach(line => { const [k,...v]=line.split('='); if(k?.trim()) process.env[k.trim()]=v.join('=').trim() })
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' }

// Get FRIEREN's user_id
const profiles = await (await fetch(`${SUPABASE_URL}/rest/v1/profiles?display_name=eq.FRIEREN&select=id`, { headers })).json()
const userId = profiles[0]?.id
console.log(`FRIEREN id: ${userId}`)

// Get all predictions with match info, ordered by kickoff
const preds = await (await fetch(
  `${SUPABASE_URL}/rest/v1/predictions?user_id=eq.${userId}&select=points,home_guess,away_guess,matches(round,kickoff,home_team,away_team,home_score,away_score)&order=match_id`,
  { headers }
)).json()

// Sort by kickoff
preds.sort((a, b) => new Date(a.matches.kickoff) - new Date(b.matches.kickoff))

// Compute streak manually
let maxStreak = 0, cur = 0
const withNull = preds.filter(p => p.points === null)
const withPts  = preds.filter(p => p.points !== null)

console.log(`\nTotal predictions: ${preds.length}`)
console.log(`  With points: ${withPts.length}`)
console.log(`  Points=null: ${withNull.length}`)
if (withNull.length) {
  console.log(`  Null-point matches:`)
  withNull.slice(0,5).forEach(p => {
    const m = p.matches
    console.log(`    R${m.round} ${m.home_team} vs ${m.away_team} (${m.home_score}:${m.away_score}) — guess ${p.home_guess}:${p.away_guess}`)
  })
}

console.log('\nLast 20 predictions in kickoff order:')
withPts.slice(-20).forEach(p => {
  const m = p.matches
  const mark = p.points === 3 ? '✅' : p.points === 1 ? '↗' : '❌'
  if (p.points === 3) { cur++; if (cur > maxStreak) maxStreak = cur }
  else cur = 0
  console.log(`  R${m.round} ${m.home_team} ${p.home_guess}:${p.away_guess} vs ${m.away_team} | real ${m.home_score}:${m.away_score} | pts=${p.points} ${mark} | streak=${cur}`)
})

// Full max streak
cur = 0; maxStreak = 0
for (const p of withPts) {
  if (p.points === 3) { cur++; if (cur > maxStreak) maxStreak = cur }
  else cur = 0
}
console.log(`\nMax streak (computed): ${maxStreak}`)
