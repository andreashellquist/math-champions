import { useMemo, useState } from 'react'
import { useGame } from '../state/GameContext'
import { useTranslation } from '../i18n/useTranslation'
import { OPS, OP_ORDER, opName } from '../game/config'
import { STRANDS_BY_OP, factKey, answerOf } from '../game/facts'
import { MASTERED_BOX, masteredCount, strandProgress, labelForKey, workingOn } from '../game/mastery'
import { getHint } from '../game/hints'

/**
 * "Din plan" — your pitch.
 *
 * The framing matters more than the layout: this is **turf you have grown**,
 * not a score you have earned. An empty square is unplanted, not wrong. That
 * is what stops a 250-cell grid reading as a report card of everything the
 * child can't yet do — which is exactly what a completion percentage would
 * make it.
 *
 * So: no percentage headline, no miss counts, and we count what is grown,
 * never what is missing.
 */

/** Grid axes per operation. Multiplication and addition are symmetric, which
 *  makes commutativity visible for free. */
const GRIDS = {
  addition:       { rows: range(0, 10), cols: range(0, 10) },
  subtraction:    { rows: range(2, 18), cols: range(1, 9) },
  // 2..12 rather than 0..12: the ×0 and ×1 rows were 25 of 169 cells and
  // nobody practises them, so they diluted the whole signal.
  multiplication: { rows: range(2, 12), cols: range(2, 12) },
  division:       { rows: range(1, 10), cols: range(1, 10) },   // divisor × quotient
}

function range(a, b) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

/** Which fact a cell refers to — null when the ladder doesn't cover it */
function cellFact(op, r, c) {
  if (op === 'division') return { a: r * c, b: r }        // divisor r, quotient c
  if (op === 'subtraction') return r - c >= 0 ? { a: r, b: c } : null
  return { a: r, b: c }
}

export default function MasteryMap() {
  const { state, dispatch, startRound } = useGame()
  const { t } = useTranslation()
  const [op, setOp] = useState(state.selectedOp ?? 'addition')
  const [picked, setPicked] = useState(null)
  const [cursor, setCursor] = useState(0)

  const tracked = useMemo(() => {
    const set = new Map()
    for (const s of STRANDS_BY_OP[op] ?? []) {
      for (const f of s.facts) set.set(f.key, f)
    }
    return set
  }, [op])

  // Memoised on the fact table alone — the map must not rebuild on every
  // unrelated dispatch just because the context value is new.
  const boxes = useMemo(() => state.mastery.f, [state.mastery.f])

  const grid = GRIDS[op]
  const grown = useMemo(
    () => [...tracked.keys()].filter(k => (boxes[k]?.[0] ?? 0) > 0).length,
    [tracked, boxes],
  )

  const ladder = (STRANDS_BY_OP[op] ?? []).filter(s => !s.perFact)

  // The three facts worth practising next, from the same data the trophy
  // screen uses. This is what turns the map from a search task into a
  // reading task.
  const nextThree = useMemo(
    () => workingOn(state.mastery, 12).filter(w => tracked.has(w.key)).slice(0, 3),
    [state.mastery, tracked],
  )

  /** Open the sheet from a fact key rather than a grid position */
  function openKey(key) {
    const fact = tracked.get(key)
    if (!fact) return
    const ans = answerOf(fact)
    setPicked({ key, fact, ans, box: boxes[key]?.[0] ?? 0,
      hint: getHint({ op: fact.op, a: fact.a, b: fact.b, ans }) })
  }

  /** Arrow-key navigation with a roving tabindex — a 169-cell grid is
      otherwise unreachable without a pointer. */
  function onGridKey(e) {
    const cols = grid.cols.length
    const total = cols * grid.rows.length
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]
    if (delta === undefined) return
    e.preventDefault()
    const next = Math.max(0, Math.min(total - 1, cursor + delta))
    setCursor(next)
    e.currentTarget.querySelector(`[data-idx="${next}"]`)?.focus()
  }

  function openCell(r, c) {
    const raw = cellFact(op, r, c)
    if (!raw) return
    const key = factKey(op, raw.a, raw.b)
    const fact = tracked.get(key)
    if (!fact) return
    const ans = answerOf(fact)
    setPicked({ key, fact, ans, box: boxes[key]?.[0] ?? 0, hint: getHint({ op, a: fact.a, b: fact.b, ans }) })
  }

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.8rem' }}>{t('map.title')}</h1>
      <p className="subtitle">{t('map.grownSimple', { n: grown })}</p>

      {nextThree.length > 0 && (
        <div className="map-next">
          <span className="map-next-label">{t('map.nextThree')}</span>
          {nextThree.map(w => (
            <button key={w.key} className="map-chip" onClick={() => openKey(w.key)}>
              {labelForKey(w.key)}
            </button>
          ))}
        </div>
      )}

      <div className="map-tabs" role="tablist">
        {OP_ORDER.map(o => (
          <button
            key={o}
            role="tab"
            aria-selected={o === op}
            className={`map-tab${o === op ? ' active' : ''}`}
            onClick={() => { setOp(o); setPicked(null) }}
          >
            {OPS[o].icon}
          </button>
        ))}
      </div>

      <div className="mastery-grid-scroll">
      <div
        className="mastery-grid"
        role="grid"
        aria-label={t('map.gridLabel', { op: opName(op) })}
        style={{ '--cols': grid.cols.length, aspectRatio: `${grid.cols.length} / ${grid.rows.length}` }}
        onKeyDown={onGridKey}
      >
        {grid.rows.flatMap((r, ri) => grid.cols.map((c, ci) => {
          const idx = ri * grid.cols.length + ci
          const raw = cellFact(op, r, c)
          const key = raw && factKey(op, raw.a, raw.b)
          const known = key && tracked.has(key)
          const box = known ? (boxes[key]?.[0] ?? 0) : null
          const seen = known && boxes[key] !== undefined

          return (
            <button
              key={`${r}-${c}`}
              role="gridcell"
              className={`mm-cell${known ? '' : ' off'}${seen ? ' seen' : ''}`}
              data-box={seen ? box : undefined}
              disabled={!known}
              tabIndex={idx === cursor ? 0 : -1}
              data-idx={idx}
              onFocus={() => setCursor(idx)}
              aria-label={known
                ? t('map.cellLabel', { fact: labelForKey(key), box: seen ? box : 0 })
                : undefined}
              onClick={() => openCell(r, c)}
            />
          )
        }))}
      </div>
      </div>

      <ul className="map-key" aria-hidden="true">
        <li><i className="mm-cell" /> {t('map.unplanted')}</li>
        <li><i className="mm-cell seen" data-box="2" /> {t('map.growing')}</li>
        <li><i className="mm-cell seen" data-box="5" /> {t('map.solid')}</li>
      </ul>

      {ladder.length > 0 && (
        <div className="trophy-card" style={{ marginTop: 8 }}>
          <div className="unlock-title">{t('map.bigNumbers')}</div>
          {ladder.map(s => (
            <div key={s.id} className="unlock-row">
              <div className="unlock-info">
                <div className="unlock-name">{s.label}</div>
                <div className="prog-bar-bg" style={{ height: 10, marginTop: 4 }}>
                  <div
                    className="prog-bar-fill"
                    style={{ width: `${Math.round(strandProgress(state.mastery, s) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {picked && (
        <div className="cell-sheet" role="dialog" aria-label={labelForKey(picked.key)}>
          <p className="cell-fact">{labelForKey(picked.key)} = {picked.ans}</p>
          <p className="cell-hint"><b>{picked.hint.label}</b> — {picked.hint.steps}</p>
          <div className="cell-pips" aria-hidden="true">
            {[1, 2, 3, 4, 5].map(i => (
              <span key={i} className={`pip${picked.box >= i ? ' on' : ''}`} />
            ))}
          </div>
          <div className="result-links">
            <button className="btn btn-gold" onClick={() => startRound(op, { mode: 'training' })}>
              {t('map.practise')}
            </button>
            <button className="btn btn-white" onClick={() => setPicked(null)}>
              {t('map.close')}
            </button>
          </div>
        </div>
      )}

      <button className="btn btn-white" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'menu' })}>
        {t('common.back')}
      </button>
    </div>
  )
}

/** Total facts the ladder tracks, for the one-glance menu bar */
export function totalTrackedFacts() {
  return OP_ORDER.reduce(
    (n, op) => n + (STRANDS_BY_OP[op] ?? []).reduce((m, s) => m + s.facts.length, 0),
    0,
  )
}

export { MASTERED_BOX, masteredCount }
