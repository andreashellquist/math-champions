/**
 * Seasonal pitch themes.
 *
 * Four reskins of the pitch, tied to the Swedish calendar: vår (spring, the
 * default), sommar, höst, vinter. Auto-selected from the current month, with
 * a manual override — free choice, never unlocked or earned, same rule as the
 * character roster.
 *
 * Deliberately NOT a literal white winter pitch or a bright summer field: every
 * theme keeps roughly the same *lightness* as the default green gradient, only
 * the hue moves. The whole app is built as light text and gold accents over a
 * dark pitch — `.subtitle`, `.map-bar-caption` and the gold accent colour are
 * all tuned against that gradient in one place (`App.css :root`). Swapping to
 * a genuinely bright winter-white background would mean re-auditing every
 * light-on-dark string in the app; keeping the reskins dark-toned means the
 * existing palette keeps working everywhere for free. Measured: every theme
 * clears 3:1 for `--subtitle`/`--gold` against both ends of its gradient.
 */

export const THEMES = ['spring', 'summer', 'autumn', 'winter']

export const PALETTE = {
  spring: { pitch: '#1e7a42', pitchDeep: '#0f4a26', grassA: '#2a7a40', grassB: '#349c52' },
  summer: { pitch: '#237a3f', pitchDeep: '#0d5a2c', grassA: '#2f8a44', grassB: '#3fae5c' },
  autumn: { pitch: '#8a5a2e', pitchDeep: '#3a2410', grassA: '#7a4a20', grassB: '#a06a30' },
  // A night match under floodlights with snow falling, rather than a literal
  // white pitch — see the file header for why.
  winter: { pitch: '#3a5a72', pitchDeep: '#12222e', grassA: '#4a6a80', grassB: '#dce9f2' },
}

/** Swedish meteorological seasons: Dec–Feb winter, Mar–May spring, etc. */
export function seasonForMonth(month /* 0-11 */) {
  if (month === 11 || month <= 1) return 'winter'
  if (month <= 4) return 'spring'
  if (month <= 7) return 'summer'
  return 'autumn'
}

export function resolveTheme(setting, date = new Date()) {
  if (THEMES.includes(setting)) return setting
  return seasonForMonth(date.getMonth())
}
