/**
 * The goal and net — scenery, not a character.
 *
 * This used to live inside the keeper component, which meant the net moved
 * whenever the keeper did and the keeper couldn't be swapped for another
 * player. Extracted so any roster member can stand in it.
 */
export default function Goal({ width = 240, children }) {
  const height = Math.round(width * 0.62)

  return (
    <div className="goal" style={{ width, height }}>
      <svg
        className="goal-frame"
        viewBox="0 0 240 150"
        width={width}
        height={height}
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        {/* Net mesh */}
        <g stroke="rgba(255,255,255,.16)" strokeWidth="1">
          {[26, 50, 74, 98, 122].map(y => <line key={`h${y}`} x1="8" y1={y} x2="232" y2={y} />)}
          {[32, 60, 88, 116, 144, 172, 200].map(x => <line key={`v${x}`} x1={x} y1="10" x2={x} y2="140" />)}
        </g>
        {/* Frame — posts and crossbar */}
        <path
          d="M8 140 L8 12 L232 12 L232 140"
          fill="none"
          stroke="rgba(255,255,255,.82)"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <rect x="8" y="12" width="224" height="4" fill="rgba(255,255,255,.3)" rx="2" />
      </svg>

      <div className="goal-keeper">{children}</div>
    </div>
  )
}
