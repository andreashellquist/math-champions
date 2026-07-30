import { useEffect, useRef, useCallback, useState } from 'react'
import { useGame } from '../state/GameContext'
import { OPS, opName } from '../game/config'
import { t } from '../i18n'
import { useTranslation } from '../i18n/useTranslation'
import { useDeadline } from '../hooks/useDeadline'
import { sfx } from '../audio/sfx'
import { banter } from '../game/banter'
import Player from './Player'
import Goal from './Goal'
import Confetti from './Confetti'
import HintCard from './HintCard'

/**
 * Beats, in ms.
 *
 * These were nearly twice as long, which meant ~1.9s per kick — about 14% of a
 * session — where the child physically could not act. The informational
 * feedback is already at 0ms (the button turns green, the wrong option greys
 * out); everything after that is reward theatre, so it isn't protected by the
 * perception floor.
 *
 * `resolve` MUST match the `.ball.shoot` duration in App.css, which it
 * previously didn't — the ball landed 180ms before the game reacted to it.
 *
 * Floors, below which the outcome stops registering as caused by the child:
 * 350ms of outcome on screen, 250ms before a skip gesture is accepted, 600ms
 * to read a short feedback line.
 */
const BEATS = {
  resolve:     420,   // ball flight — keep in sync with .ball.shoot
  next:        1020,  // flight + 600ms to read the feedback
  nextTimeout: 1250,  // longer copy, and a retake needs understanding
  nextReveal:  1400,  // the one beat genuinely worth keeping long
  skipFloor:   250,   // below this, a stage tap is the answer tap bouncing
}

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function GameScreen() {
  const { state, dispatch, advance, answer, keeperId, rival, totalKicks } = useGame()
  useTranslation()   // re-render on locale change
  const r = state.round
  const [confettiKey, setConfettiKey] = useState(0)
  const [urgency, setUrgency] = useState(0)
  const [line, setLine] = useState(null)
  const [keyboardSeen, setKeyboardSeen] = useState(false)
  const questionRef = useRef(null)
  const skipArmedAt = useRef(null)
  const extendedRef = useRef(false)

  /* Every timeout goes through here so they can all be cancelled on unmount.
     The old code created four bare setTimeouts per kick with no handles, so
     any early exit fired state updates after unmount. */
  const timers = useRef([])
  const schedule = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }, [])
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])
  useEffect(() => clearTimers, [clearTimers])

  const shootout = r?.mode === 'shootout' && !r?.clockOff
  const reduced = prefersReducedMotion()

  /* ── Clock (shootout only) ─────────────────────────────── */

  const onExpire = useCallback(() => {
    sfx.whistleFlat()
    dispatch({ type: 'TIMEOUT' })
  }, [dispatch])

  const { barRef, secondsLeft, paused, resume, extend } = useDeadline({
    durationMs: shootout && r?.phase === 'asking' && !r?.timedOut ? r.timerMs : null,
    running: r?.phase === 'asking' && !r?.timedOut,
    onExpire,
    generation: r?.kickIdx ?? 0,
  })

  /* Two discrete urgency marks rather than a per-second tick */
  useEffect(() => {
    if (!shootout || secondsLeft == null || !r?.timerMs) { setUrgency(0); return }
    const frac = (secondsLeft * 1000) / r.timerMs
    if (frac <= 0.2 && urgency < 2) { setUrgency(2); sfx.urgent2() }
    else if (frac <= 0.4 && urgency < 1) { setUrgency(1); sfx.urgent1() }
  }, [secondsLeft, shootout, r?.timerMs, urgency])

  useEffect(() => { setUrgency(0); extendedRef.current = false }, [r?.kickIdx])

  /* The rival greets at kick-off and applauds a goal — and says nothing at all
     when the child misses. See game/banter.js. */
  useEffect(() => {
    if (!r || r.mode !== 'fixture') { setLine(null); return }
    if (r.phase === 'asking' && r.kickIdx === 0 && r.attempt === 1) {
      setLine(banter('greet', rival))
    } else if (r.phase === 'celebrating' && r.results.at(-1) !== 'miss') {
      setLine(banter('beaten', rival))
    } else if (r.phase === 'asking') {
      setLine(null)
    }
  }, [r?.phase, r?.kickIdx, r?.mode, rival])

  /* ── Kick resolution ───────────────────────────────────── */

  useEffect(() => {
    if (!r || r.phase !== 'resolving') return
    clearTimers()

    const scored = r.results[r.results.length - 1] !== 'miss'
    const timedOut = r.timedOut
    const flight = reduced ? 120 : BEATS.resolve

    schedule(() => {
      if (timedOut) sfx.scuff()
      else if (scored) { sfx.goal(); setConfettiKey(k => k + 1) }
      else sfx.thud()
      dispatch({ type: 'CELEBRATE' })
    }, flight)

    const missed = r.results.at(-1) === 'miss'
    const hold = reduced ? 700
      : timedOut ? BEATS.nextTimeout
      : missed ? BEATS.nextReveal
      : BEATS.next
    schedule(advance, hold)

    // Let the child outrun the animation. This is a self-pacing device, not a
    // shortcut: a child who taps has told us they don't need the beat, and a
    // child who wants to watch the goal still watches it.
    // Date.now rather than performance.now: this is a 250ms UI guard, drift is
    // irrelevant, and it stays testable under fake timers.
    skipArmedAt.current = Date.now() + BEATS.skipFloor
    // Deliberately no cleanup nulling this. The effect re-runs when the phase
    // becomes `celebrating`, and disarming there would kill the skip in the
    // 600ms window where the child is most likely to use it.
  }, [r?.phase, r?.kickIdx])   // eslint-disable-line react-hooks/exhaustive-deps

  /* Auto-resolve the reveal. The retrieval attempt has already been made twice;
     the third tap is encoding support, and encoding support a child refuses is
     worth nothing. So it becomes an invitation with a deadline rather than a
     gate they cannot pass. The mastery consequence is identical either way. */
  useEffect(() => {
    if (r?.phase !== 'reveal') return
    const id = setTimeout(() => dispatch({ type: 'ACKNOWLEDGE_REVEAL' }), 4000)
    timers.current.push(id)
    return () => clearTimeout(id)
  }, [r?.phase, r?.kickIdx, dispatch])

  /* Focus the question, not an answer button — a screen reader user should
     hear the problem before the options. */
  useEffect(() => {
    if (r?.phase === 'asking') questionRef.current?.focus({ preventScroll: true })
  }, [r?.kickIdx, r?.phase])

  /* ── Keyboard ──────────────────────────────────────────── */

  useEffect(() => {
    if (!r) return
    const onKey = e => {
      setKeyboardSeen(true)
      if (e.key === 'Escape') { dispatch({ type: 'NAVIGATE', screen: 'menu' }); return }
      if (e.key === ' ' || e.key === '+') {
        if (shootout && r.timerMs) { e.preventDefault(); extend(r.timerMs) }
        return
      }
      const idx = Number(e.key) - 1
      if (Number.isInteger(idx) && idx >= 0 && idx < (r.question?.opts.length ?? 0)) {
        const value = r.question.opts[idx]
        if (r.phase === 'reveal') {
          if (value === r.question.ans) dispatch({ type: 'ACKNOWLEDGE_REVEAL' })
        } else {
          answer(value)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [r, answer, dispatch, shootout, extend])

  /** Tap the pitch to move on. Armed 250ms in, so it can't be the answer tap
      bouncing. Never armed during `reveal` — that beat is already tap-gated. */
  const skipAhead = useCallback(() => {
    const ph = r?.phase
    // Only ever active while an outcome is playing out — never during `asking`
    // (a stray pitch tap must not skip a question) and never during `reveal`.
    if (ph !== 'resolving' && ph !== 'celebrating') return
    if (!skipArmedAt.current || Date.now() < skipArmedAt.current) return
    skipArmedAt.current = null
    clearTimers()
    if (ph === 'resolving') dispatch({ type: 'CELEBRATE' })
    advance()
  }, [r?.phase, advance, dispatch, clearTimers])

  if (!r) return null

  const { question, phase } = r
  const accepting = phase === 'asking' || phase === 'rebound' || phase === 'reveal'

  function handleTap(value) {
    sfx.click()
    if (phase === 'reveal') {
      if (value === question.ans) dispatch({ type: 'ACKNOWLEDGE_REVEAL' })
      return
    }
    answer(value)
  }

  /* ── Presentation ──────────────────────────────────────── */

  const strikerPose =
    phase === 'celebrating' && r.results.at(-1) !== 'miss' ? 'celebrate'
    : phase === 'celebrating' ? 'dejected'
    : phase === 'resolving' ? 'kick'
    : 'idle'

  /* A miss must never read as the opponent winning. He parries and returns to
     his line — no held dive, no expression change, nothing that turns the
     child's knowledge gap into a social loss. Only a *goal* moves him. */
  const keeperPose =
    phase === 'celebrating' && r.results.at(-1) !== 'miss' && !r.timedOut ? 'beaten'
    : phase === 'resolving' && r.results.at(-1) === 'miss'
      ? (r.dive === 'left' ? 'dive-left' : 'dive-right')
    : 'ready'

  const ballClass = phase === 'resolving' || phase === 'celebrating'
    ? `ball shoot traj-${r.timedOut ? 'scuffed' : r.trajectory}`
    : 'ball'

  const feedback = buildFeedback(r)
  const skippable = phase === 'resolving' || phase === 'celebrating'

  function answerState(opt) {
    if (phase === 'reveal' && opt === question.ans) return 'reveal'
    if (r.disabled.includes(opt)) return 'spent'
    if (phase === 'reveal' || r.timedOut) return 'dim'
    if ((phase === 'resolving' || phase === 'celebrating') && opt === r.chosen) return 'correct'
    return ''
  }

  return (
    <div className="screen game-screen" data-streak={Math.min(r.streak, 5)}>
      {/* Round bar */}
      <div className="round-bar">
        <span className="op-label">
          {OPS[r.op].icon}
          {r.mode === 'fixture' && <em className="derby-tag">vs {t(rival.nameKey)}</em>}
        </span>
        <div
          className="kick-dots"
          role="img"
          aria-label={t('game.dotsLabel', { n: r.kickIdx + 1, total: totalKicks, results: describeDots(r.results) })}
        >
          {Array.from({ length: Math.max(totalKicks, r.results.length) }, (_, i) => (
            <div
              key={i}
              className={`dot ${r.results[i] ?? ''}${i === r.kickIdx ? ' current' : ''}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {/* Pitch */}
      <div
        className={`stage${phase === 'celebrating' && r.results.at(-1) !== 'miss' ? ' shake' : ''}`}
        onClick={skipAhead}
        role={skippable ? 'button' : undefined}
        tabIndex={skippable ? 0 : undefined}
        aria-label={skippable ? t('game.tapNext') : undefined}
      >
        {/* The clock is tappable: adding time was keyboard-only, so on a tablet
            the only option was removing the clock entirely — an all-or-nothing
            choice where a graded one already existed in the code. */}
        {shootout && (
          <button
            className="shot-clock"
            data-urgency={urgency}
            onClick={e => { e.stopPropagation(); if (!extendedRef.current) { extendedRef.current = true; extend(r.timerMs) } }}
            aria-label={t('game.addTime')}
          >
            <div className="shot-clock-fill" ref={barRef} />
          </button>
        )}

        <div className="pitch-scene">
          <div className="kicker-wrap">
            <Player
              id={state.settings.character}
              pose={strikerPose}
              size={78}
              animate={!reduced}
            />
          </div>

          <div className={ballClass}>⚽</div>

          <div className="goal-wrap">
            <Goal width={200}>
              <Player id={keeperId} role="keeper" pose={keeperPose} size={92} facing="left" animate={!reduced} />
            </Goal>
          </div>

          <div className="grass" />
          <div className="penalty-spot" />
          {skippable && <span className="skip-hint">{t('game.tapNext')}</span>}
        </div>
      </div>

      {line && <p className="banter">{line}</p>}

      {/* Question */}
      <div className="question-box" ref={questionRef} tabIndex={-1}>
        {question.prompt}
      </div>

      {/* Reserved height so the answer buttons never shift when a hint appears.
          Costs ~96px on every kick; a tap target that moves mid-question is
          worse for everyone, and much worse with poor motor inhibition. */}
      <div className="hint-slot">
        {r.hint
          ? <HintCard hint={r.hint} diagnosis={phase === 'reveal' ? r.diagnosis : null} />
          : phase === 'asking' && (
              <button className="link-btn" onClick={() => dispatch({ type: 'SHOW_HINT' })}>
                {t('game.showTrick')}
              </button>
            )}
      </div>

      {/* Answers */}
      <div className="answers" data-count={question.opts.length}>
        {question.opts.map((opt, i) => (
          <button
            key={`${opt}-${i}`}
            className={`ans-btn ${answerState(opt)}`}
            onClick={() => handleTap(opt)}
            disabled={!accepting || r.disabled.includes(opt)}
          >
            {keyboardSeen && <span className="ans-key" aria-hidden="true">{i + 1}</span>}
            {opt}
          </button>
        ))}
      </div>

      {/* Feedback — a live region so the outcome is announced */}
      <div className={`feedback ${feedback.type}`} role="status" aria-live="polite" aria-atomic="true">
        {feedback.text}
      </div>

      <button
        className="link-btn subtle"
        onClick={() => { clearTimers(); dispatch({ type: 'END_ROUND' }) }}
      >
        {t('game.stopHere')}
      </button>

      {shootout && (
        <button className="link-btn subtle" onClick={() => dispatch({ type: 'CLOCK_OFF' })}>
          {t('game.clockOff')}
        </button>
      )}

      {paused && (
        <div className="pause-veil">
          <p>{t('game.paused')}</p>
          <button className="btn btn-gold" onClick={resume}>{t('game.ready')}</button>
        </div>
      )}

      <Confetti trigger={confettiKey} />
    </div>
  )
}

/* ── COPY ───────────────────────────────────────────────────
   No "Saved!", no "Wrong". A miss is a parry with the ball still live; a
   timeout is the clock's doing, not the child's.
   ───────────────────────────────────────────────────────── */

function buildFeedback(r) {
  const last = r.results.at(-1)

  if (r.phase === 'rebound') return { type: 'rebound', text: t('game.parried') }
  if (r.phase === 'reveal')  return { type: 'reveal',  text: t('game.reveal', { ans: r.question.ans }) }
  if (r.timedOut && r.phase === 'asking') return { type: 'timeout', text: t('game.timeout') }

  if (r.phase === 'resolving' || r.phase === 'celebrating') {
    if (last === 'timeout-goal') return { type: 'goal',   text: t('game.goalRetake') }
    if (last === 'rebound')      return { type: 'goal',   text: t('game.goalRebound') }
    if (last === 'miss')         return { type: 'reveal', text: t('game.revealDone', { ans: r.question.ans }) }
    if (r.flourish === 'screamer') return { type: 'goal', text: t('game.goalScreamer') }
    if (r.flourish === 'glove')    return { type: 'goal', text: t('game.goalGlove') }
    return { type: 'goal', text: t('game.goal') }
  }
  return { type: '', text: '' }
}

function describeDots(results) {
  if (!results.length) return t('game.noKicks')
  return results
    .map(x => (x === 'miss' ? t('game.resultMiss')
      : x === 'rebound' ? t('game.resultRebound') : t('game.resultGoal')))
    .join(', ')
}
