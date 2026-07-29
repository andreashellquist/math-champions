import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { ratingFor } from '../game/config'
import { computeTimeLimit } from '../hooks/useDeadline'
import Player from './Player'
import Confetti from './Confetti'

export default function ResultScreen() {
  const { state, dispatch, startRound } = useGame()
  const { t } = useTranslation()
  const r = state.round
  if (!r) return null

  const goals = r.goals
  const rating = ratingFor(goals)
  const stars = '⭐'.repeat(rating.stars) + '☆'.repeat(3 - rating.stars)
  const rebounds = r.results.filter(x => x === 'rebound').length
  const retakes = r.results.filter(x => x === 'timeout-goal').length
  const manyTimeouts = r.timeouts >= 3

  const replay = () => {
    const timerMs = r.mode === 'shootout' && !r.clockOff
      ? computeTimeLimit({ op: r.op, previousT: r.timerMs, extraTime: state.settings.extraTime })
      : null
    startRound(r.op, { mode: r.clockOff ? 'training' : r.mode, timerMs })
  }

  return (
    <div className="screen">
      <div className="result-card">
        {/* No sad face for a low score. The moment a child is most exposed is
            not the moment to put a 😅 on the screen. */}
        <div className="result-figure">
          <Player id={state.settings.character} pose={goals >= 3 ? 'celebrate' : 'idle'} size={92} />
        </div>

        <h2 className="result-title">{manyTimeouts ? t('result.clockWon') : rating.title}</h2>
        <div className="result-score">{goals}/{r.results.length} ⚽</div>
        <div className="result-stars" aria-label={t('result.starsLabel', { n: rating.stars })}>{stars}</div>
        <p className="result-msg">
          {manyTimeouts ? t('result.clockWonMsg', { n: goals }) : rating.msg}
        </p>

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
      </div>

      {goals >= 4 && <Confetti trigger={1} count={40} />}
    </div>
  )
}
