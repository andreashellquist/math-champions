/**
 * Round assembly — picks the facts, then dresses each one as a question.
 *
 * Kept out of the reducer because question generation is random, and a
 * reducer that isn't pure can't be tested or replayed.
 */
import {
  composeRound, composeFixture, composeMixed, mixedReady,
  boxOf, optionCountFor, isFatiguing, recentAccuracy, masteredCount,
} from './mastery'
import { OP_ORDER } from './config'
import { buildQuestion, pickFormat } from './questions'
import { rng as defaultRng } from './rng'

export const ROUND_SIZE = 5

/** Choose the facts for a round: warm-up, review, review, struggle, new */
export function buildRoundQueue(mastery, op, { size = ROUND_SIZE, mode = 'training', rng = defaultRng } = {}) {
  // In a fixture the rival picks the questions — see composeFixture
  if (mode === 'fixture') return composeFixture(mastery, op, { size, rng })
  if (mode === 'mixed') {
    const ops = mixedReady(mastery, OP_ORDER) ?? [op]
    return composeMixed(mastery, ops, { size, rng })
  }
  // A tiring child gets an easier round, never a locked door
  const ease = isFatiguing(mastery, op)
  return composeRound(mastery, op, { size: ease ? 3 : size, ease, rng })
}

/**
 * Dress a fact as a question, using its mastery box to pick the presentation.
 *
 * In a derby the option count is forced to four regardless of box. That is
 * honest difficulty — a pure guesser scores 1.25/5 instead of 1.67/5 — and it
 * touches only what is *asked*, never whether a correct answer scores.
 */
export function questionFor(mastery, fact, { mode = 'training', rng = defaultRng } = {}) {
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
