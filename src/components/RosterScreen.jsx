import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { ROSTER } from '../game/characters'
import Player from './Player'

/**
 * Pick your player.
 *
 * Everyone is available from the first launch and nobody is unlockable. Choice
 * over things that don't affect difficulty is close to free motivation, but
 * only while it stays a genuine choice — gating characters behind performance
 * turns the one purely autonomy-supporting screen in the game into a reward
 * schedule, and makes a locked favourite a small negative signal every time
 * the child opens the menu.
 */
export default function RosterScreen() {
  const { state, dispatch } = useGame()
  const { t } = useTranslation()
  const selected = state.settings.character

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.9rem' }}>{t('roster.title')}</h1>
      <p className="subtitle">{t('roster.subtitle')}</p>

      <div className="roster">
        {ROSTER.map(c => {
          const isSelected = c.id === selected
          return (
            <button
              key={c.id}
              className={`roster-card${isSelected ? ' selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => dispatch({ type: 'SET_SETTING', key: 'character', value: c.id })}
            >
              {isSelected && <span className="roster-check" aria-hidden="true">✓</span>}
              {/* Only the selected figure breathes — five idle loops at once
                  is visual noise and wasted battery */}
              <Player
                id={c.id}
                pose={isSelected ? 'celebrate' : 'idle'}
                size={116}
                animate={isSelected}
              />
              <span className="roster-name">{c.short}</span>
              <span className="roster-meta">{c.flag} #{c.number}</span>
            </button>
          )
        })}
      </div>

      <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'menu' })}>
        {t('common.done')}
      </button>
    </div>
  )
}
