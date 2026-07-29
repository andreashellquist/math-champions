/**
 * Rivals.
 *
 * The core mechanic, and the reason a rival is worth having at all:
 *
 *   **The rival chooses the questions. He never chooses the outcome.**
 *
 * He doesn't save your shots — he picks which shots you take, drawing from
 * your lowest-box, most-missed facts. That is the spaced-repetition scheduler
 * wearing a costume: the narrative resistance goes up, the hardest content
 * gets practised, and a correct answer still scores 100% of the time.
 *
 * His strength is fixed, published and non-adaptive, so a child can see
 * exactly why he got harder (they mastered the easy ones) and exactly how to
 * beat him (know more facts). Opaque difficulty demotivates; transparent
 * difficulty doesn't.
 *
 * Rivals are club-flavoured fictional keepers, not real people cast as
 * villains. The colours carry all the identity a child needs, and it means we
 * keep full control of how the character behaves.
 *
 * Kit note: the obvious club colours are unusable as the *shirt*. Man Utd red
 * (#DA291C) measures 1.10:1 against the pitch — very nearly isoluminant with
 * it, the single worst pairing available — and a black shirt fails just as
 * badly against the dark end of the gradient. So every rival shirt is a light
 * tone clearing 3:1 against both ends, and club identity is carried by hoops,
 * gloves and trim instead, which is where the eye goes during a dive anyway.
 */

/** Shared keeper build — rivals differ by kit, size and dive style, not anatomy */
const base = {
  hair: 'crop', hairColor: '#2A2119', skin: '#D9A87C',
  number: 1, celebration: 'zen', breathe: 3.4,
}

export const RIVALS = {
  red_devil: {
    ...base,
    id: 'red_devil', nameKey: 'rivals.red_devil', flag: '🔴',
    hair: 'buzz', hairColor: '#3A2C22',
    /** Reach — a taller keeper covers more goal. Presentation only. */
    scale: 1.08,
    diveStyle: 'full',
    gk: { shirt: '#F2E8D5', pattern: 'hoops', accent: '#DA291C', gloves: '#DA291C', shorts: '#1A1A1A', socks: '#DA291C', trim: '#DA291C' },
  },

  white_wall: {
    ...base,
    id: 'white_wall', nameKey: 'rivals.white_wall', flag: '⚪',
    hair: 'flow', hairColor: '#6B4A2F',
    scale: 1.12,
    diveStyle: 'statue',
    gk: { shirt: '#E3D0F5', pattern: 'solid', accent: '#5C2D91', gloves: '#5C2D91', shorts: '#5C2D91', socks: '#E3D0F5', trim: '#FEBE10' },
  },

  blaugrana: {
    ...base,
    id: 'blaugrana', nameKey: 'rivals.blaugrana', flag: '🔵',
    hair: 'curls', hairColor: '#1A1310', skin: '#B07B4E',
    scale: 1.04,
    diveStyle: 'quick',
    gk: { shirt: '#FFE234', pattern: 'hoops', accent: '#004D98', gloves: '#C81B5A', shorts: '#004D98', socks: '#FFE234', trim: '#C81B5A' },
  },

  gunner: {
    ...base,
    id: 'gunner', nameKey: 'rivals.gunner', flag: '🔴',
    hair: 'afro', hairColor: '#1B1310', skin: '#8D5A3B',
    scale: 1.06,
    diveStyle: 'full',
    gk: { shirt: '#FFB84D', pattern: 'solid', accent: '#DA291C', gloves: '#DA291C', shorts: '#023474', socks: '#FFB84D', trim: '#DA291C' },
  },

  dynamite: {
    ...base,
    id: 'dynamite', nameKey: 'rivals.dynamite', flag: '🇩🇰',
    hair: 'buzz', hairColor: '#C89B5A', skin: '#EFC6A6',
    scale: 1.0,
    diveStyle: 'quick',
    gk: { shirt: '#F2F2F2', pattern: 'hoops', accent: '#C60C30', gloves: '#C60C30', shorts: '#1F3A5F', socks: '#F2F2F2', trim: '#C60C30' },
  },
}

/**
 * Who each striker's club plays against.
 * A default, not a rule — the child can override it, because a Man Utd-
 * supporting child who wants to play as Haaland shouldn't have their own club
 * cast as the enemy.
 */
const DEFAULT_RIVAL = {
  haaland:    'red_devil',   // Manchester derby
  yamal:      'white_wall',  // El Clásico
  bellingham: 'blaugrana',   // El Clásico, other way round
  kane:       'gunner',      // North London
  gyokeres:   'dynamite',    // Sweden–Denmark
}

export const RIVAL_IDS = Object.keys(RIVALS)

export function rivalFor(strikerId, override = null) {
  if (override && RIVALS[override]) return RIVALS[override]
  return RIVALS[DEFAULT_RIVAL[strikerId]] ?? RIVALS.red_devil
}

export const getRival = id => RIVALS[id] ?? null
