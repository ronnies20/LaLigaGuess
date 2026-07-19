/**
 * LaLigaGuess Integration Test Suite
 *
 * Runs all test suites against the TEST Supabase project (never production).
 *
 * Requirements:
 *   scripts/tests/.env.test.secrets must contain:
 *     SUPABASE_URL=https://[test-project].supabase.co
 *     SUPABASE_SERVICE_KEY=...
 *
 * Usage:
 *   node scripts/tests/run-suite.js           # all suites
 *   node scripts/tests/run-suite.js scoring   # one suite by name
 *
 * Suite names: scoring, streak, penalty, leaderboard, calcpoints
 */

// Must be first import — sets SUPABASE_URL + SUPABASE_SERVICE_KEY in process.env
import './helpers/loadSecrets.js'

import { run as runScoring }     from './suite/scoring.js'
import { run as runStreak }      from './suite/streak.js'
import { run as runPenalty }     from './suite/penalty.js'
import { run as runLeaderboard } from './suite/leaderboard.js'
import { run as runCalcPoints }  from './suite/calcpoints.js'

const ALL_SUITES = {
  scoring:     runScoring,
  streak:      runStreak,
  penalty:     runPenalty,
  leaderboard: runLeaderboard,
  calcpoints:  runCalcPoints,
}

const filter = process.argv[2]?.toLowerCase()
const suites = filter
  ? Object.entries(ALL_SUITES).filter(([name]) => name.includes(filter))
  : Object.entries(ALL_SUITES)

if (!suites.length) {
  console.error(`No suite matches "${filter}". Available: ${Object.keys(ALL_SUITES).join(', ')}`)
  process.exit(1)
}

console.log('🧪 LaLigaGuess Test Suite')
console.log(`   DB: ${process.env.SUPABASE_URL}`)
if (filter) console.log(`   Filter: "${filter}"`)

let totalPassed = 0, totalFailed = 0

for (const [name, run] of suites) {
  try {
    const { passed, failed } = await run()
    totalPassed += passed
    totalFailed += failed
  } catch (err) {
    console.error(`\n💥 Suite "${name}" crashed before completing:`)
    console.error(`   ${err.message}`)
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'))
    totalFailed++
  }
}

const sep = '═'.repeat(44)
console.log(`\n${sep}`)
console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`)

if (totalFailed === 0) {
  console.log('✅ All tests passed!')
} else {
  console.error(`❌ ${totalFailed} test(s) failed`)
  process.exit(1)
}
