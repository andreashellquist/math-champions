import { describe, it, expect, beforeEach } from 'vitest'
import { load, save, flush, clear, sanitize, __resetStorage } from './storage'
import { emptyState } from './mastery'

beforeEach(() => {
  localStorage.clear()
  __resetStorage()
})

describe('sanitize', () => {
  it('turns a corrupt count into 0 rather than letting NaN through', () => {
    // This is the important one. The old code did `parseInt(raw)` with no
    // radix and no guard; a corrupt value became NaN, and since `NaN < 20`
    // and `NaN < 50` are both false the difficulty ramp jumped straight to
    // its hardest tier — a child with one bad storage entry got the hardest
    // questions in the game, permanently, with no way to tell why.
    const s = sanitize({ agg: { correct: 'banana', goals: NaN, seen: undefined } })
    expect(s.agg.correct).toBe(0)
    expect(s.agg.goals).toBe(0)
    expect(Number.isFinite(s.agg.correct)).toBe(true)
  })

  it('clamps mastery boxes into range', () => {
    const s = sanitize({ f: { 'm7.8': [99, -5, 'x', 3] } })
    expect(s.f['m7.8'][0]).toBe(5)
    expect(s.f['m7.8'][1]).toBe(0)
    expect(s.f['m7.8'][2]).toBe(0)
    expect(s.f['m7.8'][3]).toBe(3)
  })

  it('drops malformed records instead of throwing', () => {
    const s = sanitize({ f: { good: [1, 2, 3, 4], bad: 'nope', worse: null } })
    expect(Object.keys(s.f)).toEqual(['good'])
  })

  it('caps the error ring buffer — the only structure that could grow forever', () => {
    const s = sanitize({ e: Array.from({ length: 500 }, () => 'buggy_algorithm') })
    expect(s.e.length).toBe(20)
  })

  it('returns a usable state for total garbage', () => {
    expect(sanitize(null).agg.correct).toBe(0)
    expect(sanitize('whatever').f).toEqual({})
    expect(sanitize(42).v).toBe(emptyState().v)
  })
})

describe('load / save', () => {
  it('round-trips a state', () => {
    const s = { ...emptyState(), n: 12, f: { 'a3.4': [2, 15, 1, 0] } }
    save(s, { immediate: true })
    const back = load()
    expect(back.n).toBe(12)
    expect(back.f['a3.4']).toEqual([2, 15, 1, 0])
  })

  it('migrates the two legacy keys so existing progress survives', () => {
    localStorage.setItem('mc_correct', '37')
    localStorage.setItem('mc_goals', '37')
    const s = load()
    expect(s.agg.correct).toBe(37)
    expect(s.agg.goals).toBe(37)
    expect(s.v).toBe(emptyState().v)
  })

  it('recovers from unparseable JSON rather than white-screening', () => {
    localStorage.setItem('mc_state', '{not json at all')
    expect(() => load()).not.toThrow()
    expect(load().agg.correct).toBe(0)
  })

  it('refuses to guess at data written by a newer version', () => {
    localStorage.setItem('mc_state', JSON.stringify({ v: 99, agg: { correct: 5 } }))
    expect(load().agg.correct).toBe(0)
  })

  it('clears legacy keys once migrated', () => {
    localStorage.setItem('mc_correct', '5')
    save(load(), { immediate: true })
    expect(localStorage.getItem('mc_correct')).toBeNull()
  })

  it('survives storage being unavailable', () => {
    // Safari private browsing, "Block All Cookies", some home-screen webviews
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('denied') },
    })
    __resetStorage()

    expect(() => load()).not.toThrow()
    expect(() => save(emptyState(), { immediate: true })).not.toThrow()
    expect(() => clear()).not.toThrow()

    Object.defineProperty(window, 'localStorage', original)
    __resetStorage()
  })

  it('stays flat in size as a child plays for months', () => {
    // Per-fact records exist only for the bounded single-digit space;
    // everything multi-digit is tracked per strand. So the record count is
    // capped by the fact space, never by play time.
    const s = emptyState()
    for (let i = 0; i < 5000; i++) {
      s.f[`m${i % 13}.${(i * 7) % 13}`] = [i % 6, i, 0, 0]
    }
    save(s, { immediate: true })
    const bytes = localStorage.getItem('mc_state').length
    expect(bytes).toBeLessThan(20000)
    expect(Object.keys(load().f).length).toBeLessThanOrEqual(400)
  })
})

describe('flush', () => {
  it('writes pending debounced state immediately', () => {
    save({ ...emptyState(), n: 7 })
    flush()
    expect(load().n).toBe(7)
  })
})
