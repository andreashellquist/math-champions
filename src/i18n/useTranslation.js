import { useSyncExternalStore, useCallback } from 'react'
import { t, getLocale, setLocale, subscribe } from './index'

/**
 * Re-renders the component when the locale changes.
 *
 * The locale lives in a module rather than context because the hint and
 * distractor engines are pure functions called outside React; this hook is
 * just the bridge back in.
 */
export function useTranslation() {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale)
  const translate = useCallback((key, params) => t(key, params, locale), [locale])
  return { t: translate, locale, setLocale }
}
