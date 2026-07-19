import { createClient } from '@supabase/supabase-js'
const sb = createClient(
  'https://jgzscpqnqvymnrpktikf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnenNjcHFucXZ5bW5ycGt0aWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY2MzAzMywiZXhwIjoyMDk4MjM5MDMzfQ.1r4lGIF1tpJ5_jHud0GUElqVdLkdc7giEQPofF9AHto',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const FRIEREN_ID = 'e32b1490-9dd1-49aa-a750-e7768db784b0'

const toClose = [
  { homeQ: 'Osasuna',          awayQ: 'Getafe', home_score: 0, away_score: 2 },
  { homeQ: 'Racing Santander', awayQ: 'Elche',  home_score: 2, away_score: 0 },
]

for (const c of toClose) {
  const { data: match } = await sb.from('matches')
    .select('id,home_team,away_team')
    .ilike('home_team', `%${c.homeQ}%`)
    .eq('round', 3)
    .single()
  if (!match) { console.log(`  ✗ לא נמצא: ${c.homeQ}`); continue }

  // שמירת ניחוש FRIEREN לפני הכל
  const { data: fp } = await sb.from('predictions')
    .select('home_guess,away_guess,is_joker,penalty_min,penalty_max')
    .eq('match_id', match.id).eq('user_id', FRIEREN_ID).maybeSingle()

  const { error } = await sb.from('matches').update({
    home_score: c.home_score,
    away_score: c.away_score,
    status: 'FT',
    kickoff: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  }).eq('id', match.id)

  if (error) { console.error(`  ✗ ${match.home_team}: ${error.message}`); continue }
  console.log(`  ✓ ${match.home_team} ${c.home_score}:${c.away_score} ${match.away_team} → FT`)

  // שחזור FRIEREN אם היה ניחוש
  if (fp) {
    const { error: pe } = await sb.from('predictions').upsert({
      user_id: FRIEREN_ID, match_id: match.id,
      home_guess: fp.home_guess, away_guess: fp.away_guess,
      is_joker: fp.is_joker ?? false,
      ...(fp.penalty_min != null ? { penalty_min: fp.penalty_min, penalty_max: fp.penalty_max } : {})
    }, { onConflict: 'user_id,match_id' })
    if (pe) console.error(`  ⚠️ FRIEREN restore: ${pe.message}`)
    else console.log(`  ✓ ניחוש FRIEREN שמור`)
  }
}
console.log('\n✅ סיום')
