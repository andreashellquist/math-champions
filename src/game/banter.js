/**
 * Rival banter.
 *
 * Warm, sporting, and strictly one-directional: the rival may greet the child,
 * applaud a goal, and shake hands afterwards. He may **never** speak after a
 * miss, never taunt, never celebrate a save, and never comment on the child's
 * ability.
 *
 * That asymmetry is the whole design. An opponent who reacts to failure turns
 * a knowledge gap into a social loss; an opponent who only ever reacts to
 * success is just good company. Banter is warm rather than aggressive for the
 * same reason — nobody needs to be crushed for a seven-year-old to enjoy
 * beating a keeper.
 */
import { t, tPick } from '../i18n'
import { rng as defaultRng } from './rng'

/** Moments the rival is allowed to speak at. There is deliberately no `miss`. */
export const BANTER_MOMENTS = ['greet', 'beaten', 'wonTie', 'closeTie']

/**
 * @param {'greet'|'beaten'|'wonTie'|'closeTie'} moment
 * @param {object} rival
 * @returns {string|null}
 */
export function banter(moment, rival, r = defaultRng) {
  if (!rival || !BANTER_MOMENTS.includes(moment)) return null
  return tPick(`banter.${moment}`, { rival: t(rival.nameKey) }, r)
}
