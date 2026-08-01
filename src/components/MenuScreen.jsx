import { useState } from 'react'
import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { getCharacter } from '../game/characters'
import { masteredCount } from '../game/mastery'
import { STRANDS_BY_OP } from '../game/facts'
import { currentCompetition, tieWins, TIE_TARGET } from '../game/mastery'
import { getRival } from '../game/rivals'
import { OP_ORDER } from '../game/config'
import Player from './Player'
import WeeklyCard from './WeeklyCard'

/** Colour ramp shared with the mastery map — monotonic in lightness */
const BAND_COLORS = ['#2c6b45', '#3f8f56', '#57b06a', '#8ccf78', '#c7e88a', '#ffe234']

const TOTAL_FACTS = OP_ORDER.reduce(
  (n, op) => n + (STRANDS_BY_OP[op] ?? []).reduce((m, s) => m + s.facts.length, 0), 0)

export default function MenuScreen() {
  const [weekDone, setWeekDone] = useState(false)
  const { state, dispatch, keeperId, quickStart } = useGame()
  const { t } = useTranslation()
  const { agg } = state.mastery
  const me = getCharacter(state.settings.character)
  const them = getCharacter(keeperId)

  const total = TOTAL_FACTS
  const comp = currentCompetition(state.mastery)
  const wins = comp ? tieWins(state.mastery, comp.rival) : 0
  const bands = BAND_COLORS.map((color, box) => ({
    box, color,
    pct: (Object.values(state.mastery.f).filter(r => r[0] === box).length / total) * 100,
  }))

  return (
    <div className="screen">
      {!weekDone && <WeeklyCard onClose={() => setWeekDone(true)} />}
      <h1 className="title">{t('menu.title')}</h1>
      <p className="subtitle">{t('menu.subtitle')}</p>

      <div className="characters-row">
        <div className="char-col">
          <Player id={me.id} pose="idle" size={104} />
          <div className="char-label">{me.flag} {me.short}</div>
        </div>

        <div className="vs-badge">VS</div>

        <div className="char-col">
          <Player id={them.id} role="keeper" pose="ready" size={104} facing="left" />
          <div className="char-label">{them.flag} {them.short}</div>
        </div>
      </div>

      <div className="stats-pill">
        <span>{t('menu.goals')} <b>{agg.goals}</b></span>
        <span>{t('menu.factsKnown')} <b>{masteredCount(state.mastery)}</b></span>
      </div>

      {/* The season, as a strip rather than a fifth button */}
      {comp && (
        <button
          className="season-strip"
          onClick={() => dispatch({ type: 'NAVIGATE', screen: 'season' })}
        >
          <Player id={comp.rival} role="keeper" pose="ready" size={38} animate={false} />
          <span className="season-strip-text">
            <b>{t('season.strip', { n: state.mastery.rivalry?.season ?? 1, comp: t(`season.comp.${comp.id}`) })}</b>
            <span>{t(getRival(comp.rival).nameKey)}</span>
          </span>
          <span className="tie-pips" aria-hidden="true">
            {Array.from({ length: TIE_TARGET }, (_, k) => (
              <span key={k} className={`tie-pip${k < wins ? ' on' : ''}`} />
            ))}
          </span>
        </button>
      )}

      {/* One glance at the whole fact space: a bar that visibly moves every
          session. It is the tap target itself rather than a fifth button. */}
      <div className="map-bar-wrap">
        <button
          className="map-bar"
          onClick={() => dispatch({ type: 'NAVIGATE', screen: 'map' })}
          aria-label={t('map.open')}
        >
          {bands.map(b => (
            <span key={b.box} style={{ width: `${b.pct}%`, background: b.color }} />
          ))}
        </button>
        <span className="map-bar-caption">
          {t('map.menuSummary', { n: masteredCount(state.mastery), total })}
        </span>
      </div>

      {/* One tap, no decision. The picker is still there for a child who
          wants it, demoted to a link. */}
      <button className="btn btn-gold" onClick={quickStart}>
        {t('menu.start')}
      </button>
      <button className="link-btn" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'mode' })}>
        {t('menu.pickSelf')}
      </button>

      <div className="menu-links">
        <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'roster' })}>
          {t('menu.changePlayer')}
        </button>
        <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'trophy' })}>
          {t('menu.stats')}
        </button>
      </div>

      <button
        className="link-btn subtle"
        aria-pressed={state.settings.sound}
        onClick={() => dispatch({ type: 'SET_SETTING', key: 'sound', value: !state.settings.sound })}
      >
        {state.settings.sound ? t('menu.soundOn') : t('menu.soundOff')}
      </button>
    </div>
  )
}
