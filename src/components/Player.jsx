import { useId } from 'react'
import { getCharacter, shade } from '../game/characters'

/**
 * One skeleton, every character, every pose.
 *
 * Replaces the two bespoke character files, which had three different
 * coordinate systems between them, baked the goal net into the keeper, and
 * built limbs from axis-aligned rectangles — so nothing could bend.
 *
 * Geometry is fixed so characters are interchangeable without the scene
 * jumping:
 *
 *   ground baseline  y = 150      centre        x = 60
 *   head             (60, 36) r18 shoulders     y = 66
 *   torso            y = 60..106  hips          y = 106
 *
 * Limbs are *stroked paths*, not filled rects — that gives round ends for
 * free and lets a pose bend a limb by moving one control point rather than
 * redrawing a polygon.
 *
 * Poses are CSS transforms on named groups (see styles/player.css), not
 * alternate path sets: 5 characters x 9 poses would otherwise be 45
 * hand-drawn figures, and a sixth player would cost 9 more.
 */

const TORSO = 'M45 60 Q60 55 75 60 L78 106 Q60 110 42 106 Z'

/**
 * Hair silhouettes. Along with kit colour this is the identifying channel, so
 * each has to read at 72px — which means wrapping the sides of the skull, not
 * sitting on top like a cap. Built on the head circle (60, 36) r=18: an outer
 * arc over the crown, then an inner hairline that stays clear of the eyes.
 */
const HAIR = {
  buzz:  { main: 'M42 37 A18 18 0 0 0 78 37 Q76 28 60 27 Q44 28 42 37 Z' },
  crop:  { main: 'M41 40 A19 19 0 0 0 79 40 Q79 29 71 27 Q63 34 53 31 Q45 29 41 40 Z' },
  flow:  {
    main:   'M40 43 A20 20 0 0 0 80 43 Q80 27 71 22 Q65 18 58 19 Q47 20 42 26 Q39 32 40 43 Z',
    accent: 'M76 36 q9 6 7 17 q-3 7 -9 4 q6 -10 2 -21 Z',
  },
  curls: {
    main: 'M41 41 a10 10 0 0 1 3 -14 a11 11 0 0 1 11 -9 a11 11 0 0 1 14 1 a10 10 0 0 1 10 8 a10 10 0 0 1 3 14 q-4 -11 -13 -12 q-13 -3 -19 1 q-8 2 -9 11 Z',
  },
  afro:  { main: 'M38 44 A23 23 0 0 0 82 44 Q79 28 60 28 Q41 28 38 44 Z' },
}

/* Face sits in the lower half of the head circle (60,36) r18 — the upper half
   is scalp, and features placed there end up drawn on top of the hair. */
const MOUTH = {
  neutral: 'M54 47 Q60 51 66 47',
  smile:   'M53 45 Q60 54 67 45',
  sad:     'M54 50 Q60 45 66 50',
  open:    null,   // drawn as an ellipse
}

/** Which face each pose wears */
const FACE_FOR = {
  idle: 'neutral', windup: 'neutral', kick: 'neutral',
  celebrate: 'smile', dejected: 'sad',
  ready: 'neutral', 'dive-left': 'open', 'dive-right': 'open', beaten: 'sad',
}

export default function Player({
  id = 'haaland',
  role = 'striker',        // 'striker' | 'keeper'
  pose = 'idle',
  facing = 'right',
  size = 120,
  animate = true,
  variant = 'home',
  className = '',
}) {
  const uid = useId().replace(/:/g, '')
  const c = getCharacter(id)
  const keeper = role === 'keeper'
  const kit = keeper
    ? { shirt: c.gk.shirt,
        // Keeper kits were hardcoded to solid, which made the hoops/stripes
        // path unreachable. Pattern is the cheapest way to make one rival
        // look nothing like another.
        pattern: c.gk.pattern ?? 'solid',
        accent: c.gk.accent ?? c.gk.trim,
        shorts: c.gk.shorts, socks: c.gk.socks, trim: c.gk.trim, numberColor: c.gk.trim }
    : c.kits[variant] ?? c.kits.home

  // Reach: a taller keeper covers more goal. Presentation only — it can never
  // change whether a shot goes in.
  const width = Math.round(size * (c.scale ?? 1))
  const height = Math.round(width * 4 / 3)
  const face = FACE_FOR[pose] ?? 'neutral'
  const hand = keeper ? c.gk.gloves : c.skin
  const handR = keeper ? 7.5 : 5
  const hair = HAIR[c.hair] ?? HAIR.crop

  const kitFill = `url(#${uid}-kit)`
  const skinFill = `url(#${uid}-skin)`

  /** A limb segment: a rounded stroked path */
  const limb = (d, w, stroke) => (
    <path d={d} stroke={stroke} strokeWidth={w} strokeLinecap="round" fill="none" />
  )

  return (
    <svg
      className={`player-fig ${className}`}
      width={width}
      height={height}
      viewBox="0 0 120 160"
      role="img"
      aria-label={`${c.name}${keeper ? ', goalkeeper' : ''}`}
      data-pose={pose}
      data-animate={animate ? 'on' : 'off'}
      style={{ '--breathe': `${c.breathe}s`, transform: facing === 'left' ? 'scaleX(-1)' : undefined }}
    >
      <defs>
        {/* Form shading — one gradient per instance. The id MUST be unique:
            five players on the roster screen with a hardcoded id would all
            inherit whichever one rendered first. */}
        <linearGradient id={`${uid}-kit`} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0%"   stopColor={shade(kit.shirt, 0.14)} />
          <stop offset="45%"  stopColor={kit.shirt} />
          <stop offset="100%" stopColor={shade(kit.shirt, -0.28)} />
        </linearGradient>
        <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%"   stopColor={shade(c.skin, 0.10)} />
          <stop offset="100%" stopColor={shade(c.skin, -0.18)} />
        </linearGradient>
        <clipPath id={`${uid}-torso`}>
          <path d={TORSO} />
        </clipPath>
      </defs>

      {/* Ground shadow — shrinking it is what sells an airborne pose. Without
          it, a translateY reads as sliding rather than jumping. */}
      <ellipse className="g-shadow" cx="60" cy="150" rx="24" ry="5.5" fill="rgba(0,0,0,.28)" />

      <g className="g-body">
        {/* ── FAR ARM ───────────────────────────────── */}
        <g className="g-arm-far">
          {limb('M47 66 L39 80', 12, kitFill)}
          {limb('M39 80 L36 94', 9, skinFill)}
          <circle cx="36" cy="95" r={handR} fill={hand} />
          {limb('M42 74 L38 81', 3, kit.trim)}
        </g>

        {/* ── FAR LEG ───────────────────────────────── */}
        <g className="g-leg-far">
          {limb('M52 106 L50 122', 14, kit.shorts)}
          {limb('M50 122 L47 139', 10, kit.socks)}
          <ellipse cx="45" cy="145" rx="10" ry="5" fill="#1a1a1a" />
        </g>

        {/* ── TORSO ─────────────────────────────────── */}
        <g className="g-torso">
          <path d={TORSO} fill={kitFill} />

          <g clipPath={`url(#${uid}-torso)`}>
            {kit.pattern === 'stripes' && (
              <>
                <rect x="48" y="54" width="6" height="58" fill={kit.accent} />
                <rect x="64" y="54" width="6" height="58" fill={kit.accent} />
              </>
            )}
            {kit.pattern === 'sash' && (
              <path d="M42 60 L78 106" stroke={kit.accent} strokeWidth="11" fill="none" />
            )}
            {kit.pattern === 'hoops' && (
              <>
                <rect x="40" y="64" width="40" height="6" fill={kit.accent} />
                <rect x="40" y="80" width="40" height="6" fill={kit.accent} />
                <rect x="40" y="96" width="40" height="6" fill={kit.accent} />
              </>
            )}
            {/* Ambient occlusion — a flat alpha shape reads the same as a
                multiply blend at this scale and costs far less */}
            <ellipse cx="60" cy="61" rx="15" ry="5" fill="rgba(0,0,0,.16)" />
            <rect x="40" y="101" width="40" height="9" fill="rgba(0,0,0,.12)" />
          </g>

          {/* Collar */}
          <path d="M51 60 Q60 67 69 60" stroke={kit.trim} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          {/* Squad number. Counter-mirrored when the figure faces left,
              otherwise scaleX(-1) on the root renders "10" backwards.
              fontFamily is explicit so it can't fall back to a serif when the
              webfont fails to load. */}
          <g transform={facing === 'left' ? 'translate(120,0) scale(-1,1)' : undefined}>
            <text
              x="60" y="90" textAnchor="middle"
              fontSize="19" fontWeight="900" fill={kit.numberColor}
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
            >
              {c.number}
            </text>
          </g>
        </g>

        {/* ── NEAR LEG ──────────────────────────────── */}
        <g className="g-leg-near">
          {limb('M68 106 L70 122', 14, kit.shorts)}
          {limb('M70 122 L73 139', 10, kit.socks)}
          <ellipse cx="75" cy="145" rx="10" ry="5" fill="#1a1a1a" />
        </g>

        {/* ── NEAR ARM ──────────────────────────────── */}
        <g className="g-arm-near">
          {limb('M73 66 L81 80', 12, kitFill)}
          {limb('M81 80 L84 94', 9, skinFill)}
          <circle cx="84" cy="95" r={handR} fill={hand} />
          {limb('M78 74 L82 81', 3, kit.trim)}
        </g>

        {/* ── HEAD ──────────────────────────────────── */}
        <g className="g-head">
          {limb('M60 50 L60 61', 12, skinFill)}
          <circle cx="60" cy="36" r="18" fill={skinFill} />
          <path d={hair.main} fill={c.hairColor} />
          {hair.accent && <path d={hair.accent} fill={shade(c.hairColor, -0.12)} />}
          <circle cx="53.5" cy="39" r="2.5" fill="#241a12" />
          <circle cx="66.5" cy="39" r="2.5" fill="#241a12" />
          {face === 'open'
            ? <ellipse cx="60" cy="48" rx="4" ry="5" fill="#5c2b2b" />
            : <path d={MOUTH[face]} stroke="#5c3a2a" strokeWidth="2.1" fill="none" strokeLinecap="round" />}
        </g>
      </g>
    </svg>
  )
}
