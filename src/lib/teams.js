export const TEAMS = {
  'Real Madrid':     { short: 'MAD', color: '#C9A84C', bg: '#fff8e8', initial: 'ר' },
  'Barcelona':       { short: 'BAR', color: '#004D9E', bg: '#e8f0ff', initial: 'ב' },
  'Atletico Madrid': { short: 'ATL', color: '#CE1021', bg: '#ffe8ea', initial: 'א' },
  'Sevilla':         { short: 'SEV', color: '#D4002A', bg: '#ffe8ea', initial: 'ס' },
  'Real Betis':      { short: 'BET', color: '#00883A', bg: '#e8f8ee', initial: 'ב' },
  'Valencia':        { short: 'VAL', color: '#EF7D00', bg: '#fff3e0', initial: 'ו' },
  'Villarreal':      { short: 'VIL', color: '#FFDA00', bg: '#fffbe0', initial: 'ו' },
  'Real Sociedad':   { short: 'SOC', color: '#005AA7', bg: '#e8f0ff', initial: 'ס' },
  'Osasuna':         { short: 'OSA', color: '#C11B17', bg: '#ffe8ea', initial: 'א' },
  'Athletic Club':   { short: 'ATH', color: '#EE3124', bg: '#ffe8ea', initial: 'א' },
  'Rayo Vallecano':  { short: 'RAY', color: '#D4002A', bg: '#ffe8ea', initial: 'ר' },
  'Celta Vigo':      { short: 'CEL', color: '#6CACE4', bg: '#e8f4ff', initial: 'ס' },
  'Getafe':          { short: 'GET', color: '#004B93', bg: '#e8f0ff', initial: 'ג' },
  'Mallorca':        { short: 'MAL', color: '#D4002A', bg: '#ffe8ea', initial: 'מ' },
  'Las Palmas':      { short: 'LPA', color: '#FFDA00', bg: '#fffbe0', initial: 'ל' },
  'Girona':          { short: 'GIR', color: '#D4002A', bg: '#ffe8ea', initial: 'ג' },
  'Espanyol':        { short: 'ESP', color: '#0055A5', bg: '#e8f0ff', initial: 'א' },
  'Alaves':          { short: 'ALA', color: '#005BAC', bg: '#e8f0ff', initial: 'א' },
  'Leganes':         { short: 'LEG', color: '#003087', bg: '#e8f0ff', initial: 'ל' },
  'Valladolid':      { short: 'VLL', color: '#6A0DAD', bg: '#f0e8ff', initial: 'ו' },
}

export function getTeamInfo(name) {
  return TEAMS[name] || { short: name.slice(0, 3).toUpperCase(), color: '#888', bg: '#f0f0f0', initial: name[0] }
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

export const CURRENT_ROUND = 36
export const TOTAL_ROUNDS = 38
