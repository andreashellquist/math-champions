import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { ratingFor } from '../game/config'
import { computeTimeLimit } from '../hooks/useDeadline'
import { masteredCount } from '../game/mastery'
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

  const replay = () => {
    const timerMs = r.mode === 'shootout' && !r.clockOff
      ? computeTimeLimit({ op: r.op, latencies: state.mastery.l, previousT: r.timerMs, extraTime: state.settings.extraTime })
      : null
    // After a hard round, make the next commitment a small one. Task
    // initiation is priced by the perceived size of the commitment.
    const kicks = goals <= 3 ? 3 : (r.totalKicks ?? 5)
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

        {stoppedEarly ? (
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

      {goals >= 4 && <Confetti trigger={1} count={40} />}
    </div>
  )
}
