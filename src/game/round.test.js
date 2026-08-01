import { describe, it, expect } from 'vitest'
import { buildRoundQueue, arcadeQuestionFor } from './round'
import { ARCADE_SETS, arcadeSet } from './arcadeSets'
import { emptyState } from './mastery'
import { makeRng } from './rng'

describe('arcade round assembly', () => {
  it('tiles the set generously so a fast child never runs out mid-run', () => {
    const queue = buildRoundQueue(emptyState(), 'addition', { mode: 'arcade', setId: 'addition.core', rng: makeRng(1) })
    expect(queue.length).toBeGreaterThanOrEqual(150)
  })

  it('reshuffles order on every lap — the set must not repeat in the same sequence', () => {
    const set = arcadeSet('addition.core')
    const queue = buildRoundQueue(emptyState(), 'addition', { mode: 'arcade', setId: 'addition.core', rng: makeRng(2) })
    const lapSize = set.facts.length
    const firstLap = queue.slice(0, lapSize).map(f => f.key)
    const secondLap = queue.slice(lapSize, lapSize * 2).map(f => f.key)
    // Same content, both laps...
    expect([...firstLap].sort()).toEqual([...secondLap].sort())
    // ...but not the same order (astronomically unlikely by chance at this size)
    expect(firstLap).not.toEqual(secondLap)
  })

  it('every lap still contains exactly the set, once each', () => {
    const set = arcadeSet('addition.core')
    const queue = buildRoundQueue(emptyState(), 'addition', { mode: 'arcade', setId: 'addition.core', rng: makeRng(3) })
    const lapSize = set.facts.length
    for (let lap = 0; lap * lapSize < queue.length; lap++) {
      const keys = queue.slice(lap * lapSize, (lap + 1) * lapSize).map(f => f.key).sort()
      expect(keys).toEqual([...set.facts.map(f => f.key)].sort())
    }
  })

  it('returns nothing for an unknown set rather than throwing', () => {
    expect(buildRoundQueue(emptyState(), 'addition', { mode: 'arcade', setId: 'nope', rng: makeRng(4) })).toEqual([])
  })
})

describe('arcadeQuestionFor', () => {
  const fact = ARCADE_SETS[0].facts[0]

  it('always uses the plain three-option format — never entry, missing, or word', () => {
    for (let seed = 0; seed < 30; seed++) {
      const q = arcadeQuestionFor(fact, { rng: makeRng(seed) })
      expect(q.format).toBe('standard')
      expect(q.opts.length).toBe(3)
      expect(q.prompt).toMatch(/= \?$/)
    }
  })

  it('includes the correct answer among the options, every time', () => {
    for (const set of ARCADE_SETS) {
      for (const f of set.facts.slice(0, 10)) {
        const q = arcadeQuestionFor(f, { rng: makeRng(5) })
        expect(q.opts, f.key).toContain(q.ans)
        expect(new Set(q.opts).size, f.key).toBe(3)
      }
    }
  })

  it('keeps the same distractor VALUES for a fact across different runs', () => {
    // Comparability is the whole point of a fixed set — the content of a
    // given flashcard must not quietly get easier or harder some runs.
    const runA = arcadeQuestionFor(fact, { rng: makeRng(10) })
    const runB = arcadeQuestionFor(fact, { rng: makeRng(99) })
    expect([...runA.opts].sort()).toEqual([...runB.opts].sort())
  })

  it('varies WHICH BUTTON holds the correct answer across runs', () => {
    // Otherwise a well-practised child answers from screen position rather
    // than by computing, and the score stops measuring arithmetic.
    const positions = new Set()
    for (let seed = 0; seed < 40; seed++) {
      const q = arcadeQuestionFor(fact, { rng: makeRng(seed) })
      positions.add(q.opts.indexOf(q.ans))
    }
    expect(positions.size).toBeGreaterThan(1)
  })
})
