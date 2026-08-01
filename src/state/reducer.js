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
import {
  applyAnswer, emptyState, MIN_REQUEUE_GAP, applyFixtureResult, applyGateResult,
  applyArcadeResult, arcadeTier,
} from '../game/mastery'

export const TOTAL_KICKS = 5
/** Bonus kicks a perfect Shootout can earn. Additive only — never a tiebreak. */
export const SUDDEN_DEATH_MAX = 10

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

/**
 * Resolve a kick as a miss: record it, requeue the fact if there's room, and
 * take the shot. Shared by the acknowledged reveal and by the path that skips
 * the reveal entirely when a requeue can't fire.
 */
function resolveAsMiss(state, r, diagnosis, { requeue }) {
  const mastery = applyAnswer(state.mastery, {
    fact: r.fact, correct: false, latencyMs: 0,
    errorFamily: diagnosis?.family ?? null,
    noDemote: r.mode === 'gate',
  })
  const demotedTo = (r.fact.perFact ? mastery.f : mastery.s)[
    r.fact.perFact ? r.fact.key : r.fact.strand
  ]?.[0] ?? 0
  const trajectory = trajectoryFor(r.kickIdx, r.question.ans)

  let queue = r.queue
  if (requeue) {
    const at = r.kickIdx + MIN_REQUEUE_GAP
    if (at < queue.length && !queue.slice(r.kickIdx + 1).some(f => f.key === r.fact.key)) {
      queue = [...queue]
      queue.splice(at, 0, { ...r.fact, role: 'requeue' })
    }
  }

  return {
    ...state,
    mastery,
    round: {
      ...r,
      queue,
      phase: 'resolving',
      streak: 0,
      brainPoints: r.brainPoints + 1,
      results: [...r.results, 'miss'],
      missedKeys: [...(r.missedKeys ?? []), r.fact.key],
      diagnosis,
      requeued: requeue,
      demotedTo,
      trajectory,
      dive: diveFor(trajectory, false),
    },
  }
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
          gateId: action.gateId ?? null,
          setId: action.setId ?? null,
          arcadeExpiring: false,
          missedKeys: [],
          totalKicks: action.totalKicks ?? TOTAL_KICKS,
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

      /* ── Snabbskott (arcade): a self-contained, much simpler machine ──
         Never touches the adaptive engine — no `applyAnswer`, no rebound, no
         forced-reveal tap. A miss still shows the correct answer briefly
         (error correction, not kindness: the same fact comes round again
         later in this run) but nothing here requires a tap or holds the
         child in place. See `mastery.js`'s Snabbskott section for why this
         mode may never call `applyAnswer`. */
      if (r.mode === 'arcade') {
        const arcadeCorrect = action.value === question.ans
        const trajectory = trajectoryFor(r.kickIdx, question.ans)
        return {
          ...state,
          round: {
            ...r,
            phase: 'resolving',
            chosen: action.value,
            goals: r.goals + (arcadeCorrect ? 1 : 0),
            results: [...r.results, arcadeCorrect ? 'goal' : 'miss'],
            missedKeys: arcadeCorrect ? r.missedKeys : [...r.missedKeys, fact.key],
            arcadeMiss: !arcadeCorrect,
            trajectory,
            dive: diveFor(trajectory, arcadeCorrect),
            deadline: r.deadline,   // the round clock is untouched by any kick
          },
        }
      }

      const correct = action.value === question.ans
      const latencyMs = action.at - r.askedAt
      // `r.timedOut` is set by the TIMEOUT action, which also clears the
      // deadline — so the deadline comparison alone would miss the retake.
      const timedOut = r.timedOut === true ||
        (r.phase === 'asking' && r.deadline !== null && action.at > r.deadline)

      /* ── Attempt 2 was also wrong: show the answer and require a tap ── */
      if (!correct && r.phase === 'rebound') {
        // A frustrated child's next tap is often a fast re-tap on a neighbouring
        // button. Without this, that instantly burns the second attempt.
        if (action.at - (r.reboundAt ?? 0) < 250) return state

        const diagnosis = classifyChoice(action.value, question.hintFact ?? question)

        // The requeue is the actual learning mechanism, and it can only fire
        // with kicks left to insert into. On the last few kicks the reveal
        // holds the child in place and buys nothing — so skip it there.
        const canRequeue = r.kickIdx + MIN_REQUEUE_GAP < r.queue.length
        if (!canRequeue) return resolveAsMiss(state, r, diagnosis, { requeue: false })

        return {
          ...state,
          round: {
            ...r,
            phase: 'reveal',
            chosen: action.value,
            disabled: [...r.disabled, action.value],
            diagnosis,
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
            reboundAt: action.at,
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
          // How long they took decides the *spectacle*, never the outcome. A
          // rival's bias tips which flourish plays — a fingertip graze reads as
          // beating someone good — and cannot affect `scored`.
          flourish: timedOut ? 'retake'
            : latencyMs < (r.timerMs ?? 6000) * 0.5 * (1 - (action.flourishBias ?? 0) * 0.6)
              ? 'screamer' : 'glove',
        },
      }
    }

    /* ── The reveal is done: tapped by the child, or auto-resolved ── */
    case 'ACKNOWLEDGE_REVEAL': {
      const r = state.round
      if (!r || r.phase !== 'reveal') return state
      return resolveAsMiss(state, r, r.diagnosis, { requeue: true })
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
      const total = r.totalKicks ?? TOTAL_KICKS

      /* Sudden death, and only as a reward for a perfect regulation round.
         Never as a tiebreak — a tiebreak invites a failure ending, whereas
         sudden death earned by 5/5 cannot produce one. It ends on the first
         non-goal, and the scoreline only ever goes up. */
      const perfect = r.goals >= total && r.results.length >= total
      const enteringSuddenDeath =
        !r.suddenDeath && nextIdx >= total && r.mode === 'shootout' && perfect

      const lastWasGoal = r.results.at(-1) !== 'miss'
      const suddenDeathOver =
        r.suddenDeath && (!lastWasGoal || r.results.length >= total + SUDDEN_DEATH_MAX)

      // The clock — not the queue — ends an arcade run. `arcadeExpiring` is set
      // by ARCADE_EXPIRE when the deadline fires; the item already in flight is
      // always allowed to finish first, so this is only ever checked here, one
      // kick later, never mid-answer.
      const arcadeOver = r.mode === 'arcade' && r.arcadeExpiring

      const done = arcadeOver || (nextIdx >= total
        ? (r.suddenDeath ? suddenDeathOver : !enteringSuddenDeath)
        : false)

      if (done || !action.question) {
        // Arcade must not touch `agg` at all — see mastery.js's Snabbskott
        // section for why (it would leak into the Shootout clock and gate
        // cooldown). Every other mode increments the lifetime round count.
        let mastery = r.mode === 'arcade'
          ? state.mastery
          : { ...state.mastery, agg: { ...state.mastery.agg, rounds: state.mastery.agg.rounds + 1 } }
        let tieWon = null, seasonWon = null, arcadeTierResult = null

        // A gate certifies and nothing more. It cannot withhold anything, so
        // there is no branch here that changes what is available.
        if (r.mode === 'gate' && r.gateId) {
          mastery = applyGateResult(mastery, {
            gateId: r.gateId,
            score: r.goals,
            missedKeys: r.missedKeys ?? [],
            at: action.at ?? Date.now(),
          })
        }

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

        // A monotone personal best is hit less and less often the more a
        // child plays — computed before the write, so "was THIS run a best"
        // can still be answered after the record moves.
        if (r.mode === 'arcade' && r.setId) {
          arcadeTierResult = arcadeTier(mastery, r.setId, r.goals)
          mastery = applyArcadeResult(mastery, { setId: r.setId, score: r.goals, at: action.at ?? Date.now() })
        }

        return {
          ...state,
          screen: 'result',
          mastery,
          round: { ...r, phase: 'done', tieWon, seasonWon, arcadeTierResult },
        }
      }

      return {
        ...state,
        round: {
          ...r,
          suddenDeath: r.suddenDeath || enteringSuddenDeath,
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
          arcadeMiss: false,
          askedAt: action.at,
          // Arcade runs one clock for the whole round, armed once at
          // START_ROUND — recomputing it here would reset the countdown on
          // every single kick instead of letting it run down.
          deadline: r.mode === 'arcade'
            ? r.deadline
            : (r.clockOff || !r.timerMs ? null : action.at + r.timerMs),
        },
      }
    }

    /**
     * The Snabbskott clock ran out.
     *
     * Does not end anything by itself — it only marks the round. Whatever item
     * was already showing is still answerable; the score only finalises the
     * next time ADVANCE runs, so the child always gets to finish the ball that
     * was in flight when the whistle went rather than having it cut away
     * under them.
     */
    case 'ARCADE_EXPIRE': {
      const r = state.round
      if (!r || r.mode !== 'arcade' || r.arcadeExpiring) return state
      return { ...state, round: { ...r, arcadeExpiring: true } }
    }

    /**
     * The child chose to stop mid-round.
     *
     * A child who cannot leave will eventually leave by closing the app, and
     * that exit teaches nothing and records nothing. Deliberately does NOT call
     * applyFixtureResult: a round the child ended must never increment
     * `played`, which is the closest thing to a loss tally in the whole model.
     *
     * Arcade is stricter still: a bailed-early run is not a real attempt at the
     * score, so it skips both `agg.rounds` and `applyArcadeResult` entirely —
     * it must never appear in the run-history strip or be eligible to set a
     * personal best.
     */
    case 'END_ROUND': {
      const r = state.round
      if (!r) return state
      if (r.mode === 'arcade') {
        return { ...state, screen: 'result', round: { ...r, phase: 'done', stoppedEarly: true } }
      }
      return {
        ...state,
        screen: 'result',
        mastery: { ...state.mastery, agg: { ...state.mastery.agg, rounds: state.mastery.agg.rounds + 1 } },
        round: { ...r, phase: 'done', stoppedEarly: true },
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
