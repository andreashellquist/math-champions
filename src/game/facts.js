/**
 * The fact ladder.
 *
 * Two kinds of strand:
 *
 *  - **perFact** strands cover the bounded single-digit fact space, so each
 *    fact gets its own mastery record (`7×8` is a thing you either know or
 *    don't).
 *  - **sampled** strands cover multi-digit arithmetic, where the space is
 *    effectively infinite. These are tracked per *strand*, not per fact —
 *    otherwise `73+48` would mint a new record forever and localStorage would
 *    grow without bound.
 *
 * Strands are ordered by difficulty and assignment is first-match, so every
 * canonical fact belongs to exactly one strand.
 */
import { rng as defaultRng } from './rng'

export const OP_CHAR = {
  addition: 'a', subtraction: 's', multiplication: 'm', division: 'd',
}

/** Addition and multiplication are commutative — one record serves both orders */
export const COMMUTATIVE = {
  addition: true, multiplication: true, subtraction: false, division: false,
}

/** Canonical key for a fact. Commutative ops sort their operands. */
export function factKey(op, a, b) {
  const [x, y] = COMMUTATIVE[op] ? [Math.min(a, b), Math.max(a, b)] : [a, b]
  return `${OP_CHAR[op]}${x}.${y}`
}

const digitsOnes = n => n % 10

/* ── STRAND DEFINITIONS ───────────────────────────────────────
   `owns`   — perFact strands: does this canonical fact belong here?
   `sample` — sampled strands: draw a fresh (a, b) inside the rule.
   ───────────────────────────────────────────────────────────── */

const STRAND_DEFS = [
  /* ADDITION */
  { id: 'A1', op: 'addition', label: 'Sums within 10',
    owns: (a, b) => a >= 1 && b >= 1 && a <= 9 && b <= 9 && a + b <= 10 },
  { id: 'A2', op: 'addition', label: 'Doubles & near doubles',
    owns: (a, b) => a >= 2 && b <= 10 && Math.abs(a - b) <= 1 },
  { id: 'A3', op: 'addition', label: 'Bridging through ten',
    owns: (a, b) => a <= 9 && b <= 9 && a + b >= 11 && a + b <= 18 },
  { id: 'A4', op: 'addition', label: 'Adding ten',
    sample: r => { const a = r.int(10, 89); return [a, 10] } },
  { id: 'A5', op: 'addition', label: 'Two-digit plus one digit',
    sample: r => {
      // Ones digit capped at 8 so there is always room for a no-carry addend
      const a = r.int(1, 8) * 10 + r.int(0, 8)
      return [a, r.int(1, 9 - digitsOnes(a))]
    } },
  { id: 'A6', op: 'addition', label: 'Two-digit plus one digit, carrying',
    sample: r => {
      // Ones digit ≥ 1, so the addend needed to force a carry is still single-digit
      const a = r.int(1, 8) * 10 + r.int(1, 9)
      return [a, r.int(10 - digitsOnes(a), 9)]
    } },
  { id: 'A7', op: 'addition', label: 'Two-digit plus two-digit',
    sample: r => {
      const a = r.int(11, 77)
      const bTens = r.int(1, Math.max(1, Math.floor((99 - a) / 10)))
      return [a, bTens * 10 + r.int(0, 9 - digitsOnes(a))]
    } },
  { id: 'A8', op: 'addition', label: 'Two-digit plus two-digit, carrying',
    sample: r => {
      const aOnes = r.int(2, 9)
      const bOnes = r.int(10 - aOnes, 9)
      const a = r.int(1, 4) * 10 + aOnes
      const b = r.int(1, Math.floor((98 - a - bOnes) / 10)) * 10 + bOnes
      return [a, b]
    } },
  { id: 'A9', op: 'addition', label: 'Crossing one hundred',
    sample: r => {
      const total = r.int(100, 150)
      // Keep both addends two-digit — `99 + 1` is not what this strand teaches
      const a = r.int(Math.max(11, total - 99), Math.min(99, total - 10))
      return [a, total - a]
    } },

  /* SUBTRACTION */
  { id: 'S1', op: 'subtraction', label: 'Within 10',
    owns: (a, b) => a <= 10 && b >= 1 && b <= 9 && a - b >= 1 },
  { id: 'S2', op: 'subtraction', label: 'Facts to 18',
    owns: (a, b) => a >= 11 && a <= 18 && b >= 2 && b <= 9 && a - b >= 2 && a - b <= 9 },
  { id: 'S3', op: 'subtraction', label: 'Two-digit minus one digit',
    sample: r => {
      // Ones digit ≥ 1 so there is something to subtract without borrowing
      const a = r.int(1, 9) * 10 + r.int(1, 9)
      return [a, r.int(1, digitsOnes(a))]
    } },
  { id: 'S4', op: 'subtraction', label: 'Two-digit minus one digit, borrowing',
    sample: r => {
      const a = r.int(2, 9) * 10 + r.int(0, 7)
      return [a, r.int(digitsOnes(a) + 1, 9)]
    } },
  { id: 'S5', op: 'subtraction', label: 'Two-digit minus two-digit',
    sample: r => {
      const a = r.int(21, 99)
      const bOnes = r.int(0, digitsOnes(a))
      return [a, r.int(1, Math.floor(a / 10) - 1) * 10 + bOnes]
    } },
  { id: 'S6', op: 'subtraction', label: 'Two-digit minus two-digit, borrowing',
    sample: r => {
      const a = r.int(3, 9) * 10 + r.int(0, 8)
      const bOnes = r.int(digitsOnes(a) + 1, 9)
      return [a, r.int(1, Math.floor(a / 10) - 1) * 10 + bOnes]
    } },
  { id: 'S7', op: 'subtraction', label: 'Taking from a whole ten',
    sample: r => {
      const a = r.int(2, 10) * 10
      const b = r.int(1, a / 10 - 1) * 10 + r.int(1, 9)
      return [a, b]
    } },

  /* MULTIPLICATION — named for the hardest new factor each strand introduces.
     Canonical collapsing means later strands inherit fewer pairs. */
  { id: 'M1', op: 'multiplication', label: 'Twos, fives and tens',
    owns: (a, b) => a >= 2 && b <= 10 && ([2, 5, 10].includes(a) || [2, 5, 10].includes(b)) },
  { id: 'M2', op: 'multiplication', label: 'Times zero and times one',
    owns: (a, b) => a <= 1 && b <= 10 },
  { id: 'M3', op: 'multiplication', label: 'Threes and fours',
    owns: (a, b) => a >= 2 && b <= 10 && ([3, 4].includes(a) || [3, 4].includes(b)) },
  { id: 'M4', op: 'multiplication', label: 'Squares',
    owns: (a, b) => a === b && a >= 2 && a <= 10 },
  { id: 'M5', op: 'multiplication', label: 'The sixes',
    owns: (a, b) => b <= 10 && (a === 6 || b === 6) },
  { id: 'M6', op: 'multiplication', label: 'The sevens',
    owns: (a, b) => b <= 10 && (a === 7 || b === 7) },
  { id: 'M7', op: 'multiplication', label: 'Eight times nine',
    owns: (a, b) => b <= 10 && a >= 2 },
  { id: 'M8', op: 'multiplication', label: 'Elevens and twelves',
    owns: (a, b) => a >= 2 && b <= 12 },

  /* DIVISION */
  { id: 'D1', op: 'division', label: 'Sharing by 1, 2, 5 and 10',
    owns: (a, b) => [1, 2, 5, 10].includes(b) },
  { id: 'D2', op: 'division', label: 'Sharing by 3 and 4',
    owns: (a, b) => [3, 4].includes(b) },
  { id: 'D3', op: 'division', label: 'Sharing by 6, 7, 8 and 9',
    owns: (a, b) => [6, 7, 8, 9].includes(b) },
]

/* ── CANONICAL FACT SPACES ─────────────────────────────────── */

function canonicalSpace(op) {
  const out = []
  if (op === 'addition') {
    for (let a = 0; a <= 10; a++) for (let b = a; b <= 10; b++) out.push([a, b])
  } else if (op === 'subtraction') {
    for (let a = 0; a <= 18; a++) for (let b = 0; b <= 9; b++) {
      if (a - b >= 0 && a - b <= 9) out.push([a, b])
    }
  } else if (op === 'multiplication') {
    for (let a = 0; a <= 12; a++) for (let b = a; b <= 12; b++) out.push([a, b])
  } else {
    for (let b = 1; b <= 10; b++) for (let q = 1; q <= 10; q++) out.push([b * q, b])
  }
  return out
}

/**
 * Strands that legitimately end up empty because canonical collapsing gave all
 * their pairs to an earlier strand. Naming the hardest new factor means later
 * multiplication strands inherit fewer pairs, and eventually none.
 */
const ALLOWED_EMPTY = new Set(['M8'])

/** Build strands with their fact lists resolved. */
function buildStrands() {
  const claimed = new Set()
  const strands = STRAND_DEFS.map(def => {
    if (!def.owns) return { ...def, perFact: false, facts: [] }

    const facts = []
    for (const [a, b] of canonicalSpace(def.op)) {
      const key = factKey(def.op, a, b)
      if (claimed.has(key)) continue
      // Only commutative ops get their operands sorted. Handing `owns` a
      // sorted pair for subtraction or division silently inverts the rule —
      // `a - b >= 1` becomes `b - a >= 1`, which is never true.
      const [x, y] = COMMUTATIVE[def.op] ? [Math.min(a, b), Math.max(a, b)] : [a, b]
      if (!def.owns(x, y)) continue
      claimed.add(key)
      facts.push({ op: def.op, a, b, key, strand: def.id, perFact: true })
    }
    return { ...def, perFact: true, facts }
  })

  const built = strands.filter(s => !s.perFact || s.facts.length > 0)

  // A strand definition that claims nothing is a bug in its predicate, not a
  // strand we meant to drop — surface it rather than silently shipping a
  // ladder with a rung missing.
  const lost = STRAND_DEFS
    .filter(d => d.owns && !built.some(s => s.id === d.id))
    .map(d => d.id)
    .filter(id => !ALLOWED_EMPTY.has(id))
  if (lost.length) {
    throw new Error(`Strand(s) claimed no facts: ${lost.join(', ')}`)
  }

  return built
}

export const STRANDS = buildStrands()

export const STRANDS_BY_OP = STRANDS.reduce((acc, s) => {
  ;(acc[s.op] ||= []).push(s)
  return acc
}, {})

export const STRAND_BY_ID = Object.fromEntries(STRANDS.map(s => [s.id, s]))

/** Every perFact fact, flat — useful for stats and tests */
export const ALL_FACTS = STRANDS.flatMap(s => s.facts)

/**
 * Mastery is tracked per-fact for single-digit strands and per-strand for
 * multi-digit ones. This is the key a fact's Leitner record lives under.
 */
export function masteryKey(fact) {
  return fact.perFact ? fact.key : fact.strand
}

/** Draw a fresh fact from a sampled (multi-digit) strand. */
export function sampleStrandFact(strand, r = defaultRng) {
  const [a, b] = strand.sample(r)
  return { op: strand.op, a, b, key: factKey(strand.op, a, b), strand: strand.id, perFact: false }
}

/** All facts a strand can currently offer (enumerated, or one fresh sample) */
export function factsFromStrand(strand, r = defaultRng) {
  return strand.perFact ? strand.facts : [sampleStrandFact(strand, r)]
}

/** The multiplication fact a division fact inverts — `56 ÷ 8` → `m7.8` */
export function inverseMultiplicationKey(fact) {
  if (fact.op !== 'division') return null
  return factKey('multiplication', fact.b, fact.a / fact.b)
}

/** Answer to a fact */
export function answerOf({ op, a, b }) {
  switch (op) {
    case 'addition':       return a + b
    case 'subtraction':    return a - b
    case 'multiplication': return a * b
    case 'division':       return a / b
    default:               throw new Error(`unknown op: ${op}`)
  }
}
