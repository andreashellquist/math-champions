/**
 * Turns a fact into a question the child actually sees.
 *
 * A fact (`7 × 8`) can be dressed three ways:
 *   standard  — `7 × 8 = ?`
 *   missing   — `7 × ? = 56`   (builds algebraic thinking; unlocked once the
 *               fact is well known, otherwise it's two problems at once)
 *   word      — a soccer story. Numbers always come from the fact the mastery
 *               engine chose — never freshly randomised, or word problems
 *               would quietly bypass the whole adaptive system.
 */
import { COMMUTATIVE, answerOf } from './facts'
import { pickDistractors } from './distractors'
import { rng as defaultRng } from './rng'
import { tPick } from '../i18n'

export const SYMBOL = {
  addition: '+', subtraction: '−', multiplication: '×', division: '÷',
}

/* ── WORD PROBLEM TEMPLATES ────────────────────────────────
   ≤2 sentences, ≤20 words, digits not number-words — reading load competes
   with arithmetic for the same working memory.
   ───────────────────────────────────────────────────────── */

const PLAYERS = ['Haaland', 'Yamal', 'Bellingham', 'Kane', 'Gyökeres', 'Alexia']
const TEAMS   = ['City', 'Barça', 'Madrid', 'Arsenal']

function wordCast(r) {
  const [p1, p2] = r.shuffle(PLAYERS)
  return { p1, p2, team: r.pick(TEAMS) }
}

/**
 * Pick a word-problem template.
 *
 * Comparison subtraction ("how many more") is cognitively distinct from
 * take-away and much harder, so it is gated to two-digit facts. Division
 * rotates partitive (sharing into groups) and quotitive (making groups of) —
 * a child drilled on only one reliably fails the other.
 */
function wordProblem(op, a, b, r) {
  const params = { a, b, ...wordCast(r) }
  const useCompare = op === 'subtraction' && a >= 11 && r.chance(0.35)
  const key = useCompare ? 'word.subtractionCompare' : `word.${op}`
  return tPick(key, params, r)
}

/* ── MISSING-OPERAND FORMS ─────────────────────────────────
   Recovering the hidden operand uses the inverse operation, so the
   distractors come from the inverse operation's misconception rules.
   ───────────────────────────────────────────────────────── */

/**
 * @returns {{ prompt, ans, distractorFact: {op,a,b,ans} }}
 */
function missingForm(op, a, b, result, hideFirst) {
  const s = SYMBOL[op]
  if (hideFirst) {
    // ? ∘ b = result  — recovered by the inverse applied to (result, b)
    const inverse = { addition: 'subtraction', subtraction: 'addition',
                      multiplication: 'division', division: 'multiplication' }[op]
    return {
      prompt: `? ${s} ${b} = ${result}`,
      ans: a,
      distractorFact: { op: inverse, a: result, b, ans: a },
    }
  }
  // a ∘ ? = result
  const recover = { addition: 'subtraction', subtraction: 'subtraction',
                    multiplication: 'division', division: 'division' }[op]
  const [ra, rb] = op === 'addition' || op === 'multiplication' ? [result, a] : [a, result]
  return {
    prompt: `${a} ${s} ? = ${result}`,
    ans: b,
    distractorFact: { op: recover, a: ra, b: rb, ans: b },
  }
}

/** Errors unique to the missing-operand format — the two dominant real ones */
function missingExtras(visibleA, visibleB) {
  return [
    { value: Math.max(visibleA, visibleB), w: 6, family: 'operand_echo', rule: 'MISSING_ECHO_TOTAL' },
    { value: visibleA + visibleB,          w: 5, family: 'wrong_op',     rule: 'MISSING_SUMMED_ALL' },
  ]
}

/* ── MAIN BUILDER ──────────────────────────────────────────── */

/**
 * Build a presentable question from a fact.
 *
 * @param {object}   opts
 * @param {object}   opts.fact     - { op, a, b, key, strand, perFact }
 * @param {string}   opts.format   - 'standard' | 'missing' | 'word'
 * @param {number}   opts.optionCount - 3 while learning, 4 once it's being assessed
 * @param {string[]} opts.recentErrorFamilies - to probe this child's actual mistakes
 * @param {Function} opts.rng
 */
export function buildQuestion({
  fact,
  format = 'standard',
  optionCount = 3,
  recentErrorFamilies = [],
  rng: r = defaultRng,
}) {
  const { op } = fact
  const result = answerOf(fact)

  // Present commutative facts in either order so position is never a cue
  const swap = COMMUTATIVE[op] && r.chance(0.5)
  const a = swap ? fact.b : fact.a
  const b = swap ? fact.a : fact.b

  let prompt, ans, distractorFact, extra = []

  if (format === 'missing') {
    const hideFirst = r.chance(0.4)
    const form = missingForm(op, a, b, result, hideFirst)
    prompt = form.prompt
    ans = form.ans
    distractorFact = form.distractorFact
    extra = missingExtras(hideFirst ? b : a, result)
  } else if (format === 'word') {
    // No template for this operation — fall back rather than skip the item
    prompt = wordProblem(op, a, b, r) ?? `${a} ${SYMBOL[op]} ${b} = ?`
    ans = result
    distractorFact = { op, a, b, ans: result }
  } else {
    prompt = `${a} ${SYMBOL[op]} ${b} = ?`
    ans = result
    distractorFact = { op, a, b, ans: result }
  }

  const distractors = pickDistractors({
    ...distractorFact,
    count: optionCount - 1,
    recentErrorFamilies,
    extra,
    rng: r,
  })

  return {
    factKey: fact.key,
    strand: fact.strand,
    op, a, b,
    ans,
    format,
    prompt,
    distractors,
    opts: r.shuffle([ans, ...distractors.map(d => d.value)]),
    // The hint always describes the underlying fact, not the dressed-up form
    hintFact: { op, a, b, ans: result },
  }
}

/**
 * Which presentation to use for a fact at a given mastery box.
 * Missing-operand only once the fact itself is solid (box ≥ 3), capped so
 * it stays a variation rather than the norm.
 */
export function pickFormat(box, { allowWord = true, rng: r = defaultRng } = {}) {
  if (box >= 3 && r.chance(0.25)) return 'missing'
  if (allowWord && r.chance(0.2)) return 'word'
  return 'standard'
}
