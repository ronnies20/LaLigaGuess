import { createClient } from '@supabase/supabase-js'
const sb = createClient(
  'https://jgzscpqnqvymnrpktikf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnenNjcHFucXZ5bW5ycGt0aWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY2MzAzMywiZXhwIjoyMDk4MjM5MDMzfQ.1r4lGIF1tpJ5_jHud0GUElqVdLkdc7giEQPofF9AHto',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const YAMAL_ID = 'd2e3ddc2-9a4c-4afd-acbb-2012833a2521'

const { data: preds } = await sb.from('predictions')
  .select('home_guess,away_guess,is_joker,points,penalty_bonus,matches!inner(round,home_team,away_team,home_score,away_score,kickoff,status)')
  .eq('user_id', YAMAL_ID)
  .eq('matches.status', 'FT')

const sorted = (preds || [])
  .filter(p => p.matches)
  .sort((a,b) => new Date(a.matches.kickoff) - new Date(b.matches.kickoff))

console.log('📋 כל ניחושי Yamal27 שסיימו:\n')
console.log('  מ׳   משחק                         ניחוש  תוצאה   נק׳   סוג')
console.log('  ─────────────────────────────────────────────────────────────')

let streak = 0
for (const p of sorted) {
  const m = p.matches
  const isExact = p.home_guess === m.home_score && p.away_guess === m.away_score
  const gDir = Math.sign(p.home_guess - p.away_guess)
  const rDir = Math.sign(m.home_score - m.away_score)
  const isDir = !isExact && gDir === rDir && m.home_score !== m.away_score
  if (isExact) streak++; else streak = 0
  const tag = isExact ? `✅ מדויק (streak=${streak})` : isDir ? '🟡 כיוון' : '❌'

  const matchStr = `${m.home_team} vs ${m.away_team}`.slice(0,30).padEnd(30)
  const guessStr = `${p.home_guess}:${p.away_guess}`.padEnd(6)
  const resultStr = `${m.home_score}:${m.away_score}`.padEnd(7)
  const pts = String((p.points ?? 0) + (p.penalty_bonus ?? 0)).padStart(3)
  const j = p.is_joker ? '🃏' : '  '
  console.log(`  ${m.round}    ${matchStr} ${guessStr} ${resultStr} ${pts}   ${j} ${tag}`)
}
console.log(`\n🔥 streak סופי: ${streak}`)
