import { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react'
import { reducer, initialState, TOTAL_KICKS } from './reducer'
import { load, save, flush, clear, loadSettings, saveSettings } from '../game/storage'
import { buildRoundQueue, questionFor } from '../game/round'
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

  const startRound = useCallback((op, { mode = 'training', timerMs = null } = {}) => {
    const queue = buildRoundQueue(state.mastery, op, { mode })
    if (!queue.length) return
    dispatch({
      type: 'START_ROUND',
      op, mode, queue, timerMs,
      fact: queue[0],
      question: questionFor(state.mastery, queue[0]),
      startedAt: Date.now(),
    })
  }, [state.mastery])

  /** Move to the next kick, building its question from the round queue */
  const advance = useCallback(() => {
    const r = state.round
    if (!r) return
    const nextIdx = r.kickIdx + 1
    const fact = r.queue[nextIdx]
    dispatch({
      type: 'ADVANCE',
      fact,
      question: fact ? questionFor(state.mastery, fact) : null,
      rivalId: rival.id,
      at: Date.now(),
    })
  }, [state.round, state.mastery])

  const answer = useCallback(value => {
    dispatch({ type: 'ANSWER', value, at: Date.now() })
  }, [])

  const resetProgress = useCallback(() => {
    clear()
    dispatch({ type: 'RESET_PROGRESS' })
  }, [])

  const rival = useMemo(
    () => rivalFor(state.settings.character, state.settings.rival),
    [state.settings.character, state.settings.rival],
  )

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
    advance,
    answer,
    resetProgress,
    keeperId,
    rival,
    totalKicks: TOTAL_KICKS,
  }), [state, startRound, advance, answer, resetProgress, keeperId, rival])

  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>
}

export function useGame() {
  const ctx = useContext(GameCtx)
  if (!ctx) throw new Error('useGame must be used inside a GameProvider')
  return ctx
}
