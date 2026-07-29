import { t } from '../i18n'

/** Operations available in the game, in unlock order */
export const OPS = {
  addition:       { icon: '➕', unlock: 0  },
  subtraction:    { icon: '➖', unlock: 15 },
  multiplication: { icon: '✖️', unlock: 30 },
  division:       { icon: '➗', unlock: 50 },
}

export const OP_ORDER = ['addition', 'subtraction', 'multiplication', 'division']

export const opName = op => t(`ops.${op}`)

/**
 * Star rating thresholds (goals out of 5).
 *
 * Copy rules: praise the strategy and the process, name what was actually
 * accomplished, and keep the star count honest — inflated stars get detected
 * and devalue every other signal in the game. Never attribute a low score to
 * insufficient effort; a child meeting unfamiliar material tried just as hard.
 */
export const STAR_THRESHOLDS = [
  { min: 5, stars: 3, key: 's5' },
  { min: 4, stars: 3, key: 's4' },
  { min: 3, stars: 2, key: 's3' },
  { min: 2, stars: 1, key: 's2' },
  { min: 1, stars: 1, key: 's1' },
  { min: 0, stars: 0, key: 's0' },
]

export function ratingFor(goals) {
  const r = STAR_THRESHOLDS.find(x => goals >= x.min) ?? STAR_THRESHOLDS.at(-1)
  return { ...r, title: t(`stars.${r.key}.title`), msg: t(`stars.${r.key}.msg`) }
}
