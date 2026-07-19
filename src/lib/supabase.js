import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ---- Auth ----
export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } }
  })
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function getUser() {
  return supabase.auth.getUser()
}

// ---- Matches ----
export async function getMatchesByRound(round) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('round', round)
    .order('kickoff', { ascending: true })
  if (error) throw error
  return data
}

// ---- Predictions ----
export async function getPredictions(userId, round) {
  const { data, error } = await supabase
    .from('predictions')
    .select('*, matches(home_team, away_team, home_score, away_score, kickoff)')
    .eq('user_id', userId)
    .eq('matches.round', round)
  if (error) throw error
  return data
}

export async function upsertPrediction(userId, matchId, homeGuess, awayGuess, isJoker = false, penaltyMin = null, penaltyMax = null) {
  const row = { user_id: userId, match_id: matchId, home_guess: homeGuess, away_guess: awayGuess, is_joker: isJoker }
  if (penaltyMin !== null) row.penalty_min = penaltyMin
  if (penaltyMax !== null) row.penalty_max = penaltyMax
  const { data, error } = await supabase
    .from('predictions')
    .upsert(row, { onConflict: 'user_id,match_id' })
    .select()
  if (error) throw error
  return data
}

// ---- Leaderboard ----
export async function getLeaderboard() {
  const { data, error } = await supabase
    .from('leaderboard_view')
    .select('*')
    .order('total_points', { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

export async function getLeaderboardByRound(round) {
  const { data, error } = await supabase
    .from('predictions')
    .select('user_id, points, profiles(display_name)')
    .eq('matches.round', round)
  if (error) throw error
  return data
}

// ---- Profile ----
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function updateProfile(userId, updates) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
  if (error) throw error
}

const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const AVATAR_MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function uploadAvatar(file, userId) {
  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) throw new Error('סוג קובץ לא נתמך — יש להעלות jpg, png, gif או webp')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('הקובץ גדול מדי — מקסימום 5MB')
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const { data: existing } = await supabase.storage.from('avatars').list(userId)
  if (existing?.length) {
    await supabase.storage.from('avatars').remove(existing.map(f => `${userId}/${f.name}`))
  }
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

// Returns the earliest round that still has unplayed matches (open for prediction)
export async function getCurrentRound() {
  // Use status != 'FT' so live matches (home_score=0) keep the round pinned correctly
  const { data } = await supabase
    .from('matches')
    .select('round')
    .neq('status', 'FT')
    .order('round', { ascending: true })
    .limit(1)
  return data?.[0]?.round ?? 1
}

export async function getRoundMessages(round) {
  const { data } = await supabase
    .from('round_messages')
    .select('user_id, message, profiles(display_name, avatar_url)')
    .eq('round', round)
  return data || []
}

export async function upsertRoundMessage(userId, round, message) {
  const { error } = await supabase
    .from('round_messages')
    .upsert({ user_id: userId, round, message: message.slice(0, 20) }, { onConflict: 'user_id,round' })
  if (error) throw error
}

export async function getPlayerHistory(userId) {
  const { data, error } = await supabase
    .from('predictions')
    .select('home_guess, away_guess, points, is_joker, penalty_bonus, matches!inner(id, home_team, away_team, home_score, away_score, kickoff, round, is_special)')
    .eq('user_id', userId)
    .not('matches.home_score', 'is', null)
  if (error) throw error
  return (data || []).sort((a, b) => new Date(b.matches.kickoff) - new Date(a.matches.kickoff))
}

export async function getLiveMatchGuesses(liveMatchIds) {
  if (!liveMatchIds.length) return []
  const { data, error } = await supabase
    .from('predictions')
    .select('user_id, match_id, home_guess, away_guess, is_joker')
    .in('match_id', liveMatchIds)
  if (error) throw error
  return data || []
}

export async function getPlayerRoundPredictions(userId, round) {
  const { data, error } = await supabase
    .from('predictions')
    .select('home_guess, away_guess, is_joker, points, penalty_min, penalty_max, penalty_bonus, matches!inner(home_team, away_team, home_score, away_score, kickoff, status, is_special, penalty_events)')
    .eq('user_id', userId)
    .eq('matches.round', round)
  if (error) throw error
  return (data || []).filter(p => p.matches).sort((a, b) => new Date(a.matches.kickoff) - new Date(b.matches.kickoff))
}

// ---- Feedback ----
export async function submitFeedback(message) {
  // user_id, display_name, user_email are filled server-side by trigger
  const { error } = await supabase
    .from('feedback')
    .insert({ message })
  if (error) throw error
}

export async function getAdminFeedback() {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function markFeedbackRead(id) {
  const { error } = await supabase.from('feedback').update({ read: true }).eq('id', id)
  if (error) throw error
}

// ---- Engagement helpers ----

// Count distinct users who have predicted at least one match in a round (social proof)
export async function countRoundParticipants(round) {
  const { data, error } = await supabase.rpc('count_round_predictions', { p_round: round })
  if (error) return 0
  return data ?? 0
}

// Full history for trophy / persona computation
export async function getMyHistory(userId) {
  const { data, error } = await supabase
    .from('predictions')
    .select('home_guess, away_guess, points, is_joker, penalty_bonus, matches!inner(round, home_score, away_score, kickoff, is_special, score_90)')
    .eq('user_id', userId)
    .not('matches.home_score', 'is', null)
  if (!error) return data || []
  // Fallback: score_90 may not exist in older DB schemas
  const { data: fallback } = await supabase
    .from('predictions')
    .select('home_guess, away_guess, points, is_joker, penalty_bonus, matches!inner(round, home_score, away_score, kickoff, is_special)')
    .eq('user_id', userId)
    .not('matches.home_score', 'is', null)
  return fallback || []
}

// Get season leaderboard with ranks for rival computation (already have getLeaderboard)
export async function getLeaderboardRanked() {
  const { data, error } = await supabase
    .from('leaderboard_view')
    .select('user_id, display_name, avatar_url, total_points, exact_count, direction_count')
    .order('total_points', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data || []).map((r, i) => ({ ...r, rank: i + 1 }))
}

export async function getBonusBreakdown(userId, round = null) {
  let query = supabase
    .from('predictions')
    .select('points, penalty_bonus, is_joker, home_guess, away_guess, matches!inner(home_score, away_score, round)')
    .eq('user_id', userId)
    .not('matches.home_score', 'is', null)
    .not('points', 'is', null)
  if (round !== null) query = query.eq('matches.round', round)
  const { data } = await query

  let penalty = 0, joker = 0, streak = 0
  for (const p of (data || [])) {
    const m = p.matches
    if (!m) continue
    const isExact = p.home_guess === m.home_score && p.away_guess === m.away_score
    const isDir   = !isExact && Math.sign(p.home_guess - p.away_guess) === Math.sign(m.home_score - m.away_score)
    const r = m.round
    const phaseExact = r < 20 ? 3 : r < 34 ? 5 : 7
    const phaseDir   = r < 20 ? 1 : r < 34 ? 2 : 3
    const basePts    = isExact ? phaseExact : isDir ? phaseDir : 0
    const jokerExtra = p.is_joker ? basePts : 0
    streak  += (p.points ?? 0) - basePts - jokerExtra
    joker   += jokerExtra
    penalty += p.penalty_bonus ?? 0
  }
  return { penalty, joker, streak }
}

export async function getMyStats(userId) {
  const [{ data: lb }, { data: maxStreakData }, { data: penPreds }] = await Promise.all([
    supabase.from('leaderboard_view').select('*').eq('user_id', userId).maybeSingle(),
    supabase.rpc('get_max_streak', { p_user_id: userId }),
    supabase.from('predictions').select('penalty_bonus').eq('user_id', userId).gt('penalty_bonus', 0),
  ])
  return {
    exact:       lb?.exact_count       ?? 0,
    dir:         lb?.direction_count   ?? 0,
    total:       lb?.total_points      ?? 0,
    played:      lb?.total_predictions ?? 0,
    maxStreak:   maxStreakData         ?? 0,
    penaltyHits: (penPreds || []).length,
  }
}
