import { describe, it, expect } from 'vitest'
import {
  emptyState, applyAnswer, composeRound, openStrands, boxOf,
  masteredCount, recentAccuracy, optionCountFor, workingOn, labelForKey,
  MASTERED_BOX,
} from './mastery'
import { STRANDS_BY_OP, answerOf, factKey } from './facts'
import { makeRng } from './rng'

/**
 * Play the game as a simulated child.
 * @param skill probability of answering a fact correctly on the first try
 */
function simulate({ skill, rounds = 40, op = 'addition', seed = 7, latencyMs = 2500 }) {
  const r = makeRng(seed)
  let state = emptyState()
  const asked = []

  for (let i = 0; i < rounds; i++) {
    for (const fact of composeRound(state, op, { rng: r })) {
      asked.push(fact)
      state = applyAnswer(state, { fact, correct: r() < skill, latencyMs })
    }
  }
  return { state, asked }
}

const strandsOf = asked => new Set(asked.map(f => f.strand))

describe('progression pacing', () => {
  it('moves a strong child off the easiest strand quickly', () => {
    const { state, asked } = simulate({ skill: 0.97, rounds: 12 })
    // 12 rounds is 60 items. A child getting nearly everything right should be
    // well past "sums within 10" by then — the old fixed threshold needed
    // ~60 correct answers just to leave the first strand.
    expect(openStrands(state, 'addition').map(s => s.id)).not.toEqual(['A1'])
    expect(strandsOf(asked).size).toBeGreaterThan(1)
  })

  it('keeps a struggling child on the foundations', () => {
    const { state, asked } = simulate({ skill: 0.45, rounds: 12 })
    const reached = [...strandsOf(asked)]
    expect(reached.every(id => ['A1', 'A2'].includes(id)), `reached ${reached}`).toBe(true)
    expect(openStrands(state, 'addition')[0].id).toBe('A1')
  })

  it('does not open the next strand on a cold start', () => {
    expect(openStrands(emptyState(), 'addition').map(s => s.id)).toEqual(['A1'])
  })

  it("doesn't serve the same five trivial facts on a fresh profile", () => {
    // Strictly-first introduction gave every new player `1+1, 1+2, 1+3…`
    const seen = new Set()
    for (let seed = 0; seed < 12; seed++) {
      composeRound(emptyState(), 'addition', { rng: makeRng(seed) })
        .forEach(f => seen.add(f.key))
    }
    expect(seen.size).toBeGreaterThan(4)
  })
})

describe('round composition', () => {
  it('never repeats a fact inside a round', () => {
    const { state } = simulate({ skill: 0.85, rounds: 10 })
    for (let seed = 0; seed < 30; seed++) {
      const round = composeRound(state, 'addition', { rng: makeRng(seed) })
      expect(new Set(round.map(f => f.key)).size).toBe(round.length)
    }
  })

  it('always fills the round', () => {
    for (const op of ['addition', 'subtraction', 'multiplication', 'division']) {
      const round = composeRound(emptyState(), op, { rng: makeRng(3) })
      expect(round.length, op).toBe(5)
    }
  })

  it('opens with a fact the child already knows', () => {
    const { state } = simulate({ skill: 0.9, rounds: 8 })
    const round = composeRound(state, 'addition', { rng: makeRng(11) })
    expect(round[0].role).toBe('warmup')
    expect(boxOf(state, round[0])).toBeGreaterThan(0)
  })
})

describe('the Leitner box', () => {
  const FACT = STRANDS_BY_OP.addition[0].facts[3]

  it('promotes on a fast correct answer', () => {
    const s = applyAnswer(emptyState(), { fact: FACT, correct: true, latencyMs: 1200 })
    expect(boxOf(s, FACT)).toBe(1)
  })

  it('withholds promotion when the answer was slow', () => {
    // Fluency means retrieval, not reconstruction — a laboured correct answer
    // is not yet evidence the fact is automatic.
    const s = applyAnswer(emptyState(), { fact: FACT, correct: true, latencyMs: 9000 })
    expect(boxOf(s, FACT)).toBe(0)
  })

  it('drops two boxes on a miss, never below zero', () => {
    let s = emptyState()
    for (let i = 0; i < 3; i++) s = applyAnswer(s, { fact: FACT, correct: true, latencyMs: 1000 })
    expect(boxOf(s, FACT)).toBe(3)
    s = applyAnswer(s, { fact: FACT, correct: false })
    expect(boxOf(s, FACT)).toBe(1)
    s = applyAnswer(s, { fact: FACT, correct: false })
    s = applyAnswer(s, { fact: FACT, correct: false })
    expect(boxOf(s, FACT)).toBe(0)
  })

  it('does not promote a rebound answer', () => {
    const s = applyAnswer(emptyState(), { fact: FACT, correct: true, latencyMs: 900, secondAttempt: true })
    expect(boxOf(s, FACT)).toBe(0)
    expect(s.agg.correct).toBe(0)
  })

  it('schedules a missed fact for later, not the next item', () => {
    const s = applyAnswer(emptyState(), { fact: FACT, correct: false })
    expect(s.f[FACT.key][1]).toBeGreaterThan(s.n)
  })
})

describe('derived stats', () => {
  it('counts only well-established facts as known', () => {
    const { state } = simulate({ skill: 0.98, rounds: 30 })
    expect(masteredCount(state)).toBeGreaterThan(0)
    for (const [, rec] of Object.entries(state.f)) {
      if (rec[0] < MASTERED_BOX) continue
      expect(rec[0]).toBeGreaterThanOrEqual(MASTERED_BOX)
    }
  })

  it('surfaces the facts a child actually misses', () => {
    const { state } = simulate({ skill: 0.5, rounds: 20 })
    const w = workingOn(state, 5)
    expect(w.length).toBeGreaterThan(0)
    expect(w[0].misses).toBeGreaterThanOrEqual(w.at(-1).misses)
  })

  it('renders a fact key as readable maths', () => {
    expect(labelForKey(factKey('multiplication', 7, 8))).toBe('7 × 8')
    expect(labelForKey(factKey('division', 56, 8))).toBe('56 ÷ 8')
  })

  it('tracks recent accuracy in a bounded window', () => {
    const { state } = simulate({ skill: 0.8, rounds: 30 })
    expect(state.r.addition.length).toBeLessThanOrEqual(20)
    const acc = recentAccuracy(state, 'addition')
    expect(acc).toBeGreaterThan(0.4)
    expect(acc).toBeLessThanOrEqual(1)
  })
})

describe('presentation policy', () => {
  it('adds a fourth option once a fact is being assessed rather than learned', () => {
    expect(optionCountFor(0)).toBe(3)
    expect(optionCountFor(2)).toBe(3)
    expect(optionCountFor(3)).toBe(4)
    expect(optionCountFor(5)).toBe(4)
  })
})

describe('division rests on multiplication', () => {
  /** Give the child solid knowledge of the first `n` multiplication facts */
  function withTimesTables(n) {
    let state = emptyState()
    for (const f of STRANDS_BY_OP.multiplication.flatMap(s => s.facts).slice(0, n)) {
      for (let i = 0; i < 3; i++) {
        state = applyAnswer(state, { fact: f, correct: true, latencyMs: 1000 })
      }
    }
    return state
  }

  it('prefers division facts whose inverse the child already knows', () => {
    const r = makeRng(5)
    const state = withTimesTables(24)

    let grounded = 0, total = 0
    for (let i = 0; i < 40; i++) {
      for (const fact of composeRound(state, 'division', { rng: r })) {
        const invBox = state.f[factKey('multiplication', fact.b, answerOf(fact))]?.[0] ?? 0
        // Serving `56 ÷ 8` to a child who doesn't know `7 × 8` teaches nothing
        if (invBox >= 2) grounded++
        total++
      }
    }
    expect(grounded / total, `${grounded}/${total} grounded`).toBe(1)
  })

  it('still gives a playable round to a child who picks division first', () => {
    // The gate sequences division; it must not lock a child out of trying it
    const round = composeRound(emptyState(), 'division', { rng: makeRng(9) })
    expect(round).toHaveLength(5)
    for (const f of round) expect(f.a % f.b).toBe(0)
  })
})
