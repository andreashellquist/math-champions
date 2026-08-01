import { t, tPick, tCount, getLocale } from '../i18n'
import { rng as defaultRng } from './rng'

/**
 * Rival banter.
 *
 * Warm, cheeky, and strictly one-directional: the rival may greet the child,
 * applaud a goal, and shake hands afterwards. He may **never** speak after a
 * miss, never taunt, never celebrate a save, and never comment on the child's
 * ability.
 *
 * That asymmetry is the whole design. An opponent who reacts to failure turns a
 * knowledge gap into a social loss; an opponent who only ever reacts to success
 * is just good company. The teasing is aimed at the *fixture* — the derby, the
 * old scorelines, which end of town you're from — never at the player.
 *
 * Lines are per-rival so the Manchester derby doesn't sound like El Clásico,
 * with a shared pool behind them, and the picker avoids anything said recently
 * so the same joke doesn't land twice in a session.
 */

/** Moments the rival is allowed to speak at. There is deliberately no `miss`. */
export const BANTER_MOMENTS = ['greet', 'beaten', 'wonTie', 'closeTie']

/** Recently-used lines, so a short session doesn't repeat itself */
const recent = []
const RECENT_MEMORY = 12

function remember(line) {
  recent.push(line)
  if (recent.length > RECENT_MEMORY) recent.shift()
}

/** Test seam */
export function __resetBanter() {
  recent.length = 0
}

/**
 * Pick a line the child has not just heard.
 *
 * Draws from the rival's own pool plus the shared one, and only falls back to
 * repeating once every option has been used recently.
 */
function pickFresh(keys, params, r) {
  const locale = getLocale()
  const pool = []
  for (const key of keys) {
    const n = tCount(key, locale)
    for (let i = 0; i < n; i++) pool.push(key)
  }
  if (!pool.length) return null

  for (let attempt = 0; attempt < 24; attempt++) {
    const line = tPick(r.pick(pool), params, r, locale)
    if (line && !recent.includes(line)) { remember(line); return line }
  }
  // Everything is stale — say something rather than nothing
  const line = tPick(r.pick(pool), params, r, locale)
  if (line) remember(line)
  return line
}

/**
 * @param {'greet'|'beaten'|'wonTie'|'closeTie'} moment
 * @param {object} rival
 * @returns {string|null}
 */
export function banter(moment, rival, r = defaultRng) {
  if (!rival || !BANTER_MOMENTS.includes(moment)) return null
  return pickFresh(
    [`banter.${rival.id}.${moment}`, `banter.${moment}`],
    { rival: t(rival.nameKey) },
    r,
  )
}
