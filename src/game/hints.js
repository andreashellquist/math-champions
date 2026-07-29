/**
 * Strategy hints — the "trick" behind a fact.
 *
 * Pedagogical intent: telling a child the answer is knowledge-of-result and
 * teaches almost nothing. Naming the *strategy* is what transfers to the next
 * fact. Every hint names a reusable method, not this one answer.
 *
 * Rules are priority-ordered — first match wins, most specific first — and the
 * ordering is a pedagogical claim: for `8 + 7`, near-doubles beats bridging
 * through ten, because `7+7` is the cheaper thing to recall.
 *
 * The rule chosen is language-independent; only the wording is translated.
 */
import { t } from '../i18n'

/**
 * @param {{a: number, b: number, op: string, ans: number}} fact
 * @returns {{ label: string, steps: string }}
 */
export function getHint({ a, b, op, ans }) {
  const rule = hintRule({ a, b, op, ans })
  return {
    label: t(`${rule.key}.label`, rule.params),
    steps: (rule.prefix ?? '') + t(`${rule.key}.steps`, rule.params),
  }
}

/** Which strategy applies — exposed so tests can assert the choice, not the copy */
export function hintRule({ a, b, op, ans }) {
  switch (op) {
    case 'addition':       return additionRule(a, b, ans)
    case 'subtraction':    return subtractionRule(a, b, ans)
    case 'multiplication': return multiplicationRule(a, b, ans)
    case 'division':       return divisionRule(a, b, ans)
    default:               return { key: 'hint.generic', params: {} }
  }
}

const rule = (key, params) => ({ key, params })

/* ── ADDITION ─────────────────────────────────────────── */

function additionRule(a, b, ans) {
  const max = Math.max(a, b)
  const min = Math.min(a, b)
  const base = { a, b, ans, max, min }

  // Bonds to ten anchor every later bridging strategy, so they're named as
  // bonds rather than counted out
  if (a + b === 10 && a > 0 && b > 0) return rule('hint.add.bondToTen', base)
  if (min <= 1)              return rule('hint.add.justOneMore', base)
  if (a === b)               return rule('hint.add.double', base)
  if (Math.abs(a - b) === 1) return rule('hint.add.nearDouble', { ...base, dbl: min * 2 })
  if (a === 9 || b === 9) {
    const other = max === 9 ? min : max
    return rule('hint.add.nineTrick', { ...base, other, plusTen: other + 10 })
  }
  if (a === 10 || b === 10) return rule('hint.add.addTen', base)

  // Bridging through ten — the key single-digit strategy
  if (a < 10 && b < 10 && a + b > 10) {
    return rule('hint.add.makeTen', { ...base, toTen: 10 - a, rest: b - (10 - a) })
  }

  if (a >= 10 || b >= 10) {
    const aT = Math.floor(a / 10) * 10, aO = a % 10
    const bT = Math.floor(b / 10) * 10, bO = b % 10
    return rule('hint.add.splitUp', { ...base, aT, aO, bT, bO, tens: aT + bT, onesSum: aO + bO })
  }

  return rule('hint.add.countOn', base)
}

/* ── SUBTRACTION ──────────────────────────────────────── */

function subtractionRule(a, b, ans) {
  const base = { a, b, ans }

  if (b === 0)      return rule('hint.sub.takeNothing', base)
  if (a === b)      return rule('hint.sub.allOfIt', base)
  if (ans <= 3)     return rule('hint.sub.countUp', base)
  if (b === 9)      return rule('hint.sub.nineTrick', { ...base, minusTen: a - 10 })
  if (b % 10 === 0) return rule('hint.sub.takeTens', base)

  // Bridging back through ten
  if (a < 20 && a % 10 < b % 10) {
    return rule('hint.sub.downToTen', { ...base, aO: a % 10, rest: b - (a % 10) })
  }

  // Partitioning is only safe when no regrouping is needed
  if (a % 10 >= b % 10) {
    const aT = Math.floor(a / 10) * 10, aO = a % 10
    const bT = Math.floor(b / 10) * 10, bO = b % 10
    return rule('hint.sub.splitUp', { ...base, aT, aO, bT, bO, tens: aT - bT, onesDiff: aO - bO })
  }

  return rule('hint.sub.countUpEnd', base)
}

/* ── MULTIPLICATION ───────────────────────────────────── */

function multiplicationRule(a0, b0, ans) {
  // Normalise so `lo` is the smaller factor — the strategy hangs off it
  const hi = Math.max(a0, b0)
  const lo = Math.min(a0, b0)
  const p = { a: a0, b: b0, ans, hi, lo, x2: hi * 2, x4: hi * 4, x5: hi * 5, x10: hi * 10,
              s2: lo * 2, s3: lo * 3 }

  // Commutativity is worth saying out loud — it halves the table
  const prefix = a0 < b0 ? t('hint.mul.flip', p) : ''
  const r = key => ({ key, params: p, prefix })

  if (lo === 0)  return r('hint.mul.zeroGroups')
  if (lo === 1)  return r('hint.mul.oneGroup')
  if (lo === 2)  return r('hint.mul.doubleIt')
  if (lo === 10) return r('hint.mul.timesTen')
  if (lo === 5)  return r('hint.mul.halfOfTen')
  if (lo === 9)  return r('hint.mul.oneGroupLess')
  if (lo === 4)  return r('hint.mul.doubleDouble')
  if (lo === 8)  return r('hint.mul.doubleThrice')
  if (lo === 3)  return r('hint.mul.doublePlusOne')
  if (lo === 6)  return r('hint.mul.fivePlusOne')
  if (lo === 7)  return r('hint.mul.fivePlusTwo')

  return r('hint.mul.skipCount')
}

/* ── DIVISION ─────────────────────────────────────────── */

function divisionRule(a, b, ans) {
  const base = { a, b, ans, s2: b * 2, s3: b * 3 }

  if (b === 1)            return rule('hint.div.splitByOne', base)
  if (b === a)            return rule('hint.div.oneEach', base)
  if (b === 2)            return rule('hint.div.halveIt', base)
  if (b === 10)           return rule('hint.div.divideByTen', base)
  if (ans <= 5 || b <= 5) return rule('hint.div.skipCount', base)

  return rule('hint.div.flipIt', base)
}
