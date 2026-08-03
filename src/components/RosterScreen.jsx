import { useMemo } from 'react'
import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { ROSTER, buildCustomCharacter } from '../game/characters'
import { THEMES, PALETTE, resolveTheme } from '../game/theme'
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
  const pitchSetting = state.settings.pitchTheme ?? 'auto'
  const activeTheme = resolveTheme(pitchSetting)

  const customCharacter = useMemo(
    () => buildCustomCharacter(state.settings.customPlayer),
    [state.settings.customPlayer],
  )
  const squad = useMemo(() => {
    const all = customCharacter ? [...ROSTER, customCharacter] : ROSTER
    return [...all].sort((a, b) => a.short.localeCompare(b.short, 'sv'))
  }, [customCharacter])

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.9rem' }}>{t('roster.title')}</h1>
      <p className="subtitle">{t('roster.subtitle')}</p>

      <div className="roster">
        {squad.map(c => {
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
                character={c.id === 'custom' ? c : null}
                pose={isSelected ? 'celebrate' : 'idle'}
                size={116}
                animate={isSelected}
              />
              <span className="roster-name">{c.short}</span>
              <span className="roster-meta">{c.flag} #{c.number}</span>
            </button>
          )
        })}

        <button
          className="roster-card roster-card-create"
          onClick={() => dispatch({ type: 'NAVIGATE', screen: 'customPlayer' })}
        >
          <span className="roster-create-icon" aria-hidden="true">{customCharacter ? '✏️' : '➕'}</span>
          <span className="roster-name">
            {t(customCharacter ? 'roster.editSelf' : 'roster.createSelf')}
          </span>
        </button>
      </div>

      <h2 className="title" style={{ fontSize: '1.4rem', marginTop: 8 }}>{t('theme.title')}</h2>
      <p className="subtitle" style={{ marginBottom: 12 }}>{t('theme.subtitle')}</p>

      <div className="theme-picker">
        {['auto', ...THEMES].map(id => {
          const isSelected = pitchSetting === id
          const swatch = PALETTE[id === 'auto' ? activeTheme : id]
          return (
            <button
              key={id}
              className={`theme-chip${isSelected ? ' selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => dispatch({ type: 'SET_SETTING', key: 'pitchTheme', value: id })}
            >
              <span
                className="theme-swatch"
                aria-hidden="true"
                style={{ background: `linear-gradient(135deg, ${swatch.pitch}, ${swatch.pitchDeep})` }}
              />
              <span className="theme-label">{t(`theme.${id}.label`)}</span>
              {id === 'auto' && <span className="theme-sub">{t('theme.auto.sub')}</span>}
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
