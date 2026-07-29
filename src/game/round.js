/**
 * Round assembly — picks the facts, then dresses each one as a question.
 *
 * Kept out of the reducer because question generation is random, and a
 * reducer that isn't pure can't be tested or replayed.
 */
import { composeRound, composeFixture, boxOf, optionCountFor } from './mastery'
import { buildQuestion, pickFormat } from './questions'
import { rng as defaultRng } from './rng'

export const ROUND_SIZE = 5

/** Choose the facts for a round: warm-up, review, review, struggle, new */
export function buildRoundQueue(mastery, op, { size = ROUND_SIZE, mode = 'training', rng = defaultRng } = {}) {
  // In a fixture the rival picks the questions — see composeFixture
  return mode === 'fixture'
    ? composeFixture(mastery, op, { size, rng })
    : composeRound(mastery, op, { size, rng })
}

/** Dress a fact as a question, using its mastery box to pick the presentation */
export function questionFor(mastery, fact, { rng = defaultRng } = {}) {
  const box = boxOf(mastery, fact)
  return buildQuestion({
    fact,
    format: pickFormat(box, { rng }),
    optionCount: optionCountFor(box),
    recentErrorFamilies: mastery.e,
    rng,
  })
}
