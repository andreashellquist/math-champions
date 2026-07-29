/**
 * The whole game as one pure reducer.
 *
 * The single most important thing here is `round.phase`. The old GameScreen
 * kept six independent pieces of state (`locked`, `ballAnim`, `celebrating`,
 * `keeperMood`, `feedback`, `ansStates`) that all had to be updated in
 * lockstep, and guarded input on `locked` — a *state* value, which is async.
 * Two taps dispatched before React committed both saw `locked === false`,
 * scored twice and queued two `nextKick` timers.
 *
 * Here, input is guarded on the phase inside the reducer, where dispatches are
 * serialised. A second ANSWER in the same phase is structurally a no-op.
 */
import { OPS, OP_ORDER, opName } from '../game/config'
import { t } from '../i18n'
import { getHint } from '../game/hints'
import { classifyChoice } from '../game/distractors'
import { applyAnswer, emptyState, MIN_REQUEUE_GAP, applyFixtureResult } from '../game/mastery'

export const TOTAL_KICKS = 5

/** Ball trajectories — chosen deterministically so the reducer stays pure */
export const TRAJECTORIES = ['top-left', 'top-right', 'bottom-left', 'daisy-cutter']

export function initialState(mastery = emptyState(), settings = {}) {
  return {
    screen: 'menu',
    selectedOp: 'addition',
    settings: { sound: true, character: 'haaland', keeper: 'yamal', extraTime: 1, ...settings },
    mastery,
    round: null,
    toast: null,
  }
}

/* ── HELPERS ───────────────────────────────────────────────── */

const trajectoryFor = (kickIdx, ans) => TRAJECTORIES[(kickIdx * 3 + ans) % TRAJECTORIES.length]

/** On a save the keeper goes the right way; on a goal he goes the wrong way. */
function diveFor(trajectory, scored) {
  const side = trajectory.endsWith('right') ? 'right' : 'left'
  if (scored) return side === 'left' ? 'right' : 'left'
  return side
}

function newlyUnlocked(before, after) {
  return OP_ORDER.filter(op => {
    const need = OPS[op].unlock
    // A crossing test, not equality — a single missed increment used to skip
    // the unlock permanently.
    return need > 0 && before < need && after >= need
  })
}

/* ── REDUCER ───────────────────────────────────────────────── */

export function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, mastery: action.mastery ?? state.mastery,
               settings: { ...state.settings, ...action.settings } }

    case 'NAVIGATE':
      return { ...state, screen: action.screen, round: action.screen === 'game' ? state.round : null }

    case 'SELECT_OP':
      return { ...state, selectedOp: action.op }

    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } }

    case 'SHOW_TOAST':
      return { ...state, toast: action.message }

    case 'HIDE_TOAST':
      return { ...state, toast: null }

    case 'START_ROUND':
      return {
        ...state,
        screen: 'game',
        selectedOp: action.op,
        round: {
          op: action.op,
          mode: action.mode ?? 'training',
          queue: action.queue ?? [],
          kickIdx: 0,
          results: [],
          goals: 0,
          streak: 0,
          brainPoints: 0,
          timeouts: 0,
          question: action.question,
          fact: action.fact,
          phase: 'asking',
          attempt: 1,
          chosen: null,
          disabled: [],
          hint: null,
          diagnosis: null,
          trajectory: null,
          dive: 'none',
          timerMs: action.timerMs ?? null,
          deadline: action.timerMs ? action.startedAt + action.timerMs : null,
          clockOff: false,
          askedAt: action.startedAt,
          suddenDeath: false,
        },
      }

    case 'ANSWER': {
      const r = state.round
      // The guard that kills the double-tap. A second tap in any phase other
      // than one that accepts input simply does nothing.
      if (!r || (r.phase !== 'asking' && r.phase !== 'rebound' && r.phase !== 'reveal')) return state
      if (r.disabled.includes(action.value)) return state

      const { question, fact } = r
      const correct = action.value === question.ans
      const latencyMs = action.at - r.askedAt
      // `r.timedOut` is set by the TIMEOUT action, which also clears the
      // deadline — so the deadline comparison alone would miss the retake.
      const timedOut = r.timedOut === true ||
        (r.phase === 'asking' && r.deadline !== null && action.at > r.deadline)

      /* ── Attempt 2 was also wrong: show the answer and require a tap ── */
      if (!correct && r.phase === 'rebound') {
        return {
          ...state,
          round: {
            ...r,
            phase: 'reveal',
            chosen: action.value,
            disabled: [...r.disabled, action.value],
            diagnosis: classifyChoice(action.value, question.hintFact ?? question),
          },
        }
      }

      /* ── First miss: parry. Ball stays live, hint appears, no clock. ── */
      if (!correct && r.phase === 'asking') {
        return {
          ...state,
          round: {
            ...r,
            phase: 'rebound',
            attempt: 2,
            chosen: action.value,
            disabled: [action.value],
            hint: getHint(question.hintFact ?? question),
            diagnosis: classifyChoice(action.value, question.hintFact ?? question),
            deadline: null,          // the rebound is never timed
            streak: 0,
          },
        }
      }

      /* ── Correct ── */
      const firstTry = r.phase === 'asking'
      const scored = true
      const trajectory = trajectoryFor(r.kickIdx, question.ans)

      const mastery = applyAnswer(state.mastery, {
        fact,
        correct: true,
        latencyMs,
        // A rebound is real learning but not retrieval, so it must not
        // promote. Nor may a post-whistle answer: running out of time is
        // evidence about the clock, not about what the child knows — the
        // Shootout clock may only ever promote, never demote or inflate.
        secondAttempt: !firstTry || timedOut,
      })

      const beforeCorrect = state.mastery.agg.correct
      const unlocks = firstTry && !timedOut ? newlyUnlocked(beforeCorrect, mastery.agg.correct) : []

      const outcome = timedOut ? 'timeout-goal' : firstTry ? 'goal' : 'rebound'
      const streak = firstTry && !timedOut ? r.streak + 1 : 0

      return {
        ...state,
        mastery: {
          ...mastery,
          agg: {
            ...mastery.agg,
            goals: mastery.agg.goals + 1,
            bestStreak: Math.max(mastery.agg.bestStreak, streak),
          },
        },
        toast: unlocks.length
          ? t('unlock', { icon: OPS[unlocks[0]].icon, name: opName(unlocks[0]) })
          : state.toast,
        round: {
          ...r,
          phase: 'resolving',
          chosen: action.value,
          goals: r.goals + 1,
          streak,
          brainPoints: r.brainPoints + (firstTry ? 0 : 1),
          results: [...r.results, outcome],
          trajectory,
          dive: diveFor(trajectory, scored),
          deadline: null,
          // How long they took decides the *spectacle*, never the outcome
          flourish: timedOut ? 'retake' : latencyMs < (r.timerMs ?? 6000) * 0.5 ? 'screamer' : 'glove',
        },
      }
    }

    /* ── The child tapped the revealed correct answer ── */
    case 'ACKNOWLEDGE_REVEAL': {
      const r = state.round
      if (!r || r.phase !== 'reveal') return state

      const mastery = applyAnswer(state.mastery, {
        fact: r.fact,
        correct: false,
        latencyMs: 0,
        errorFamily: r.diagnosis?.family ?? null,
      })
      const trajectory = trajectoryFor(r.kickIdx, r.question.ans)

      // Bring the missed fact back later in the round. Re-asking it
      // immediately would measure echoic memory rather than learning, so it
      // goes two kicks downstream, not the next one.
      const requeueAt = r.kickIdx + MIN_REQUEUE_GAP
      const queue = [...r.queue]
      if (requeueAt < queue.length && !queue.slice(r.kickIdx + 1).some(f => f.key === r.fact.key)) {
        queue.splice(requeueAt, 0, { ...r.fact, role: 'requeue' })
      }

      return {
        ...state,
        mastery,
        round: {
          ...r,
          queue,
          phase: 'resolving',
          goals: r.goals,
          streak: 0,
          brainPoints: r.brainPoints + 1,
          results: [...r.results, 'miss'],
          trajectory,
          dive: diveFor(trajectory, false),
        },
      }
    }

    /* ── Shootout: the whistle went before an answer ── */
    case 'TIMEOUT': {
      const r = state.round
      if (!r || r.phase !== 'asking' || r.deadline === null) return state
      // A timeout is not evidence of not knowing — the kick is still taken,
      // just without a clock, and mastery is untouched.
      return {
        ...state,
        round: { ...r, phase: 'asking', deadline: null, timedOut: true, timeouts: r.timeouts + 1 },
      }
    }

    case 'CLOCK_OFF': {
      const r = state.round
      if (!r) return state
      return { ...state, round: { ...r, deadline: null, clockOff: true, timerMs: null } }
    }

    case 'CELEBRATE': {
      const r = state.round
      if (!r || r.phase !== 'resolving') return state
      return { ...state, round: { ...r, phase: 'celebrating' } }
    }

    /* ── Next kick, or end of round ── */
    case 'ADVANCE': {
      const r = state.round
      if (!r) return state
      const nextIdx = r.kickIdx + 1
      const done = nextIdx >= (r.totalKicks ?? TOTAL_KICKS) && !r.suddenDeath

      if (done || !action.question) {
        let mastery = { ...state.mastery, agg: { ...state.mastery.agg, rounds: state.mastery.agg.rounds + 1 } }
        let tieWon = null, seasonWon = null

        // Only a derby counts toward a tie. Falling short increments `played`
        // and nothing else — nothing here can reduce what the child has earned.
        if (r.mode === 'fixture' && action.rivalId) {
          const next = applyFixtureResult(mastery, {
            rivalId: action.rivalId, goals: r.goals, at: action.at ?? Date.now(),
          })
          tieWon = next.justWonTie
          seasonWon = next.justWonSeason
          mastery = { ...next, justWonTie: undefined, justWonSeason: undefined }
        }

        return {
          ...state,
          screen: 'result',
          mastery,
          round: { ...r, phase: 'done', tieWon, seasonWon },
        }
      }

      return {
        ...state,
        round: {
          ...r,
          kickIdx: nextIdx,
          question: action.question,
          fact: action.fact,
          phase: 'asking',
          attempt: 1,
          chosen: null,
          disabled: [],
          hint: null,
          diagnosis: null,
          trajectory: null,
          dive: 'none',
          timedOut: false,
          flourish: null,
          askedAt: action.at,
          deadline: r.clockOff || !r.timerMs ? null : action.at + r.timerMs,
        },
      }
    }

    case 'SHOW_HINT': {
      const r = state.round
      if (!r || r.hint) return state
      // Asking for the trick is autonomy-supportive — never penalised, but
      // it does mean this item is no longer clean retrieval evidence.
      return { ...state, round: { ...r, hint: getHint(r.question.hintFact ?? r.question), hintRequested: true } }
    }

    case 'RESET_PROGRESS':
      return { ...initialState(emptyState(), state.settings), screen: 'menu' }

    default:
      return state
  }
}
