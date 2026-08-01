/**
 * Fixed fact sets for Snabbskott ("Quick Shots") — the arcade mode.
 *
 * Two design constraints came out of pedagogy and ADHD review before this was
 * built, and both are why this file exists rather than reusing the adaptive
 * engine:
 *
 * - **The set must be fixed, but the presentation order must not be.** Same
 *   facts every run is what makes a score comparable across attempts — that's
 *   the whole point of a personal best. But the *same order* every run trains
 *   a child to answer from position within about fifteen runs, at which point
 *   the score stops measuring arithmetic and starts measuring recitation.
 *   `questions.js`/`GameContext` shuffle order per run; only the fact list
 *   here is fixed.
 * - **The set must be scoped to content a child could plausibly know**, not
 *   the raw canonical table for the operation. `OPS.unlock` gates operations
 *   by a cumulative correct-answer count across the whole app, so a child can
 *   reach multiplication's arcade chip before ever seeing a multiplication
 *   fact in training. Cold-starting on unfamiliar facts under a clock is
 *   exactly the pairing the Shootout gate (`shootoutOffered`) exists to
 *   prevent elsewhere — so sets here reuse the same strand ordering the
 *   adaptive engine already uses, rather than the full fact space.
 *
 * A child picks a set, not a difficulty number — self-selecting into a tier
 * where they score is more autonomy-supportive than a hidden eligibility
 * check, and it gives a plateaued child somewhere to go that isn't a bigger
 * number on the same content.
 */
import { STRANDS_BY_OP } from './facts'

/** How many of an operation's easiest strands make up its "core" set */
const CORE_STRAND_COUNT = 2

function strandFacts(op, count) {
  return (STRANDS_BY_OP[op] ?? [])
    .filter(s => s.perFact)
    .slice(0, count)
    .flatMap(s => s.facts)
}

function allFacts(op) {
  return (STRANDS_BY_OP[op] ?? []).filter(s => s.perFact).flatMap(s => s.facts)
}

/** One entry per (operation, set). `id` is stable — used as the storage key. */
export const ARCADE_SETS = ['addition', 'subtraction', 'multiplication', 'division'].flatMap(op => {
  const core = strandFacts(op, CORE_STRAND_COUNT)
  const full = allFacts(op)
  const sets = [{ id: `${op}.core`, op, facts: core }]
  // Only offer the full table as a distinct tier once it's meaningfully bigger
  if (full.length > core.length + 6) {
    sets.push({ id: `${op}.full`, op, facts: full })
  }
  return sets
})

export const arcadeSetsFor = op => ARCADE_SETS.filter(s => s.op === op)
export const arcadeSet = id => ARCADE_SETS.find(s => s.id === id)
