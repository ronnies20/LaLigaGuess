// Send push notifications — runs every 5 minutes via GitHub Actions.
// Handles 4 triggers: pre-lock reminder, results published, streak broken, active streak.

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.log('VAPID keys not configured — skipping push notifications')
  process.exit(0)
}

webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ---- helpers ----

async function send(sub, body) {
  const payload = JSON.stringify({ title: 'LaLiga Guess 🎰', body })
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    )
    console.log(`  ✓ sent to ${sub.user_id.slice(0, 8)}: ${body}`)
  } catch (err) {
    if (err.statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      console.log(`  ⚠ removed expired subscription for ${sub.user_id.slice(0, 8)}`)
    }
  }
}

async function alreadySent(userId, type, round) {
  const { data } = await supabase.from('notification_log')
    .select('id').eq('user_id', userId).eq('type', type).eq('round', round).maybeSingle()
  return !!data
}

async function markSent(userId, type, round, metadata = null) {
  await supabase.from('notification_log')
    .upsert({ user_id: userId, type, round, metadata }, { onConflict: 'user_id,type,round' })
}

// ---- trigger 1 + 7: pre-lock (2 hours before first match) ----

async function checkPreLock(subs, streakMap) {
  const { data: roundRow } = await supabase
    .from('matches').select('round').is('home_score', null)
    .order('round', { ascending: true }).limit(1)
  if (!roundRow?.length) return

  const round = roundRow[0].round

  const { data: matches } = await supabase
    .from('matches').select('id, kickoff').eq('round', round).is('home_score', null)
    .order('kickoff', { ascending: true })
  if (!matches?.length) return

  const hoursUntil = (new Date(matches[0].kickoff) - new Date()) / 3_600_000
  if (hoursUntil < 1.5 || hoursUntil > 2.5) return

  const matchIds = matches.map(m => m.id)
  const { data: preds } = await supabase
    .from('predictions').select('user_id, match_id').in('match_id', matchIds)

  const predCount = {}
  preds?.forEach(p => { predCount[p.user_id] = (predCount[p.user_id] || 0) + 1 })

  console.log(`checkPreLock: round ${round}, ${hoursUntil.toFixed(1)}h to first match`)

  for (const sub of subs) {
    const streak  = streakMap[sub.user_id] || 0
    const missing = matchIds.length - (predCount[sub.user_id] || 0)

    // trigger 7 — active streak (prioritized)
    if (streak >= 3 && !(await alreadySent(sub.user_id, 'streak_active', round))) {
      const body = `🔥 יש לך רצף פעיל של ${streak} ניחושים — ניחוש מדויק הבא שווה לך בונוס נקודות, אל תפספס`
      await send(sub, body)
      await markSent(sub.user_id, 'streak_active', round, { streak })
    }
    // trigger 1 — missing predictions (only if no streak notification)
    else if (missing > 0 && !(await alreadySent(sub.user_id, 'pre_lock', round))) {
      const options = [
        `⏰ שעתיים לנעילת מחזור ${round} — עדיין חסרים לך ${missing} ניחושים`,
        `🤖 קאט ניחש את הכל במחזור ${round}. אתה עדיין ממתין?`,
        `😤 מחזור ${round} נועל בעוד שעתיים — ${missing} ניחושים עדיין פתוחים`,
      ]
      await send(sub, options[Math.floor(Math.random() * options.length)])
      await markSent(sub.user_id, 'pre_lock', round)
    }
  }
}

// ---- trigger 3 + 6: results published / streak broken ----

async function checkResults(subs, streakMap) {
  const { data: allMatches } = await supabase
    .from('matches').select('round, home_score').order('round', { ascending: false }).limit(500)
  if (!allMatches?.length) return

  const info = {}
  for (const m of allMatches) {
    if (!info[m.round]) info[m.round] = { total: 0, scored: 0 }
    info[m.round].total++
    if (m.home_score !== null) info[m.round].scored++
  }

  const completedRounds = Object.entries(info)
    .filter(([, { total, scored }]) => total > 0 && total === scored)
    .map(([r]) => parseInt(r))
    .sort((a, b) => b - a)

  if (!completedRounds.length) return
  const round = completedRounds[0]

  console.log(`checkResults: latest completed round = ${round}`)

  // fetch per-user points for this round
  const { data: pointRows } = await supabase
    .from('round_leaderboard_view').select('user_id, round_points').eq('round', round)
  const pointsMap = {}
  pointRows?.forEach(r => { pointsMap[r.user_id] = r.round_points })

  for (const sub of subs) {
    // trigger 3 — results notification
    if (!(await alreadySent(sub.user_id, 'results', round))) {
      const points = pointsMap[sub.user_id] ?? 0
      const body = `🎰 מחזור ${round} נגמר — קיבלת ${points} נקודות, כנס לראות את הטבלה`
      await send(sub, body)
      await markSent(sub.user_id, 'results', round)
    }

    // trigger 6 — streak broken: had streak_active for this round AND current streak is 0
    const { data: streakLog } = await supabase.from('notification_log')
      .select('metadata').eq('user_id', sub.user_id).eq('type', 'streak_active').eq('round', round).maybeSingle()

    if (streakLog && (streakMap[sub.user_id] || 0) === 0 && !(await alreadySent(sub.user_id, 'streak_broken', round))) {
      const prevStreak = streakLog.metadata?.streak ?? '?'
      const body = `💔 הרצף שלך של ${prevStreak} ניחושים נשבר — בא נבנה מחדש`
      await send(sub, body)
      await markSent(sub.user_id, 'streak_broken', round)
    }
  }
}

// ---- main ----

async function main() {
  const [{ data: subs }, { data: streakRows }] = await Promise.all([
    supabase.from('push_subscriptions').select('*'),
    supabase.from('current_streak_view').select('user_id, current_streak'),
  ])

  if (!subs?.length) { console.log('No push subscriptions'); return }

  const streakMap = {}
  streakRows?.forEach(r => { streakMap[r.user_id] = r.current_streak })

  await checkPreLock(subs, streakMap)
  await checkResults(subs, streakMap)
}

main().catch(console.error)
