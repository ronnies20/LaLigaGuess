// Web Audio API sound system — all sounds synthesized, no files needed
let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function note(c, freq, startTime, duration, gain = 0.2, type = 'sine') {
  try {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, startTime)
    g.gain.setValueAtTime(gain, startTime)
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    osc.connect(g).connect(c.destination)
    osc.start(startTime)
    osc.stop(startTime + duration + 0.01)
  } catch {}
}

function noise(c, startTime, duration, cutoff = 400, gain = 0.15) {
  try {
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buffer
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    const g = c.createGain()
    g.gain.setValueAtTime(gain, startTime)
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    src.connect(filter).connect(g).connect(c.destination)
    src.start(startTime)
    src.stop(startTime + duration + 0.01)
  } catch {}
}

// Played when user saves predictions — "bet placed"
export function playSubmit() {
  try {
    const c = getCtx(); const t = c.currentTime
    noise(c, t, 0.08, 200, 0.25)
    note(c, 220, t + 0.05, 0.28, 0.10)
    note(c, 660, t + 0.05, 0.28, 0.10)
    note(c, 1200, t + 0.32, 0.06, 0.15)
  } catch {}
}

// Correct direction but wrong score — unresolved interval = "almost"
export function playNearMiss() {
  try {
    const c = getCtx(); const t = c.currentTime
    note(c, 523, t,        0.15, 0.20)
    note(c, 622, t + 0.15, 0.18, 0.20) // Eb5 — doesn't resolve
  } catch {}
}

// Exact score hit — full jackpot fanfare
export function playExactScore() {
  try {
    const c = getCtx(); const t = c.currentTime
    noise(c, t, 0.08, 300, 0.20)
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => note(c, f, t + 0.10 + i * 0.09, 0.12, 0.20))
    const osc = c.createOscillator()
    const g = c.createGain()
    const lfo = c.createOscillator()
    const lfoG = c.createGain()
    lfo.frequency.value = 6; lfoG.gain.value = 12
    lfo.connect(lfoG).connect(osc.frequency)
    osc.frequency.value = 880
    g.gain.setValueAtTime(0.22, t + 0.60)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.80)
    osc.connect(g).connect(c.destination)
    lfo.start(t + 0.60); osc.start(t + 0.60)
    lfo.stop(t + 1.80); osc.stop(t + 1.80)
    ;[1319,1175,1047,988,880,784,698,659].forEach((f, i) => note(c, f, t + 1.90 + i * 0.08, 0.09, 0.12))
  } catch {}
}

// Joker win — suspense then mega-fanfare + coin shower
export function playJokerWin() {
  try {
    const c = getCtx(); const t = c.currentTime
    note(c, 40, t, 1.80, 0.10, 'sine') // sub-bass drone
    noise(c, t + 1.80, 0.08, 350, 0.30)
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => note(c, f, t + 1.90 + i * 0.09, 0.13, 0.26))
    const osc = c.createOscillator(); const g = c.createGain()
    osc.frequency.value = 880
    g.gain.setValueAtTime(0.30, t + 2.40)
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.60)
    osc.connect(g).connect(c.destination)
    osc.start(t + 2.40); osc.stop(t + 3.60)
    for (let i = 0; i < 20; i++) note(c, 800 + Math.random() * 800, t + 3.70 + i * 0.07, 0.06, 0.08)
  } catch {}
}

// Joker loss — melancholic descending, not harsh
export function playJokerLoss() {
  try {
    const c = getCtx(); const t = c.currentTime
    note(c, 784, t,        0.25, 0.16)
    note(c, 659, t + 0.22, 0.25, 0.14)
    note(c, 523, t + 0.44, 0.50, 0.12)
  } catch {}
}

// Streak milestone — n ascending notes
export function playStreakMilestone(n = 3) {
  try {
    const c = getCtx(); const t = c.currentTime
    const freqs = [523,659,784,1047,1319].slice(0, Math.min(n, 5))
    freqs.forEach((f, i) => note(c, f, t + i * 0.12, 0.20, 0.18 + i * 0.02))
    if (n >= 3) {
      note(c, 523, t + freqs.length * 0.12, 0.45, 0.07)
      note(c, 659, t + freqs.length * 0.12, 0.45, 0.07)
      note(c, 784, t + freqs.length * 0.12, 0.45, 0.07)
    }
  } catch {}
}

// Leaderboard rank climb — whoosh + pings
export function playRankUp(positionsClimbed = 1) {
  try {
    const c = getCtx(); const t = c.currentTime
    // Whoosh
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.30), c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (i / d.length)
    const src = c.createBufferSource(); src.buffer = buf
    const filt = c.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.setValueAtTime(200, t)
    filt.frequency.exponentialRampToValueAtTime(3000, t + 0.30)
    const g = c.createGain()
    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.30)
    src.connect(filt).connect(g).connect(c.destination)
    src.start(t); src.stop(t + 0.31)
    // Pings per position
    const pingFreqs = [523, 659, 784, 1047, 1319]
    for (let i = 0; i < Math.min(positionsClimbed, 5); i++) {
      note(c, pingFreqs[i] || 1319, t + 0.35 + i * 0.13, 0.10, 0.15)
    }
  } catch {}
}

// Short tick for countdown timer
export function playTick() {
  try {
    const c = getCtx()
    note(c, 1000, c.currentTime, 0.03, 0.05)
  } catch {}
}

// Joker hold ritual — rising tension tick during hold
export function playJokerRitual(tickNum = 0) {
  try {
    const c = getCtx(); const t = c.currentTime
    const freqs = [110, 147, 196, 262]
    const f = freqs[Math.min(tickNum, freqs.length - 1)]
    note(c, f, t, 0.12, 0.12, 'sawtooth')
    noise(c, t, 0.05, 150, 0.06)
  } catch {}
}

// Joker successfully activated after hold
export function playJokerActivate() {
  try {
    const c = getCtx(); const t = c.currentTime
    noise(c, t, 0.06, 250, 0.30)
    const osc = c.createOscillator(); const g = c.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(80, t)
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.35)
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
    osc.connect(g).connect(c.destination)
    osc.start(t); osc.stop(t + 0.5)
    ;[523, 659, 784].forEach((f, i) => note(c, f, t + 0.38 + i * 0.06, 0.3, 0.18))
  } catch {}
}
