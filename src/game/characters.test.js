import { describe, it, expect, afterEach } from 'vitest'
import {
  ROSTER, ROSTER_IDS, CHARACTERS, getCharacter, keeperFor,
  buildCustomCharacter, setCustomCharacter, HAIR_STYLES, HAIR_COLORS, SKIN_TONES, KIT_PRESETS,
} from './characters'

afterEach(() => setCustomCharacter(null))

describe('the roster', () => {
  it('is ordered alphabetically by displayed name', () => {
    const names = ROSTER.map(c => c.short)
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'sv'))
    expect(names).toEqual(sorted)
  })

  it('has a distinct id for every character, so nothing silently collides', () => {
    expect(new Set(ROSTER_IDS).size).toBe(ROSTER_IDS.length)
  })

  it('gives every character a home and nation kit with legible number colours', () => {
    for (const c of Object.values(CHARACTERS)) {
      for (const variant of ['home', 'nation']) {
        const kit = c.kits[variant]
        expect(kit.shirt, `${c.id}.${variant}`).toMatch(/^#[0-9A-F]{6}$/i)
        expect(kit.numberColor, `${c.id}.${variant}`).toMatch(/^#[0-9A-F]{6}$/i)
      }
    }
  })

  it('keeps prototype character Nova out of the selectable roster', () => {
    expect(getCharacter('nova').name).toBe('Nova')
    expect(ROSTER_IDS).not.toContain('nova')
  })
})

describe('keeperFor', () => {
  it('never picks the striker as their own keeper', () => {
    for (const id of ROSTER_IDS) {
      for (let seed = 0; seed < 5; seed++) {
        expect(keeperFor(id, seed)).not.toBe(id)
      }
    }
  })
})

describe('the custom player', () => {
  it('getCharacter falls back to Haaland for "custom" when none has been created', () => {
    expect(getCharacter('custom').id).toBe('haaland')
  })

  it('builds a full character from a curated selection', () => {
    const cp = { name: 'Robin', hair: HAIR_STYLES[2], hairColor: HAIR_COLORS[2],
      skin: SKIN_TONES[2], kitId: KIT_PRESETS[2].id, number: 23 }
    const c = buildCustomCharacter(cp)
    expect(c.id).toBe('custom')
    expect(c.name).toBe('Robin')
    expect(c.number).toBe(23)
    expect(c.kits.home.id).toBe(KIT_PRESETS[2].id)
  })

  it('getCharacter picks up whatever was last set, until cleared', () => {
    setCustomCharacter({ name: 'Robin', hair: HAIR_STYLES[0], hairColor: HAIR_COLORS[0],
      skin: SKIN_TONES[0], kitId: KIT_PRESETS[0].id, number: 1 })
    expect(getCharacter('custom').name).toBe('Robin')

    setCustomCharacter(null)
    expect(getCharacter('custom').id).toBe('haaland')
  })

  it('never lets a made-up id borrow the custom slot', () => {
    setCustomCharacter({ name: 'Robin', hair: HAIR_STYLES[0], hairColor: HAIR_COLORS[0],
      skin: SKIN_TONES[0], kitId: KIT_PRESETS[0].id, number: 1 })
    expect(getCharacter('not-a-real-id').id).toBe('haaland')
  })
})
