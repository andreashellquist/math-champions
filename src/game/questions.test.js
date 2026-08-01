import { describe, it, expect } from 'vitest'
import { buildQuestion, pickFormat } from './questions'
import { pickDistractors, classifyChoice } from './distractors'
import { ALL_FACTS, STRANDS, sampleStrandFact, factKey } from './facts'
import { makeRng } from './rng'

/** A representative mix: every single-digit fact plus draws from every sampled strand */
function corpus(r, drawsPerStrand = 40) {
  const out = [...ALL_FACTS]
  for (const s of STRANDS.filter(x => !x.perFact)) {
    for (let i = 0; i < drawsPerStrand; i++) out.push(sampleStrandFact(s, r))
  }
  return out
}

describe('buildQuestion — invariants that must hold for every item', () => {
  const r = makeRng(20260729)
  const facts = corpus(r)

  const cases = []
  for (const fact of facts) {
    for (const format of ['standard', 'missing', 'word']) {
      for (const optionCount of [3, 4]) {
        cases.push({ fact, q: buildQuestion({ fact, format, optionCount, rng: r }), optionCount, format })
      }
    }
  }

  it('builds a large corpus', () => {
    expect(cases.length).toBeGreaterThan(2000)
  })

  it('always includes the correct answer among the options', () => {
    for (const { q, fact, format } of cases) {
      expect(q.opts, `${fact.key} ${format}: "${q.prompt}"`).toContain(q.ans)
    }
  })

  it('always offers exactly the requested number of distinct options', () => {
    for (const { q, optionCount, fact, format } of cases) {
      expect(q.opts.length, `${fact.key} ${format}`).toBe(optionCount)
      expect(new Set(q.opts).size, `${fact.key} ${format}: ${q.opts}`).toBe(optionCount)
    }
  })

  it('never offers a negative or non-integer option', () => {
    for (const { q, fact, format } of cases) {
      for (const o of q.opts) {
        expect(Number.isInteger(o), `${fact.key} ${format}: ${o}`).toBe(true)
        expect(o, `${fact.key} ${format}: "${q.prompt}" → ${q.opts}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('never states a negative or fractional answer', () => {
    for (const { q, fact } of cases) {
      expect(q.ans, fact.key).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(q.ans), fact.key).toBe(true)
    }
  })

  it('keeps every option within a plausible magnitude of the answer', () => {
    // A child must not be able to eliminate an option just by how big it looks
    for (const { q, fact, format } of cases) {
      for (const o of q.opts) {
        if (q.ans >= 10) {
          expect(o, `${fact.key} ${format}: ${o} vs ans ${q.ans}`).toBeGreaterThanOrEqual(Math.floor(0.4 * q.ans))
          expect(o, `${fact.key} ${format}: ${o} vs ans ${q.ans}`).toBeLessThanOrEqual(Math.ceil(2.5 * q.ans))
        } else {
          expect(Math.abs(o - q.ans), `${fact.key} ${format}: ${o} vs ans ${q.ans}`).toBeLessThanOrEqual(6)
        }
      }
    }
  })

  it('writes a non-empty prompt for every format', () => {
    for (const { q, fact, format } of cases) {
      expect(q.prompt.length, `${fact.key} ${format}`).toBeGreaterThan(2)
      if (format === 'standard') expect(q.prompt).toMatch(/= \?$/)
      if (format === 'missing') expect(q.prompt).toContain('?')
    }
  })

  it('keeps word problems short enough to read', () => {
    for (const { q, format } of cases) {
      if (format !== 'word') continue
      expect(q.prompt.split(/\s+/).length, `"${q.prompt}"`).toBeLessThanOrEqual(20)
    }
  })

  it('solves its own missing-operand prompts correctly', () => {
    for (const { q, fact, format } of cases) {
      if (format !== 'missing') continue
      const solved = q.prompt.replace('?', String(q.ans))
      const m = solved.match(/^(\d+) ([+−×÷]) (\d+) = (\d+)$/)
      expect(m, `unparseable: "${solved}"`).not.toBeNull()
      const [, x, sym, y, z] = m
      const l = Number(x), rr = Number(y), want = Number(z)
      const got = sym === '+' ? l + rr : sym === '−' ? l - rr : sym === '×' ? l * rr : l / rr
      expect(got, `${fact.key}: "${solved}"`).toBe(want)
    }
  })

  it('presents commutative facts in both orders over time', () => {
    const fact = ALL_FACTS.find(f => f.key === factKey('multiplication', 3, 8))
    const seen = new Set()
    for (let i = 0; i < 60; i++) {
      seen.add(buildQuestion({ fact, rng: r }).prompt)
    }
    expect(seen.has('3 × 8 = ?')).toBe(true)
    expect(seen.has('8 × 3 = ?')).toBe(true)
  })

  it('only ever poses exact divisions', () => {
    for (const { q, format } of cases) {
      if (q.op !== 'division' || format !== 'standard') continue
      const [, a, b] = q.prompt.match(/^(\d+) ÷ (\d+)/)
      expect(Number(a) % Number(b), q.prompt).toBe(0)
    }
  })
})

describe('the answer must not be identifiable without computing', () => {
  const r = makeRng(4242)
  const facts = corpus(r, 25)

  it('rarely leaves the answer as the only even or only odd option', () => {
    let leaks = 0, total = 0
    for (const fact of facts) {
      const q = buildQuestion({ fact, optionCount: 3, rng: r })
      const evens = q.opts.filter(o => o % 2 === 0).length
      const ansEven = q.ans % 2 === 0
      if ((evens === 1 && ansEven) || (evens === q.opts.length - 1 && !ansEven)) leaks++
      total++
    }
    // Not always avoidable (some facts have too few guarded candidates),
    // but it must be the rare exception rather than the norm.
    expect(leaks / total, `${leaks}/${total} parity leaks`).toBeLessThan(0.1)
  })

  it('rarely leaves the answer as the only multiple of an operand', () => {
    let leaks = 0, total = 0
    for (const fact of facts) {
      if (fact.op !== 'multiplication' && fact.op !== 'division') continue
      const q = buildQuestion({ fact, optionCount: 3, rng: r })
      const divides = n => (q.a !== 0 && n % q.a === 0) || (q.b !== 0 && n % q.b === 0)
      if (!q.opts.filter(o => o !== q.ans).some(divides)) leaks++
      total++
    }
    expect(leaks / total, `${leaks}/${total} multiple leaks`).toBeLessThan(0.1)
  })

  it('regression: the old generator leaked 4 × 6 badly', () => {
    // ans 24, options like 19/31 — the only even number gave it away
    const fact = ALL_FACTS.find(f => f.key === factKey('multiplication', 4, 6))
    let leaks = 0
    for (let i = 0; i < 200; i++) {
      const q = buildQuestion({ fact, optionCount: 3, rng: r })
      const evens = q.opts.filter(o => o % 2 === 0).length
      if (evens === 1) leaks++
    }
    expect(leaks).toBe(0)
  })
})

describe('distractors encode real misconceptions', () => {
  const named = (chosen, fact) => classifyChoice(chosen, fact)?.rule

  it('recognises the smaller-from-larger subtraction bug', () => {
    // 43 − 17: subtract the smaller digit from the larger in each column → 34
    expect(named(34, { op: 'subtraction', a: 43, b: 17, ans: 26 })).toBe('SUB_SMALLER_FROM_LARGER')
  })

  it('recognises a borrow that never decremented the tens', () => {
    expect(named(36, { op: 'subtraction', a: 43, b: 17, ans: 26 })).toBe('SUB_BORROW_NO_DECREMENT')
  })

  it('recognises the zero-in-the-minuend bug', () => {
    // 50 − 23 → 33
    expect(named(33, { op: 'subtraction', a: 50, b: 23, ans: 27 })).toBe('SUB_ZERO_BUG')
  })

  it('recognises a dropped carry in addition', () => {
    // 28 + 15 = 43; dropping the carried ten gives 33
    expect(named(33, { op: 'addition', a: 28, b: 15, ans: 43 })).toBe('ADD_CARRY_DROP')
  })

  it('recognises digit concatenation, which is too implausible to offer as an option', () => {
    // 28 + 15 → "3" and "13" written side by side → 313
    expect(named(313, { op: 'addition', a: 28, b: 15, ans: 43 })).toBe('ADD_CONCAT')
    const offered = pickDistractors({ op: 'addition', a: 28, b: 15, ans: 43, count: 2, rng: makeRng(1) })
    expect(offered.map(d => d.value)).not.toContain(313)
  })

  it('recognises the square next door to 7 x 8', () => {
    expect(named(49, { op: 'multiplication', a: 7, b: 8, ans: 56 })).toBe('MUL_SQUARE_PULL')
    expect(named(64, { op: 'multiplication', a: 7, b: 8, ans: 56 })).toBe('MUL_SQUARE_PULL')
  })

  it('recognises reporting the divisor as the quotient', () => {
    expect(named(8, { op: 'division', a: 56, b: 8, ans: 7 })).toBe('DIV_SWAP_OPERANDS')
  })

  it('returns nothing for a correct answer', () => {
    expect(classifyChoice(56, { op: 'multiplication', a: 7, b: 8, ans: 56 })).toBeNull()
  })

  it('attaches a plain-language diagnosis describing the slip, not the child', () => {
    const d = classifyChoice(34, { op: 'subtraction', a: 43, b: 17, ans: 26 })
    expect(d.message).toBeTruthy()
    expect(d.message.toLowerCase()).not.toMatch(/\byou forgot|wrong|failed|should have\b/)
  })

  it('offers the seductive square when a child is asked 7 x 8', () => {
    const r = makeRng(99)
    const values = new Set()
    for (let i = 0; i < 40; i++) {
      pickDistractors({ op: 'multiplication', a: 7, b: 8, ans: 56, count: 2, rng: r })
        .forEach(d => values.add(d.value))
    }
    expect([...values].some(v => v === 49 || v === 64)).toBe(true)
  })

  it('probes harder at the error family a child keeps making', () => {
    const r = makeRng(5)
    const withHistory = new Set()
    for (let i = 0; i < 60; i++) {
      pickDistractors({
        op: 'subtraction', a: 43, b: 17, ans: 26, count: 2, rng: r,
        recentErrorFamilies: ['buggy_algorithm', 'buggy_algorithm', 'buggy_algorithm'],
      }).forEach(d => withHistory.add(d.family))
    }
    expect(withHistory.has('buggy_algorithm')).toBe(true)
  })
})

describe('free numeric entry', () => {
  const r = makeRng(2026)
  const fact = ALL_FACTS.find(f => f.key === factKey('multiplication', 7, 8))

  it('is offered only once a fact is solid', () => {
    // No scaffold to fall back on, so it must not arrive early
    for (const box of [0, 1, 2, 3]) {
      for (let i = 0; i < 60; i++) {
        expect(pickFormat(box, { allowEntry: true, rng: r })).not.toBe('entry')
      }
    }
  })

  it('never appears unless the operation as a whole is solid', () => {
    for (let i = 0; i < 200; i++) {
      expect(pickFormat(5, { allowEntry: false, rng: r })).not.toBe('entry')
    }
  })

  it('does appear at a high box once allowed', () => {
    const seen = new Set()
    for (let i = 0; i < 200; i++) seen.add(pickFormat(5, { allowEntry: true, rng: r }))
    expect(seen.has('entry')).toBe(true)
  })

  it('offers no options to choose between', () => {
    const q = buildQuestion({ fact, format: 'entry', rng: r })
    expect(q.opts).toEqual([])
    expect(q.distractors).toEqual([])
    expect(q.ans).toBe(56)
    expect(q.prompt).toMatch(/= \?$/)
    // The hint still describes the underlying fact
    expect(q.hintFact).toEqual({ op: 'multiplication', a: 7, b: 8, ans: 56 })
  })
})
