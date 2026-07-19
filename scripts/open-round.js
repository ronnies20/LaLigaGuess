import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://jgzscpqnqvymnrpktikf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnenNjcHFucXZ5bW5ycGt0aWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY2MzAzMywiZXhwIjoyMDk4MjM5MDMzfQ.1r4lGIF1tpJ5_jHud0GUElqVdLkdc7giEQPofF9AHto',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ROUND = parseInt(process.argv[2] || '5')

// Israel = UTC+3. Schedule: 3 matches/day at 17:00, 19:30, 22:00 IL
// Starting July 16 2026
const SCHEDULE_IL = [
  '2026-07-16T17:00', '2026-07-16T19:30', '2026-07-16T22:00',
  '2026-07-17T17:00', '2026-07-17T19:30', '2026-07-17T22:00',
  '2026-07-18T17:00', '2026-07-18T19:30', '2026-07-18T22:00',
  '2026-07-19T17:00', '2026-07-19T19:30', '2026-07-19T22:00',
].map(s => new Date(s + ':00+03:00').toISOString())

async function run() {
  const { data: matches } = await sb
    .from('matches')
    .select('id, home_team, away_team')
    .eq('round', ROUND)
    .order('id')

  if (!matches?.length) { console.log('No matches found for round', ROUND); return }
  console.log(`Opening round ${ROUND} — ${matches.length} matches\n`)

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const kickoff = SCHEDULE_IL[i]
    if (!kickoff) { console.error('Not enough slots in schedule!'); break }

    const { error } = await sb.from('matches').update({
      kickoff,
      home_score:      null,
      away_score:      null,
      status:          'NS',
      score_90:        null,
      penalty_events:  null,
      penalty_minute:  null,
    }).eq('id', m.id)

    const slot = new Date(kickoff).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'short', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    if (error) console.error(`✗ ${m.home_team} vs ${m.away_team}:`, error.message)
    else       console.log(`✓ ${slot.padEnd(22)} | ${m.home_team} vs ${m.away_team}`)
  }
}
run()
