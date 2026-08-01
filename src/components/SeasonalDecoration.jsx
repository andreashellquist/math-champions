import { useMemo } from 'react'

/**
 * A handful of drifting particles, confined to the pitch stage.
 *
 * Spring and summer get none — decoration should say something, not fill
 * space. Winter gets snow, autumn gets leaves. Pure flavour: `aria-hidden`,
 * `pointer-events: none`, and the whole layer is skipped under
 * `prefers-reduced-motion` (see `.seasonal-layer` in App.css).
 *
 * Piece positions are computed once per theme via `useMemo`, not re-rolled on
 * every render — the round bar re-renders constantly during a kick, and
 * reshuffling snowflakes on every keystroke would be both wasted work and
 * visually restless.
 */
const CONTENT = { winter: '❄', autumn: '🍂' }

export default function SeasonalDecoration({ theme }) {
  const glyph = CONTENT[theme]

  const pieces = useMemo(() => {
    if (!glyph) return []
    return Array.from({ length: 7 }, (_, i) => ({
      id: i,
      left: 8 + ((i * 13) % 84),
      dur: 4.5 + (i % 4) * 1.1,
      delay: -(i * 0.9),
      dx: (i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 8),
      rot: (i % 2 === 0 ? 1 : -1) * (60 + i * 15),
      size: 12 + (i % 3) * 3,
    }))
  }, [glyph])

  if (!pieces.length) return null

  return (
    <div className="seasonal-layer" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          className="seasonal-piece"
          style={{
            left: `${p.left}%`,
            fontSize: p.size,
            '--dur': `${p.dur}s`,
            '--dx': `${p.dx}px`,
            '--rot': `${p.rot}deg`,
            animationDelay: `${p.delay}s`,
          }}
        >
          {glyph}
        </span>
      ))}
    </div>
  )
}
