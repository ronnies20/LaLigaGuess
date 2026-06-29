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
  'Espanyol':        { short: 'ESP', color: '#4488CC', bg: '#001233', initial: 'א', logoId: 534 },
  'Alaves':          { short: 'ALA', color: '#5599CC', bg: '#001233', initial: 'א', logoId: 542 },
  'Leganes':         { short: 'LEG', color: '#4477BB', bg: '#001233', initial: 'ל', logoId: 723 },
  'Valladolid':      { short: 'VLL', color: '#9B6FD4', bg: '#0e0033', initial: 'ו', logoId: 720 },
}

export function getTeamInfo(name) {
  return TEAMS[name] || { short: name.slice(0, 3).toUpperCase(), color: '#888', bg: '#1a1a1a', initial: name[0], logoId: null }
}

export function getTeamLogoUrl(logoId) {
  return logoId ? `https://media.api-sports.io/football/teams/${logoId}.png` : null
}

export function calcPoints(homeGuess, awayGuess, homeReal, awayReal) {
  if (homeReal === null || homeReal === undefined) return null
  if (homeGuess === null || homeGuess === undefined) return 0
  if (homeGuess === homeReal && awayGuess === awayReal) return 3
  const realDir = Math.sign(homeReal - awayReal)
  const guessDir = Math.sign(homeGuess - awayGuess)
  return realDir === guessDir ? 1 : 0
}

export function isMatchLocked(kickoff) {
  const kickoffDate = new Date(kickoff)
  const lockTime = new Date(kickoffDate.getTime() - 5 * 60 * 1000)
  return new Date() >= lockTime
}

export function formatKickoff(kickoff) {
  const d = new Date(kickoff)
  return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

export const CURRENT_ROUND = 1
export const TOTAL_ROUNDS = 38
