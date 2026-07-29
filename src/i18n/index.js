/**
 * Tiny i18n layer.
 *
 * Swedish is the default — this is a Swedish child's game — with English
 * available. Translations are plain nested objects; `t` walks a dotted key and
 * interpolates `{name}` placeholders.
 *
 * The locale is module-level rather than React context because the hint and
 * distractor engines are pure functions called outside the component tree.
 * `subscribe` lets the UI re-render when it changes.
 */
import sv from './sv'
import en from './en'

export const LOCALES = { sv, en }
export const LOCALE_NAMES = { sv: 'Svenska', en: 'English' }
export const DEFAULT_LOCALE = 'sv'

let current = DEFAULT_LOCALE
const listeners = new Set()

export function getLocale() {
  return current
}

export function setLocale(locale) {
  if (!LOCALES[locale] || locale === current) return
  current = locale
  listeners.forEach(fn => fn(current))
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Detect from the browser, falling back to Swedish */
export function detectLocale() {
  const langs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []
  for (const l of langs) {
    const code = String(l ?? '').slice(0, 2).toLowerCase()
    if (LOCALES[code]) return code
  }
  return DEFAULT_LOCALE
}

function lookup(table, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), table)
}

const interpolate = (str, params) =>
  str.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`))

/**
 * Translate. Falls back to the other locale, then to the key itself, so a
 * missing string shows up as an obvious `menu.play` rather than blank space.
 */
export function t(key, params = {}, locale = current) {
  let value = lookup(LOCALES[locale], key)
  if (typeof value !== 'string') value = lookup(LOCALES[DEFAULT_LOCALE], key)
  if (typeof value !== 'string') value = lookup(LOCALES.en, key)
  if (typeof value !== 'string') return key
  return interpolate(value, params)
}

/** Pick a random entry from a translated array (word-problem templates) */
export function tPick(key, params, rng, locale = current) {
  const list = lookup(LOCALES[locale], key) ?? lookup(LOCALES[DEFAULT_LOCALE], key)
  if (!Array.isArray(list) || !list.length) return null
  const chosen = rng ? rng.pick(list) : list[0]
  return interpolate(chosen, params)
}

/** How many entries a translated list has */
export function tCount(key, locale = current) {
  const list = lookup(LOCALES[locale], key) ?? lookup(LOCALES[DEFAULT_LOCALE], key)
  return Array.isArray(list) ? list.length : 0
}
