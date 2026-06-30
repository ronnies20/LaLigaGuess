export const TEAMS = {
  'Real Madrid':     { short: 'MAD', color: '#C9A84C', bg: '#1a1200', initial: 'ר', logoId: 541 },
  'Barcelona':       { short: 'BAR', color: '#004D9E', bg: '#001a33', initial: 'ב', logoId: 529 },
  'Atletico Madrid': { short: 'ATL', color: '#CE1021', bg: '#1a0002', initial: 'א', logoId: 530 },
  'Sevilla':         { short: 'SEV', color: '#D4002A', bg: '#1a0002', initial: 'ס', logoId: 536 },
  'Real Betis':      { short: 'BET', color: '#00883A', bg: '#001a0d', initial: 'ב', logoId: 543 },
  'Valencia':        { short: 'VAL', color: '#EF7D00', bg: '#1a0e00', initial: 'ו', logoId: 532 },
  'Villarreal':      { short: 'VIL', color: '#FFDA00', bg: '#1a1400', initial: 'ו', logoId: 533 },
  'Real Sociedad':   { short: 'SOC', color: '#005AA7', bg: '#001233', initial: 'ס', logoId: 548 },
  'Osasuna':         { short: 'OSA', color: '#C11B17', bg: '#1a0002', initial: 'א', logoId: 727 },
  'Athletic Club':   { short: 'ATH', color: '#EE3124', bg: '#1a0002', initial: 'א', logoId: 531 },
  'Rayo Vallecano':  { short: 'RAY', color: '#D4002A', bg: '#1a0002', initial: 'ר', logoId: 728 },
  'Celta Vigo':      { short: 'CEL', color: '#6CACE4', bg: '#001a2e', initial: 'ס', logoId: 538 },
  'Getafe':          { short: 'GET', color: '#6CA0DC', bg: '#001233', initial: 'ג', logoId: 546 },
  'Mallorca':        { short: 'MAL', color: '#D4002A', bg: '#1a0002', initial: 'מ', logoId: 798 },
  'Las Palmas':      { short: 'LPA', color: '#FFDA00', bg: '#1a1400', initial: 'ל', logoId: 840 },
  'Girona':          { short: 'GIR', color: '#D4002A', bg: '#1a0002', initial: 'ג', logoId: 547 },
  'Espanyol':        { short: 'ESP', color: '#4488CC', bg: '#001233', initial: 'א', logoId: 534, logoUrl: '/logos/espanyol.png' },
  'Alaves':          { short: 'ALA', color: '#5599CC', bg: '#001233', initial: 'א', logoId: 542 },
  'Leganes':         { short: 'LEG', color: '#4477BB', bg: '#001233', initial: 'ל', logoId: 723 },
  'Valladolid':      { short: 'VLL', color: '#9B6FD4', bg: '#0e0033', initial: 'ו', logoId: 720 },
}

export function getTeamInfo(name) {
  return TEAMS[name] || { short: name.slice(0, 3).toUpperCase(), color: '#888', bg: '#1a1a1a', initial: name[0], logoId: null }
}

export function getTeamLogoUrl(logoId, logoUrl) {
  if (logoUrl) return logoUrl
  return logoId ? `https://media.api-sports.io/football/teams/${logoId}.png` : null
}

// Phase-based scoring:
// Rounds  1-19: exact=3, dir=1  (base)
// Rounds 20-33: exact=5, dir=2  (Phase 2)
// Rounds 34-38: exact=7, dir=3  (Sprint)
export function getPhaseBase(round = 1) {
  if (round >= 34) return { exact: 7, dir: 3 }
  if (round >= 20) return { exact: 5, dir: 2 }
  return { exact: 3, dir: 1 }
}

// streakBefore = exact-guess streak going into this match (mirrors the
// streak_count the update_match_points() SQL trigger reads) — used only
// to keep the live-preview preview in sync with the eventual server value.
export function calcPoints(homeGuess, awayGuess, homeReal, awayReal, isJoker = false, isSpecial = false, round = 1, streakBefore = 0) {
  if (homeReal === null || homeReal === undefined) return null
  if (homeGuess === null || homeGuess === undefined) return isJoker ? -1 : 0
  const { exact, dir } = getPhaseBase(round)
  const isExact = homeGuess === homeReal && awayGuess === awayReal
  if (isJoker) {
    if (!isExact) return streakBefore >= 4 ? -3 : -1
    if (streakBefore >= 5) return exact * 2 + 3
    if (streakBefore >= 4) return exact * 2 + 1
    return exact * 2
  }
  if (isSpecial) {
    if (isExact) return exact * 2
    const realDir = Math.sign(homeReal - awayReal)
    const guessDir = Math.sign(homeGuess - awayGuess)
    return realDir === guessDir ? dir * 2 : 0
  }
  if (isExact) {
    if (streakBefore >= 5) return exact + 3
    if (streakBefore >= 4) return exact + 2
    return exact
  }
  const realDir = Math.sign(homeReal - awayReal)
  const guessDir = Math.sign(homeGuess - awayGuess)
  return realDir === guessDir ? dir : 0
}

export const LIVE_STATUSES     = ['1H','HT','2H','ET','BT','P','INT']
export const FINISHED_STATUSES = ['FT','AET','PEN']

export function isMatchLive(status)     { return LIVE_STATUSES.includes(status) }
export function isMatchFinished(status) { return FINISHED_STATUSES.includes(status) }

export function getStatusLabel(status) {
  const map = { '1H':'מח׳ ראשונה', HT:'הפסקה', '2H':'מח׳ שנייה', ET:'הארכות', P:'פנדלים' }
  return map[status] || null
}

export function isMatchLocked(kickoff) {
  const kickoffDate = new Date(kickoff)
  const lockTime = new Date(kickoffDate.getTime() - 60 * 60 * 1000)
  return new Date() >= lockTime
}

export function formatKickoff(kickoff) {
  const d = new Date(kickoff)
  return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

export const CURRENT_ROUND = 1
export const TOTAL_ROUNDS = 38
