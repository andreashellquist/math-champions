import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { OPS, opName } from '../game/config'
import { COMPETITIONS, TIE_TARGET, tieWins, headToHead, seasonComplete } from '../game/mastery'
import { getRival } from '../game/rivals'
import Player from './Player'

/**
 * The season.
 *
 * Four competitions, each a tie against one rival, each first-to-three
 * round-wins. Deliberately *not* a league table: points and a
 * bottom-of-the-table position is a report card.
 *
 * Ties have a not-yet state, never a lost state. Nothing on this screen can go
 * down. The head-to-head ledger shows wins as a count — never a percentage,
 * and the "played" figure is never rendered as a loss tally, which is why the
 * string is suppressed entirely at zero wins.
 */
export default function SeasonScreen() {
  const { state, dispatch, startRound } = useGame()
  const { t } = useTranslation()
  const { rivalry } = state.mastery
  const stage = rivalry?.stage ?? 0
  const done = seasonComplete(state.mastery)

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.8rem' }}>
        {t('season.title', { n: rivalry?.season ?? 1 })}
      </h1>
      <p className="subtitle">
        {done ? t('season.allClear') : t('season.subtitle')}
      </p>

      {rivalry?.cups?.length > 0 && (
        <p className="cup-shelf" aria-label={t('season.cups', { n: rivalry.cups.length })}>
          {'🏆'.repeat(Math.min(rivalry.cups.length, 12))}
        </p>
      )}

      <div className="trophy-card">
        {COMPETITIONS.map((comp, i) => {
          const rival = getRival(comp.rival)
          const wins = tieWins(state.mastery, comp.rival)
          const [won] = headToHead(state.mastery, comp.rival)
          const active = i === stage
          const cleared = i < stage

          return (
            <div key={comp.id} className={`comp-row${active ? ' active' : ''}`}>
              <Player id={comp.rival} role="keeper" pose="ready" size={46} animate={false} />

              <div className="comp-info">
                <div className="comp-name">
                  {t(`season.comp.${comp.id}`)} {cleared && '✓'}
                </div>
                <div className="comp-sub">
                  {OPS[comp.op].icon} {opName(comp.op)} · {t(rival.nameKey)}
                </div>

                {/* Tie progress as pips, not a bar — three discrete wins */}
                <div className="tie-pips" aria-label={t('season.tieProgress', { n: wins, total: TIE_TARGET })}>
                  {Array.from({ length: TIE_TARGET }, (_, k) => (
                    <span key={k} className={`tie-pip${k < wins ? ' on' : ''}`} />
                  ))}
                </div>

                {/* Only wins are ever shown. At zero the line is replaced. */}
                <div className="comp-ledger">
                  {won > 0
                    ? t('fixture.ledger', { n: won, rival: t(rival.nameKey) })
                    : t('fixture.next', { rival: t(rival.nameKey) })}
                </div>
              </div>

              {active && (
                <button className="shootout-chip" onClick={() => startRound(comp.op, { mode: 'fixture' })}>
                  {t('season.playTie')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'menu' })}>
        {t('common.back')}
      </button>
    </div>
  )
}
