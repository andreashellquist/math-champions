import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * The Shootout clock.
 *
 * Three deliberate choices:
 *
 * - **The truth is a deadline timestamp, never a decrementing counter.** A
 *   counter you subtract from accumulates drift and is unrecoverable after the
 *   tab is suspended. `performance.now()` rather than `Date.now()` because it
 *   is monotonic — immune to NTP corrections and to a child changing the
 *   iPad's clock.
 * - **CSS drives the visual, one `setTimeout` triggers expiry.** rAF is
 *   suspended in hidden tabs so it can't be the expiry trigger, and a rAF loop
 *   writing React state 60×/s would re-render the game every frame.
 *   Background throttling makes `setTimeout` fire *late*, never early, and
 *   lateness is harmless because the callback re-checks the clock.
 * - **Backgrounding pauses.** A child who locks the tablet mid-question must
 *   not come back to an expired clock.
 */
export function useDeadline({ durationMs, running, onExpire, onAutoPause, generation = 0 }) {
  const deadlineRef = useRef(null)
  const pausedAtRef = useRef(null)
  const timerRef = useRef(null)
  const firedRef = useRef(-1)
  const barRef = useRef(null)

  const [paused, setPaused] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(null)

  const remainingMs = useCallback(() => {
    if (deadlineRef.current === null) return null
    const from = pausedAtRef.current ?? performance.now()
    return Math.max(0, deadlineRef.current - from)
  }, [])

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  /** Seek the CSS animation to a position — negative delay is the trick */
  const syncBar = useCallback(() => {
    const el = barRef.current
    if (!el || !durationMs) return
    const elapsed = durationMs - (remainingMs() ?? durationMs)
    el.style.animationDuration = `${durationMs}ms`
    el.style.animationDelay = `-${elapsed}ms`
    el.style.animationPlayState = pausedAtRef.current === null ? 'running' : 'paused'
  }, [durationMs, remainingMs])

  const scheduleRef = useRef(null)
  const schedule = useCallback(() => {
    clearTimer()
    const left = remainingMs()
    if (left === null) return
    timerRef.current = setTimeout(() => {
      // Re-check rather than trust the timer: background throttling can fire
      // this late, and a pause may have happened in between.
      const stillLeft = remainingMs()
      if (stillLeft > 20) { scheduleRef.current?.(); return }
      if (firedRef.current === generation) return
      firedRef.current = generation
      onExpire?.()
    }, left)
  }, [remainingMs, onExpire, generation])

  // Assigned in an effect, not during render. The self-reference exists so the
  // timeout can reschedule itself after a background-throttled late fire.
  useEffect(() => { scheduleRef.current = schedule }, [schedule])

  /* Arm a fresh deadline whenever the question changes */
  useEffect(() => {
    clearTimer()
    pausedAtRef.current = null
    // These values mirror the newly armed external timer. Resetting them in
    // this synchronization effect is intentional; deferring a frame would
    // expose the previous question's clock to assistive technology.
    /* eslint-disable react-hooks/set-state-in-effect */
    setPaused(false)

    if (!durationMs || !running) {
      deadlineRef.current = null
      setSecondsLeft(null)
      if (barRef.current) barRef.current.style.animation = 'none'
      return
    }

    deadlineRef.current = performance.now() + durationMs
    setSecondsLeft(Math.ceil(durationMs / 1000))
    syncBar()
    schedule()
    return clearTimer
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, durationMs, running])

  /* A coarse ticker — only so the three screen-reader announcements can fire.
     Never rendered as digits: a counting-down number competes with the
     question's own digits for the same representational resource. */
  useEffect(() => {
    if (!durationMs || !running) return
    const id = setInterval(() => {
      const left = remainingMs()
      if (left !== null) setSecondsLeft(Math.ceil(left / 1000))
    }, 500)
    return () => clearInterval(id)
  }, [durationMs, running, remainingMs, generation])

  const pause = useCallback(() => {
    if (pausedAtRef.current !== null || deadlineRef.current === null) return
    pausedAtRef.current = performance.now()
    clearTimer()
    setPaused(true)
    syncBar()
  }, [syncBar])

  const resume = useCallback(() => {
    if (pausedAtRef.current === null) return
    deadlineRef.current += performance.now() - pausedAtRef.current
    pausedAtRef.current = null
    setPaused(false)
    syncBar()
    schedule()
  }, [syncBar, schedule])

  /** Add time. No penalty — this is the WCAG 2.2.1 extend mechanism. */
  const extend = useCallback(ms => {
    if (deadlineRef.current === null) return
    deadlineRef.current += ms
    firedRef.current = -1
    syncBar()
    schedule()
  }, [syncBar, schedule])

  const cancel = useCallback(() => {
    clearTimer()
    deadlineRef.current = null
    setSecondsLeft(null)
    if (barRef.current) barRef.current.style.animation = 'none'
  }, [])

  /* Auto-pause when the tablet is locked or the tab is hidden. `pagehide`
     as well as `visibilitychange` — iOS can freeze a home-screen webapp
     without reliably firing the latter. */
  useEffect(() => {
    if (!durationMs || !running) return
    const onHidden = () => {
      if (document.visibilityState === 'hidden') { pause(); onAutoPause?.() }
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onHidden)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onHidden)
    }
  }, [durationMs, running, pause, onAutoPause])

  return { barRef, remainingMs, secondsLeft, paused, pause, resume, extend, cancel }
}

/* ── TIMER LENGTH ──────────────────────────────────────────────
   Derived from the child's own history. A self-referential limit is the
   single biggest anxiety reducer available: it can never signal "you are
   slow", only "beat your own pace".
   ─────────────────────────────────────────────────────────── */

const DEFAULTS = {
  addition:       [8000,  9500, 11000],
  subtraction:    [9000, 10500, 12000],
  multiplication: [9000, 10000, 11000],
  division:      [10000, 11500, 12000],
}

export const TIMER_FLOOR = 4000
export const TIMER_CEIL = 12000

/**
 * @param {number[]} latencies - recent first-attempt latencies, normal mode only
 * @param {string}   op
 * @param {number}   level     - 0..2, coarse difficulty
 * @param {number}   previousT - last session's limit, for the ratchet guard
 * @param {number}   extraTime - persistent multiplier from "give me more time"
 */
export function computeTimeLimit({ latencies = [], op, level = 0, previousT = null, extraTime = 1 }) {
  let T
  if (latencies.length >= 5) {
    const sorted = [...latencies].sort((a, b) => a - b)
    const p60 = sorted[Math.floor(sorted.length * 0.6)]
    T = 1.8 * p60 + 1500          // +1500ms for reading and reaching the button
  } else {
    T = (DEFAULTS[op] ?? DEFAULTS.addition)[Math.min(2, level)]
  }

  T = Math.round(T * extraTime)

  // Ratchet guard: the limit may rise freely but may only fall 10% per
  // session. Without this, every improvement is repaid with less time — the
  // treadmill that makes timed drill aversive.
  if (previousT) T = Math.max(T, previousT * 0.9)

  return Math.round(Math.min(TIMER_CEIL * extraTime, Math.max(TIMER_FLOOR, T)))
}
