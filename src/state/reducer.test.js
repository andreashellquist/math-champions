import { describe, it, expect, beforeEach } from 'vitest'
import { reducer, initialState, SUDDEN_DEATH_MAX } from './reducer'
import { setLocale } from '../i18n'
import { opName } from '../game/config'
import { emptyState } from '../game/mastery'
import { buildQuestion } from '../game/questions'
import { ALL_FACTS, factKey } from '../game/facts'
import { makeRng } from '../game/rng'

const rng = makeRng(1234)
const FACT = ALL_FACTS.find(f => f.key === factKey('addition', 3, 4))

/** Five distinct addition facts — a queue of duplicates would suppress requeueing */
const QUEUE_FACTS = ALL_FACTS.filter(f => f.op === 'addition').slice(0, 5)

function roundInProgress(overrides = {}) {
  const question = buildQuestion({ fact: FACT, format: 'standard', optionCount: 3, rng })
  const queue = [FACT, ...QUEUE_FACTS.filter(f => f.key !== FACT.key).slice(0, 4)]
  const s = reducer(initialState(emptyState()), {
    type: 'START_ROUND', op: 'addition', queue, fact: FACT, question, startedAt: 1000,
  })
  return { ...s, round: { ...s.round, ...overrides }, question }
}

describe('input guarding', () => {
  it('ignores a second answer for the same kick — the double-tap fix', () => {
    const s0 = roundInProgress()
    const correct = s0.round.question.ans

    const s1 = reducer(s0, { type: 'ANSWER', value: correct, at: 2000 })
    expect(s1.round.goals).toBe(1)
    expect(s1.round.phase).toBe('resolving')

    // A tap that lands before React commits must not score twice. The old
    // code guarded on a `locked` state value, which is async — two taps both
    // saw it as false, incremented twice and queued two advance timers.
    const s2 = reducer(s1, { type: 'ANSWER', value: correct, at: 2001 })
    expect(s2.round.goals).toBe(1)
    expect(s2).toBe(s1)          // literally a no-op
    expect(s2.round.results).toHaveLength(1)
  })

  it('ignores a tap on an option already spent on this kick', () => {
    const s0 = roundInProgress()
    const wrong = s0.round.question.opts.find(o => o !== s0.round.question.ans)

    const s1 = reducer(s0, { type: 'ANSWER', value: wrong, at: 2000 })
    expect(s1.round.phase).toBe('rebound')
    expect(s1.round.disabled).toContain(wrong)

    const s2 = reducer(s1, { type: 'ANSWER', value: wrong, at: 2100 })
    expect(s2).toBe(s1)
  })
})

describe('the rebound flow', () => {
  it('parries a first miss without revealing the answer or gloating', () => {
    const s0 = roundInProgress()
    const wrong = s0.round.question.opts.find(o => o !== s0.round.question.ans)
    const s1 = reducer(s0, { type: 'ANSWER', value: wrong, at: 2000 })

    expect(s1.round.phase).toBe('rebound')
    expect(s1.round.attempt).toBe(2)
    expect(s1.round.hint).toBeTruthy()          // a strategy, not just the answer
    expect(s1.round.results).toHaveLength(0)    // the kick isn't over
    expect(s1.round.deadline).toBeNull()        // the rebound is never timed
  })

  it('counts a rebound goal but does not let it promote mastery', () => {
    const s0 = roundInProgress()
    const q = s0.round.question
    const wrong = q.opts.find(o => o !== q.ans)

    const s1 = reducer(s0, { type: 'ANSWER', value: wrong, at: 2000 })
    const s2 = reducer(s1, { type: 'ANSWER', value: q.ans, at: 3000 })

    expect(s2.round.goals).toBe(1)
    expect(s2.round.results).toEqual(['rebound'])
    expect(s2.round.brainPoints).toBe(1)
    expect(s2.round.streak).toBe(0)             // a rebound doesn't extend a streak
    // Real learning, but not retrieval — the Leitner box must not advance
    expect(s2.mastery.f[FACT.key][0]).toBe(0)
    expect(s2.mastery.agg.correct).toBe(0)      // first-try accuracy is untouched
  })

  it('requires the child to tap the answer after a second miss', () => {
    const s0 = roundInProgress()
    const q = s0.round.question
    const [w1, w2] = q.opts.filter(o => o !== q.ans)

    const s1 = reducer(s0, { type: 'ANSWER', value: w1, at: 2000 })
    const s2 = reducer(s1, { type: 'ANSWER', value: w2, at: 3000 })
    expect(s2.round.phase).toBe('reveal')
    expect(s2.round.results).toHaveLength(0)    // still not over — a tap is required

    const s3 = reducer(s2, { type: 'ACKNOWLEDGE_REVEAL' })
    expect(s3.round.results).toEqual(['miss'])
    expect(s3.round.brainPoints).toBe(1)
    expect(s3.mastery.f[FACT.key][3]).toBe(1)   // recorded as a miss
  })

  it('brings a missed fact back later in the round, but not immediately', () => {
    const s0 = roundInProgress()
    const q = s0.round.question
    const [w1, w2] = q.opts.filter(o => o !== q.ans)
    const before = s0.round.queue.length

    const s3 = reducer(
      reducer(reducer(s0, { type: 'ANSWER', value: w1, at: 2000 }),
        { type: 'ANSWER', value: w2, at: 3000 }),
      { type: 'ACKNOWLEDGE_REVEAL' })

    expect(s3.round.queue.length).toBe(before + 1)
    // Re-asking on the very next kick would measure echoic memory, not learning
    expect(s3.round.queue[1].role).not.toBe('requeue')
    expect(s3.round.queue[3].role).toBe('requeue')
  })
})

describe('timeouts', () => {
  it('lets the kick be taken untimed and leaves mastery alone', () => {
    const s0 = roundInProgress({ mode: 'shootout', timerMs: 6000, deadline: 7000 })
    const s1 = reducer(s0, { type: 'TIMEOUT' })

    expect(s1.round.phase).toBe('asking')     // still answerable
    expect(s1.round.deadline).toBeNull()      // clock gone
    expect(s1.round.timeouts).toBe(1)
    expect(s1.mastery).toBe(s0.mastery)       // a timeout is not evidence of not knowing

    const s2 = reducer(s1, { type: 'ANSWER', value: s1.round.question.ans, at: 9000 })
    expect(s2.round.goals).toBe(1)
    expect(s2.round.results).toEqual(['timeout-goal'])
  })

  it('never lets a correct answer fail to score', () => {
    // The owner asked for "possibility of goal". The variability lives in the
    // flourish, never the outcome — a right answer punished by chance is the
    // textbook way to teach a child that effort does not matter.
    for (const flourishCase of [{ at: 1200 }, { at: 5900 }]) {
      const s0 = roundInProgress({ mode: 'shootout', timerMs: 6000, deadline: 7000 })
      const s1 = reducer(s0, { type: 'ANSWER', value: s0.round.question.ans, ...flourishCase })
      expect(s1.round.goals).toBe(1)
      expect(s1.round.results[0]).not.toBe('miss')
    }
  })
})

describe('unlocks', () => {
  // Default locale is Swedish; pin it so the assertion is about the crossing
  // logic rather than whichever language happens to be active.
  beforeEach(() => setLocale('sv'))

  it('announces in the active language', () => {
    setLocale('en')
    const base = { ...emptyState(), agg: { ...emptyState().agg, correct: 14 } }
    const s = reducer({ ...roundInProgress(), mastery: base },
      { type: 'ANSWER', value: roundInProgress().round.question.ans, at: 2000 })
    expect(s.toast).toContain(opName('subtraction'))
    setLocale('sv')
  })

  it('fires on crossing the threshold, not on landing exactly on it', () => {
    // The old code tested `latestTotal === unlock`, so a single missed
    // increment skipped the unlock permanently.
    const base = { ...emptyState(), agg: { ...emptyState().agg, correct: 14 } }
    const s0 = { ...roundInProgress(), mastery: base }
    const s1 = reducer(s0, { type: 'ANSWER', value: s0.round.question.ans, at: 2000 })
    expect(s1.toast).toContain(opName('subtraction'))
  })

  it('does not re-announce an unlock already passed', () => {
    const base = { ...emptyState(), agg: { ...emptyState().agg, correct: 40 } }
    const s0 = { ...roundInProgress(), mastery: base }
    const s1 = reducer(s0, { type: 'ANSWER', value: s0.round.question.ans, at: 2000 })
    expect(s1.toast).toBeNull()
  })
})

describe('attention and frustration guards', () => {
  it('skips the reveal when a requeue cannot fire', () => {
    // The requeue is the learning mechanism, and it needs kicks left to insert
    // into. On the last few kicks the reveal used to hold the child in place
    // and buy nothing.
    const s0 = roundInProgress({ kickIdx: 3 })
    const q = s0.round.question
    const [w1, w2] = q.opts.filter(o => o !== q.ans)

    const s1 = reducer(s0, { type: 'ANSWER', value: w1, at: 2000 })
    const s2 = reducer(s1, { type: 'ANSWER', value: w2, at: 3000 })

    expect(s2.round.phase).toBe('resolving')       // not held in `reveal`
    expect(s2.round.results).toEqual(['miss'])
    expect(s2.round.requeued).toBe(false)
    expect(s2.mastery.f[FACT.key][3]).toBe(1)      // still recorded as a miss
  })

  it('still holds the reveal early in the round, where the requeue works', () => {
    const s0 = roundInProgress({ kickIdx: 0 })
    const q = s0.round.question
    const [w1, w2] = q.opts.filter(o => o !== q.ans)

    const s2 = reducer(reducer(s0, { type: 'ANSWER', value: w1, at: 2000 }),
      { type: 'ANSWER', value: w2, at: 3000 })
    expect(s2.round.phase).toBe('reveal')
  })

  it('ignores a fast re-tap that would burn the second attempt', () => {
    // A frustrated child's next tap is often an immediate re-tap on a
    // neighbouring button. That should not cost them the rebound.
    const s0 = roundInProgress()
    const q = s0.round.question
    const [w1, w2] = q.opts.filter(o => o !== q.ans)

    const s1 = reducer(s0, { type: 'ANSWER', value: w1, at: 2000 })
    expect(s1.round.phase).toBe('rebound')

    const tooFast = reducer(s1, { type: 'ANSWER', value: w2, at: 2100 })
    expect(tooFast).toBe(s1)                        // no-op

    const deliberate = reducer(s1, { type: 'ANSWER', value: w2, at: 2400 })
    expect(deliberate.round.phase).toBe('reveal')
  })

  it('resolves the reveal identically however it was dismissed', () => {
    // The auto-resolve after 4s dispatches the same action as the tap, so the
    // pedagogy cannot differ between a child who complies and one who doesn't.
    const s0 = roundInProgress({ kickIdx: 0 })
    const q = s0.round.question
    const [w1, w2] = q.opts.filter(o => o !== q.ans)
    const revealed = reducer(reducer(s0, { type: 'ANSWER', value: w1, at: 2000 }),
      { type: 'ANSWER', value: w2, at: 3000 })

    const after = reducer(revealed, { type: 'ACKNOWLEDGE_REVEAL' })
    expect(after.round.results).toEqual(['miss'])
    expect(after.round.requeued).toBe(true)
    expect(after.round.queue.length).toBe(revealed.round.queue.length + 1)
  })
})

describe('first-try accuracy is not inflated by rebounds', () => {
  it('records a rebound as a miss in the recent-outcome series', () => {
    // This series drives the Shootout gate, strand opening, new-fact
    // introduction, and a parent-facing "right on the first try" figure — a
    // rebound counted as correct made all four wrong, and the last one false.
    const s0 = roundInProgress()
    const q = s0.round.question
    const wrong = q.opts.find(o => o !== q.ans)

    const s2 = reducer(reducer(s0, { type: 'ANSWER', value: wrong, at: 2000 }),
      { type: 'ANSWER', value: q.ans, at: 3000 })

    expect(s2.round.goals).toBe(1)                  // full credit in the fiction
    expect(s2.mastery.r.addition.at(-1)).toBe(0)    // honest in the data
    expect(s2.mastery.agg.correct).toBe(0)
  })

  it('records a clean first-try answer as correct', () => {
    const s0 = roundInProgress()
    const s1 = reducer(s0, { type: 'ANSWER', value: s0.round.question.ans, at: 2000 })
    expect(s1.mastery.r.addition.at(-1)).toBe(1)
  })
})

describe('sudden death', () => {
  /** Answer every kick correctly to the end of regulation */
  function perfectRound(kicks = 5) {
    let s = roundInProgress({ mode: 'shootout', totalKicks: kicks })
    for (let i = 0; i < kicks; i++) {
      s = reducer(s, { type: 'ANSWER', value: s.round.question.ans, at: 2000 + i * 100 })
      const nextFact = s.round.queue[s.round.kickIdx + 1] ?? QUEUE_FACTS[0]
      s = reducer(s, {
        type: 'ADVANCE',
        fact: nextFact,
        question: buildQuestion({ fact: nextFact, format: 'standard', optionCount: 3, rng }),
        at: 3000 + i * 100,
      })
    }
    return s
  }

  it('is earned by a perfect round, never used as a tiebreak', () => {
    // A tiebreak invites a failure ending; sudden death earned by 5/5 cannot
    // produce one, because the scoreline only ever goes up.
    const s = perfectRound()
    expect(s.round.suddenDeath).toBe(true)
    expect(s.screen).toBe('game')
    expect(s.round.goals).toBe(5)
  })

  it('does not trigger on an imperfect round', () => {
    let s = roundInProgress({ mode: 'shootout', totalKicks: 5, kickIdx: 4, goals: 3,
      results: ['goal', 'goal', 'goal', 'miss'] })
    s = reducer(s, { type: 'ADVANCE', fact: QUEUE_FACTS[1], question: s.round.question, at: 9000 })
    expect(s.screen).toBe('result')
    expect(s.round.suddenDeath).toBeFalsy()
  })

  it('does not trigger outside a shootout', () => {
    let s = roundInProgress({ mode: 'training', totalKicks: 5, kickIdx: 4, goals: 5,
      results: ['goal', 'goal', 'goal', 'goal', 'goal'] })
    s = reducer(s, { type: 'ADVANCE', fact: QUEUE_FACTS[1], question: s.round.question, at: 9000 })
    expect(s.screen).toBe('result')
  })

  it('ends on the first non-goal, and the score never goes down', () => {
    let s = perfectRound()
    const before = s.round.goals
    // a bonus kick that is missed
    s = { ...s, round: { ...s.round, results: [...s.round.results, 'miss'] } }
    s = reducer(s, { type: 'ADVANCE', fact: QUEUE_FACTS[1], question: s.round.question, at: 9999 })
    expect(s.screen).toBe('result')
    expect(s.round.goals).toBe(before)
  })

  it('caps the bonus so it cannot run forever', () => {
    let s = perfectRound()
    s = { ...s, round: { ...s.round,
      results: [...Array(5 + SUDDEN_DEATH_MAX).fill('goal')] } }
    s = reducer(s, { type: 'ADVANCE', fact: QUEUE_FACTS[1], question: s.round.question, at: 9999 })
    expect(s.screen).toBe('result')
  })
})

describe('a demotion is named, not silent', () => {
  it('reports which level the fact drops to', () => {
    let s = roundInProgress({ kickIdx: 3 })
    const q = s.round.question
    const [w1, w2] = q.opts.filter(o => o !== q.ans)
    s = reducer(s, { type: 'ANSWER', value: w1, at: 2000 })
    s = reducer(s, { type: 'ANSWER', value: w2, at: 3000 })
    expect(s.round.demotedTo).toBe(0)
    expect(typeof s.round.demotedTo).toBe('number')
  })
})
