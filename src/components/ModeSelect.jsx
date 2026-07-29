import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { OPS, OP_ORDER, opName } from '../game/config'
import { recentAccuracy, masteredCount, opProgress } from '../game/mastery'
import { computeTimeLimit } from '../hooks/useDeadline'

/**
 * Shootout is offered only to a child who already has the facts — it's a
 * victory lap, not a test. It is never pushed at someone who is struggling,
 * but it stays permanently *reachable*, because quietly removing something a
 * child once had is itself a message.
 */
function shootoutOffered(mastery, op) {
  const acc = recentAccuracy(mastery, op)
  const attempts = (mastery.r[op] ?? []).length
  return acc !== null && acc >= 0.85 && attempts >= 20 && masteredCount(mastery) >= 8
}

export default function ModeSelect() {
  const { state, dispatch, startRound, rival } = useGame()
  const { t } = useTranslation()
  const { mastery } = state

  // The rival draws from facts the child has actually met
  const derbyReady = (mastery.r[state.selectedOp] ?? []).length >= 10

  const play = (op, mode) => {
    const timerMs = mode === 'shootout'
      ? computeTimeLimit({
          op,
          level: Math.floor(opProgress(mastery, op) * 3),
          extraTime: state.settings.extraTime,
        })
      : null
    startRound(op, { mode, timerMs })
  }

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.9rem' }}>{t('mode.title')}</h1>
      <p className="subtitle">{t('mode.subtitle')}</p>

      <div className="ops-grid">
        {OP_ORDER.map(op => {
          const unlocked = mastery.agg.correct >= OPS[op].unlock
          const pct = Math.round(opProgress(mastery, op) * 100)
          return (
            <div key={op} className={`op-card${unlocked ? '' : ' locked'}`}>
              <button className="op-main" onClick={() => play(op, 'training')}>
                <span className="op-icon">{OPS[op].icon}</span>
                <span className="op-name">{opName(op)}</span>
                <span className={`op-status ${unlocked ? 'unlocked' : 'locked-msg'}`}>
                  {unlocked ? t('mode.progress', { pct }) : t('mode.opensAt', { n: OPS[op].unlock })}
                </span>
              </button>

              {/* A lock a child can't get past reads as arbitrary. They can
                  always try — it just doesn't count for anything. */}
              {!unlocked && (
                <button className="link-btn tiny" onClick={() => play(op, 'training')}>
                  {t('mode.tryAnyway')}
                </button>
              )}

              {unlocked && shootoutOffered(mastery, op) && (
                <button className="shootout-chip" onClick={() => play(op, 'shootout')}>
                  {t('mode.shootout')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* The derby: the rival picks the questions, never the outcome. Only
          offered once he has something to pick *from* — on a fresh profile
          there is no history, so the promise would be empty. */}
      {derbyReady && (
        <>
          <button className="btn btn-gold derby-btn" onClick={() => play(state.selectedOp, 'fixture')}>
            {t('fixture.label')} — {t(rival.nameKey)}
          </button>
          <p className="hint-note">{t('fixture.note', { rival: t(rival.nameKey) })}</p>
        </>
      )}

      <p className="hint-note">{t('mode.shootoutNote')}</p>

      <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'menu' })}>
        {t('common.back')}
      </button>
    </div>
  )
}
