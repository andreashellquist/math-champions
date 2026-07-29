import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { LOCALE_NAMES } from '../i18n'
import { OPS, OP_ORDER, opName } from '../game/config'
import { masteredCount, workingOn, opProgress, labelForKey, recentAccuracy } from '../game/mastery'
import { getHint } from '../game/hints'

const OP_OF_CHAR = { a: 'addition', s: 'subtraction', m: 'multiplication', d: 'division' }

/**
 * Written on the assumption the child is reading over a shoulder — because
 * they will be. No red, no percentages as headlines, no comparison to other
 * children, and no word from {behind, weak, poor, struggling}. Gaps are stated
 * as what's next, never as what's missing.
 */
export default function TrophyScreen() {
  const { state, dispatch, resetProgress } = useGame()
  const { t, locale, setLocale } = useTranslation()
  const { mastery } = state
  const working = workingOn(mastery, 5)

  function handleReset() {
    if (window.confirm(t('trophy.resetConfirm'))) resetProgress()
  }

  function chooseLocale(next) {
    setLocale(next)
    dispatch({ type: 'SET_SETTING', key: 'locale', value: next })
  }

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '2rem', marginBottom: 10 }}>{t('trophy.title')}</h1>

      <div className="trophy-card">
        <div className="stat-grid">
          <div className="stat-box" style={{ background: '#fff9e6' }}>
            <div style={{ fontSize: '1.8rem' }}>⚽</div>
            <div className="stat-number" style={{ color: '#a35f00' }}>{mastery.agg.goals}</div>
            <div className="stat-label">{t('trophy.goalsScored')}</div>
          </div>
          <div className="stat-box" style={{ background: '#e8f5e9' }}>
            <div style={{ fontSize: '1.8rem' }}>🧠</div>
            <div className="stat-number" style={{ color: '#166b39' }}>{masteredCount(mastery)}</div>
            <div className="stat-label">{t('trophy.factsKnown')}</div>
          </div>
        </div>

        {mastery.agg.bestStreak > 0 && (
          <p className="best-streak">
            {t('trophy.bestRun')}: <b>{mastery.agg.bestStreak}</b> {t('trophy.inARow')}
          </p>
        )}

        <div className="unlock-title">{t('trophy.whereUpTo')}</div>
        {OP_ORDER.map(op => {
          const pct = Math.round(opProgress(mastery, op) * 100)
          const acc = recentAccuracy(mastery, op)
          const recent = mastery.r[op] ?? []
          return (
            <div key={op} className="unlock-row">
              <span className="unlock-icon">{OPS[op].icon}</span>
              <div className="unlock-info">
                <div className="unlock-name">{opName(op)}</div>
                <div className="prog-bar-bg" style={{ height: 10, marginTop: 4 }}>
                  <div className="prog-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                {acc !== null && (
                  // A count of N, not a percentage — percentages read as grades
                  <div className="prog-sub">
                    {t('trophy.firstTry', { n: Math.round(acc * recent.length), total: recent.length })}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {working.length > 0 && (
          <>
            <div className="unlock-title" style={{ marginTop: 16 }}>{t('trophy.workingOn')}</div>
            <ul className="working-list">
              {working.map(w => {
                const [a, b] = w.key.slice(1).split('.').map(Number)
                const op = OP_OF_CHAR[w.key[0]]
                const ans = op === 'addition' ? a + b : op === 'subtraction' ? a - b
                          : op === 'multiplication' ? a * b : a / b
                // Pair every "working on" item with the strategy the app
                // teaches, so a parent can practise it the same way
                const hint = op ? getHint({ op, a, b, ans }) : null
                return (
                  <li key={w.key}>
                    <b>{labelForKey(w.key)}</b>
                    {hint && (
                      <span className="working-hint">
                        {t('trophy.tryLabel')} {hint.label} — {hint.steps}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <div className="lang-row">
          <span className="lang-label">{t('trophy.language')}</span>
          {Object.entries(LOCALE_NAMES).map(([code, name]) => (
            <button
              key={code}
              className={`lang-btn${locale === code ? ' active' : ''}`}
              aria-pressed={locale === code}
              onClick={() => chooseLocale(code)}
            >
              {name}
            </button>
          ))}
        </div>

        <button onClick={handleReset} className="reset-btn">{t('trophy.reset')}</button>
      </div>

      <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'menu' })}>
        {t('common.back')}
      </button>
    </div>
  )
}
