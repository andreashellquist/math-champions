import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { OPS, OP_ORDER, opName } from '../game/config'
import {
  masteredCount, workingOn, labelForKey, recentAccuracy, dominantErrorFamily,
  boxName, seasonComplete, currentCompetition, headToHead,
} from '../game/mastery'
import { getHint } from '../game/hints'
import { getRival } from '../game/rivals'
import { exportBackup, importBackup } from '../game/storage'
import { useRef, useState } from 'react'

const OP_OF_CHAR = { a: 'addition', s: 'subtraction', m: 'multiplication', d: 'division' }

/**
 * Parent / teacher view, behind `?parent=1`.
 *
 * Every string is written assuming the child is reading over a shoulder,
 * because they will be. The rules this screen obeys:
 *
 *  - No red. No age or grade norms. No comparison to other children.
 *  - Counts of N, never a bare percentage — a percentage reads as a grade.
 *  - Deficits stated as *what's next*, never as *what's missing*, and every
 *    "working on" item paired with the strategy the app actually teaches, so a
 *    parent can practise it the same way.
 *  - No word from {behind, weak, poor, failing, struggling}.
 *  - Shootout appears as participation only. Publish a timed score to a parent
 *    and some will start drilling the timed mode, which is the exact failure
 *    this design avoids.
 */
export default function ParentView() {
  const { state } = useGame()
  const { t } = useTranslation()
  const { mastery } = state

  const fileRef = useRef(null)
  const [status, setStatus] = useState(null)

  function download() {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mattemastarna-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus('exported')
  }

  async function restore(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const result = importBackup(await file.text())
    setStatus(result.ok ? 'imported' : result.reason)
    if (result.ok) window.location.reload()
  }

  const known = masteredCount(mastery)
  const working = workingOn(mastery, 6)
  const errorFamily = dominantErrorFamily(mastery)
  const comp = currentCompetition(mastery)

  /** Latency trend as a direction only — never a raw figure, never a norm */
  const speed = (() => {
    const l = mastery.l ?? []
    if (l.length < 10) return null
    const early = l.slice(0, Math.floor(l.length / 2))
    const late = l.slice(-Math.floor(l.length / 2))
    const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length
    const delta = avg(early) - avg(late)
    if (delta > 400) return 'quicker'
    if (delta < -400) return 'slower'
    return 'steady'
  })()

  /** Of the misses the child had a second go at, how many did they then get? */
  const reboundRate = (() => {
    const misses = Object.values(mastery.f).reduce((n, rec) => n + rec[3], 0)
    if (!misses) return null
    return { fixed: Math.max(0, mastery.agg.seen - mastery.agg.correct - misses), misses }
  })()

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.7rem' }}>{t('parent.title')}</h1>
      <p className="subtitle">{t('parent.subtitle')}</p>

      <div className="trophy-card">
        {/* 1 — what the child can now do */}
        <div className="stat-grid">
          <div className="stat-box" style={{ background: '#e8f5e9' }}>
            <div className="stat-number" style={{ color: '#166b39' }}>{known}</div>
            <div className="stat-label">{t('parent.automatic')}</div>
          </div>
          <div className="stat-box" style={{ background: '#fff9e6' }}>
            <div className="stat-number" style={{ color: '#a35f00' }}>{mastery.agg.rounds}</div>
            <div className="stat-label">{t('parent.rounds')}</div>
          </div>
        </div>

        {/* 2 — first-try accuracy as a count of N, per operation */}
        <div className="unlock-title">{t('parent.firstTryTitle')}</div>
        {OP_ORDER.map(op => {
          const recent = mastery.r[op] ?? []
          const acc = recentAccuracy(mastery, op)
          if (acc === null) {
            return (
              <p key={op} className="parent-line">
                {OPS[op].icon} {opName(op)} — {t('parent.notStarted')}
              </p>
            )
          }
          return (
            <p key={op} className="parent-line">
              {OPS[op].icon} {opName(op)} —{' '}
              {t('parent.firstTry', { n: Math.round(acc * recent.length), total: recent.length })}
            </p>
          )
        })}

        {/* 3 — speed as a direction, never a number */}
        {speed && (
          <p className="parent-line">⏱️ {t(`parent.speed.${speed}`)}</p>
        )}

        {/* 4 — did the hints land? */}
        {reboundRate && (
          <p className="parent-line">🧠 {t('parent.rebound')}</p>
        )}

        {/* 5 — what's next, with the strategy attached */}
        {working.length > 0 && (
          <>
            <div className="unlock-title" style={{ marginTop: 14 }}>{t('parent.workingOn')}</div>
            <ul className="working-list">
              {working.map(w => {
                const [a, b] = w.key.slice(1).split('.').map(Number)
                const op = OP_OF_CHAR[w.key[0]]
                const ans = op === 'addition' ? a + b : op === 'subtraction' ? a - b
                          : op === 'multiplication' ? a * b : a / b
                const hint = op ? getHint({ op, a, b, ans }) : null
                return (
                  <li key={w.key}>
                    <b>{labelForKey(w.key)}</b>
                    <span className="working-hint">
                      {t('box.at', { name: t(`box.${boxName(w.box)}`) })}
                      {hint && ` · ${hint.label} — ${hint.steps}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {/* 6 — the error pattern, made actionable */}
        {errorFamily && (
          <p className="parent-note">💡 {t(`parent.error.${errorFamily}`)}</p>
        )}

        {/* 7 — where they are in the season, participation only */}
        <div className="unlock-title" style={{ marginTop: 14 }}>{t('parent.season')}</div>
        <p className="parent-line">
          {seasonComplete(mastery)
            ? t('parent.seasonDone', { n: mastery.rivalry.season })
            : t('parent.seasonAt', {
                season: mastery.rivalry?.season ?? 1,
                comp: t(`season.comp.${comp?.id ?? 'cup'}`),
                won: headToHead(mastery, comp?.rival)[0],
                rival: t(getRival(comp?.rival)?.nameKey ?? 'rivals.red_devil'),
              })}
        </p>
      </div>

      {/* Progress lives in this browser's localStorage — there is no account
          and no sync, so moving devices means moving the file by hand. */}
      <div className="trophy-card" style={{ marginTop: 12 }}>
        <div className="unlock-title">{t('parent.backup')}</div>
        <p className="parent-line">{t('parent.backupNote')}</p>
        <div className="result-links">
          <button className="btn btn-white" onClick={download}>{t('parent.export')}</button>
          <button className="btn btn-white" onClick={() => fileRef.current?.click()}>
            {t('parent.import')}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={restore}
        />
        {status && <p className="parent-note">{t(`parent.${status}`)}</p>}
      </div>

      <p className="hint-note">{t('parent.footer')}</p>
    </div>
  )
}
