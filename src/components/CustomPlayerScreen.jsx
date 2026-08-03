import { useState } from 'react'
import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { HAIR_STYLES, HAIR_COLORS, SKIN_TONES, KIT_PRESETS, buildCustomCharacter } from '../game/characters'
import Player from './Player'

const DEFAULT_DRAFT = {
  name: '', hair: HAIR_STYLES[0], hairColor: HAIR_COLORS[0], skin: SKIN_TONES[0],
  kitId: KIT_PRESETS[0].id, number: 10,
}

/**
 * Create-a-player.
 *
 * The self-reference effect is real, and it's the honest answer for a child
 * who isn't any of the squad as given (see the note at the top of
 * characters.js). Every option here is a swatch, never a raw colour input —
 * a curated palette means there is no combination a child can pick that
 * comes out illegible, which a free colour wheel can't promise.
 */
export default function CustomPlayerScreen() {
  const { state, dispatch } = useGame()
  const { t } = useTranslation()
  const existing = state.settings.customPlayer
  const [draft, setDraft] = useState(existing ?? DEFAULT_DRAFT)

  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }))
  const preview = buildCustomCharacter({ ...draft, name: draft.name.trim() || t('customPlayer.previewName') })

  const canSave = draft.name.trim().length > 0

  const save = () => {
    if (!canSave) return
    dispatch({ type: 'SET_SETTING', key: 'customPlayer', value: { ...draft, name: draft.name.trim().slice(0, 14) } })
    dispatch({ type: 'SET_SETTING', key: 'character', value: 'custom' })
    dispatch({ type: 'NAVIGATE', screen: 'roster' })
  }

  const removeSelf = () => {
    dispatch({ type: 'SET_SETTING', key: 'customPlayer', value: null })
    if (state.settings.character === 'custom') {
      dispatch({ type: 'SET_SETTING', key: 'character', value: 'haaland' })
    }
    dispatch({ type: 'NAVIGATE', screen: 'roster' })
  }

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.9rem' }}>{t('customPlayer.title')}</h1>
      <p className="subtitle">{t('customPlayer.subtitle')}</p>

      <Player character={preview} pose="celebrate" size={140} animate />

      <input
        className="name-input"
        type="text"
        maxLength={14}
        placeholder={t('customPlayer.namePlaceholder')}
        value={draft.name}
        onChange={e => set('name', e.target.value)}
        aria-label={t('customPlayer.nameLabel')}
      />

      <h2 className="title" style={{ fontSize: '1.1rem', marginTop: 10 }}>{t('customPlayer.hairLabel')}</h2>
      <div className="swatch-row">
        {HAIR_STYLES.map(style => (
          <button
            key={style}
            className={`swatch-card${draft.hair === style ? ' selected' : ''}`}
            aria-pressed={draft.hair === style}
            aria-label={t(`customPlayer.hairStyle.${style}`)}
            onClick={() => set('hair', style)}
          >
            <Player
              character={{ ...preview, hair: style }}
              pose="idle" size={64} animate={false}
            />
          </button>
        ))}
      </div>

      <h2 className="title" style={{ fontSize: '1.1rem', marginTop: 10 }}>{t('customPlayer.hairColorLabel')}</h2>
      <div className="swatch-row">
        {HAIR_COLORS.map((color, index) => (
          <button
            key={color}
            className={`color-swatch${draft.hairColor === color ? ' selected' : ''}`}
            style={{ background: color }}
            aria-pressed={draft.hairColor === color}
            aria-label={t('customPlayer.hairColorChoice', { n: index + 1, total: HAIR_COLORS.length })}
            onClick={() => set('hairColor', color)}
          />
        ))}
      </div>

      <h2 className="title" style={{ fontSize: '1.1rem', marginTop: 10 }}>{t('customPlayer.skinLabel')}</h2>
      <div className="swatch-row">
        {SKIN_TONES.map((color, index) => (
          <button
            key={color}
            className={`color-swatch${draft.skin === color ? ' selected' : ''}`}
            style={{ background: color }}
            aria-pressed={draft.skin === color}
            aria-label={t('customPlayer.skinChoice', { n: index + 1, total: SKIN_TONES.length })}
            onClick={() => set('skin', color)}
          />
        ))}
      </div>

      <h2 className="title" style={{ fontSize: '1.1rem', marginTop: 10 }}>{t('customPlayer.kitLabel')}</h2>
      <div className="swatch-row">
        {KIT_PRESETS.map((kit, index) => (
          <button
            key={kit.id}
            className={`swatch-card${draft.kitId === kit.id ? ' selected' : ''}`}
            aria-pressed={draft.kitId === kit.id}
            aria-label={t('customPlayer.kitChoice', { n: index + 1, total: KIT_PRESETS.length })}
            onClick={() => set('kitId', kit.id)}
          >
            <Player
              character={{ ...preview, kits: { home: kit, nation: kit } }}
              pose="idle" size={64} animate={false}
            />
          </button>
        ))}
      </div>

      <h2 className="title" style={{ fontSize: '1.1rem', marginTop: 10 }}>{t('customPlayer.numberLabel')}</h2>
      <input
        className="number-input"
        type="number"
        min={1}
        max={99}
        value={draft.number}
        onChange={e => set('number', Math.min(99, Math.max(1, Number.parseInt(e.target.value, 10) || 1)))}
        aria-label={t('customPlayer.numberLabel')}
      />

      <div className="custom-player-actions">
        <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'roster' })}>
          {t('common.back')}
        </button>
        <button className="btn btn-gold" disabled={!canSave} onClick={save}>
          {t('customPlayer.save')}
        </button>
      </div>

      {existing && (
        <button className="link-btn tiny" onClick={removeSelf}>
          {t('customPlayer.remove')}
        </button>
      )}
    </div>
  )
}
