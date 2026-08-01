import { useEffect, useRef, useCallback, useState } from 'react'
import { useGame } from '../state/GameContext'
import { OPS } from '../game/config'
import { boxName } from '../game/mastery'
import { t } from '../i18n'
import { useTranslation } from '../i18n/useTranslation'
import { useDeadline } from '../hooks/useDeadline'
import { sfx } from '../audio/sfx'
import { banter } from '../game/banter'
import Player from './Player'
import Goal from './Goal'
import Confetti from './Confetti'
import HintCard from './HintCard'
import SeasonalDecoration from './SeasonalDecoration'
import { resolveTheme } from '../game/theme'

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
  // Snabbskott (arcade): near-zero by design — the whole point is throughput.
  // A miss still holds the correct answer for a beat, per pedagogy review: an
  // unsignalled wrong answer that recurs later in the same run is how a wrong
  // association gets built, so it isn't kindness being dropped, it's error
  // correction.
  arcadeFlight: 90,
  arcadeHit:    250,
  arcadeMiss:   500,
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
  const [typed, setTyped] = useState('')
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
  const arcade = r?.mode === 'arcade'
  const reduced = prefersReducedMotion()

  /* ── Clock (shootout: per-kick. arcade: one clock for the whole round) ── */

  const onExpire = useCallback(() => {
    sfx.whistleFlat()
    dispatch({ type: 'TIMEOUT' })
  }, [dispatch])

  /* The Snabbskott clock never ends anything by itself — it marks the round
     and the whistle still lets whatever item is showing be finished. See
     ARCADE_EXPIRE in the reducer. */
  const onArcadeExpire = useCallback(() => {
    sfx.whistleFlat()
    dispatch({ type: 'ARCADE_EXPIRE' })
  }, [dispatch])

  const { barRef, secondsLeft, paused, resume, extend } = useDeadline({
    durationMs: arcade ? r.timerMs : (shootout && r?.phase === 'asking' && !r?.timedOut ? r.timerMs : null),
    // Shootout pauses its clock between kicks (the rebound is never timed).
    // Arcade runs one continuous clock for the whole round — pausing it
    // between items would make the score depend on the resolve/celebrate
    // beat length rather than on the child.
    running: arcade || (shootout && r?.phase === 'asking' && !r?.timedOut),
    onExpire: arcade ? onArcadeExpire : onExpire,
    generation: arcade ? 'arcade' : (r?.kickIdx ?? 0),
  })

  /* Two discrete urgency marks rather than a per-second tick. Arcade skips the
     tone (the item beats are already a steady stream of clicks/thuds) but
     keeps the same non-red visual ramp. */
  useEffect(() => {
    if (!(shootout || arcade) || secondsLeft == null || !r?.timerMs) { setUrgency(0); return }
    const frac = (secondsLeft * 1000) / r.timerMs
    if (frac <= 0.2 && urgency < 2) { setUrgency(2); if (!arcade) sfx.urgent2() }
    else if (frac <= 0.4 && urgency < 1) { setUrgency(1); if (!arcade) sfx.urgent1() }
  }, [secondsLeft, shootout, arcade, r?.timerMs, urgency])

  useEffect(() => { setUrgency(0); extendedRef.current = false; setTyped('') }, [r?.kickIdx])

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

    if (r.mode === 'arcade') {
      // Near-zero beats and quiet sfx by design: the point is throughput, and
      // the big goal fanfare + confetti eighteen times a minute would be
      // sensory overload competing with the next prompt. The full celebration
      // is saved for a new personal best, on the result screen.
      schedule(() => {
        if (scored) sfx.click(); else sfx.thud()
        dispatch({ type: 'CELEBRATE' })
      }, reduced ? 80 : BEATS.arcadeFlight)
      schedule(advance, reduced ? 250 : (scored ? BEATS.arcadeHit : BEATS.arcadeMiss))
      skipArmedAt.current = null   // pace is already fast; tap-to-skip would only misfire
      return
    }

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
  // Arcade's beats are already close to the skip floor, so tap-to-skip is
  // never armed for it (see the resolution effect) — don't advertise an
  // affordance that would silently do nothing.
  const skippable = (phase === 'resolving' || phase === 'celebrating') && r.mode !== 'arcade'

  function answerState(opt) {
    // Arcade never enters `reveal`/`rebound` — a miss still resolves through
    // `resolving`/`celebrating`, so it needs its own check here, or the
    // generic "chosen === correct" rule below would paint the child's WRONG
    // tap green just because it was the one they chose.
    if (r.mode === 'arcade') {
      if (!r.arcadeMiss) {
        return (phase === 'resolving' || phase === 'celebrating') && opt === r.chosen ? 'correct' : ''
      }
      if (opt === question.ans) return 'reveal'
      if (opt === r.chosen) return 'spent'
      return 'dim'
    }
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
        {/* Arcade's queue is a hundred-odd tiled items long — dots would be
            noise. A live count is the only progress marker that means
            anything when the clock, not the queue, ends the round. */}
        {arcade && (
          <span className="arcade-score" aria-live="polite">
            {t('arcade.liveScore', { n: r.goals })}
          </span>
        )}
        {!arcade && (
          <div
            className="kick-dots"
            role="img"
            aria-label={t('game.dotsLabel', { n: r.kickIdx + 1, total: totalKicks, results: describeDots(r.results) })}
          >
            {r.mode !== 'gate' && Array.from({ length: Math.max(totalKicks, r.results.length) }, (_, i) => (
              <div
                key={i}
                className={`dot ${r.results[i] ?? ''}${i === r.kickIdx ? ' current' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
        {/* A gate must be bounded and visible — 20 dots would be unreadable, so
            it gets the counter that normal rounds no longer need. */}
        {r.mode === 'gate' && (
          <span>{t('gate.progress', { n: r.kickIdx + 1, total: totalKicks })}</span>
        )}
      </div>

      {/* Pitch */}
      <div
        className={`stage${phase === 'celebrating' && r.results.at(-1) !== 'miss' ? ' shake' : ''}`}
        onClick={skipAhead}
        role={skippable ? 'button' : undefined}
        tabIndex={skippable ? 0 : undefined}
        aria-label={skippable ? t('game.tapNext') : undefined}
      >
        {/* The clock is tappable in Shootout: adding time was keyboard-only,
            so on a tablet the only option was removing the clock entirely —
            an all-or-nothing choice where a graded one already existed in the
            code. Arcade's clock is not tappable: it's a fixed, published
            duration, and "extending" a throughput score is incoherent — the
            whole point is that it's the same 30 seconds every time. */}
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
        {arcade && (
          <div className="shot-clock" data-urgency={urgency} aria-hidden="true">
            <div className="shot-clock-fill" ref={barRef} />
          </div>
        )}

        <div className="pitch-scene">
          <SeasonalDecoration theme={resolveTheme(state.settings.pitchTheme)} />
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
      {/* No hint mechanism in arcade — there's no time to read one, and the
          same fact simply comes round again later in the run. */}
      {!arcade && (
        <div className="hint-slot">
          {r.hint
            ? <HintCard hint={r.hint} diagnosis={phase === 'reveal' ? r.diagnosis : null} />
            : phase === 'asking' && (
                <button className="link-btn" onClick={() => dispatch({ type: 'SHOW_HINT' })}>
                  {t('game.showTrick')}
                </button>
              )}
        </div>
      )}

      {question.format === 'entry' ? (
        <div className="entry">
          <div className="entry-display" aria-live="polite">{typed || '·'}</div>
          <div className="keypad">
            {[1,2,3,4,5,6,7,8,9,0].map(d => (
              <button
                key={d}
                className="key"
                disabled={!accepting}
                onClick={() => setTyped(v => (v + d).slice(0, 3))}
              >{d}</button>
            ))}
            <button className="key key-wide" disabled={!accepting} onClick={() => setTyped('')}>
              ⌫
            </button>
            <button
              className="key key-go"
              disabled={!accepting || !typed}
              onClick={() => { sfx.click(); answer(Number(typed)) }}
            >
              ⚽
            </button>
          </div>
        </div>
      ) : (
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
      )}

      {/* Free entry feels harder, and a child who isn't told why reads that as
          going backwards. Say it before they conclude it. */}
      {question.format === 'entry' && phase === 'asking' && (
        <p className="entry-note">{t('game.entryNote')}</p>
      )}

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

  if (r.mode === 'arcade') {
    // At this pace a per-item line would be unreadable, and would be gone
    // before it could be — so arcade stays silent except for the one line
    // that matters: a heads-up before the last ball, never a jarring cut.
    if (r.arcadeExpiring && r.phase === 'asking') return { type: 'timeout', text: t('arcade.lastBall') }
    return { type: '', text: '' }
  }

  if (r.phase === 'rebound') return { type: 'rebound', text: t('game.parried') }
  if (r.phase === 'reveal')  return { type: 'reveal',  text: t('game.reveal', { ans: r.question.ans }) }
  if (r.timedOut && r.phase === 'asking') return { type: 'timeout', text: t('game.timeout') }

  if (r.phase === 'resolving' || r.phase === 'celebrating') {
    if (last === 'timeout-goal') return { type: 'goal',   text: t('game.goalRetake') }
    if (last === 'rebound')      return { type: 'goal',   text: t('game.goalRebound') }
    if (last === 'miss') {
      // Name the level it drops to. Silent demotion is the thing that reads as
      // punishment; a squad move is just what happens to real players.
      const lvl = t(`box.${boxName(r.demotedTo ?? 0)}`)
      return { type: 'reveal', text: t('box.demoted', { name: lvl }) }
    }
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
