import { createClient } from '@supabase/supabase-js'

const PROD_URL = 'https://vufirabiwpfzalidbjtw.supabase.co'
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1ZmlyYWJpd3BmemFsaWRianR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ2NDAwMiwiZXhwIjoyMDk4MDQwMDAyfQ.WC8re4DO8qjiCve71BBV0o4WZwQ6OiYjm6I4NuCysEc'
const sb = createClient(PROD_URL, PROD_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// Try to get view/function source via pg_views and pg_proc through REST with service role
const h = { 'apikey': PROD_KEY, 'Authorization': `Bearer ${PROD_KEY}`, 'Accept': 'application/json' }

// pg_views is accessible via REST
console.log('=== current_streak_view definition ===')
const vr = await fetch(`${PROD_URL}/rest/v1/pg_views?schemaname=eq.public&viewname=eq.current_streak_view&select=definition`, { headers: h })
const vj = await vr.json()
if (vj?.[0]?.definition) {
  const def = vj[0].definition
  console.log(def)
  // Key checks
  console.log('\n--- ניתוח ---')
  console.log('יש NULL fix (streak_shield_round is not null):', def.includes('streak_shield_round is not null') ? '✅' : '❌ חסר!')
} else {
  console.log('לא נמצא (status:', vr.status, ')', JSON.stringify(vj).slice(0,200))
}

console.log('\n=== update_match_points source ===')
const fr = await fetch(`${PROD_URL}/rest/v1/pg_proc?proname=eq.update_match_points&select=prosrc`, { headers: h })
const fj = await fr.json()
if (fj?.[0]?.prosrc) {
  const src = fj[0].prosrc
  // Only print key lines
  const lines = src.split('\n')
  const keyLines = lines.filter(l =>
    l.includes('streak') || l.includes('bonus') || l.includes('shield') ||
    l.includes('>= 3') || l.includes('>= 4') || l.includes('>= 5') ||
    l.includes('is not null') || l.includes('IS NOT NULL') ||
    l.includes('phase') || l.includes('round')
  )
  console.log('שורות קריטיות:')
  keyLines.forEach(l => console.log(' ', l.trim()))

  console.log('\n--- ניתוח ---')
  console.log('NULL fix (streak_shield_round is not null):', src.includes('streak_shield_round is not null') || src.includes('streak_shield_round IS NOT NULL') ? '✅' : '❌ חסר!')
  console.log('סף סטרייק >= 3 (+2):', src.includes('>= 3') ? '✅' : '❌')
  console.log('סף סטרייק >= 4 (+3):', src.includes('>= 4') ? '✅' : '❌')
  console.log('score_90 / phase logic:', src.includes('score_90') || src.includes('phase') ? '✅' : '⚠️')
} else {
  console.log('לא נמצא (status:', fr.status, ')', JSON.stringify(fj).slice(0,200))
}

console.log('\n=== getCurrentRound — איך עובד באפליקציה? ===')
// Check if get_current_round exists as RPC
const { error: rpcErr } = await sb.rpc('get_current_round', {})
console.log(rpcErr ? '❌ get_current_round לא קיים: ' + rpcErr.message : '✅ קיים')

// Check if matches table has data and what round
const { data: matches } = await sb.from('matches').select('round').order('round', { ascending: true }).limit(1)
console.log('matches קיימות:', matches?.length ? 'כן, מחזור מינימלי: ' + matches[0].round : 'לא (טבלה ריקה)')
