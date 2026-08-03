import { useEffect, useRef, useState } from 'react'
import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { masteredCount } from '../game/mastery'
import { weekId, loadWeek, saveWeek } from '../game/storage'

/**
 * The week's delta.
 *
 * The unit of visible progress is what moved *this week*, not the cumulative
 * total: "38% complete" invites grinding and renders a 62%-shaped deficit,
 * while "6 new facts went automatic this week" is true, specific, and
 * re-earnable every week.
 *
 * Deliberately not compared to last week's number — that manufactures a streak.
 * A thin week is reported without evaluation.
 */
export default function WeeklyCard({ onClose }) {
  const { state } = useGame()
  const { t } = useTranslation()
  const [snapshot] = useState(() => {
    const id = weekId()
    const prev = loadWeek()
    const now = masteredCount(state.mastery)
    if (!prev || prev.id !== id) {
      return { delta: null, next: { id, mastered: now, shown: true }, close: true }
    }
    if (prev.shown) return { delta: null, next: null, close: true }
    return { delta: Math.max(0, now - prev.mastered), next: { ...prev, shown: true }, close: false }
  })
  /* Runs exactly once. Without this the effect re-fires (the parent passes an
     inline onClose, so its identity changes every render), reads back its own
     `shown: true`, and dismisses the card it just opened. */
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    if (snapshot.next) saveWeek(snapshot.next)
    if (snapshot.close) onClose?.()
  }, [snapshot, onClose])

  if (snapshot.delta === null) return null

  return (
    <div className="weekly-card" role="dialog" aria-label={t('week.title')}>
      <h2 className="result-title">{t('week.title')}</h2>
      <p className="week-big">{snapshot.delta}</p>
      <p className="result-msg">
        {snapshot.delta > 0 ? t('week.gained', { n: snapshot.delta }) : t('week.thin')}
      </p>
      <button className="btn btn-gold" onClick={onClose}>{t('week.ok')}</button>
    </div>
  )
}
