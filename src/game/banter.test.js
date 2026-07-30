import { describe, it, expect } from 'vitest'
import { banter, BANTER_MOMENTS } from './banter'
import { RIVALS, rivalFor, RIVAL_IDS, clockScaleFor, MIN_CLOCK_SCALE } from './rivals'
import { ROSTER_IDS } from './characters'
import { setLocale, LOCALES, t } from '../i18n'
import { boxName } from './mastery'
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

describe('app-wide tone', () => {
  /** Every user-facing string in a locale, flattened */
  function allStrings(obj, path = '') {
    return Object.entries(obj).flatMap(([k, v]) => {
      const at = path ? `${path}.${k}` : k
      if (typeof v === 'string') return [[at, v]]
      if (Array.isArray(v)) return v.map((s, i) => [`${at}[${i}]`, s])
      return allStrings(v, at)
    })
  }

  const strings = LOCALE_CODES.flatMap(code =>
    allStrings(LOCALES[code]).map(([k, v]) => [`${code}:${k}`, v]))

  it('has plenty of copy to check', () => {
    expect(strings.length).toBeGreaterThan(200)
  })

  it('contains no violent or aggressive language anywhere', () => {
    const violent = /\b(kill|död[a]?|smash|krossa|destroy|förstör|attack|anfall|war|krig|fight|slåss|weapon|vapen|shoot(?!ing)|blood|blod|hate|hatar|revenge|hämnd|enemy|fiende)\b/i
    for (const [key, value] of strings) {
      expect(value, `${key}: "${value}"`).not.toMatch(violent)
    }
  })

  it('never puts the child down', () => {
    const putdown = /\b(dum|dålig|värdelös|misslyckad|fel på dig|stupid|dumb|bad at|useless|failure|loser|pathetic|weak)\b/i
    for (const [key, value] of strings) {
      expect(value, `${key}: "${value}"`).not.toMatch(putdown)
    }
  })

  it('avoids the banned failure vocabulary', () => {
    // "Saved!" and "Wrong" were the original copy. A miss is a parry with the
    // ball still live; nothing in the app calls the child wrong.
    const banned = /\b(wrong|incorrect|failed|räddad!|fel svar)\b/i
    for (const [key, value] of strings) {
      // The aria-only word "räddad" describes the ball for a screen reader
      if (key.endsWith('game.resultMiss')) continue
      expect(value, `${key}: "${value}"`).not.toMatch(banned)
    }
  })

  it('never shames a gap in knowledge', () => {
    // Deliberately narrow: "the ten got left behind" is about the digit, not
    // the child. Only phrasings that locate a deficit *in the child* count.
    const shaming = /\b(struggling|falling behind|you'?re behind|du är efter|poor at|svag på|weakness|svaghet|problemområde)\b/i
    for (const [key, value] of strings) {
      expect(value, `${key}: "${value}"`).not.toMatch(shaming)
    }
  })
})

describe('rival difficulty knobs', () => {
  it('never lets a rival tighten the clock past the floor', () => {
    for (const rival of Object.values(RIVALS)) {
      expect(clockScaleFor(rival, 1)).toBeGreaterThanOrEqual(MIN_CLOCK_SCALE)
      expect(clockScaleFor(rival, 1)).toBeLessThanOrEqual(1)
    }
  })

  it('never applies any tightening when the child asked for extra time', () => {
    // That setting is the accessibility escape hatch. A rival must not be able
    // to claw it back.
    for (const rival of Object.values(RIVALS)) {
      expect(clockScaleFor(rival, 1.3)).toBe(1)
      expect(clockScaleFor(rival, 2)).toBe(1)
    }
  })

  it('gives every rival a flourish bias in range', () => {
    for (const rival of Object.values(RIVALS)) {
      expect(rival.flourishBias).toBeGreaterThanOrEqual(0)
      expect(rival.flourishBias).toBeLessThanOrEqual(1)
    }
  })

  it('keeps every difficulty knob to presentation or question choice', () => {
    // Nothing a rival carries may touch whether a correct answer scores
    for (const rival of Object.values(RIVALS)) {
      expect(rival).not.toHaveProperty('saveChance')
      expect(rival).not.toHaveProperty('goalChance')
      expect(rival).not.toHaveProperty('difficulty.outcome')
    }
  })
})

describe('box level names', () => {
  it('names every box, in both languages', () => {
    for (const locale of LOCALE_CODES) {
      setLocale(locale)
      for (let box = 0; box <= 5; box++) {
        const name = t(`box.${boxName(box)}`)
        expect(name, `${locale} box ${box}`).not.toMatch(/^box\./)
      }
    }
    setLocale('sv')
  })

  it('frames a demotion as a squad move rather than a downgrade', () => {
    setLocale('sv')
    const msg = t('box.demoted', { name: t(`box.${boxName(2)}`) })
    expect(msg).toContain('Reserv')
    expect(msg.toLowerCase()).not.toMatch(/\b(ner|sämre|förlorat|misslyck)/)
  })
})
