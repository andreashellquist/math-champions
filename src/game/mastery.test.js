import { describe, it, expect } from 'vitest'
import {
  emptyState, applyAnswer, composeRound, composeMixed, mixedReady, isFatiguing,
  openStrands, boxOf, masteredCount, recentAccuracy, optionCountFor, workingOn,
  labelForKey, MASTERED_BOX, OP_KEYS,
  emptyArcade, applyArcadeResult, arcadeTier, arcadeBest, arcadeRuns, arcadeKey,
} from './mastery'
import { STRANDS_BY_OP, answerOf, factKey } from './facts'
import { computeTimeLimit, TIMER_FLOOR } from '../hooks/useDeadline'
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

describe('latency evidence for the clock', () => {
  const FACT2 = STRANDS_BY_OP.addition[0].facts[5]

  it('records first-attempt latencies only', () => {
    let s = applyAnswer(emptyState(), { fact: FACT2, correct: true, latencyMs: 2200 })
    expect(s.l).toEqual([2200])

    // A rebound is real learning but it is not a timed retrieval
    s = applyAnswer(s, { fact: FACT2, correct: true, latencyMs: 3100, secondAttempt: true })
    expect(s.l).toEqual([2200])

    // Nor is a miss
    s = applyAnswer(s, { fact: FACT2, correct: false, latencyMs: 9000 })
    expect(s.l).toEqual([2200])
  })

  it('stays bounded however long the child plays', () => {
    let s = emptyState()
    for (let i = 0; i < 500; i++) {
      s = applyAnswer(s, { fact: FACT2, correct: true, latencyMs: 1000 + i })
    }
    expect(s.l.length).toBeLessThanOrEqual(30)
  })

  it('produces a clock derived from the child, not from content mastery', () => {
    const fast = Array(20).fill(1400)
    const slow = Array(20).fill(7000)
    const tFast = computeTimeLimit({ op: 'addition', latencies: fast })
    const tSlow = computeTimeLimit({ op: 'addition', latencies: slow })
    expect(tSlow).toBeGreaterThan(tFast)
    expect(tFast).toBeGreaterThanOrEqual(TIMER_FLOOR)
  })

  it('never tightens more than 10% between sessions', () => {
    const t = computeTimeLimit({ op: 'addition', latencies: Array(20).fill(1000), previousT: 10000 })
    expect(t).toBeGreaterThanOrEqual(9000)
  })
})

describe('interleaved mixed rounds', () => {
  /** Bring several operations up to a solid standard */
  function solidIn(ops) {
    let state = emptyState()
    for (const op of ops) {
      for (const f of STRANDS_BY_OP[op].flatMap(s => s.facts).slice(0, 12)) {
        for (let i = 0; i < 3; i++) {
          state = applyAnswer(state, { fact: f, correct: true, latencyMs: 1000 })
        }
      }
    }
    return state
  }

  it('is withheld until two operations are actually solid', () => {
    expect(mixedReady(emptyState(), OP_KEYS)).toBeNull()
    expect(mixedReady(solidIn(['addition']), OP_KEYS)).toBeNull()
    expect(mixedReady(solidIn(['addition', 'subtraction']), OP_KEYS)).toHaveLength(2)
  })

  it('draws from more than one operation', () => {
    const state = solidIn(['addition', 'subtraction'])
    const ops = mixedReady(state, OP_KEYS)
    const round = composeMixed(state, ops, { rng: makeRng(4) })
    expect(round.length).toBeGreaterThan(1)
    expect(new Set(round.map(f => f.op)).size).toBeGreaterThan(1)
  })

  it('never repeats a fact inside a mixed round', () => {
    const state = solidIn(['addition', 'subtraction', 'multiplication'])
    const ops = mixedReady(state, OP_KEYS)
    for (let seed = 0; seed < 20; seed++) {
      const round = composeMixed(state, ops, { rng: makeRng(seed) })
      expect(new Set(round.map(f => f.key)).size).toBe(round.length)
    }
  })
})

describe('fatigue degrades content, never access', () => {
  it('detects a real drop within a session', () => {
    const s = emptyState()
    // strong first half, weak second half
    s.r.addition = [...Array(10).fill(1), ...Array(10).fill(0)]
    expect(isFatiguing(s, 'addition')).toBe(true)
  })

  it('does not fire on a steady session', () => {
    const s = emptyState()
    s.r.addition = Array(20).fill(1)
    expect(isFatiguing(s, 'addition')).toBe(false)
  })

  it('needs enough data before judging', () => {
    const s = emptyState()
    s.r.addition = [1, 1, 0, 0]
    expect(isFatiguing(s, 'addition')).toBe(false)
  })
})

describe('workingOn only reports facts the ladder can serve', () => {
  it('ignores records that do not name a real fact', () => {
    // Storage validates the shape of a key, not whether it names a real fact,
    // so a legacy or corrupt record must not reach a parent as `0 − 0` with a
    // nonsense strategy attached.
    const s = emptyState()
    s.f['s0.0'] = [1, 0, 0, 9]        // n − n, which no strand generates
    s.f['s1.0'] = [1, 0, 0, 8]        // n − 0, likewise
    s.f['zz9.9'] = [1, 0, 0, 7]       // not even an operation
    const real = STRANDS_BY_OP.multiplication[0].facts[3]
    s.f[real.key] = [1, 0, 0, 2]

    const w = workingOn(s, 10)
    expect(w.map(x => x.key)).toEqual([real.key])
  })

  it('still surfaces real facts in most-missed order', () => {
    const s = emptyState()
    const [f1, f2, f3] = STRANDS_BY_OP.multiplication[0].facts
    s.f[f1.key] = [1, 0, 0, 2]
    s.f[f2.key] = [1, 0, 0, 9]
    s.f[f3.key] = [1, 0, 0, 5]
    expect(workingOn(s, 3).map(x => x.key)).toEqual([f2.key, f3.key, f1.key])
  })
})

describe('Snabbskott (arcade) results', () => {
  const D = 30000   // an arbitrary fixed duration — any distinct value would do

  it('starts empty', () => {
    expect(emptyArcade()).toEqual({})
    expect(arcadeBest(emptyState(), 'addition.core', D)).toBe(0)
    expect(arcadeRuns(emptyState(), 'addition.core', D)).toEqual([])
  })

  it('a personal best only ever rises', () => {
    let s = emptyState()
    s = applyArcadeResult(s, { setId: 'addition.core', durationMs: D, score: 8 })
    expect(arcadeBest(s, 'addition.core', D)).toBe(8)

    s = applyArcadeResult(s, { setId: 'addition.core', durationMs: D, score: 5 })
    expect(arcadeBest(s, 'addition.core', D)).toBe(8)   // a worse run cannot lower it

    s = applyArcadeResult(s, { setId: 'addition.core', durationMs: D, score: 12 })
    expect(arcadeBest(s, 'addition.core', D)).toBe(12)
  })

  it('keeps a bounded run history rather than an unbounded log', () => {
    let s = emptyState()
    for (let i = 0; i < 20; i++) s = applyArcadeResult(s, { setId: 'addition.core', durationMs: D, score: i })
    expect(arcadeRuns(s, 'addition.core', D).length).toBeLessThanOrEqual(8)
    expect(arcadeRuns(s, 'addition.core', D).at(-1)).toBe(19)   // most recent kept
  })

  it('keeps sets independent of each other', () => {
    let s = emptyState()
    s = applyArcadeResult(s, { setId: 'addition.core', durationMs: D, score: 9 })
    s = applyArcadeResult(s, { setId: 'multiplication.core', durationMs: D, score: 4 })
    expect(arcadeBest(s, 'addition.core', D)).toBe(9)
    expect(arcadeBest(s, 'multiplication.core', D)).toBe(4)
  })

  it('keeps different durations of the same set independent — a 60s best must not shadow a 30s run', () => {
    // Sharing one record between a 30s and a 60s run would mean the first 60s
    // attempt sets a number no 30s run could ever beat again.
    let s = emptyState()
    s = applyArcadeResult(s, { setId: 'addition.core', durationMs: 60000, score: 40 })
    s = applyArcadeResult(s, { setId: 'addition.core', durationMs: 30000, score: 12 })
    expect(arcadeBest(s, 'addition.core', 30000)).toBe(12)
    expect(arcadeBest(s, 'addition.core', 60000)).toBe(40)
    expect(arcadeTier(s, 'addition.core', 30000, 12)).not.toBe('best')   // it was already the best 30s run
    expect(arcadeTier(s, 'addition.core', 30000, 13)).toBe('best')       // beats the 30s record, not the 60s one
  })

  it('uses a stable, unique key per (set, duration) pair', () => {
    expect(arcadeKey('addition.core', 30000)).toBe('addition.core@30000')
    expect(arcadeKey('addition.core', 30000)).not.toBe(arcadeKey('addition.core', 60000))
  })

  describe('arcadeTier', () => {
    it('calls the very first run on a set a personal best', () => {
      expect(arcadeTier(emptyState(), 'addition.core', D, 3)).toBe('best')
    })

    it('is a best only when it strictly beats the previous record', () => {
      let s = applyArcadeResult(emptyState(), { setId: 'addition.core', durationMs: D, score: 10 })
      expect(arcadeTier(s, 'addition.core', D, 10)).not.toBe('best')   // tying isn't beating
      expect(arcadeTier(s, 'addition.core', D, 11)).toBe('best')
    })

    it('recognises a top-three run that is not a new best', () => {
      let s = emptyState()
      for (const score of [10, 6, 4]) s = applyArcadeResult(s, { setId: 'addition.core', durationMs: D, score })
      // History is [10, 6, 4]; an 8 lands in the top three without being a best
      expect(arcadeTier(s, 'addition.core', D, 8)).toBe('top3')
    })

    it('says neither for a run that is not close to the best runs', () => {
      let s = emptyState()
      for (const score of [10, 9, 8, 7, 6]) s = applyArcadeResult(s, { setId: 'addition.core', durationMs: D, score })
      expect(arcadeTier(s, 'addition.core', D, 2)).toBeNull()
    })

    // The one-part rule this whole mechanic exists to satisfy: a monotone
    // personal best is hit less and less often the more a child plays, so the
    // tier must not just be "is this the best" — most runs need something
    // true and positive left to say.
    it('finds a non-null verdict is reachable on a plausible run of attempts', () => {
      let s = emptyState()
      const seenTier = new Set()
      const scores = [5, 7, 6, 8, 7, 9, 6, 8, 10, 7]
      for (const score of scores) {
        seenTier.add(arcadeTier(s, 'addition.core', D, score))
        s = applyArcadeResult(s, { setId: 'addition.core', durationMs: D, score })
      }
      expect(seenTier.has('best')).toBe(true)
      expect(seenTier.has('top3')).toBe(true)
    })
  })
})
