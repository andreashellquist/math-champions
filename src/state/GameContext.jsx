import { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useState } from 'react'
import { reducer, initialState, TOTAL_KICKS } from './reducer'
import { load, save, flush, clear, loadSettings, saveSettings } from '../game/storage'
import { buildRoundQueue, questionFor } from '../game/round'
import { suggestOp } from '../game/mastery'
import { OPS, OP_ORDER } from '../game/config'
import { keeperFor } from '../game/characters'
import { rivalFor } from '../game/rivals'
import { setLocale, DEFAULT_LOCALE } from '../i18n'

const GameCtx = createContext(null)

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => {
      const settings = loadSettings()
      // Swedish is the default, deliberately not the browser's language —
      // this is a Swedish child's game and an English-configured tablet
      // shouldn't change that. An explicit choice in Settings wins.
      setLocale(settings.locale ?? DEFAULT_LOCALE)
      return initialState(load(), settings)
    },
  )

  /* Rounds played since the app was opened. Used only to soften the landing
     after a long sitting — never to cap or block anything.

     State rather than a ref: the ResultScreen renders from it, and a ref would
     not trigger the re-render that reveals the landing. */
  const [sessionRounds, setSessionRounds] = useState(0)

  /* Persistence lives in effects, not inside the reducer. State updaters must
     be pure — React re-invokes them in StrictMode and under concurrent
     rendering, so a setItem inside one can fire twice. */
  useEffect(() => { save(state.mastery) }, [state.mastery])
  useEffect(() => { saveSettings(state.settings) }, [state.settings])

  // Don't lose the last round to a closed tab
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  const startRound = useCallback((op, { mode = 'training', timerMs = null, kicks = TOTAL_KICKS, gateId = null, setId = null } = {}) => {
    const queue = buildRoundQueue(state.mastery, op, { mode, size: kicks, setId })
    if (!queue.length) return
    setSessionRounds(n => n + 1)
    dispatch({
      type: 'START_ROUND',
      op, mode, queue, timerMs, totalKicks: kicks, gateId, setId,
      fact: queue[0],
      question: questionFor(state.mastery, queue[0], { mode }),
      startedAt: Date.now(),
    })
  }, [state.mastery])

  const rival = useMemo(
    () => rivalFor(state.settings.character, state.settings.rival),
    [state.settings.character, state.settings.rival],
  )

  /** Move to the next kick, building its question from the round queue */
  const advance = useCallback(() => {
    const r = state.round
    if (!r) return
    const nextIdx = r.kickIdx + 1
    // Sudden death runs past the end of the composed queue, so top it up
    const fact = r.queue[nextIdx]
      ?? (r.goals >= (r.totalKicks ?? TOTAL_KICKS)
        ? buildRoundQueue(state.mastery, r.op, { mode: r.mode, size: 1 })[0]
        : undefined)
    dispatch({
      type: 'ADVANCE',
      fact,
      question: fact ? questionFor(state.mastery, fact, { mode: r.mode }) : null,
      rivalId: rival.id,
      at: Date.now(),
    })
  }, [state.round, state.mastery, rival])

  /**
   * Just start. One tap, no decision.
   *
   * Always `training` — a one-tap start must never drop a child into a timed or
   * adversarial round they didn't choose. The first round of a session is short,
   * because that round carries the initiation cost.
   */
  const quickStart = useCallback(() => {
    const unlocked = OP_ORDER.filter(op => state.mastery.agg.correct >= OPS[op].unlock)
    const op = suggestOp(state.mastery, unlocked)
    startRound(op, { mode: 'training', kicks: sessionRounds === 0 ? 3 : TOTAL_KICKS })
    return op
  }, [state.mastery, startRound, sessionRounds])

  const answer = useCallback(value => {
    dispatch({
      type: 'ANSWER',
      value,
      at: Date.now(),
      flourishBias: state.round?.mode === 'fixture' ? (rival.flourishBias ?? 0) : 0,
    })
  }, [state.round?.mode, rival])

  const resetProgress = useCallback(() => {
    clear()
    dispatch({ type: 'RESET_PROGRESS' })
  }, [])

  /** In a derby you face your club's rival; otherwise a squad-mate keeps goal */
  const keeperId = useMemo(() => (
    state.round?.mode === 'fixture'
      ? rival.id
      : keeperFor(state.settings.character, state.mastery.agg.rounds)
  ), [state.round?.mode, rival.id, state.settings.character, state.mastery.agg.rounds])

  const value = useMemo(() => ({
    state,
    dispatch,
    startRound,
    quickStart,
    advance,
    answer,
    resetProgress,
    keeperId,
    rival,
    totalKicks: state.round?.totalKicks ?? TOTAL_KICKS,
    sessionRounds,
  }), [state, startRound, quickStart, advance, answer, resetProgress, keeperId, rival, sessionRounds])

  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>
}

export function useGame() {
  const ctx = useContext(GameCtx)
  if (!ctx) throw new Error('useGame must be used inside a GameProvider')
  return ctx
}
