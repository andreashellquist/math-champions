/**
 * Misconception-based distractors.
 *
 * The old generator built wrong answers as `ans ± random`. That is worse than
 * useless: for `4 × 6 = 24` it might offer `19, 31`, and a child can pick the
 * only even number without multiplying anything. Worse, a wrong answer taught
 * nothing, because nobody actually makes that mistake.
 *
 * Here every distractor is a real error a child makes — a dropped carry, the
 * smaller-from-larger subtraction bug, the square next door to `7 × 8`. Two
 * consequences: choosing between options requires actually computing, and a
 * wrong answer is *diagnostic* — `classifyChoice` names the misconception, so
 * feedback can address the specific mistake instead of reciting the answer.
 */
import { t } from '../i18n'

/* ── RULES ─────────────────────────────────────────────────
   family — used to keep the two distractors probing different errors
   w      — diagnostic weight; higher rules win the slot
   mcq    — false ⇒ never offer as an option, classify-only (see ADD_CONCAT)
   ───────────────────────────────────────────────────────── */

const ones = n => n % 10
const tens = n => Math.floor(n / 10)

const RULES = {
  addition: [
    { name: 'ADD_DOUBLE_PULL', family: 'near_fact', w: 5,
      applies: (a, b) => Math.abs(a - b) === 1,
      values: (a, b) => [2 * a, 2 * b] },
    { name: 'ADD_CARRY_DROP', family: 'place_value', w: 5,
      applies: (a, b) => ones(a) + ones(b) >= 10,
      values: (a, b, ans) => [ans - 10] },
    { name: 'ADD_CONCAT', family: 'place_value', w: 4, mcq: false,
      applies: (a, b) => a >= 10 && b >= 10 && ones(a) + ones(b) >= 10,
      values: (a, b) => [100 * (tens(a) + tens(b)) + (ones(a) + ones(b))] },
    { name: 'ADD_ROUND_NO_ADJUST', family: 'strategy_slip', w: 4,
      applies: (a, b) => [8, 9].includes(ones(a)) || [8, 9].includes(ones(b)),
      values: (a, b, ans) => {
        const near = [8, 9].includes(ones(b)) ? b : a
        return [ans + (10 - ones(near))]
      } },
    { name: 'ADD_OP_CONFUSION', family: 'wrong_op', w: 4,
      applies: (a, b) => a !== b,
      values: (a, b) => [Math.abs(a - b)] },
    { name: 'ADD_BRIDGE_SLIP', family: 'off_by_one', w: 3,
      applies: (a, b) => a <= 9 && b <= 9 && a + b >= 11,
      values: (a, b, ans) => [ans - 2, ans + 2] },
    { name: 'ADD_COUNT_ON', family: 'off_by_one', w: 3,
      applies: () => true,
      values: (a, b, ans) => [ans - 1, ans + 1] },
  ],

  subtraction: [
    // A zero in the minuend's ones column produces the same wrong number as
    // the general smaller-from-larger bug, but "there was nothing to take
    // from" is the more useful thing to say — so it is tested first.
    { name: 'SUB_ZERO_BUG', family: 'buggy_algorithm', w: 6,
      applies: (a, b) => ones(a) === 0 && ones(b) > 0,
      values: (a, b) => [10 * (tens(a) - tens(b)) + ones(b)] },
    // Brown & VanLehn's classic buggy algorithm: subtract the smaller digit
    // from the larger in each column, whichever way round they appear.
    { name: 'SUB_SMALLER_FROM_LARGER', family: 'buggy_algorithm', w: 6,
      applies: (a, b) => ones(a) < ones(b),
      values: (a, b) => [10 * Math.abs(tens(a) - tens(b)) + Math.abs(ones(a) - ones(b))] },
    { name: 'SUB_BORROW_NO_DECREMENT', family: 'buggy_algorithm', w: 5,
      applies: (a, b) => ones(a) < ones(b),
      values: (a, b, ans) => [ans + 10] },
    { name: 'SUB_OP_CONFUSION', family: 'wrong_op', w: 4,
      applies: (a, b, ans) => a + b <= 2.5 * ans,
      values: (a, b) => [a + b] },
    { name: 'SUB_DECREMENT_ONLY', family: 'place_value', w: 3,
      applies: (a, b) => ones(a) >= ones(b),
      values: (a, b, ans) => [ans - 10] },
    { name: 'SUB_COUNT_BACK', family: 'off_by_one', w: 3,
      applies: () => true,
      values: (a, b, ans) => [ans - 1, ans + 1] },
  ],

  multiplication: [
    // 7×8 → 49 or 64. The neighbouring square is the single most seductive
    // wrong answer in the whole times table.
    { name: 'MUL_SQUARE_PULL', family: 'near_fact', w: 6,
      applies: (a, b) => Math.abs(a - b) === 1,
      values: (a, b) => [a * a, b * b] },
    { name: 'MUL_ADJACENT_MULTIPLE', family: 'adjacent_multiple', w: 5,
      applies: () => true,
      values: (a, b, ans) => [ans - a, ans + a, ans - b, ans + b] },
    { name: 'MUL_NINE_SHORTCUT', family: 'strategy_slip', w: 5,
      applies: (a, b) => a === 9 || b === 9,
      values: (a, b) => { const o = a === 9 ? b : a; return [10 * o, 10 * o - 1] } },
    { name: 'MUL_IDENTITY_BUG', family: 'identity', w: 5,
      applies: (a, b) => Math.min(a, b) <= 1,
      values: (a, b) => {
        const [lo, hi] = [Math.min(a, b), Math.max(a, b)]
        return lo === 0 ? [hi] : [0, hi + 1]
      } },
    { name: 'MUL_HALF_TABLE', family: 'strategy_slip', w: 4,
      applies: (a, b) => [4, 6, 8].includes(Math.min(a, b)),
      values: (a, b) => [Math.max(a, b) * (Math.min(a, b) / 2)] },
    { name: 'MUL_DIGIT_REVERSAL', family: 'digit_reversal', w: 4,
      applies: (a, b, ans) => ans >= 13 && ans <= 99 && ones(ans) !== tens(ans) && ones(ans) !== 0,
      values: (a, b, ans) => [10 * ones(ans) + tens(ans)] },
    { name: 'MUL_OP_CONFUSION', family: 'wrong_op', w: 4,
      applies: (a, b) => Math.min(a, b) <= 4,
      values: (a, b) => [a + b] },
  ],

  division: [
    // Reporting the divisor as the quotient — "56 ÷ 8" answered "8".
    { name: 'DIV_SWAP_OPERANDS', family: 'operand_echo', w: 6,
      applies: (a, b, ans) => b !== ans,
      values: (a, b) => [b] },
    { name: 'DIV_SKIP_MISCOUNT', family: 'off_by_one', w: 5,
      applies: () => true,
      values: (a, b, ans) => [ans - 1, ans + 1] },
    { name: 'DIV_HALF_ERROR', family: 'strategy_slip', w: 4,
      applies: (a, b) => [4, 6, 8].includes(b),
      values: (a, b, ans) => [2 * ans] },
    { name: 'DIV_OP_CONFUSION', family: 'wrong_op', w: 4,
      applies: (a, b, ans) => a - b >= 0 && a - b <= 2.5 * ans,
      values: (a, b) => [a - b] },
    { name: 'DIV_ECHO_DIVIDEND', family: 'operand_echo', w: 3,
      applies: (a, b, ans) => a <= 2.5 * ans,
      values: a => [a] },
  ],
}

/** Rules whose whole point is echoing a visible operand — exempt from G7 */
const ECHO_FAMILIES = new Set(['operand_echo', 'identity'])

/* ── GUARDS ────────────────────────────────────────────────
   Per-candidate guards reject a single value; set-level guards reject a
   whole option set. Both matter: a distractor can be individually fine and
   still leak the answer once you see it next to the others.
   ───────────────────────────────────────────────────────── */

const digitCount = n => String(Math.abs(n)).length

/** G1, G2, G4, G7 — evaluated per candidate */
function candidateOk(d, { a, b, ans, family, op }) {
  if (!Number.isInteger(d)) return false
  if (d < 0) return false                                   // G1
  if (d === 0 && ans !== 0) return false                    // G1 — "0" is never a real guess here
  if (d === ans) return false                               // G2
  if (ans >= 10) {                                          // G4 magnitude
    if (d < 0.4 * ans || d > 2.5 * ans) return false
  } else {
    if (Math.abs(d - ans) > 6) return false
    // Small *sums and differences* also need a ratio bound: `1 + 1 = 2`
    // offered against `8` is discardable on sight. Products are exempt —
    // a child working out 2 x 3 might plausibly land far from 6, so the
    // ratio bound there would throw away genuine misconceptions.
    const additive = op === 'addition' || op === 'subtraction'
    if (additive && d > Math.max(ans * 3, ans + 3)) return false
  }
  if (!ECHO_FAMILIES.has(family) && (d === a || d === b)) return false  // G7
  return true
}

/** G5 — at most one option may differ in digit count from the answer */
function passesDigitLength(opts, ans) {
  return opts.filter(d => digitCount(d) !== digitCount(ans)).length <= 1
}

/**
 * G6 — the answer must not be identifiable without computing.
 * Two leaks to close: parity (the only even number), and, for × and ÷,
 * being the only multiple of an operand.
 */
function passesNoShortcut(opts, { a, b, ans, op }) {
  const all = [ans, ...opts]
  const evens = all.filter(n => n % 2 === 0).length
  if ((evens === 1 && ans % 2 === 0) || (evens === all.length - 1 && ans % 2 !== 0)) return false

  if (op === 'multiplication' || op === 'division') {
    const divides = n => (a !== 0 && n % a === 0) || (b !== 0 && n % b === 0)
    if (!opts.some(divides)) return false
  }
  return true
}

/* ── SELECTION ─────────────────────────────────────────────── */

/**
 * Low-weight, fully-guarded filler values.
 *
 * These exist so the set-level guards are *satisfiable*. A fact like `4 × 6`
 * may only fire two or three misconception rules, and if they all happen to
 * be odd the answer becomes the only even option — the exact leak the rules
 * were meant to close. Fillers give the combination search room to find a
 * guard-passing set. Their weight of 1 means a real misconception always
 * wins the slot when one is available.
 */
function fillerCandidates(op, a, b, ans) {
  const out = []
  const push = (v, rule) => {
    if (candidateOk(v, { a, b, ans, op, family: 'fallback' })) {
      out.push({ v, w: 1, family: 'fallback', rule })
    }
  }
  for (let k = 1; k <= 12; k++) { push(ans + k, 'FALLBACK_NEAR'); push(ans - k, 'FALLBACK_NEAR') }
  // For × and ÷ the answer must not be the only multiple of an operand,
  // so offer nearby multiples explicitly.
  if (op === 'multiplication' || op === 'division') {
    for (let k = 1; k <= 4; k++) {
      push(ans + k * a, 'FALLBACK_MULTIPLE'); push(ans - k * a, 'FALLBACK_MULTIPLE')
      push(ans + k * b, 'FALLBACK_MULTIPLE'); push(ans - k * b, 'FALLBACK_MULTIPLE')
    }
  }
  return out
}

function candidatesFor(op, a, b, ans, recentErrorFamilies = [], extra = []) {
  const seen = new Map()   // value → best candidate

  for (const f of fillerCandidates(op, a, b, ans)) {
    if (!seen.has(f.v)) seen.set(f.v, f)
  }

  // Format-specific rules (missing-operand forms have their own error modes)
  for (const e of extra) {
    if (!candidateOk(e.value, { a, b, ans, op, family: e.family })) continue
    const prev = seen.get(e.value)
    const cand = { v: e.value, w: e.w, family: e.family, rule: e.rule }
    if (!prev || cand.w > prev.w) seen.set(e.value, cand)
  }

  for (const rule of RULES[op] ?? []) {
    if (rule.mcq === false) continue
    if (!rule.applies(a, b, ans)) continue
    for (const v of rule.values(a, b, ans)) {
      if (!candidateOk(v, { a, b, ans, op, family: rule.family })) continue
      // Personalise: probe harder on the errors this child actually makes
      const bump = recentErrorFamilies.filter(f => f === rule.family).length >= 2 ? 2 : 0
      const cand = { v, w: rule.w + bump, family: rule.family, rule: rule.name }
      const prev = seen.get(v)
      if (!prev || cand.w > prev.w) seen.set(v, cand)
    }
  }
  return [...seen.values()]
}

/** All size-`k` combinations of `arr` (arr stays small — a dozen candidates at most) */
function combinations(arr, k) {
  if (k === 0) return [[]]
  const out = []
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) out.push([arr[i], ...rest])
  }
  return out
}

/** Keep the combination search cheap — the best candidates are all we need */
const SEARCH_WIDTH = 16

/**
 * Pick `count` distractors for a fact.
 *
 * Tries hardest first: satisfy every guard, then relax the shortcut guard,
 * then the digit-length guard. Relaxation is ordered so the *pedagogical*
 * guards survive longest. The magnitude and non-negativity guards are never
 * relaxed — an implausible option is worse than a mild leak, because a child
 * can discard it on sight and the item silently becomes easier.
 *
 * @returns {{ value: number, rule: string, family: string }[]}
 */
export function pickDistractors({ op, a, b, ans, count = 2, recentErrorFamilies = [], extra = [], rng }) {
  const jitter = () => (rng ? rng() : 0.5) * 0.9   // break weight ties differently each time

  const cands = candidatesFor(op, a, b, ans, recentErrorFamilies, extra)
    .map(c => ({ ...c, j: jitter() }))
    .sort((x, y) => (y.w + y.j) - (x.w + x.j))
    .slice(0, SEARCH_WIDTH)

  const score = combo =>
    combo.reduce((s, c) => s + c.w + c.j, 0) +
    (new Set(combo.map(c => c.family)).size === combo.length ? 3 : 0)  // family diversity

  const ctx = { a, b, ans, op }
  const tiers = [
    opts => passesDigitLength(opts, ans) && passesNoShortcut(opts, ctx),
    opts => passesDigitLength(opts, ans),
    () => true,
  ]

  const take = Math.min(count, cands.length)
  let picked = null
  for (const accepts of tiers) {
    let best = null
    for (const combo of combinations(cands, take)) {
      if (!accepts(combo.map(c => c.v))) continue
      if (!best || score(combo) > score(best)) best = combo
    }
    if (best) { picked = best.map(c => ({ value: c.v, rule: c.rule, family: c.family })); break }
  }
  picked ??= cands.map(c => ({ value: c.v, rule: c.rule, family: c.family }))

  // The guarded pool can be smaller than `count` when the answer is tiny and
  // few plausible options exist. Pad regardless of which tier matched — a
  // question with a missing option would be worse than a mild guard breach.
  const used = new Set([ans, ...picked.map(p => p.value)])
  for (let k = 1; picked.length < count && k <= 30; k++) {
    for (const v of [ans + k, ans - k]) {
      if (picked.length >= count || v < 0 || used.has(v)) continue
      used.add(v)
      picked.push({ value: v, rule: 'FALLBACK_NEAR', family: 'fallback' })
    }
  }
  return picked
}

/**
 * Name the misconception behind a wrong answer.
 *
 * Runs the full rule set including classify-only rules like ADD_CONCAT
 * (`28 + 15 → 313`), which is far too implausible to offer as an option but
 * highly diagnostic when a child types it.
 *
 * @returns {{ rule: string, family: string, message: string } | null}
 */
export function classifyChoice(chosen, { op, a, b, ans }) {
  if (chosen === ans) return null
  for (const rule of RULES[op] ?? []) {
    if (!rule.applies(a, b, ans)) continue
    if (rule.values(a, b, ans).includes(chosen)) {
      const key = `diag.${rule.name}`
      const message = t(key)
      return { rule: rule.name, family: rule.family, message: message === key ? null : message }
    }
  }
  return null
}

export const __testing = { RULES, candidateOk, passesDigitLength, passesNoShortcut }
