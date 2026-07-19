import { createClient } from '@supabase/supabase-js'
const sb = createClient(
  'https://jgzscpqnqvymnrpktikf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnenNjcHFucXZ5bW5ycGt0aWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY2MzAzMywiZXhwIjoyMDk4MjM5MDMzfQ.1r4lGIF1tpJ5_jHud0GUElqVdLkdc7giEQPofF9AHto',
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const CAT_ID = 'c47c47c4-7c47-4c47-8c47-c47c47c47c47'
const { data: m3 } = await sb.from('matches').select('id,home_team,away_team').eq('round',3).order('kickoff')
const ids = m3.map(m => m.id)
const { data: preds } = await sb.from('predictions').select('match_id,home_guess,away_guess').eq('user_id', CAT_ID).in('match_id', ids)
const pm = Object.fromEntries((preds || []).map(p => [p.match_id, p]))
for (const m of m3) {
  const p = pm[m.id]
  if (p) console.log(`${m.home_team} ${p.home_guess}:${p.away_guess} ${m.away_team}`)
  else console.log(`${m.home_team} — ${m.away_team} (no prediction)`)
}
