import { describe, it, expect } from 'vitest'
import {
  emptyState, applyAnswer, applyGateResult, gateReadiness, gatePassed, gatesPassed,
  composeGate, composeRound, openStrands, optionCountFor, masteredCount,
  recentAccuracy, mixedReady, currentCompetition,
  GATES, GATE_SIZE, GATE_PASS, OP_KEYS,
} from './mastery'
import { pickFormat } from './questions'
import { STRANDS_BY_OP } from './facts'
import { sanitize, load, save, __resetStorage } from './storage'
import { makeRng } from './rng'

/** A child who is genuinely ready for the addition gate */
function readyChild(op = 'addition') {
  let state = emptyState()
  for (const f of STRANDS_BY_OP[op].flatMap(s => s.facts).slice(0, 20)) {
    for (let i = 0; i < 5; i++) {
      state = applyAnswer(state, { fact: f, correct: true, latencyMs: 1200 })
    }
  }
  return state
}

/** Everything the game could conceivably withhold, as a snapshot */
function affordances(state) {
  return {
    strands: OP_KEYS.map(op => openStrands(state, op).map(s => s.id).join(',')),
    optionCounts: [0, 1, 2, 3, 4, 5].map(optionCountFor),
    formats: [0, 3, 4, 5].map(box => {
      const r = makeRng(7)
      const seen = new Set()
      for (let i = 0; i < 80; i++) seen.add(pickFormat(box, { allowEntry: true, rng: r }))
      return [...seen].sort().join(',')
    }),
    mixed: (mixedReady(state, OP_KEYS) ?? []).join(','),
    competition: currentCompetition(state)?.id ?? null,
    roundSize: composeRound(state, 'addition', { rng: makeRng(3) }).length,
    mastered: masteredCount(state),
    accuracy: OP_KEYS.map(op => recentAccuracy(state, op)),
  }
}

describe('a gate certifies — it never filters', () => {
  const gateId = GATES[0].id

  it('changes nothing about what is available when it is failed', () => {
    // The rule the whole feature rests on. A child who fails would otherwise
    // get *less* variety and more of what they already find hard, which
    // inverts the pedagogy.
    const before = readyChild()
    const after = applyGateResult(before, {
      gateId, score: 3, missedKeys: Object.keys(before.f).slice(0, 8),
    })
    expect(affordances(after)).toEqual(affordances(before))
  })

  it('changes nothing about what is available when it is passed either', () => {
    const before = readyChild()
    const after = applyGateResult(before, { gateId, score: GATE_SIZE, missedKeys: [] })
    expect(affordances(after)).toEqual(affordances(before))
  })

  it('never lowers a mastery box, however badly it goes', () => {
    const before = readyChild()
    const keys = Object.keys(before.f)
    const after = applyGateResult(before, { gateId, score: 0, missedKeys: keys })

    for (const key of keys) {
      expect(after.f[key][0], key).toBe(before.f[key][0])
      expect(after.f[key][3], key).toBe(before.f[key][3])   // no extra misses either
    }
  })

  it('brings missed facts forward without touching what they are worth', () => {
    const before = readyChild()
    const key = Object.keys(before.f)[0]
    const after = applyGateResult(before, { gateId, score: 10, missedKeys: [key] })
    // dueAt moves; box does not
    expect(after.f[key][1]).toBeLessThanOrEqual(before.f[key][1])
    expect(after.f[key][0]).toBe(before.f[key][0])
  })

  it('leaves the season untouched', () => {
    const before = readyChild()
    const after = applyGateResult(before, { gateId, score: 0, missedKeys: [] })
    expect(after.rivalry).toEqual(before.rivalry)
  })
})

describe('an insignia can never be revoked', () => {
  const gateId = GATES[0].id

  it('stays passed after a later failed attempt', () => {
    let s = applyGateResult(readyChild(), { gateId, score: GATE_PASS })
    expect(gatePassed(s, gateId)).toBe(true)

    s = applyGateResult(s, { gateId, score: 2 })
    expect(gatePassed(s, gateId)).toBe(true)
    expect(gatesPassed(s)).toBe(1)
  })

  it('keeps the best score, never the latest', () => {
    let s = applyGateResult(readyChild(), { gateId, score: 18 })
    s = applyGateResult(s, { gateId, score: 4 })
    expect(s.gates[gateId].best).toBe(18)
    expect(s.gates[gateId].attempts).toBe(2)
  })
})

describe('a gate you are offered is one you are expected to pass', () => {
  it('is not offered to a child with no history', () => {
    expect(gateReadiness(emptyState(), GATES[0].id).ready).toBe(false)
  })

  it('is offered once the child is comfortably above the pass mark', () => {
    const r = gateReadiness(readyChild(), GATES[0].id)
    expect(r.ready).toBe(true)
    expect(r.predicted).toBeGreaterThanOrEqual(GATE_PASS)
  })

  it('is withheld from a child who is not there yet', () => {
    let s = emptyState()
    const facts = STRANDS_BY_OP.addition[0].facts.slice(0, 20)
    for (const f of facts) {
      s = applyAnswer(s, { fact: f, correct: false })
    }
    expect(gateReadiness(s, GATES[0].id).ready).toBe(false)
  })

  it('will not re-offer immediately after an attempt', () => {
    // An immediate retry teaches cramming and manufactures a false pass
    const s = applyGateResult(readyChild(), { gateId: GATES[0].id, score: 10 })
    expect(gateReadiness(s, GATES[0].id).ready).toBe(false)
  })

  it('offers again after an intervening round', () => {
    let s = applyGateResult(readyChild(), { gateId: GATES[0].id, score: 10 })
    s = { ...s, agg: { ...s.agg, rounds: s.agg.rounds + 1 } }
    expect(gateReadiness(s, GATES[0].id).ready).toBe(true)
  })

  it('reports an unknown gate rather than throwing', () => {
    expect(gateReadiness(emptyState(), 'nonsense').ready).toBe(false)
  })
})

describe('gate composition', () => {
  it('draws the full length from facts the child has met', () => {
    const s = readyChild()
    const g = composeGate(s, 'addition', { rng: makeRng(11) })
    expect(g).toHaveLength(GATE_SIZE)
    expect(new Set(g.map(f => f.key)).size).toBe(GATE_SIZE)
  })

  it('still fills a gate for a child with a thin history', () => {
    const g = composeGate(emptyState(), 'addition', { rng: makeRng(2) })
    expect(g.length).toBeGreaterThan(0)
  })
})

describe('gate persistence', () => {
  it('survives a round trip', () => {
    __resetStorage(); localStorage.clear()
    const s = applyGateResult(readyChild(), { gateId: GATES[0].id, score: 19 })
    save(s, { immediate: true })
    const back = load()
    expect(back.gates[GATES[0].id].passed).toBe(true)
    expect(back.gates[GATES[0].id].best).toBe(19)
  })

  it('clamps corrupt gate records and drops unknown ids', () => {
    const s = sanitize({ gates: {
      [GATES[0].id]: { passed: 'yes', best: 9999, attempts: -3 },
      not_a_gate: { passed: true, best: 20 },
    } })
    expect(s.gates[GATES[0].id].passed).toBe(false)   // only a real boolean counts
    expect(s.gates[GATES[0].id].best).toBe(GATE_SIZE)
    expect(s.gates[GATES[0].id].attempts).toBe(0)
    expect(s.gates.not_a_gate).toBeUndefined()
  })

  it('is bounded by the gate list, not by play time', () => {
    const many = {}
    for (let i = 0; i < 500; i++) many[`g${i}`] = { passed: true, best: 20 }
    expect(Object.keys(sanitize({ gates: many }).gates).length).toBeLessThanOrEqual(GATES.length)
  })
})

describe('sitting a gate can never cost the child anything', () => {
  it('does not demote a box on a wrong answer during a gate', () => {
    // Asymmetric quarantine, matching the Shootout clock: a gate may promote
    // but never demote. Otherwise volunteering for assessment is a gamble, and
    // the rational move is to never sit one.
    const before = readyChild()
    const fact = STRANDS_BY_OP.addition[0].facts[0]
    const box = before.f[fact.key][0]

    const after = applyAnswer(before, { fact, correct: false, noDemote: true })
    expect(after.f[fact.key][0]).toBe(box)
    expect(after.f[fact.key][3]).toBe(before.f[fact.key][3] + 1)  // still recorded
  })

  it('still demotes in a normal round', () => {
    const before = readyChild()
    const fact = STRANDS_BY_OP.addition[0].facts[0]
    const after = applyAnswer(before, { fact, correct: false })
    expect(after.f[fact.key][0]).toBeLessThan(before.f[fact.key][0])
  })

  it('leaves the headline count intact across a failed gate', () => {
    let s = readyChild()
    const mastered = masteredCount(s)
    for (const f of STRANDS_BY_OP.addition[0].facts.slice(0, 20)) {
      s = applyAnswer(s, { fact: f, correct: false, noDemote: true })
    }
    s = applyGateResult(s, { gateId: GATES[0].id, score: 0, missedKeys: Object.keys(s.f) })
    expect(masteredCount(s)).toBe(mastered)
  })
})
