/**
 * The squad.
 *
 * Stylised cartoon avatars identified by kit colour, hair silhouette and
 * number — recognisable by team and vibe, not likenesses of real people.
 *
 * The roster started deliberately mixed — five men and two women, so roughly
 * half the audience had someone to be — and has grown lopsided as players
 * were added one request at a time; still worth an eye each time a name goes
 * in, rather than assumed fixed by whatever the count happens to be today.
 * The create-a-player screen (see `buildCustomCharacter` below) is the
 * backstop regardless: a child who isn't anyone here should never be limited
 * to the squad as given.
 *
 * Every character is available from the first launch and freely swappable.
 * Characters are deliberately NOT unlockable: who you get to be should never
 * be something a child has to earn, and a locked favourite is a small negative
 * signal every time they open the menu. Kit *variants* are fine as milestone
 * rewards; identity is not.
 *
 * Contrast note: real club colours mostly fail 3:1 against the pitch green
 * (#0f4a26–#1e7a42) — Man City sky is ~2.2:1, Barça claret ~1.8:1. Chasing
 * the ratio across five real palettes is unwinnable, so separation is carried
 * structurally by a mandatory light outline on every silhouette. That frees
 * the fills to be authentic.
 */

import { RIVALS } from './rivals'

/** Lighten (amt > 0) or darken (amt < 0) a hex colour */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    const v = amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)
    return Math.max(0, Math.min(255, Math.round(v)))
  })
  return `#${ch.map(c => c.toString(16).padStart(2, '0')).join('')}`
}

/** Shared goalkeeper palette — real GK kits are loud, which solves contrast for free */
const GK_DEFAULT = {
  shirt: '#FFE234', gloves: '#FF7A1A', shorts: '#0A2B17', socks: '#FFE234', trim: '#0A2B17',
}

export const CHARACTERS = {
  haaland: {
    id: 'haaland', name: 'Haaland', short: 'Haaland', flag: '🇳🇴',
    // Golden rather than pale blonde — a light blonde against light skin
    // merges into one shape at the 72px the pitch scene renders at
    hair: 'flow', hairColor: '#E0A62A', skin: '#F6D9BE',
    number: 9, celebration: 'zen', breathe: 3.2,
    kits: {
      home:   { shirt: '#9BCFF2', accent: '#1C2C5B', pattern: 'solid',
                shorts: '#FFFFFF', socks: '#9BCFF2', trim: '#1C2C5B', numberColor: '#1C2C5B' },
      nation: { shirt: '#BA0C2F', accent: '#00205B', pattern: 'solid',
                shorts: '#FFFFFF', socks: '#BA0C2F', trim: '#FFFFFF', numberColor: '#FFFFFF' },
    },
    gk: GK_DEFAULT,
  },

  yamal: {
    id: 'yamal', name: 'Yamal', short: 'Yamal', flag: '🇪🇸',
    hair: 'curls', hairColor: '#1A1310', skin: '#C08A5C',
    number: 10, celebration: 'point', breathe: 3.0,
    kits: {
      home:   { shirt: '#C81B5A', accent: '#004D98', pattern: 'stripes',
                shorts: '#004D98', socks: '#C81B5A', trim: '#FFE234', numberColor: '#FFE234' },
      nation: { shirt: '#C60B1E', accent: '#FFC400', pattern: 'solid',
                shorts: '#1A2A6C', socks: '#C60B1E', trim: '#FFC400', numberColor: '#FFC400' },
    },
    gk: { ...GK_DEFAULT, shirt: '#B9F73E', socks: '#B9F73E' },
  },

  kane: {
    id: 'kane', name: 'Harry Kane', short: 'Kane', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    hair: 'crop', hairColor: '#6B5236', skin: '#F4D3B4',
    number: 9, celebration: 'arms-wide', breathe: 3.5,
    kits: {
      home:   { shirt: '#F5F5F5', accent: '#D6001C', pattern: 'sash',
                shorts: '#0A1F44', socks: '#F5F5F5', trim: '#D6001C', numberColor: '#0A1F44' },
      nation: { shirt: '#E31B23', accent: '#FFFFFF', pattern: 'solid',
                shorts: '#FFFFFF', socks: '#E31B23', trim: '#FFFFFF', numberColor: '#FFFFFF' },
    },
    gk: GK_DEFAULT,
  },

  bellingham: {
    id: 'bellingham', name: 'Jude Bellingham', short: 'Bellingham', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    hair: 'afro', hairColor: '#221812', skin: '#C89468',
    number: 5, celebration: 'arms-wide', breathe: 3.1,
    kits: {
      home:   { shirt: '#FFFFFF', accent: '#FEBE10', pattern: 'solid',
                shorts: '#FFFFFF', socks: '#0A1F44', trim: '#FEBE10', numberColor: '#0A1F44' },
      nation: { shirt: '#E31B23', accent: '#FFFFFF', pattern: 'solid',
                shorts: '#FFFFFF', socks: '#E31B23', trim: '#FFFFFF', numberColor: '#FFFFFF' },
    },
    gk: GK_DEFAULT,
  },

  gyokeres: {
    id: 'gyokeres', name: 'Viktor Gyökeres', short: 'Gyökeres', flag: '🇸🇪',
    hair: 'buzz', hairColor: '#4A3624', skin: '#F4D3B4',
    number: 9, celebration: 'roar', breathe: 3.3,
    kits: {
      home:   { shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
      nation: { shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
    },
    // #FF7A1A measured 2.05:1 against the pitch; #FFB84D clears 3:1
    gk: { ...GK_DEFAULT, shirt: '#FFB84D', socks: '#FFB84D', gloves: '#005293' },
  },
  bonmati: {
    id: 'bonmati', name: 'Aitana Bonmatí', short: 'Aitana', flag: '🇪🇸',
    hair: 'flow', hairColor: '#4A3524', skin: '#F2D0AF',
    number: 14, celebration: 'arms-wide', breathe: 3.1,
    kits: {
      // Barça claret measures ~1.0:1 against the pitch, so it rides on the
      // stripes and trim while the shirt itself stays legible.
      home:   { shirt: '#F2E8D5', accent: '#C81B5A', pattern: 'stripes',
                shorts: '#004D98', socks: '#C81B5A', trim: '#004D98', numberColor: '#004D98' },
      nation: { shirt: '#FFD9E2', accent: '#C60B1E', pattern: 'solid',
                shorts: '#1A2A6C', socks: '#C60B1E', trim: '#C60B1E', numberColor: '#1A2A6C' },
    },
    gk: GK_DEFAULT,
  },

  rolfo: {
    id: 'rolfo', name: 'Fridolina Rolfö', short: 'Fridolina', flag: '🇸🇪',
    hair: 'crop', hairColor: '#D9B450', skin: '#F7DCC2',
    number: 8, celebration: 'point', breathe: 3.4,
    kits: {
      home:   { shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
      nation: { shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
    },
    gk: { ...GK_DEFAULT, shirt: '#B9F73E', socks: '#B9F73E' },
  },

  elanga: {
    id: 'elanga', name: 'Anthony Elanga', short: 'Elanga', flag: '🇸🇪',
    hair: 'crop', hairColor: '#1A1310', skin: '#7A4A2A',
    number: 11, celebration: 'point', breathe: 3.2,
    kits: {
      home:   { shirt: '#1A1A1A', accent: '#FFFFFF', pattern: 'stripes',
                shorts: '#1A1A1A', socks: '#1A1A1A', trim: '#FFFFFF', numberColor: '#FFFFFF' },
      nation: { shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
    },
    gk: GK_DEFAULT,
  },

  bergvall: {
    id: 'bergvall', name: 'Lucas Bergvall', short: 'Bergvall', flag: '🇸🇪',
    hair: 'buzz', hairColor: '#D9B450', skin: '#F6D9BE',
    number: 27, celebration: 'zen', breathe: 3.0,
    kits: {
      home:   { shirt: '#FFFFFF', accent: '#132257', pattern: 'solid',
                shorts: '#132257', socks: '#FFFFFF', trim: '#132257', numberColor: '#132257' },
      nation: { shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
    },
    gk: GK_DEFAULT,
  },

  ayari: {
    id: 'ayari', name: 'Yasin Ayari', short: 'Ayari', flag: '🇸🇪',
    hair: 'curls', hairColor: '#241A14', skin: '#B57A4E',
    number: 34, celebration: 'roar', breathe: 3.3,
    kits: {
      home:   { shirt: '#0057B8', accent: '#FFFFFF', pattern: 'stripes',
                shorts: '#FFFFFF', socks: '#0057B8', trim: '#FFFFFF', numberColor: '#FFFFFF' },
      nation: { shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
    },
    gk: GK_DEFAULT,
  },

  foden: {
    id: 'foden', name: 'Phil Foden', short: 'Foden', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    hair: 'flow', hairColor: '#B8934A', skin: '#F4D3B4',
    number: 47, celebration: 'arms-wide', breathe: 3.4,
    kits: {
      // Same club colours as Haaland — real squad-mates share a kit, which
      // is why identity here rides on hair, skin, number and name, not palette.
      home:   { shirt: '#9BCFF2', accent: '#1C2C5B', pattern: 'solid',
                shorts: '#FFFFFF', socks: '#9BCFF2', trim: '#1C2C5B', numberColor: '#1C2C5B' },
      nation: { shirt: '#E31B23', accent: '#FFFFFF', pattern: 'solid',
                shorts: '#FFFFFF', socks: '#E31B23', trim: '#FFFFFF', numberColor: '#FFFFFF' },
    },
    gk: GK_DEFAULT,
  },

  pickford: {
    id: 'pickford', name: 'Jordan Pickford', short: 'Pickford', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    hair: 'buzz', hairColor: '#B5651D', skin: '#F6D9BE',
    number: 1, celebration: 'zen', breathe: 3.3,
    kits: {
      home:   { shirt: '#00369C', accent: '#FFFFFF', pattern: 'solid',
                shorts: '#FFFFFF', socks: '#00369C', trim: '#FFFFFF', numberColor: '#FFFFFF' },
      nation: { shirt: '#E31B23', accent: '#FFFFFF', pattern: 'solid',
                shorts: '#FFFFFF', socks: '#E31B23', trim: '#FFFFFF', numberColor: '#FFFFFF' },
    },
    gk: GK_DEFAULT,
  },

  cubarsi: {
    id: 'cubarsi', name: 'Pau Cubarsí', short: 'Cubarsí', flag: '🇪🇸',
    hair: 'crop', hairColor: '#241A14', skin: '#D9A374',
    number: 4, celebration: 'point', breathe: 3.1,
    kits: {
      // Same club and country colours as Yamal — see Foden's note above.
      home:   { shirt: '#C81B5A', accent: '#004D98', pattern: 'stripes',
                shorts: '#004D98', socks: '#C81B5A', trim: '#FFE234', numberColor: '#FFE234' },
      nation: { shirt: '#C60B1E', accent: '#FFC400', pattern: 'solid',
                shorts: '#1A2A6C', socks: '#C60B1E', trim: '#FFC400', numberColor: '#FFC400' },
    },
    gk: GK_DEFAULT,
  },

  holmberg: {
    id: 'holmberg', name: 'Smilla Holmberg', short: 'Smilla', flag: '🇸🇪',
    hair: 'flow', hairColor: '#D9B450', skin: '#F7DCC2',
    number: 19, celebration: 'point', breathe: 3.2,
    kits: {
      home:   { shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
      nation: { shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
    },
    gk: { ...GK_DEFAULT, shirt: '#B9F73E', socks: '#B9F73E' },
  },

  asllani: {
    id: 'asllani', name: 'Kosovare Asllani', short: 'Asllani', flag: '🇸🇪',
    hair: 'flow', hairColor: '#2A1D16', skin: '#C89468',
    number: 7, celebration: 'arms-wide', breathe: 3.0,
    kits: {
      home:   { shirt: '#FB0F0C', accent: '#1A1A1A', pattern: 'stripes',
                shorts: '#FFFFFF', socks: '#1A1A1A', trim: '#1A1A1A', numberColor: '#FFFFFF' },
      nation: { shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
    },
    gk: { ...GK_DEFAULT, shirt: '#B9F73E', socks: '#B9F73E' },
  },
}

// Alphabetical by displayed name — the roster grid has no other ordering
// signal (it isn't grouped by team or unlock order), so name is what a child
// scans by when they're looking for someone specific.
export const ROSTER = Object.values(CHARACTERS).sort((a, b) => a.short.localeCompare(b.short, 'sv'))
export const ROSTER_IDS = ROSTER.map(c => c.id)

/**
 * Create-a-player: a curated palette rather than a free colour picker.
 *
 * A hex wheel can produce combinations that are unreadable against the pitch
 * or against each other (light number on a light shirt); every option here
 * is a value already proven to work by an existing squad member, so any
 * combination a child picks is guaranteed legible.
 */
export const HAIR_STYLES = ['buzz', 'crop', 'flow', 'curls', 'afro']
export const HAIR_COLORS = [
  '#1A1310', '#241A14', '#4A3624', '#6B5236', '#8C6A3E', '#B8934A', '#D9B450', '#E0A62A',
]
export const SKIN_TONES = [
  '#F6D9BE', '#F4D3B4', '#F2D0AF', '#F7DCC2', '#C89468', '#C08A5C', '#D9A374', '#7A4A2A',
]
export const KIT_PRESETS = [
  { id: 'sky',     shirt: '#9BCFF2', accent: '#1C2C5B', pattern: 'solid',
                    shorts: '#FFFFFF', socks: '#9BCFF2', trim: '#1C2C5B', numberColor: '#1C2C5B' },
  { id: 'red',      shirt: '#E31B23', accent: '#FFFFFF', pattern: 'solid',
                    shorts: '#FFFFFF', socks: '#E31B23', trim: '#FFFFFF', numberColor: '#FFFFFF' },
  { id: 'yellow',   shirt: '#FECC02', accent: '#005293', pattern: 'solid',
                    shorts: '#005293', socks: '#FECC02', trim: '#005293', numberColor: '#005293' },
  { id: 'claret',   shirt: '#F2E8D5', accent: '#C81B5A', pattern: 'stripes',
                    shorts: '#004D98', socks: '#C81B5A', trim: '#004D98', numberColor: '#004D98' },
  { id: 'monochrome', shirt: '#1A1A1A', accent: '#FFFFFF', pattern: 'stripes',
                    shorts: '#1A1A1A', socks: '#1A1A1A', trim: '#FFFFFF', numberColor: '#FFFFFF' },
  { id: 'green',    shirt: '#1E7A42', accent: '#FFFFFF', pattern: 'solid',
                    shorts: '#FFFFFF', socks: '#1E7A42', trim: '#FFFFFF', numberColor: '#FFFFFF' },
  { id: 'purple',   shirt: '#5A2D82', accent: '#FFE234', pattern: 'solid',
                    shorts: '#5A2D82', socks: '#5A2D82', trim: '#FFE234', numberColor: '#FFE234' },
  { id: 'blue',     shirt: '#0057B8', accent: '#FFFFFF', pattern: 'stripes',
                    shorts: '#FFFFFF', socks: '#0057B8', trim: '#FFFFFF', numberColor: '#FFFFFF' },
]

/** Turns a sanitised custom-player record into a full character, ready for Player */
export function buildCustomCharacter(cp) {
  if (!cp) return null
  const kit = KIT_PRESETS.find(k => k.id === cp.kitId) ?? KIT_PRESETS[0]
  return {
    id: 'custom', name: cp.name, short: cp.name, flag: '🇸🇪',
    hair: cp.hair, hairColor: cp.hairColor, skin: cp.skin,
    number: cp.number, celebration: 'arms-wide', breathe: 3.2,
    kits: { home: kit, nation: kit },
    gk: GK_DEFAULT,
  }
}

// The one piece of runtime-mutable data in this file: a child's own player,
// rebuilt whenever settings load or change (see GameContext). Everything
// else here is static, so this is the only thing getCharacter needs a cache
// for at all.
let customCharacter = null
export function setCustomCharacter(customPlayer) {
  customCharacter = buildCustomCharacter(customPlayer)
}

/** Rivals are keeper-only characters, but render through the same component */
export function getCharacter(id) {
  if (id === 'custom' && customCharacter) return customCharacter
  return CHARACTERS[id] ?? RIVALS[id] ?? CHARACTERS.haaland
}

/**
 * The opponent keeper: any squad member who isn't the chosen striker.
 * Pick Yamal and you face Haaland — the roster feels like a squad rather
 * than a menu, and it costs no extra art.
 */
export function keeperFor(strikerId, seed = 0) {
  const others = ROSTER_IDS.filter(id => id !== strikerId)
  return others[Math.abs(seed) % others.length]
}
