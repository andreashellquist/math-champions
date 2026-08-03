import { useState, useEffect, useMemo } from 'react'

const COLORS = ['#ffe234', '#ff6b6b', '#4ecdc4', '#45b7d1', '#a8e6cf', '#dda0dd', '#ffa500']

/** Stable pseudo-random fraction derived from the burst and piece ids. */
function fraction(trigger, index, salt) {
  const text = `${trigger}:${index}:${salt}`
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

function rand(trigger, index, salt, a, b) {
  return Math.floor(fraction(trigger, index, salt) * (b - a + 1)) + a
}

/**
 * Burst of confetti.
 *
 * `trigger` is a monotonically increasing counter, not a boolean. The previous
 * version toggled a flag and early-returned when it was false, so confetti
 * fired on the 1st, 3rd, 5th goal and silently did nothing on the even ones —
 * and the false-transition also ran the cleanup, clearing the timer that was
 * supposed to remove the previous burst's 28 DOM nodes.
 */
export default function Confetti({ trigger, count = 28 }) {
  const [visible, setVisible] = useState(Boolean(trigger))
  const pieces = useMemo(() => !trigger ? [] : Array.from({ length: count }, (_, i) => ({
    id:    `${trigger}-${i}`,
    left:  fraction(trigger, i, 1) * 100,
    color: COLORS[Math.floor(fraction(trigger, i, 2) * COLORS.length)],
    dur:   (fraction(trigger, i, 3) * 1.2 + 1.3).toFixed(2),
    delay: (fraction(trigger, i, 4) * 0.45).toFixed(2),
    size:  rand(trigger, i, 5, 7, 14),
    round: fraction(trigger, i, 6) > 0.5,
  })), [trigger, count])

  useEffect(() => {
    if (!trigger) return
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [trigger])

  if (!visible || pieces.length === 0) return null

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position:     'absolute',
            left:         `${p.left}vw`,
            top:          '-20px',
            width:        `${p.size}px`,
            height:       `${p.size}px`,
            background:   p.color,
            borderRadius: p.round ? '50%' : '2px',
            animation:    `confettiFall ${p.dur}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}
