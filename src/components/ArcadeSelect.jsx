import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { arcadeSetsFor } from '../game/arcadeSets'
import { ARCADE_DURATIONS } from '../game/mastery'
import { OPS, opName } from '../game/config'

/**
 * Snabbskott gets one focused decision screen instead of three repeated chips
 * inside every operation card. This also makes the full fact sets reachable;
 * they existed in the catalog and storage schema but the old UI always chose
 * index zero (the core set).
 */
export default function ArcadeSelect() {
  const { state, dispatch, startRound } = useGame()
  const { t } = useTranslation()
  const op = state.selectedOp
  const sets = arcadeSetsFor(op)

  const play = (setId, timerMs) => startRound(op, { mode: 'arcade', setId, timerMs })

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.9rem' }}>{t('arcade.title')}</h1>
      <p className="subtitle">
        {OPS[op].icon} {opName(op)} · {t('arcade.subtitle')}
      </p>

      <div className="arcade-set-list">
        {sets.map(set => {
          const label = set.id.endsWith('.full') ? t('arcade.fullSet') : t('arcade.coreSet')
          return (
            <section className="arcade-set-card" key={set.id} aria-labelledby={`arcade-${set.id}`}>
              <div className="arcade-set-heading">
                <h2 id={`arcade-${set.id}`}>{label}</h2>
                <span>{t('arcade.factCount', { n: set.facts.length })}</span>
              </div>
              <div className="arcade-duration-grid">
                {ARCADE_DURATIONS.map(ms => (
                  <button
                    key={ms}
                    className={`btn ${ms === 60000 ? 'btn-gold' : 'btn-white'} arcade-duration`}
                    onClick={() => play(set.id, ms)}
                  >
                    {t('arcade.chip', { s: ms / 1000 })}
                  </button>
                ))}
              </div>
              <button className="link-btn" onClick={() => play(set.id, null)}>
                {t('arcade.freeChip')}
              </button>
            </section>
          )
        })}
      </div>

      <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'mode' })}>
        {t('common.back')}
      </button>
    </div>
  )
}
