/**
 * Side-effect module: loads .env.test.secrets into process.env.
 * Import this FIRST in run-suite.js so all subsequent modules see the env vars.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const secretsPath = join(__dir, '../.env.test.secrets')

let raw
try {
  raw = readFileSync(secretsPath, 'utf8')
} catch {
  console.error('❌ Missing scripts/tests/.env.test.secrets')
  console.error('   Create it with:')
  console.error('   SUPABASE_URL=https://[test-project].supabase.co')
  console.error('   SUPABASE_SERVICE_KEY=...')
  process.exit(1)
}

raw.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k?.trim() && v.length) process.env[k.trim()] = v.join('=').trim()
})

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_KEY missing in .env.test.secrets')
  process.exit(1)
}
