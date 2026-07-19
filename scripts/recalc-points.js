import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://jgzscpqnqvymnrpktikf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnenNjcHFucXZ5bW5ycGt0aWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY2MzAzMywiZXhwIjoyMDk4MjM5MDMzfQ.1r4lGIF1tpJ5_jHud0GUElqVdLkdc7giEQPofF9AHto',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function run() {
  // Fetch all completed matches in kickoff ASC order
  const { data: matches, error } = await sb
    .from('matches')
    .select('id, round, home_team, away_team, kickoff, home_score, away_score')
    .not('home_score', 'is', null)
    .order('kickoff', { ascending: true })

  if (error) { console.error('fetch error:', error.message); return }
  console.log(`Recalculating ${matches.length} completed matches (kickoff ASC)...\n`)

  for (const m of matches) {
    const { error: err } = await sb
      .from('matches')
      .update({ home_score: m.home_score, away_score: m.away_score })
      .eq('id', m.id)

    const label = `R${m.round} ${m.home_team.slice(0,5)}-${m.away_team.slice(0,5)}`
    if (err) console.error(`✗ ${label}: ${err.message}`)
    else     console.log(`✓ ${label.padEnd(18)} ${m.home_score}:${m.away_score}`)
  }

  console.log('\nDone. Checking FRIEREN streak...')

  const { data: frieren } = await sb.from('profiles').select('id').eq('display_name', 'FRIEREN').single()
  const { data: preds } = await sb
    .from('predictions')
    .select('points, home_guess, away_guess, is_joker, matches!inner(home_team,away_team,home_score,away_score,kickoff,round)')
    .eq('user_id', frieren.id)
    .not('matches.home_score', 'is', null)
    .order('matches(kickoff)', { ascending: true })

  let streak = 0
  console.log('\nFRIEREN after recalc:')
  preds?.forEach(p => {
    const m = p.matches
    const exact = p.home_guess === m.home_score && p.away_guess === m.away_score
    if (exact) streak++; else streak = 0
    console.log(
      `R${m.round}`,
      (m.home_team.slice(0,4)+'-'+m.away_team.slice(0,4)).padEnd(10),
      (p.home_guess+':'+p.away_guess+(p.is_joker?' J':' ')).padEnd(5),
      '→', m.home_score+':'+m.away_score,
      exact ? 'EXACT' : 'miss ',
      'streak='+streak,
      'db_pts='+p.points,
      streak >= 5 ? '← 🔥+3' : streak >= 4 ? '← 🔥+2' : ''
    )
  })
}
run()
