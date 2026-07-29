/**
 * Sound, synthesised — no audio files, nothing to download, works offline.
 *
 * iOS creates the AudioContext suspended and only a *user-gesture-originated*
 * `resume()` unlocks it, so the context is created lazily on first gesture
 * rather than at module load. Backgrounding a home-screen webapp suspends it
 * again, hence the visibilitychange handler.
 */

let ctx = null
let master = null
let noiseBuffer = null
let enabled = true

function ensureContext() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = enabled ? 0.8 : 0
  master.connect(ctx.destination)
  return ctx
}

/** Two seconds of white noise, built once and reused for crowd/thud/scuff */
function getNoise() {
  if (noiseBuffer || !ctx) return noiseBuffer
  const len = ctx.sampleRate * 2
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return noiseBuffer
}

/** Attach to the first gesture. Safe to call repeatedly. */
export function unlockAudio() {
  const c = ensureContext()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

export function setSoundEnabled(on) {
  enabled = on
  if (master) master.gain.value = on ? 0.8 : 0
}

export function isSoundEnabled() {
  return enabled
}

/** Standard envelope. Exponential ramps can't reach 0, hence 0.0001. */
function envelope(gain, t, { peak = 0.2, attack = 0.01, dur = 0.3 }) {
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(peak, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
}

function tone({ type = 'sine', freq = 440, dur = 0.2, peak = 0.15, attack = 0.01, at = 0, bend = null, filter = null }) {
  if (!ctx || !enabled) return
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (bend) {
    bend.forEach(([f, dt]) => osc.frequency.linearRampToValueAtTime(f, t + dt))
  }
  envelope(gain, t, { peak, attack, dur })

  let node = osc
  if (filter) {
    const biq = ctx.createBiquadFilter()
    biq.type = filter.type ?? 'lowpass'
    biq.frequency.value = filter.freq ?? 2000
    node.connect(biq); node = biq
  }
  node.connect(gain).connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise({ dur = 0.2, peak = 0.15, attack = 0.01, at = 0, filterType = 'lowpass', freq = 800, q = 1, sweepTo = null }) {
  if (!ctx || !enabled) return
  const buf = getNoise()
  if (!buf) return
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = buf
  const biq = ctx.createBiquadFilter()
  biq.type = filterType
  biq.frequency.setValueAtTime(freq, t)
  biq.Q.value = q
  if (sweepTo) biq.frequency.linearRampToValueAtTime(sweepTo, t + dur * 0.7)
  const gain = ctx.createGain()
  envelope(gain, t, { peak, attack, dur })
  src.connect(biq).connect(gain).connect(master)
  src.start(t)
  src.stop(t + dur + 0.02)
}

/* ── THE KIT ───────────────────────────────────────────────── */

export const sfx = {
  click:   () => tone({ type: 'square', freq: 880, dur: 0.04, peak: 0.07, filter: { freq: 2000 } }),

  /** Round start. Bent pitch = "go". */
  whistle: () => {
    tone({ type: 'sine', freq: 1900, dur: 0.35, peak: 0.1, bend: [[2300, 0.12], [1900, 0.3]] })
    tone({ type: 'sine', freq: 1907, dur: 0.35, peak: 0.06, bend: [[2307, 0.12], [1907, 0.3]] })
  },

  /** Out of time. Flat pitch = "stop" — must not be mistaken for the start. */
  whistleFlat: () => tone({ type: 'sine', freq: 1400, dur: 0.28, peak: 0.1, attack: 0.015 }),

  /** Keeper gets a hand to it */
  thud: () => {
    tone({ type: 'sine', freq: 160, dur: 0.18, peak: 0.22, bend: [[45, 0.12]] })
    noise({ dur: 0.06, peak: 0.12, freq: 400 })
  },

  /** The ball that never reached the goal — deliberately anticlimactic */
  scuff: () => noise({ dur: 0.04, peak: 0.05, freq: 300 }),

  goal: () => {
    // Crowd: filtered noise with a swept bandpass gives a convincing roar
    noise({ dur: 1.2, peak: 0.16, attack: 0.25, filterType: 'bandpass', freq: 700, sweepTo: 1400, q: 0.8 })
    ;[523, 659, 784].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.3, peak: 0.11, at: i * 0.07 }))
  },

  /** Two discrete urgency marks, not a tick. A metronome competes with the
      inner voice a child uses to sub-vocalise the arithmetic. */
  urgent1: () => tone({ type: 'triangle', freq: 660, dur: 0.09, peak: 0.06 }),
  urgent2: () => tone({ type: 'triangle', freq: 830, dur: 0.09, peak: 0.07 }),

  unlock: () => [660, 880, 1100].forEach((f, i) =>
    tone({ type: 'triangle', freq: f, dur: 0.22, peak: 0.1, at: i * 0.09 })),
}

/** Wire up first-gesture unlock and re-unlock after backgrounding */
export function installAudioUnlock() {
  const kick = () => unlockAudio()
  document.addEventListener('pointerdown', kick, { once: true })
  document.addEventListener('keydown', kick, { once: true })
  const onVisible = () => { if (document.visibilityState === 'visible') unlockAudio() }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    document.removeEventListener('pointerdown', kick)
    document.removeEventListener('keydown', kick)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
