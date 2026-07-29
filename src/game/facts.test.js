import { describe, it, expect } from 'vitest'
import {
  STRANDS, STRANDS_BY_OP, ALL_FACTS, factKey, answerOf,
  sampleStrandFact, inverseMultiplicationKey,
} from './facts'
import { makeRng } from './rng'

describe('fact ladder', () => {
  it('assigns every canonical fact to exactly one strand', () => {
    const keys = ALL_FACTS.map(f => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has no empty perFact strands', () => {
    for (const s of STRANDS) {
      if (s.perFact) expect(s.facts.length, `${s.id} ${s.label}`).toBeGreaterThan(0)
    }
  })

  it('keeps every rung of the ladder', () => {
    // Regression: `owns` was handed canonically-sorted operands for *all*
    // operations, which inverts the rule for subtraction and division —
    // `a - b >= 1` became `b - a >= 1`. Both single-digit subtraction strands
    // claimed nothing and were silently dropped, so a child practising
    // subtraction went straight to two-digit borrowing.
    const ids = op => STRANDS_BY_OP[op].map(s => s.id)
    expect(ids('addition')).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'])
    expect(ids('subtraction')).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'])
    expect(ids('division')).toEqual(['D1', 'D2', 'D3'])
    expect(ids('multiplication').slice(0, 4)).toEqual(['M1', 'M2', 'M3', 'M4'])
  })

  it('starts each operation on genuinely single-digit ground', () => {
    for (const [op, max] of [['addition', 10], ['subtraction', 10]]) {
      const first = STRANDS_BY_OP[op][0]
      expect(first.perFact, op).toBe(true)
      for (const f of first.facts) {
        expect(Math.max(f.a, f.b), `${op} ${f.a}/${f.b}`).toBeLessThanOrEqual(max)
      }
    }
  })

  it('sorts division strands by divisor, not by dividend', () => {
    for (const f of STRANDS_BY_OP.division[0].facts) {
      expect([1, 2, 5, 10], `${f.a}÷${f.b}`).toContain(f.b)
    }
    for (const f of STRANDS_BY_OP.division[1].facts) {
      expect([3, 4], `${f.a}÷${f.b}`).toContain(f.b)
    }
  })

  it('covers all four operations', () => {
    for (const op of ['addition', 'subtraction', 'multiplication', 'division']) {
      expect(STRANDS_BY_OP[op]?.length, op).toBeGreaterThan(0)
    }
  })

  it('collapses commutative facts so one record serves both orders', () => {
    expect(factKey('multiplication', 7, 8)).toBe(factKey('multiplication', 8, 7))
    expect(factKey('addition', 3, 9)).toBe(factKey('addition', 9, 3))
    // Subtraction and division are not commutative
    expect(factKey('subtraction', 9, 3)).not.toBe(factKey('subtraction', 3, 9))
    expect(factKey('division', 8, 2)).not.toBe(factKey('division', 2, 8))
  })

  it('reduces the 12x12 table to its canonical half', () => {
    const mult = STRANDS_BY_OP.multiplication.flatMap(s => s.facts)
    // 13x13 grid (0..12) collapsed by commutativity = 91 pairs
    expect(mult.length).toBeLessThanOrEqual(91)
    expect(mult.length).toBeGreaterThan(50)
  })

  it('puts the notorious facts in the strands that name them', () => {
    const strandOf = key => ALL_FACTS.find(f => f.key === key)?.strand
    expect(strandOf(factKey('multiplication', 7, 8))).toBe('M6')  // the sevens
    expect(strandOf(factKey('multiplication', 8, 9))).toBe('M7')  // last hard fact
    expect(strandOf(factKey('multiplication', 2, 7))).toBe('M1')  // twos are easy
  })

  it('never generates a trivial subtraction (n − n or n − 0)', () => {
    for (const f of STRANDS_BY_OP.subtraction.flatMap(s => s.facts)) {
      expect(f.b, `${f.a}−${f.b}`).toBeGreaterThan(0)
      expect(answerOf(f), `${f.a}−${f.b}`).toBeGreaterThan(0)
    }
  })

  it('only generates exact divisions', () => {
    for (const f of STRANDS_BY_OP.division.flatMap(s => s.facts)) {
      expect(f.a % f.b, `${f.a}÷${f.b}`).toBe(0)
      expect(f.b).toBeGreaterThan(0)
    }
  })

  it('links a division fact to the multiplication fact it inverts', () => {
    expect(inverseMultiplicationKey({ op: 'division', a: 56, b: 8 }))
      .toBe(factKey('multiplication', 7, 8))
  })
})

describe('sampled (multi-digit) strands', () => {
  const sampled = STRANDS.filter(s => !s.perFact)

  it('has sampled strands for the multi-digit work', () => {
    expect(sampled.length).toBeGreaterThan(5)
  })

  it('produces valid, in-range facts over many draws', () => {
    const r = makeRng(20260729)
    for (const s of sampled) {
      for (let i = 0; i < 400; i++) {
        const f = sampleStrandFact(s, r)
        const ans = answerOf(f)
        expect(Number.isInteger(f.a), `${s.id}: a=${f.a}`).toBe(true)
        expect(Number.isInteger(f.b), `${s.id}: b=${f.b}`).toBe(true)
        expect(f.a, `${s.id}: a=${f.a}`).toBeGreaterThanOrEqual(0)
        expect(f.b, `${s.id}: b=${f.b}`).toBeGreaterThanOrEqual(0)
        expect(ans, `${s.id}: ${f.a} ${f.op} ${f.b} = ${ans}`).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(ans), `${s.id}: ${f.a} ${f.op} ${f.b}`).toBe(true)
      }
    }
  })

  it('respects each strand\'s defining rule', () => {
    const r = makeRng(7)
    const ones = n => n % 10
    const rules = {
      A4: f => f.b === 10,
      A5: f => f.b <= 9 && ones(f.a) + f.b <= 9,
      A6: f => f.b <= 9 && ones(f.a) + f.b >= 10,
      A7: f => f.a >= 10 && f.b >= 10 && ones(f.a) + ones(f.b) <= 9 && f.a + f.b <= 99,
      A8: f => f.a >= 10 && f.b >= 10 && ones(f.a) + ones(f.b) >= 10 && f.a + f.b <= 99,
      A9: f => f.a + f.b >= 100 && f.a + f.b <= 150,
      S3: f => f.b <= 9 && ones(f.a) >= f.b,
      S4: f => f.b <= 9 && ones(f.a) < f.b,
      S5: f => f.b >= 10 && ones(f.a) >= ones(f.b) && f.a > f.b,
      S6: f => f.b >= 10 && ones(f.a) < ones(f.b) && f.a > f.b,
      S7: f => ones(f.a) === 0 && ones(f.b) !== 0 && f.a > f.b,
    }
    for (const s of sampled) {
      const rule = rules[s.id]
      if (!rule) continue
      for (let i = 0; i < 300; i++) {
        const f = sampleStrandFact(s, r)
        expect(rule(f), `${s.id} violated by ${f.a} ${f.op} ${f.b}`).toBe(true)
      }
    }
  })
})
