import { createClient } from '@supabase/supabase-js'
const sb = createClient(
  'https://jgzscpqnqvymnrpktikf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnenNjcHFucXZ5bW5ycGt0aWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY2MzAzMywiZXhwIjoyMDk4MjM5MDMzfQ.1r4lGIF1tpJ5_jHud0GUElqVdLkdc7giEQPofF9AHto',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const [homeTeam, awayTeam, homeScore, awayScore] = process.argv.slice(2)

const { data: match } = await sb.from('matches')
  .select('id,home_team,away_team')
  .ilike('home_team', `%${homeTeam}%`)
  .ilike('away_team', `%${awayTeam}%`)
  .single()

if (!match) { console.log('✗ משחק לא נמצא'); process.exit(1) }

const { error } = await sb.from('matches').update({
  home_score: parseInt(homeScore), away_score: parseInt(awayScore), status: 'FT'
}).eq('id', match.id)

if (error) console.error('✗', error.message)
else console.log(`✓ ${match.home_team} ${homeScore}:${awayScore} ${match.away_team} → FT`)
