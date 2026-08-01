import { describe, it, expect, beforeEach } from 'vitest'
import {
  load, save, flush, clear, sanitize, __resetStorage,
  weekId, loadWeek, saveWeek, exportBackup, importBackup,
} from './storage'
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

describe('latency ring (v4)', () => {
  it('migrates an old save all the way forward, keeping everything earned', () => {
    __resetStorage()
    localStorage.clear()
    localStorage.setItem('mc_state', JSON.stringify({
      v: 3, n: 50, f: { 'a3.4': [2, 5, 1, 0] }, rivalry: { season: 2, stage: 1 },
    }))
    const s = load()
    expect(s.v).toBe(emptyState().v)            // current version, whatever it is
    expect(s.l).toEqual([])
    expect(s.gates).toEqual({})
    expect(s.f['a3.4']).toEqual([2, 5, 1, 0])   // mastery untouched
    expect(s.rivalry.season).toBe(2)            // season untouched
  })

  it('clamps and bounds corrupt latency data', () => {
    const s = sanitize({ l: ['banana', -5, 1e9, 2500, ...Array(80).fill(1200)] })
    expect(s.l.length).toBe(30)
    for (const v of s.l) {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(60000)
    }
  })
})

describe('weekly snapshot', () => {
  it('computes a Monday-based week id', () => {
    // Swedish school weeks start Monday
    const mon = weekId(new Date('2026-07-27T09:00:00Z'))
    const sun = weekId(new Date('2026-08-02T09:00:00Z'))
    const nextMon = weekId(new Date('2026-08-03T09:00:00Z'))
    expect(mon).toBe(sun)          // same week
    expect(nextMon).not.toBe(mon)  // new week
  })

  it('round-trips and clamps', () => {
    saveWeek({ id: '2026-w30', mastered: 12, shown: false })
    expect(loadWeek()).toEqual({ id: '2026-w30', mastered: 12, shown: false })

    saveWeek({ id: '2026-w30', mastered: -5, shown: true })
    expect(loadWeek().mastered).toBe(0)
  })

  it('returns null rather than throwing on garbage', () => {
    localStorage.setItem('mc_week', '{broken')
    expect(loadWeek()).toBeNull()
    localStorage.setItem('mc_week', JSON.stringify({ nope: 1 }))
    expect(loadWeek()).toBeNull()
  })

  it('is not a history, so it cannot become a breakable streak', () => {
    saveWeek({ id: '2026-w30', mastered: 12, shown: true })
    const w = loadWeek()
    expect(Object.keys(w).sort()).toEqual(['id', 'mastered', 'shown'])
  })
})

describe('backup — the manual bridge between devices', () => {
  it('round-trips a full save', () => {
    __resetStorage(); localStorage.clear()
    const s = { ...emptyState(), n: 99, f: { 'm7.8': [4, 10, 2, 1] },
      agg: { ...emptyState().agg, correct: 120, goals: 130 } }
    save(s, { immediate: true })

    const text = exportBackup()
    localStorage.clear(); __resetStorage()
    expect(load().agg.correct).toBe(0)          // gone, as after clearing site data

    expect(importBackup(text).ok).toBe(true)
    const back = load()
    expect(back.agg.correct).toBe(120)
    expect(back.f['m7.8']).toEqual([4, 10, 2, 1])
  })

  it('upgrades an older backup rather than trusting it', () => {
    const old = JSON.stringify({
      kind: 'math-champions-backup', v: 1,
      state: { v: 2, n: 10, f: { 'a3.4': [3, 1, 0, 0] }, agg: { correct: 7 } },
    })
    expect(importBackup(old).ok).toBe(true)
    const back = load()
    expect(back.v).toBe(emptyState().v)         // migrated forward
    expect(back.f['a3.4']).toEqual([3, 1, 0, 0])
    expect(back.gates).toEqual({})              // fields the old save lacked
  })

  it('refuses anything that is not one of our backups', () => {
    expect(importBackup('not json at all').ok).toBe(false)
    expect(importBackup('{"kind":"something-else"}').reason).toBe('notBackup')
    expect(importBackup('[]').reason).toBe('notBackup')
  })

  it('sanitises a tampered backup instead of trusting it', () => {
    const evil = JSON.stringify({
      kind: 'math-champions-backup', v: 1,
      state: { v: emptyState().v, agg: { correct: 'banana' }, f: { 'a3.4': [99, -1, 'x', 5] } },
    })
    expect(importBackup(evil).ok).toBe(true)
    const back = load()
    expect(back.agg.correct).toBe(0)
    expect(back.f['a3.4'][0]).toBe(5)           // clamped to the max box
  })

  it('does not choke on a backup from a newer build', () => {
    const future = JSON.stringify({
      kind: 'math-champions-backup', v: 1, state: { v: 99, agg: { correct: 500 } },
    })
    expect(importBackup(future).ok).toBe(true)
    expect(load().agg.correct).toBe(0)          // ignored rather than guessed at
  })
})

describe('arcade bests (v6)', () => {
  it('migrates a v5 save with an empty arcade ledger', () => {
    __resetStorage(); localStorage.clear()
    localStorage.setItem('mc_state', JSON.stringify({
      v: 5, n: 40, f: { 'a3.4': [3, 2, 1, 0] }, gates: {},
    }))
    const s = load()
    expect(s.v).toBe(6)
    expect(s.arcade).toEqual({})
    expect(s.f['a3.4']).toEqual([3, 2, 1, 0])   // mastery untouched by the migration
  })

  it('drops an arcade record for a set that no longer exists', () => {
    const s = sanitize({ arcade: { 'addition.core': { best: 5, runs: [5] }, 'nope.core': { best: 99, runs: [99] } } })
    expect(s.arcade['addition.core']).toEqual({ best: 5, runs: [5], at: 0 })
    expect(s.arcade['nope.core']).toBeUndefined()
  })

  it('clamps a corrupt arcade record rather than trusting it', () => {
    const s = sanitize({ arcade: { 'addition.core': { best: -5, runs: ['x', 9999, 3] } } })
    expect(s.arcade['addition.core'].best).toBe(0)
    expect(s.arcade['addition.core'].runs).toEqual([0, 999, 3])
  })

  it('bounds run history the same way a fresh state does', () => {
    const s = sanitize({ arcade: { 'addition.core': { best: 20, runs: Array(50).fill(1) } } })
    expect(s.arcade['addition.core'].runs.length).toBeLessThanOrEqual(8)
  })

  it('round-trips through export/import', () => {
    __resetStorage(); localStorage.clear()
    let s = emptyState()
    s = { ...s, arcade: { 'addition.core': { best: 14, runs: [10, 14], at: 12345 } } }
    save(s, { immediate: true })

    const text = exportBackup()
    localStorage.clear(); __resetStorage()
    expect(load().arcade).toEqual({})

    expect(importBackup(text).ok).toBe(true)
    expect(load().arcade['addition.core'].best).toBe(14)
  })
})
