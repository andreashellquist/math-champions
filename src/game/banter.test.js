import { describe, it, expect } from 'vitest'
import { banter, BANTER_MOMENTS } from './banter'
import { RIVALS, rivalFor, RIVAL_IDS } from './rivals'
import { ROSTER_IDS } from './characters'
import { setLocale, LOCALES } from '../i18n'
import { makeRng } from './rng'

const LOCALE_CODES = Object.keys(LOCALES)
const r = makeRng(31)

describe('rivals', () => {
  it('gives every striker a rival', () => {
    for (const id of ROSTER_IDS) {
      expect(rivalFor(id), id).toBeTruthy()
      expect(RIVAL_IDS).toContain(rivalFor(id).id)
    }
  })

  it("never casts a striker's own club as the opponent", () => {
    // A child playing as Bellingham faces Barça, not Real Madrid
    expect(rivalFor('bellingham').id).toBe('blaugrana')
    expect(rivalFor('yamal').id).toBe('white_wall')
    expect(rivalFor('haaland').id).toBe('red_devil')
  })

  it('lets the child override the default pairing', () => {
    // A Man Utd supporter playing as Haaland shouldn't face their own club
    expect(rivalFor('haaland', 'gunner').id).toBe('gunner')
    expect(rivalFor('haaland', 'nonsense').id).toBe('red_devil')
  })

  it('gives every rival a full keeper kit', () => {
    for (const rival of Object.values(RIVALS)) {
      for (const part of ['shirt', 'gloves', 'shorts', 'socks', 'trim']) {
        expect(rival.gk[part], `${rival.id}.${part}`).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
      expect(rival.nameKey).toMatch(/^rivals\./)
    }
  })
})

describe('banter', () => {
  it('has no moment for a miss', () => {
    // The rule the whole design rests on: an opponent who reacts to failure
    // turns a knowledge gap into a social loss. He is an obstacle, not an
    // audience — so there is no string for him to say when the child misses.
    expect(BANTER_MOMENTS).not.toContain('miss')
    expect(BANTER_MOMENTS).not.toContain('save')
    expect(banter('miss', RIVALS.red_devil, r)).toBeNull()
    expect(banter('save', RIVALS.red_devil, r)).toBeNull()
  })

  it('returns a line for every allowed moment, in both languages', () => {
    for (const locale of LOCALE_CODES) {
      setLocale(locale)
      for (const rival of Object.values(RIVALS)) {
        for (const moment of BANTER_MOMENTS) {
          const line = banter(moment, rival, r)
          expect(line, `${locale} ${rival.id} ${moment}`).toBeTruthy()
          expect(line, `${locale} ${rival.id} ${moment}`).not.toMatch(/\{\w+\}/)
        }
      }
    }
    setLocale('sv')
  })

  it('stays friendly — no taunting, violence or put-downs', () => {
    const banned = /\b(krossa|förnedra|värdelös|dålig|dum|crush|destroy|useless|pathetic|loser|stupid|weak|kill|smash|hate)\b/i
    for (const locale of LOCALE_CODES) {
      setLocale(locale)
      for (const rival of Object.values(RIVALS)) {
        for (const moment of BANTER_MOMENTS) {
          for (let i = 0; i < 30; i++) {
            const line = banter(moment, rival, r)
            expect(line, `${locale} ${rival.id} ${moment}: "${line}"`).not.toMatch(banned)
          }
        }
      }
    }
    setLocale('sv')
  })

  it('never evaluates the child, only the shot', () => {
    // "That was too good" is about the ball. "You are good" is a verdict on
    // the person, and verdicts are what we are avoiding.
    const verdicts = /\b(du är|you are|you're) (bra|dålig|good|bad|great|terrible)\b/i
    for (const locale of LOCALE_CODES) {
      setLocale(locale)
      for (const moment of BANTER_MOMENTS) {
        for (let i = 0; i < 30; i++) {
          const line = banter(moment, RIVALS.red_devil, r)
          expect(line, `${locale} ${moment}: "${line}"`).not.toMatch(verdicts)
        }
      }
    }
    setLocale('sv')
  })

  it('returns nothing without a rival', () => {
    expect(banter('greet', null, r)).toBeNull()
  })
})
