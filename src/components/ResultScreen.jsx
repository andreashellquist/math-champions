import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { ratingFor } from '../game/config'
import { computeTimeLimit } from '../hooks/useDeadline'
import {
  masteredCount, labelForKey, GATE_PASS, arcadeBest, arcadeRuns,
} from '../game/mastery'
import Player from './Player'
import Confetti from './Confetti'

export default function ResultScreen() {
  const { state, dispatch, startRound, sessionRounds } = useGame()
  const { t } = useTranslation()
  const r = state.round
  if (!r) return null

  const goals = r.goals
  const rating = ratingFor(goals)
  const stars = '⭐'.repeat(rating.stars) + '☆'.repeat(3 - rating.stars)
  const rebounds = r.results.filter(x => x === 'rebound').length
  const retakes = r.results.filter(x => x === 'timeout-goal').length
  const manyTimeouts = r.timeouts >= 3

  const stoppedEarly = r.stoppedEarly || r.results.length < (r.totalKicks ?? 5)
  // Named, so "work on these" is actionable rather than a score
  const missedLabels = [...new Set(r.missedKeys ?? [])].slice(0, 6).map(labelForKey)

  const replay = () => {
    // Snabbskott restarts itself: same set, same duration — specifically
    // *this run's own* duration (`r.timerMs`), not a global default. A child
    // who picked 30s and taps "again" must get 30s again, or the restart
    // silently changes what the score is being compared against. Free play
    // (`r.timerMs` null) replays as free play.
    if (r.mode === 'arcade') {
      startRound(r.op, { mode: 'arcade', setId: r.setId, timerMs: r.timerMs })
      return
    }

    const timerMs = r.mode === 'shootout' && !r.clockOff
      ? computeTimeLimit({ op: r.op, latencies: state.mastery.l, previousT: r.timerMs, extraTime: state.settings.extraTime })
      : null
    // After a hard round, make the next commitment a small one. Task
    // initiation is priced by the perceived size of the commitment.
    const kicks = goals <= 3 ? 3 : (r.totalKicks ?? 5)

    // Never repeat a gate from its own result screen: an immediate retry
    // teaches cramming and manufactures a false pass. "Next round" after a
    // gate means ordinary practice on the same operation.
    if (r.mode === 'gate') {
      startRound(r.op, { mode: 'training', kicks: 5 })
      return
    }
    startRound(r.op, { mode: r.clockOff ? 'training' : r.mode, timerMs, kicks })
  }

  /* From round 7, `one more` and `done for today` get equal visual weight.
     Equal weight IS the intervention — the current layout nudges toward
     continuing, and removing the nudge is enough. No wall, no cap, no
     greying out: stopping a hyperfocused child externally is what causes the
     meltdown, and it teaches that engaging deeply gets you cut off. */
  const offerLanding = sessionRounds >= 7

  return (
    <div className="screen">
      <div className="result-card">
        {/* No sad face for a low score. The moment a child is most exposed is
            not the moment to put a 😅 on the screen. */}
        <div className="result-figure">
          <Player id={state.settings.character} pose={goals >= 3 ? 'celebrate' : 'idle'} size={92} />
        </div>

        {r.mode === 'arcade' ? (
          <>
            {/* No stars, no rating band — this is a count, not a verdict.
                The headline is this run's score, alone: a personal best is a
                monotone maximum, so after enough runs "did you beat your
                record" mostly answers no, and that shouldn't be the thing a
                child reads every single time they finish. */}
            <div className="result-score">
              {r.timerMs
                ? t('arcade.runScore', { n: goals, s: r.timerMs / 1000 })
                : t('arcade.freeScore', { n: goals })}
            </div>

            {r.stoppedEarly ? (
              <p className="result-msg">{t('arcade.stoppedEarly', { n: goals })}</p>
            ) : !r.timerMs ? (
              // Free play is never scored — no tier, no strip, no "best".
              // Without a fixed duration there is nothing a count is
              // comparable *to*, and a stopping tap that also set a record
              // would turn "when do I stop" into a live cost-benefit
              // calculation on top of the arithmetic.
              <p className="result-msg">{t('arcade.freeMsg')}</p>
            ) : (
              <>
                {r.arcadeTierResult === 'best' && <p className="result-msg">{t('arcade.newBest')}</p>}
                {r.arcadeTierResult === 'top3' && <p className="result-msg">{t('arcade.topThree')}</p>}
                {!r.arcadeTierResult && <p className="result-msg">{t('arcade.justForFun')}</p>}

                {/* A run-history strip instead of a PB comparison — it shows
                    variance and trend, not a binary "you lost to yourself". */}
                <div className="arcade-strip" role="img" aria-label={t('arcade.stripLabel')}>
                  {(() => {
                    const runs = arcadeRuns(state.mastery, r.setId, r.timerMs)
                    const best = arcadeBest(state.mastery, r.setId, r.timerMs) || 1
                    return runs.map((score, i) => (
                      <span
                        key={i}
                        className={`arcade-bar${i === runs.length - 1 ? ' latest' : ''}`}
                        style={{ height: `${Math.max(14, Math.round((score / best) * 100))}%` }}
                      />
                    ))
                  })()}
                </div>
                <p className="arcade-best-label">
                  {t('arcade.bestLabel', { n: arcadeBest(state.mastery, r.setId, r.timerMs) })}
                </p>
              </>
            )}

            {!r.stoppedEarly && missedLabels.length > 0 && (
              <>
                <p className="result-footnote">{t('arcade.checkNext')}</p>
                <ul className="gate-missed">
                  {missedLabels.slice(0, 3).map(l => <li key={l}>{l}</li>)}
                </ul>
              </>
            )}
          </>
        ) : r.mode === 'gate' ? (
          <>
            {/* No pass/fail stamp, no grade, no stars. The headline is which
                facts were identified, not the score. */}
            <h2 className="result-title">
              {goals >= GATE_PASS
                ? t('gate.passed', { comp: t(`season.comp.${r.gateId}`) })
                : t('gate.notYet')}
            </h2>
            <div className="result-score">{goals}/{r.results.length}</div>
            <p className="result-msg">
              {goals >= GATE_PASS
                ? t('gate.passedMsg')
                : t('gate.notYetMsg', { n: r.results.length - goals })}
            </p>
            {missedLabels.length > 0 && (
              <ul className="gate-missed">
                {missedLabels.map(l => <li key={l}>{l}</li>)}
              </ul>
            )}
            {goals < GATE_PASS && <p className="result-footnote">{t('gate.again')}</p>}
          </>
        ) : stoppedEarly ? (
          <>
            <div className="result-score">{goals} ⚽</div>
            <p className="result-msg">{t('result.stoppedEarly', { n: r.results.length })}</p>
          </>
        ) : (
          <>
            <h2 className="result-title">{manyTimeouts ? t('result.clockWon') : rating.title}</h2>
            <div className="result-score">{goals}/{r.results.length} ⚽</div>
            <div className="result-stars" aria-label={t('result.starsLabel', { n: rating.stars })}>{stars}</div>
            <p className="result-msg">
              {manyTimeouts ? t('result.clockWonMsg', { n: goals }) : rating.msg}
            </p>
          </>
        )}

        {/* Brain points run high exactly when the score is low — which is the
            point. They're truthful, and they give a struggling child something
            real to hold on to. */}
        {r.brainPoints > 0 && (
          <div className="brain-points">
            {t('result.brainPoints')}: <b>{r.brainPoints}</b>
            <span>{t('result.brainPointsNote')}</span>
          </div>
        )}

        {(rebounds > 0 || retakes > 0) && (
          <p className="result-footnote">
            {rebounds > 0 && t('result.fromRebound', { n: rebounds })}
            {retakes > 0 && t('result.retakes', { n: retakes })}
          </p>
        )}

        {manyTimeouts && (
          <button
            className="btn btn-gold"
            onClick={() => {
              dispatch({ type: 'SET_SETTING', key: 'extraTime', value: Math.min(2, state.settings.extraTime * 1.3) })
              dispatch({ type: 'NAVIGATE', screen: 'mode' })
            }}
          >
            {t('result.moreTime')}
          </button>
        )}

        {offerLanding ? (
          <>
            <p className="session-summary">
              {t('result.sessionSummary', { n: masteredCount(state.mastery) })}
            </p>
            <div className="result-links">
              <button className="btn btn-gold" onClick={replay}>{t('result.oneMore')}</button>
              <button className="btn btn-gold" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'menu' })}>
                {t('result.doneToday')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="result-btns">
              <button className="btn btn-gold" onClick={replay}>{t('result.nextRound')}</button>
            </div>
            <div className="result-links">
              <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'mode' })}>
                {t('result.changeTraining')}
              </button>
              <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'menu' })}>
                {t('common.menu')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Arcade saves the full celebration for an actual personal best — at
          typical arcade scores, "goals >= 4" would fire on nearly every run. */}
      {(r.mode === 'arcade' ? r.arcadeTierResult === 'best' : goals >= 4) && (
        <Confetti trigger={1} count={40} />
      )}
    </div>
  )
}
