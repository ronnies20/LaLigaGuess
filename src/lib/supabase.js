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
    .select('*, matches(home_team, away_team, home_score, away_score, kickoff, locked)')
    .eq('user_id', userId)
    .eq('matches.round', round)
  if (error) throw error
  return data
}

export async function upsertPrediction(userId, matchId, homeGuess, awayGuess) {
  const { data, error } = await supabase
    .from('predictions')
    .upsert(
      { user_id: userId, match_id: matchId, home_guess: homeGuess, away_guess: awayGuess },
      { onConflict: 'user_id,match_id' }
    )
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

export async function getMyStats(userId) {
  const { data, error } = await supabase
    .from('predictions')
    .select('points')
    .eq('user_id', userId)
    .not('points', 'is', null)
  if (error) throw error
  const exact = data.filter(p => p.points === 3).length
  const dir   = data.filter(p => p.points === 1).length
  const total = data.reduce((s, p) => s + p.points, 0)
  return { exact, dir, total, played: data.length }
}
