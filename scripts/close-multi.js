import { createClient } from '@supabase/supabase-js'
const sb = createClient(
  'https://jgzscpqnqvymnrpktikf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnenNjcHFucXZ5bW5ycGt0aWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY2MzAzMywiZXhwIjoyMDk4MjM5MDMzfQ.1r4lGIF1tpJ5_jHud0GUElqVdLkdc7giEQPofF9AHto',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const FCB13_ID = '8f7d43b2-eb31-4686-821e-ed3c7e573b0f'

const toClose = [
  { home: 'Real Sociedad', away: 'Espanyol', home_score: 1, away_score: 0 },
]

for (const c of toClose) {
  // חיפוש גמיש יותר
  const { data: matches } = await sb.from('matches')
    .select('id,home_team,away_team')
    .ilike('home_team', `%Sociedad%`)

  const match = matches?.[0]
  if (!match) { console.log(`  ✗ לא נמצא: ${c.home}`); continue }

  const { data: fcbPred } = await sb.from('predictions')
    .select('home_guess,away_guess,is_joker,penalty_min,penalty_max')
    .eq('match_id', match.id).eq('user_id', FCB13_ID).single()

  const { error } = await sb.from('matches').update({
    home_score: c.home_score, away_score: c.away_score, status: 'FT',
    kickoff: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  }).eq('id', match.id)

  if (error) { console.error(`  ✗ ${match.home_team}: ${error.message}`); continue }
  console.log(`  ✓ ${match.home_team} ${c.home_score}:${c.away_score} ${match.away_team} → FT`)

  if (fcbPred) {
    await sb.from('predictions').upsert({
      user_id: FCB13_ID, match_id: match.id,
      home_guess: fcbPred.home_guess, away_guess: fcbPred.away_guess,
      is_joker: fcbPred.is_joker,
    }, { onConflict: 'user_id,match_id' })
  }
}
console.log('✅ סיום')
