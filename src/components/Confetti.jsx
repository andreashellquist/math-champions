import { useState, useEffect } from 'react'

const COLORS = ['#ffe234', '#ff6b6b', '#4ecdc4', '#45b7d1', '#a8e6cf', '#dda0dd', '#ffa500']

function rand(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a
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
  const [pieces, setPieces] = useState([])

  useEffect(() => {
    if (!trigger) return
    setPieces(Array.from({ length: count }, (_, i) => ({
      id:    `${trigger}-${i}`,
      left:  Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      dur:   (Math.random() * 1.2 + 1.3).toFixed(2),
      delay: (Math.random() * 0.45).toFixed(2),
      size:  rand(7, 14),
      round: Math.random() > 0.5,
    })))
    const timer = setTimeout(() => setPieces([]), 3000)
    return () => clearTimeout(timer)
  }, [trigger, count])

  if (pieces.length === 0) return null

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
