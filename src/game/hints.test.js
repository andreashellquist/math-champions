import { describe, it, expect, beforeEach } from 'vitest'
import { getHint, hintRule } from './hints'
import { setLocale, LOCALES } from '../i18n'

const OPS = ['addition', 'subtraction', 'multiplication', 'division']
const LOCALE_CODES = Object.keys(LOCALES)

/** Every (op, a, b) the game can realistically produce */
function allFacts() {
  const facts = []
  for (let a = 0; a <= 99; a++) {
    for (let b = 0; b <= 99; b++) {
      facts.push({ op: 'addition', a, b, ans: a + b })
      if (a >= b) facts.push({ op: 'subtraction', a, b, ans: a - b })
      if (a <= 12 && b <= 12) facts.push({ op: 'multiplication', a, b, ans: a * b })
      if (b >= 1 && b <= 12 && a >= 1 && a % b === 0 && a / b <= 12) {
        facts.push({ op: 'division', a, b, ans: a / b })
      }
    }
  }
  return facts
}

const facts = allFacts()

describe.each(LOCALE_CODES)('getHint [%s]', locale => {
  beforeEach(() => setLocale(locale))

  it('covers every reachable fact without throwing', () => {
    for (const f of facts) expect(() => getHint(f)).not.toThrow()
  })

  it('always returns a non-empty label and steps', () => {
    for (const f of facts) {
      const h = getHint(f)
      expect(h.label.length, `label for ${f.a} ${f.op} ${f.b}`).toBeGreaterThan(0)
      expect(h.steps.length, `steps for ${f.a} ${f.op} ${f.b}`).toBeGreaterThan(0)
    }
  })

  it('never leaves an untranslated key or placeholder on screen', () => {
    for (const f of facts) {
      const h = getHint(f)
      expect(h.label, `${f.a} ${f.op} ${f.b}`).not.toMatch(/^hint\./)
      expect(h.steps, `${f.a} ${f.op} ${f.b}`).not.toMatch(/\{\w+\}/)
    }
  })

  it('never states a false arithmetic claim in the steps', () => {
    const claim = /(\d+)\s*([+−×])\s*(\d+)\s*=\s*(\d+)/g
    for (const f of facts) {
      const { steps } = getHint(f)
      for (const [full, x, sign, y, z] of steps.matchAll(claim)) {
        const l = Number(x), r = Number(y), got = Number(z)
        const want = sign === '+' ? l + r : sign === '−' ? l - r : l * r
        expect(want, `"${full}" in hint for ${f.a} ${f.op} ${f.b}`).toBe(got)
      }
    }
  })

  it('never leaks a negative number into the steps', () => {
    for (const f of facts) {
      expect(getHint(f).steps, `${f.a} ${f.op} ${f.b}`).not.toMatch(/-\d/)
    }
  })

  it('keeps steps short enough for a 7-year-old to read', () => {
    for (const f of facts) {
      const words = getHint(f).steps.split(/\s+/).length
      expect(words, `${f.a} ${f.op} ${f.b}: "${getHint(f).steps}"`).toBeLessThanOrEqual(16)
    }
  })
})

describe('strategy choice (independent of language)', () => {
  const ruleKey = fact => hintRule(fact).key

  it('names a bond to ten before falling back to counting', () => {
    expect(ruleKey({ op: 'addition', a: 8, b: 2, ans: 10 })).toBe('hint.add.bondToTen')
  })

  it('bridges through ten for sums that cross it', () => {
    expect(ruleKey({ op: 'addition', a: 8, b: 5, ans: 13 })).toBe('hint.add.makeTen')
  })

  it('prefers the cheaper strategy when several apply', () => {
    expect(ruleKey({ op: 'addition', a: 6, b: 6, ans: 12 })).toBe('hint.add.double')
    // 8+7 is a near-double (7+7=14, +1) — easier than bridging through ten
    expect(ruleKey({ op: 'addition', a: 8, b: 7, ans: 15 })).toBe('hint.add.nearDouble')
  })

  it('gives the five-plus-two strategy for the notorious sevens', () => {
    expect(ruleKey({ op: 'multiplication', a: 8, b: 7, ans: 56 })).toBe('hint.mul.fivePlusTwo')
  })

  it('falls back to the inverse fact for hard divisions', () => {
    expect(ruleKey({ op: 'division', a: 56, b: 7, ans: 8 })).toBe('hint.div.flipIt')
  })

  it('returns a safe generic rule for an unknown operation', () => {
    expect(ruleKey({ op: 'nonsense', a: 1, b: 2, ans: 3 })).toBe('hint.generic')
  })
})

describe('wording', () => {
  it('mentions commutativity when the small factor comes first', () => {
    setLocale('en')
    expect(getHint({ op: 'multiplication', a: 3, b: 8, ans: 24 }).steps)
      .toMatch(/^Turn it around: 8×3\. /)
    expect(getHint({ op: 'multiplication', a: 8, b: 3, ans: 24 }).steps)
      .not.toMatch(/Turn it around/)
  })

  it('works the sevens out in English', () => {
    setLocale('en')
    expect(getHint({ op: 'multiplication', a: 8, b: 7, ans: 56 })).toEqual({
      label: 'Five plus two',
      steps: '8×5=40, 8×2=16, add them',
    })
  })

  it('uses the Swedish school term for number bonds to ten', () => {
    setLocale('sv')
    const h = getHint({ op: 'addition', a: 8, b: 2, ans: 10 })
    expect(h.label).toBe('Tiokompisar')
    expect(h.steps).toContain('tiokompisar')
  })

  it('uses Swedish maths vocabulary rather than literal translation', () => {
    setLocale('sv')
    expect(getHint({ op: 'multiplication', a: 3, b: 4, ans: 12 }).label).toBe('Dubbla plus en')
    expect(getHint({ op: 'division', a: 56, b: 7, ans: 8 }).label).toBe('Vänd på det')
    expect(getHint({ op: 'subtraction', a: 45, b: 9, ans: 36 }).label).toBe('Nio-knepet')
  })
})

describe('translation coverage', () => {
  it('has no key present in one locale and missing from the other', () => {
    const flatten = (obj, prefix = '') =>
      Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === 'object' && !Array.isArray(v)
          ? flatten(v, `${prefix}${k}.`)
          : [`${prefix}${k}`])

    const sv = new Set(flatten(LOCALES.sv))
    const en = new Set(flatten(LOCALES.en))
    expect([...sv].filter(k => !en.has(k)), 'missing from en').toEqual([])
    expect([...en].filter(k => !sv.has(k)), 'missing from sv').toEqual([])
  })

  it('covers every hint rule the engine can pick', () => {
    setLocale('sv')
    const used = new Set(facts.map(f => hintRule(f).key))
    for (const key of used) {
      const h = getHint({ ...facts.find(f => hintRule(f).key === key) })
      expect(h.label, key).not.toMatch(/^hint\./)
    }
    expect(used.size).toBeGreaterThan(20)
  })
})
