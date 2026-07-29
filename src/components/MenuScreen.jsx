import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { getCharacter } from '../game/characters'
import { masteredCount, MASTERED_BOX } from '../game/mastery'
import { STRANDS_BY_OP } from '../game/facts'
import { OP_ORDER } from '../game/config'
import Player from './Player'

/** Colour ramp shared with the mastery map — monotonic in lightness */
const BAND_COLORS = ['#2c6b45', '#3f8f56', '#57b06a', '#8ccf78', '#c7e88a', '#ffe234']

const TOTAL_FACTS = OP_ORDER.reduce(
  (n, op) => n + (STRANDS_BY_OP[op] ?? []).reduce((m, s) => m + s.facts.length, 0), 0)

export default function MenuScreen() {
  const { state, dispatch, keeperId } = useGame()
  const { t } = useTranslation()
  const { agg } = state.mastery
  const me = getCharacter(state.settings.character)
  const them = getCharacter(keeperId)

  const total = TOTAL_FACTS
  const bands = BAND_COLORS.map((color, box) => ({
    box, color,
    pct: (Object.values(state.mastery.f).filter(r => r[0] === box).length / total) * 100,
  }))

  return (
    <div className="screen">
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

      <button className="btn btn-gold" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'mode' })}>
        {t('menu.play')}
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
