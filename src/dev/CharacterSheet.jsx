import Player from '../components/Player'
import Goal from '../components/Goal'
import { ROSTER } from '../game/characters'

/**
 * Dev-only contact sheet — every character in every pose.
 * Reachable at `?sheet=1`. Not part of the game.
 */
const STRIKER_POSES = ['idle', 'windup', 'kick', 'celebrate', 'dejected']
const KEEPER_POSES = ['ready', 'dive-left', 'dive-right', 'beaten']

export default function CharacterSheet() {
  return (
    <div style={{ padding: 24, width: '100%', color: '#fff', overflow: 'auto', maxHeight: '100vh' }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Detail check</h1>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', marginBottom: 24 }}>
        {ROSTER.map(c => <Player key={c.id} id={c.id} pose="idle" size={230} />)}
      </div>

      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Striker poses</h1>
      {ROSTER.map(c => (
        <div key={c.id} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 900, marginBottom: 2 }}>{c.flag} {c.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {STRIKER_POSES.map(p => (
              <div key={p} style={{ textAlign: 'center' }}>
                <Player id={c.id} pose={p} size={104} />
                <div style={{ fontSize: 11, opacity: .8 }}>{p}</div>
              </div>
            ))}
            {KEEPER_POSES.map(p => (
              <div key={p} style={{ textAlign: 'center' }}>
                <Player id={c.id} role="keeper" pose={p} size={104} />
                <div style={{ fontSize: 11, opacity: .8 }}>gk {p}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <h1 style={{ fontSize: 22, margin: '20px 0 12px' }}>In the goal</h1>
      <Goal width={260}>
        <Player id="yamal" role="keeper" pose="ready" size={110} facing="left" />
      </Goal>
    </div>
  )
}
