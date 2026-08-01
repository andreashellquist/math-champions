import { describe, it, expect } from 'vitest'
import { THEMES, PALETTE, seasonForMonth, resolveTheme } from './theme'

describe('seasonal pitch themes', () => {
  it('has a full palette entry for every theme', () => {
    for (const id of THEMES) {
      expect(PALETTE[id], id).toBeTruthy()
      expect(PALETTE[id].pitch, id).toMatch(/^#[0-9a-f]{6}$/i)
      expect(PALETTE[id].pitchDeep, id).toMatch(/^#[0-9a-f]{6}$/i)
      expect(PALETTE[id].grassA, id).toMatch(/^#[0-9a-f]{6}$/i)
      expect(PALETTE[id].grassB, id).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('maps every month of the year to exactly one Swedish season', () => {
    const byMonth = Array.from({ length: 12 }, (_, m) => seasonForMonth(m))
    expect(byMonth.every(s => THEMES.includes(s))).toBe(true)
    // Dec, Jan, Feb
    expect(seasonForMonth(11)).toBe('winter')
    expect(seasonForMonth(0)).toBe('winter')
    expect(seasonForMonth(1)).toBe('winter')
    // Jun, Jul, Aug
    expect(seasonForMonth(5)).toBe('summer')
    expect(seasonForMonth(6)).toBe('summer')
    expect(seasonForMonth(7)).toBe('summer')
  })

  it('resolves an explicit choice regardless of the calendar', () => {
    const winterDate = new Date(2026, 0, 15)   // January
    expect(resolveTheme('summer', winterDate)).toBe('summer')
  })

  it('falls back to the calendar for "auto" or an unrecognised setting', () => {
    const julyDate = new Date(2026, 6, 1)
    expect(resolveTheme('auto', julyDate)).toBe('summer')
    expect(resolveTheme(undefined, julyDate)).toBe('summer')
    expect(resolveTheme('nonsense', julyDate)).toBe('summer')
  })
})

describe('arcade copy interpolates cleanly (regression: {n} left literal)', () => {
  it('never leaves a placeholder on screen for any arcade string that takes params', async () => {
    const { t, setLocale, LOCALES } = await import('../i18n')
    const calls = {
      'arcade.chip': { n: 24 },
      'arcade.liveScore': { n: 7 },
      'arcade.runScore': { n: 12 },
      'arcade.stoppedEarly': { n: 5 },
      'arcade.bestLabel': { n: 9 },
    }
    for (const locale of Object.keys(LOCALES)) {
      setLocale(locale)
      for (const [key, params] of Object.entries(calls)) {
        const out = t(key, params)
        expect(out, `${locale}:${key}`).not.toMatch(/\{\w+\}/)
        expect(out, `${locale}:${key}`).toContain(String(params.n))
      }
    }
    setLocale('sv')
  })
})
