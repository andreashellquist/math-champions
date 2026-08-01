import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { OPS, OP_ORDER, opName } from '../game/config'
import {
  recentAccuracy, opProgress, MASTERED_BOX, mixedReady,
  currentCompetition, gateReadiness, gatePassed, GATE_SIZE, GATE_PASS,
} from '../game/mastery'
import { STRANDS_BY_OP } from '../game/facts'
import { computeTimeLimit } from '../hooks/useDeadline'
import { clockScaleFor } from '../game/rivals'

/**
 * Shootout is offered only to a child who already has the facts — it's a
 * victory lap, not a test. It is never pushed at someone who is struggling,
 * but it stays permanently *reachable*, because quietly removing something a
 * child once had is itself a message.
 */
function shootoutOffered(mastery, op) {
  const acc = recentAccuracy(mastery, op)
  const attempts = (mastery.r[op] ?? []).length
  // Per-operation, not global: `masteredCount` counts facts from any operation,
  // so eight solid addition facts were unlocking the division Shootout.
  const solidInOp = (STRANDS_BY_OP[op] ?? [])
    .flatMap(st => st.facts)
    .filter(f => (mastery.f[f.key]?.[0] ?? 0) >= MASTERED_BOX)
    .length
  return acc !== null && acc >= 0.85 && attempts >= 20 && solidInOp >= 8
}

export default function ModeSelect() {
  const { state, dispatch, startRound, rival } = useGame()
  const { t } = useTranslation()
  const { mastery } = state

  // The rival draws from facts the child has actually met
  const derbyReady = (mastery.r[state.selectedOp] ?? []).length >= 10
  const mixedOps = mixedReady(mastery, OP_ORDER)

  // The gate for the competition currently in play, if it is worth offering
  const gate = (() => {
    const comp = currentCompetition(mastery)
    if (!comp || gatePassed(mastery, comp.id)) return null
    const readiness = gateReadiness(mastery, comp.id)
    return readiness.ready ? { ...comp, readiness } : null
  })()

  const play = (op, mode) => {
    const timerMs = mode === 'shootout' || mode === 'fixture'
      // `level` is deliberately gone: deriving the limit from content mastery
      // meant the clock tightened as the child improved, which is exactly the
      // "you are slow" signal the design exists to avoid.
      ? Math.round(
          computeTimeLimit({ op, latencies: mastery.l, extraTime: state.settings.extraTime })
          * clockScaleFor(mode === 'fixture' ? rival : null, state.settings.extraTime),
        )
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
          {/* Transparent difficulty is motivating; opaque difficulty is not. */}
          <ul className="difficulty-chips" aria-label={t('fixture.difficulty')}>
            {[
              { key: 'questions', pips: 3 },
              { key: 'options', pips: 2 },
              { key: 'length', pips: 1 },
            ].map(({ key, pips }) => (
              <li key={key}>
                <span>{t(`fixture.chip.${key}`)}</span>
                <span className="chip-pips" aria-hidden="true">
                  {[1, 2, 3].map(i => <i key={i} className={i <= pips ? 'on' : ''} />)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Uttagningen. Offered only when the model expects a pass, and it never
          withholds anything — passing awards an insignia, failing awards a list
          of facts to work on. */}
      {gate && (
        <div className="gate-offer">
          <b>{t('gate.title', { comp: t(`season.comp.${gate.id}`) })}</b>
          <span>{t('gate.blurb', { n: GATE_SIZE, pass: GATE_PASS })}</span>
          <span className="gate-ready">
            {t('gate.readiness', { predicted: gate.readiness.predicted, total: GATE_SIZE })}
          </span>
          <button className="btn btn-gold" onClick={() => startRound(gate.op, { mode: 'gate', kicks: GATE_SIZE, gateId: gate.id })}>
            {t('gate.start')}
          </button>
        </div>
      )}

      {mixedOps && (
        <>
          <button className="btn btn-white" onClick={() => play(state.selectedOp, 'mixed')}>
            {t('mode.mixed')}
          </button>
          {/* Say the dip out loud, or the child reads it as getting worse */}
          <p className="hint-note">{t('mode.mixedNote')}</p>
        </>
      )}

      <p className="hint-note">{t('mode.shootoutNote')}</p>

      <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'menu' })}>
        {t('common.back')}
      </button>
    </div>
  )
}
