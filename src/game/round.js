/**
 * Round assembly — picks the facts, then dresses each one as a question.
 *
 * Kept out of the reducer because question generation is random, and a
 * reducer that isn't pure can't be tested or replayed.
 */
import {
  composeRound, composeFixture, composeMixed, composeGate, mixedReady,
  boxOf, optionCountFor, isFatiguing, recentAccuracy, masteredCount,
} from './mastery'
import { OP_ORDER } from './config'
import { buildQuestion, pickFormat, SYMBOL } from './questions'
import { answerOf } from './facts'
import { pickDistractors } from './distractors'
import { arcadeSet } from './arcadeSets'
import { rng as defaultRng, makeRng } from './rng'

export const ROUND_SIZE = 5
/** Comfortably more items than a 60s run could ever reach, so the queue never
    runs out mid-round for either timed length. Free play (no clock) can in
    principle outlast this batch — GameContext tops it up on demand rather
    than treating "ran out of pre-built items" as "round over". */
const ARCADE_MIN_ITEMS = 200

/** Choose the facts for a round: warm-up, review, review, struggle, new */
export function buildRoundQueue(mastery, op, { size = ROUND_SIZE, mode = 'training', setId = null, rng = defaultRng } = {}) {
  // In a fixture the rival picks the questions — see composeFixture
  if (mode === 'gate') return composeGate(mastery, op, { size, rng })
  if (mode === 'fixture') return composeFixture(mastery, op, { size, rng })
  if (mode === 'arcade') return buildArcadeQueue(setId, rng)
  if (mode === 'mixed') {
    const ops = mixedReady(mastery, OP_ORDER) ?? [op]
    return composeMixed(mastery, ops, { size, rng })
  }
  // A tiring child gets an easier round, never a locked door
  const ease = isFatiguing(mastery, op)
  return composeRound(mastery, op, { size: ease ? 3 : size, ease, rng })
}

/**
 * The same fixed facts every run, reshuffled into a fresh order each time.
 *
 * Same content = a comparable score; same *order* would mean a well-practised
 * child starts answering from position rather than computing, at which point
 * the score stops measuring arithmetic. So the set is fixed, the sequence
 * isn't — reshuffled independently on every lap round the set.
 */
function buildArcadeQueue(setId, rng) {
  const set = arcadeSet(setId)
  if (!set || !set.facts.length) return []
  const laps = Math.ceil(ARCADE_MIN_ITEMS / set.facts.length)
  return Array.from({ length: laps }, () => rng.shuffle(set.facts)).flat()
}

/** A short, deterministic hash — good enough to seed a per-fact RNG */
function hashKey(key) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0
  return h >>> 0
}

/**
 * Dress an arcade fact as a question.
 *
 * Deliberately not `buildQuestion`: format is locked to a plain prompt with
 * exactly three options (no free entry, no missing-operand, no word problem —
 * under a throughput clock those measure reading and typing speed, not
 * arithmetic), and the *distractor values* are seeded per fact so an identical
 * set is never secretly harder or easier some runs. Only the *position* of the
 * correct answer among the three buttons varies, using the run's own RNG, so
 * the layout can't be memorised either.
 */
export function arcadeQuestionFor(fact, { rng = defaultRng } = {}) {
  const { op, a, b } = fact
  const ans = answerOf(fact)
  const perFactRng = makeRng(hashKey(fact.key))
  const distractors = pickDistractors({ op, a, b, ans, count: 2, rng: perFactRng })

  return {
    factKey: fact.key,
    strand: fact.strand,
    op, a, b, ans,
    format: 'standard',
    prompt: `${a} ${SYMBOL[op]} ${b} = ?`,
    distractors,
    opts: rng.shuffle([ans, ...distractors.map(d => d.value)]),
    hintFact: { op, a, b, ans },
  }
}

/**
 * Dress a fact as a question, using its mastery box to pick the presentation.
 *
 * In a derby the option count is forced to four regardless of box. That is
 * honest difficulty — a pure guesser scores 1.25/5 instead of 1.67/5 — and it
 * touches only what is *asked*, never whether a correct answer scores.
 */
export function questionFor(mastery, fact, { mode = 'training', rng = defaultRng } = {}) {
  if (mode === 'arcade') return arcadeQuestionFor(fact, { rng })
  const box = boxOf(mastery, fact)
  const acc = recentAccuracy(mastery, fact.op)
  const allowEntry = acc !== null && acc >= 0.85 && masteredCount(mastery) >= 20
  return buildQuestion({
    fact,
    format: pickFormat(box, { allowEntry, rng }),
    optionCount: mode === 'fixture' ? 4 : optionCountFor(box),
    recentErrorFamilies: mastery.e,
    rng,
  })
}
