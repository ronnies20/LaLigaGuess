/**
 * Minimal test harness — no external dependencies.
 * Usage:
 *   const h = makeHarness('Suite Name')
 *   h.it('description', async () => { h.expect(val).toBe(expected) })
 *   const { passed, failed } = await h.run()
 */
export function makeHarness(suiteName) {
  const tests = []
  let passed = 0, failed = 0

  function it(label, fn) {
    tests.push({ label, fn })
  }

  async function run() {
    console.log(`\n══ ${suiteName} ══`)
    for (const { label, fn } of tests) {
      try {
        await fn()
        console.log(`  ✅ ${label}`)
        passed++
      } catch (err) {
        console.error(`  ❌ ${label}`)
        console.error(`     ${err.message}`)
        failed++
      }
    }
    return { passed, failed }
  }

  function expect(val) {
    return {
      toBe(expected) {
        if (val !== expected) {
          throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`)
        }
      },
      toBeNull() {
        if (val !== null && val !== undefined) {
          throw new Error(`Expected null, got ${JSON.stringify(val)}`)
        }
      },
      toBeGreaterThanOrEqual(n) {
        if (!(val >= n)) throw new Error(`Expected ${val} >= ${n}`)
      },
      toBeTrue() {
        if (val !== true) throw new Error(`Expected true, got ${JSON.stringify(val)}`)
      },
    }
  }

  return { it, run, expect }
}
