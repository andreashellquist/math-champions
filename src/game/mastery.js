/**
 * Mastery model — a 6-box Leitner system with a latency gate.
 *
 * Chosen over a continuous ability estimate (ELO/IRT) for three reasons:
 * five items per round is far too little data to fit a continuous parameter
 * without wild swings; a box index is one small integer per fact, which is
 * what keeps localStorage flat forever; and "12 facts are in the last box"
 * is something you can actually show a parent.
 *
 * Latency is deliberately *not* a primary signal — on a tablet it's polluted
 * by reading time and by scanning the options. It's used only as a promotion
 * gate, which is the one place it's robust: fluency means retrieval, not
 * reconstruction, so a slow-but-correct answer doesn't advance the box.
 */
import {
  STRANDS_BY_OP, STRAND_BY_ID, masteryKey, sampleStrandFact,
  inverseMultiplicationKey, factKey,
} from './facts'
import { rng as defaultRng } from './rng'

export const STATE_VERSION = 3

/** Items (not seconds) before a fact is due again, per box */
const BOX_GAP = [0, 3, 8, 20, 45, 100]
/** A correct answer slower than this doesn't earn a promotion */
const LAT_GATE_MS = [6000, 6000, 4500, 4500, 3000, 3000]

export const MAX_BOX = 5
export const MASTERED_BOX = 4
/** Re-asking immediately measures echoic memory, not learning */
export const MIN_REQUEUE_GAP = 3
/** How far along the ladder a brand-new fact may be drawn from */
const NEW_FACT_WINDOW = 8
/** Recent-outcome window used by the difficulty controller */
const WINDOW = 20
/** Capped ring buffer of error families — the only thing that could grow unbounded */
const ERROR_MEMORY = 20

export const OP_KEYS = ['addition', 'subtraction', 'multiplication', 'division']

export function emptyState() {
  return {
    v: STATE_VERSION,
    n: 0,                                                   // items answered, ever
    f: {},                                                  // factKey  → [box, dueAt, streak, misses]
    s: {},                                                  // strandId → [box, dueAt, streak, misses]
    e: [],                                                  // recent error families
    r: Object.fromEntries(OP_KEYS.map(o => [o, []])),       // recent outcomes per op
    agg: { correct: 0, goals: 0, seen: 0, rounds: 0, bestStreak: 0 },
    rivalry: emptyRivalry(),
  }
}

/* ── SEASON ────────────────────────────────────────────────────
   The rivalry is the progression frame, not a parallel system. A tie is
   first-to-three round-wins; clearing a rival clears a competition; clearing
   all four completes the season, and season N+1 recomputes its difficulty from
   current mastery — so it never ends and never gets easier.

   A lost round never removes progress. Ties have a not-yet state, never a lost
   state: no relegation, no decrementing counters, no expiry.
   ─────────────────────────────────────────────────────────── */

/** Round-wins needed to take a tie */
export const TIE_TARGET = 3
/** A round-win reuses the existing three-star band */
export const ROUND_WIN_GOALS = 4

/** The four competitions, in order. Visible from session one so the arc is legible. */
export const COMPETITIONS = [
  { id: 'cup',    op: 'addition',       rival: 'red_devil' },
  { id: 'league', op: 'subtraction',    rival: 'white_wall' },
  { id: 'europe', op: 'multiplication', rival: 'blaugrana' },
  { id: 'final',  op: 'division',       rival: 'gunner' },
]

export function emptyRivalry() {
  return {
    season: 1,
    stage: 0,             // index into COMPETITIONS; === length ⇒ season complete
    wins: {},             // rivalId → round-wins in the active tie (0..TIE_TARGET)
    h2h: {},              // rivalId → [won, played] lifetime
    cups: [],             // [{ season, at }]
  }
}

/** The competition currently in play, or null once the season is complete */
export function currentCompetition(state) {
  return COMPETITIONS[state.rivalry?.stage ?? 0] ?? null
}

export const seasonComplete = state => (state.rivalry?.stage ?? 0) >= COMPETITIONS.length

/**
 * Record a completed fixture.
 *
 * Only wins advance anything. A round that fell short increments `played` and
 * nothing else — there is no path here that reduces a number the child has
 * already earned.
 */
export function applyFixtureResult(state, { rivalId, goals, at = Date.now() }) {
  const riv = state.rivalry ?? emptyRivalry()
  const won = goals >= ROUND_WIN_GOALS
  const [w, p] = riv.h2h[rivalId] ?? [0, 0]

  const wins = { ...riv.wins, [rivalId]: Math.min(TIE_TARGET, (riv.wins[rivalId] ?? 0) + (won ? 1 : 0)) }
  const h2h = { ...riv.h2h, [rivalId]: [w + (won ? 1 : 0), p + 1] }

  const tieTaken = wins[rivalId] >= TIE_TARGET
  const isActive = COMPETITIONS[riv.stage]?.rival === rivalId
  const stage = tieTaken && isActive ? riv.stage + 1 : riv.stage
  const finishedSeason = stage >= COMPETITIONS.length && riv.stage < COMPETITIONS.length

  return {
    ...state,
    rivalry: {
      ...riv,
      wins,
      h2h,
      // Starting a new season clears the tie counters but never the ledger
      stage: finishedSeason ? 0 : stage,
      season: finishedSeason ? riv.season + 1 : riv.season,
      cups: finishedSeason ? [...riv.cups, { season: riv.season, at }] : riv.cups,
      ...(finishedSeason ? { wins: {} } : {}),
    },
    justWonTie: tieTaken && isActive ? rivalId : null,
    justWonSeason: finishedSeason ? riv.season : null,
  }
}

export const tieWins = (state, rivalId) => state.rivalry?.wins?.[rivalId] ?? 0
export const headToHead = (state, rivalId) => state.rivalry?.h2h?.[rivalId] ?? [0, 0]

const EMPTY_REC = [0, 0, 0, 0]

export function recordFor(state, fact) {
  const key = masteryKey(fact)
  const bucket = fact.perFact ? state.f : state.s
  return bucket[key] ?? EMPTY_REC
}

export const boxOf = (state, fact) => recordFor(state, fact)[0]
export const isSeen = (state, fact) =>
  (fact.perFact ? state.f : state.s)[masteryKey(fact)] !== undefined

/* ── RECORDING AN ANSWER ───────────────────────────────────── */

/**
 * @param {object} state
 * @param {object} answer - { fact, correct, latencyMs, errorFamily, secondAttempt }
 * @returns {object} new state
 */
export function applyAnswer(state, { fact, correct, latencyMs = 0, errorFamily = null, secondAttempt = false }) {
  const key = fact.perFact ? masteryKey(fact) : fact.strand
  const bucketName = fact.perFact ? 'f' : 's'
  const [box, , streak, misses] = state[bucketName][key] ?? EMPTY_REC

  const n = state.n + 1
  let next

  if (correct) {
    // A rebound (second-attempt) correct answer is real learning, but it is
    // not evidence of retrieval — hold the box, don't promote.
    const promote = !secondAttempt && latencyMs <= LAT_GATE_MS[box]
    const newBox = promote ? Math.min(MAX_BOX, box + 1) : box
    next = [newBox, n + BOX_GAP[newBox], promote ? streak + 1 : 0, misses]
  } else {
    const newBox = Math.max(0, box - 2)
    next = [newBox, n + MIN_REQUEUE_GAP, 0, misses + 1]
  }

  // First-attempt only. A rebound is real learning but it is not a first-try
  // correct, and this series feeds the Shootout gate, strand opening, new-fact
  // introduction, and a parent-facing "right on the first try" figure.
  const recent = [...(state.r[fact.op] ?? []), correct && !secondAttempt ? 1 : 0].slice(-WINDOW)
  const errors = errorFamily ? [...state.e, errorFamily].slice(-ERROR_MEMORY) : state.e

  return {
    ...state,
    n,
    [bucketName]: { ...state[bucketName], [key]: next },
    r: { ...state.r, [fact.op]: recent },
    e: errors,
    agg: {
      ...state.agg,
      seen: state.agg.seen + 1,
      correct: state.agg.correct + (correct && !secondAttempt ? 1 : 0),
    },
  }
}

/* ── STRAND PROGRESSION ────────────────────────────────────── */

/** How far through a strand the child is, 0–1 */
export function strandProgress(state, strand) {
  if (strand.perFact) {
    if (!strand.facts.length) return 1
    const solid = strand.facts.filter(f => (state.f[f.key]?.[0] ?? 0) >= 3).length
    return solid / strand.facts.length
  }
  const box = state.s[strand.id]?.[0] ?? 0
  return Math.min(1, box / 3)
}

const OPEN_THRESHOLD = 0.7
const OPEN_THRESHOLD_FAST = 0.4

/**
 * Which strands the child can currently be served.
 *
 * Two at a time — the frontier plus the one behind it, so review keeps
 * happening while new ground is broken.
 *
 * The bar to move on drops for a child who is getting nearly everything
 * right. Without this, a competent ten-year-old would need roughly sixty
 * correct answers to escape "sums within 10", which is how a practice app
 * teaches a child that it has nothing to offer them.
 */
export function openStrands(state, op) {
  const strands = STRANDS_BY_OP[op] ?? []
  const acc = recentAccuracy(state, op, 10)
  const threshold = acc !== null && acc >= 0.9 ? OPEN_THRESHOLD_FAST : OPEN_THRESHOLD

  let frontier = 0
  while (frontier < strands.length - 1 && strandProgress(state, strands[frontier]) >= threshold) {
    frontier++
  }
  return frontier === 0 ? [strands[0]] : [strands[frontier - 1], strands[frontier]]
}

/* ── DIFFICULTY CONTROLLER ─────────────────────────────────────
   Target the desirable-difficulty sweet spot — roughly 85% observed
   accuracy. Multiple choice inflates this: with k options, an observed
   rate of p maps to true knowledge of (p·k − 1)/(k − 1). So the target
   band has to be corrected for how many options are on screen.
   ─────────────────────────────────────────────────────────── */

export const TARGET_BAND = { 3: [0.85, 0.88], 4: [0.83, 0.86], free: [0.80, 0.85] }

export function recentAccuracy(state, op, window = WINDOW) {
  const r = (state.r[op] ?? []).slice(-window)
  if (!r.length) return null
  return r.reduce((a, b) => a + b, 0) / r.length
}

/** Should a brand-new fact be introduced right now? */
export function newFactGateOpen(state, op) {
  const recent5 = recentAccuracy(state, op, 5)
  if (recent5 !== null && recent5 < 0.6) return false

  const strands = openStrands(state, op)
  const active = strands
    .filter(s => s.perFact)
    .flatMap(s => s.facts)
    .filter(f => state.f[f.key] !== undefined && state.f[f.key][0] <= 2)
  return active.length < 8
}

/* ── FACT SELECTION ────────────────────────────────────────── */

/** Every fact currently servable for an op (sampled strands contribute one fresh draw) */
function candidatePool(state, op, r) {
  return openStrands(state, op).flatMap(s =>
    s.perFact ? s.facts : [sampleStrandFact(s, r)]
  )
}

/**
 * Division rests on multiplication. Serving `56 ÷ 8` to a child who doesn't
 * yet know `7 × 8` teaches nothing but frustration.
 */
function divisionReady(state, fact) {
  if (fact.op !== 'division') return true
  const invKey = inverseMultiplicationKey(fact)
  return (state.f[invKey]?.[0] ?? 0) >= 2
}

const ROLE_ORDER = ['warmup', 'review', 'struggle', 'review', 'new']

/**
 * Pick one fact for a given role.
 * Degrades gracefully — a brand-new player has nothing to review, so review
 * falls through to new rather than returning nothing.
 */
export function selectFact(state, op, { role, exclude = new Set(), rng: r = defaultRng } = {}) {
  const all = candidatePool(state, op, r).filter(f => !exclude.has(f.key))
  const ready = all.filter(f => divisionReady(state, f))

  // The inverse-multiplication gate sequences division, it must not block it.
  // Applied strictly, a child who picks Division before touching times tables
  // gets an empty round.
  const pool = ready.length ? ready : all

  if (!pool.length) return null

  const seen = pool.filter(f => isSeen(state, f))
  const due  = seen.filter(f => recordFor(state, f)[1] <= state.n)

  const byBoxDesc = arr => [...arr].sort((x, y) => boxOf(state, y) - boxOf(state, x))
  const byBoxAsc  = arr => [...arr].sort((x, y) => boxOf(state, x) - boxOf(state, y))
  const byDue     = arr => [...arr].sort((x, y) => recordFor(state, x)[1] - recordFor(state, y)[1])

  switch (role) {
    case 'warmup':
      // Open with something they know — starting on a win is worth a lot
      return byBoxDesc(seen)[0] ?? r.pick(pool)

    case 'review': {
      const pick = byDue(due.filter(f => boxOf(state, f) >= 1))[0]
      return pick ?? selectFact(state, op, { role: 'struggle', exclude, rng: r })
    }

    case 'struggle': {
      const pick = byBoxAsc(due.length ? due : seen)[0]
      return pick ?? selectFact(state, op, { role: 'new', exclude, rng: r })
    }

    case 'new': {
      if (newFactGateOpen(state, op)) {
        // Prefer the frontier strand. Otherwise a child who has earned their
        // way onto harder material keeps being fed the leftover unseen facts
        // of the strand they already outgrew — there are ~30 of them, so they
        // would never actually reach the new ground they unlocked.
        const frontier = openStrands(state, op).at(-1)?.id
        const unseen = pool.filter(f => !isSeen(state, f))
        const fromFrontier = unseen.filter(f => f.strand === frontier)
        const window = (fromFrontier.length ? fromFrontier : unseen).slice(0, NEW_FACT_WINDOW)
        // Draw from a window rather than always the very next fact, or a
        // fresh profile's opening round is `1+1, 1+2, 1+3…` — technically
        // correct progression, and deadly dull.
        if (window.length) return r.pick(window)
      }
      return byDue(due)[0] ?? byBoxAsc(seen)[0] ?? r.pick(pool)
    }

    default:
      return r.pick(pool)
  }
}

/**
 * Compose a full round.
 *
 * Fixed shape: a warm-up, two reviews, one the child is struggling with, and
 * one new-or-stretch. No fact repeats inside a round.
 */
export function composeRound(state, op, { size = 5, rng: r = defaultRng } = {}) {
  const chosen = []
  const used = new Set()

  for (let i = 0; i < size; i++) {
    const role = ROLE_ORDER[i % ROLE_ORDER.length]
    const fact = selectFact(state, op, { role, exclude: used, rng: r })
    if (!fact) break
    used.add(fact.key)
    chosen.push({ ...fact, role })
  }
  return chosen
}

/**
 * A fixture against a rival.
 *
 * The rival picks the questions — your lowest-box, most-missed facts — but
 * never the outcome. This is the spaced-repetition scheduler wearing a
 * costume: narrative resistance goes up, the hardest content gets practised,
 * and a correct answer still scores every single time.
 *
 * His selection rule is fixed and published (`he draws from your two lowest
 * boxes`), never adaptive. A child can see exactly why he got harder — they
 * mastered the easy ones — and exactly how to beat him.
 */
export function composeFixture(state, op, { size = 5, rng: r = defaultRng } = {}) {
  const pool = candidatePool(state, op, r).filter(f => divisionReady(state, f))
  if (!pool.length) return composeRound(state, op, { size, rng: r })

  const seen = pool.filter(f => isSeen(state, f))
  const ranked = [...seen].sort((x, y) => {
    const bx = boxOf(state, x), by = boxOf(state, y)
    if (bx !== by) return bx - by                                   // lowest box first
    return recordFor(state, y)[3] - recordFor(state, x)[3]          // then most-missed
  })

  const chosen = []
  const used = new Set()
  for (const f of ranked) {
    if (chosen.length >= size) break
    if (used.has(f.key)) continue
    used.add(f.key)
    chosen.push({ ...f, role: 'fixture' })
  }

  // A child who hasn't met enough facts yet still gets a full fixture
  for (const f of pool) {
    if (chosen.length >= size) break
    if (used.has(f.key)) continue
    used.add(f.key)
    chosen.push({ ...f, role: 'fixture' })
  }
  return chosen.slice(0, size)
}

/* ── PRESENTATION POLICY ───────────────────────────────────── */

/**
 * Three options while a fact is being learned, four once it's being assessed.
 *
 * The usual argument for three options assumes the extra distractors are
 * junk. Once every distractor is a misconception probe the fourth becomes
 * functional, and the guess floor starts to matter: a pure guesser scores
 * 1.67/5 on three options but 1.25/5 on four.
 */
export function optionCountFor(box) {
  return box >= 3 ? 4 : 3
}

/* ── DERIVED STATS (for the trophy / parent view) ──────────── */

export function masteredCount(state) {
  return Object.values(state.f).filter(rec => rec[0] >= MASTERED_BOX).length
}

/** Facts the child is working on — most-missed first */
export function workingOn(state, limit = 5) {
  return Object.entries(state.f)
    .filter(([, rec]) => rec[3] > 0 && rec[0] < MASTERED_BOX)
    .sort((a, b) => b[1][3] - a[1][3])
    .slice(0, limit)
    .map(([key, rec]) => ({ key, misses: rec[3], box: rec[0] }))
}

/** The error the child makes most often right now, or null */
export function dominantErrorFamily(state) {
  const counts = state.e.reduce((m, f) => m.set(f, (m.get(f) ?? 0) + 1), new Map())
  let best = null
  for (const [family, n] of counts) {
    if (n >= 2 && (!best || n > best.n)) best = { family, n }
  }
  return best?.family ?? null
}

export function opProgress(state, op) {
  const strands = STRANDS_BY_OP[op] ?? []
  if (!strands.length) return 0
  return strands.reduce((sum, s) => sum + strandProgress(state, s), 0) / strands.length
}

/** Human-readable label for a fact key — `m7.8` → `7 × 8` */
export function labelForKey(key) {
  const [opChar, rest] = [key[0], key.slice(1)]
  const [a, b] = rest.split('.').map(Number)
  const sym = { a: '+', s: '−', m: '×', d: '÷' }[opChar]
  if (!sym) return STRAND_BY_ID[key]?.label ?? key
  return `${a} ${sym} ${b}`
}

export { factKey }
