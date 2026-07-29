/**
 * The squad.
 *
 * Stylised cartoon avatars identified by kit colour, hair silhouette and
 * number — recognisable by team and vibe, not likenesses of real people.
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
    hair: 'flow', hairColor: '#E0A62A', skin: '#F0C8A8',
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
    hair: 'curls', hairColor: '#1A1310', skin: '#C8905E',
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
    hair: 'crop', hairColor: '#5A4632', skin: '#EFC6A6',
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
    hair: 'afro', hairColor: '#1B1310', skin: '#8D5A3B',
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
    hair: 'buzz', hairColor: '#3A2C22', skin: '#EFC6A6',
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
}

export const ROSTER = Object.values(CHARACTERS)
export const ROSTER_IDS = ROSTER.map(c => c.id)

/** Rivals are keeper-only characters, but render through the same component */
export const getCharacter = id => CHARACTERS[id] ?? RIVALS[id] ?? CHARACTERS.haaland

/**
 * The opponent keeper: any squad member who isn't the chosen striker.
 * Pick Yamal and you face Haaland — the roster feels like a squad rather
 * than a menu, and it costs no extra art.
 */
export function keeperFor(strikerId, seed = 0) {
  const others = ROSTER_IDS.filter(id => id !== strikerId)
  return others[Math.abs(seed) % others.length]
}
