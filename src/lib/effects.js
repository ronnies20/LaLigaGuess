export function playCoinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1400, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {}
}

export function playJackpotSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523, 659, 784, 1047, 1318]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.1
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.start(t)
      osc.stop(t + 0.35)
    })
  } catch {}
}

export function fireConfetti(originX, originY) {
  const colors = [
    '#FDB927', '#FFE566', '#552583', '#7B37BB',
    '#004D98', '#00E676', '#FF1744', '#FFFFFF',
    '#A50044', '#FFA500', '#00BFFF',
  ]

  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden'
  document.body.appendChild(container)

  const cx = originX ?? window.innerWidth / 2
  const cy = originY ?? window.innerHeight * 0.35

  const particles = []

  for (let i = 0; i < 90; i++) {
    const el = document.createElement('div')
    const color = colors[Math.floor(Math.random() * colors.length)]
    const size = Math.random() * 10 + 4
    const isCircle = Math.random() > 0.4
    el.style.cssText = `position:absolute;width:${size}px;height:${isCircle ? size : size * 0.35}px;background:${color};border-radius:${isCircle ? '50%' : '2px'};left:${cx}px;top:${cy}px;`
    container.appendChild(el)

    const angle = Math.random() * Math.PI * 2
    const speed = Math.random() * 320 + 120
    particles.push({
      el,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 280,
      rot: Math.random() * 720 * (Math.random() > 0.5 ? 1 : -1),
      start: performance.now(),
      dur: 1200 + Math.random() * 600,
    })
  }

  function animate(now) {
    let alive = false
    for (const p of particles) {
      const t = (now - p.start) / p.dur
      if (t >= 1) { p.el.style.display = 'none'; continue }
      alive = true
      p.el.style.left = (cx + p.vx * t) + 'px'
      p.el.style.top  = (cy + p.vy * t + 500 * t * t) + 'px'
      p.el.style.opacity = String(Math.max(0, 1 - t * 1.4))
      p.el.style.transform = `rotate(${p.rot * t}deg)`
    }
    if (alive) requestAnimationFrame(animate)
    else container.remove()
  }

  requestAnimationFrame(animate)
}

const CELEBRATED_KEY = 'casino_celebrated'
export function getCelebrated() {
  try { return new Set(JSON.parse(sessionStorage.getItem(CELEBRATED_KEY) || '[]')) }
  catch { return new Set() }
}
export function markCelebrated(id) {
  const s = getCelebrated(); s.add(id)
  sessionStorage.setItem(CELEBRATED_KEY, JSON.stringify([...s]))
}
